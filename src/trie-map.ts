export interface TrieMapOptions {
    caseSensitive: boolean;
}

/** Since this is used for tokenizing, support keys and search strings as segments of a longer string. */
export interface TrieMapKeyPointer {
    data: string;
    pos: number;
    posMax: number;
}

export class TrieMap<T> implements Iterable<[string, T]> {
    private root: TrieMapNode<T> | null = null;
    private caseSensitive: boolean;
    private charsEqual: (a: string, b: string) => boolean;

    constructor(iterable?: Iterable<[string, T]>, options?: TrieMapOptions) {
        this.caseSensitive = options?.caseSensitive ?? false;
        // if case is insensitive, we will set keys to lower automatically,
        // so we only need to alter the `b` parameter below.
        this.charsEqual = options?.caseSensitive
            ? (a, b) => a === '*' || a === b
            : (a, b) => a === '*' || a === b.toLowerCase();
        for (const [key, value] of iterable ?? []) {
            this.set(key, value);
        }
    }

    get(key: TrieMapKeyPointer | string): T | null {
        const keyPointer = this.keyAsPointer(key);
        const result = this.findClosestMatchingNode(keyPointer);
        return result?.match === 'full' ? result.node.value : null;
    }

    findByLongestPrefix(search: TrieMapKeyPointer | string, wordBoundaryOnly = true): [string, T] | null {
        const searchPointer = this.keyAsPointer(search);
        const result = this.findClosestMatchingNode(searchPointer);
        if (!result || result.match === 'none' || result.node.value === null) {
            return null;
        } else if (result.match !== 'full' && result.match.index !== result.node.key.length) {
            let node: TrieMapNode<T> | null = result.node;
            while (node) {
                result.fullKey = result.fullKey.slice(0, -node.key.length);
                node = node.parent;
                if (node?.value) {
                    break;
                }
            }
            if (!node) {
                return null;
            }
            result.node = node;
        }

        if (wordBoundaryOnly) {
            const pos = searchPointer.pos;
            const keyLen = result.fullKey.length;
            if (pos + keyLen < searchPointer.posMax && isNonBoundary(searchPointer.data, pos + keyLen)) {
                searchPointer.posMax = pos + keyLen - 1;
                return this.findByLongestPrefix(searchPointer, true);
            }
        }

        return result.node.value ? [result.fullKey, result.node.value] : null;
    }

    *iterate(prefix?: TrieMapKeyPointer | string, order: 'bfs' | 'dfs' = 'bfs'): Generator<[string, T]> {
        if (!this.root) {
            return;
        }
        const result = prefix
            ? this.findClosestMatchingNode(this.keyAsPointer(prefix))
            : { node: this.root, fullKey: this.root.key };
        if (!result?.node) {
            return;
        }
        const q: [TrieMapNode<T>, string][] = [[result.node, result.fullKey]];
        while (q.length) {
            const [node, fullKey] = order === 'bfs' ? q.shift()! : q.pop()!;
            if (node.value) {
                yield [fullKey, node.value];
            }
            q.push(...node.children.map<[TrieMapNode<T>, string]>(child => [child, fullKey + child.key]));
        }
    }

    set(key: TrieMapKeyPointer | string, value: T): void {
        let keyString = this.keyAsString(key);
        if (!this.caseSensitive) {
            keyString = keyString.toLowerCase();
        }
        if (this.root === null) {
            this.root = { key: keyString, value, parent: null, children: [] };
            return;
        }

        const keyPointer = this.keyAsPointer(keyString);
        const result = this.findClosestMatchingNode(keyPointer);
        if (!result?.match) {
            // split the root
            const node: TrieMapNode<T> = {
                key: '',
                value: null,
                parent: null,
                children: [this.root],
            };
            this.root.parent = node;
            this.root = node;
            this.root.children.push({ key: keyString, value, parent: this.root, children: [] });
        } else if (isPrefixMatch(result.match)) {
            const { node, match, sumIndex } = result;
            if (match.index === keyPointer.posMax - keyPointer.pos) {
                // insert a parent node
                const newNode: TrieMapNode<T> = {
                    key: node.key.slice(0, match.index),
                    value,
                    parent: node.parent,
                    children: [node],
                };
                node.key = node.key.slice(match.index);
                if (node === this.root) {
                    this.root = newNode;
                } else {
                    const nodeIndex = node.parent!.children.indexOf(node);
                    node.parent!.children[nodeIndex] = newNode;
                }
                node.parent = newNode;
            } else if (match.index < node.key.length) {
                // split a parent node with a smaller key
                const newNode: TrieMapNode<T> = {
                    key: node.key.slice(match.index),
                    value: node.value,
                    parent: node,
                    children: node.children,
                };
                const isExactMatch = sumIndex === keyString.length;
                node.key = node.key.slice(0, match.index);
                node.value = isExactMatch ? value : null;
                node.children = [newNode];
                for (const child of newNode.children) {
                    child.parent = newNode;
                }
                if (!isExactMatch) {
                    node.children.push({ key: keyString.slice(sumIndex), value, parent: node, children: [] });
                }
            } else {
                // add the new node to children
                node.children.push({ key: keyString.slice(sumIndex), value, parent: node, children: [] });
            }
        } else {
            // update existing node value
            result.node.value = value;
        }
    }

    toJSON(): object | null {
        return this.root && this.nodeToJson(this.root);
    }

    [Symbol.iterator]() {
        return this.iterate();
    }

    /** Find the nearest parent node or an exact key match. */
    private findClosestMatchingNode(keyPointer: TrieMapKeyPointer): TrieMapClosestMatchingNode<T> | null {
        const rootMatch = this.root && this.matchPrefix(this.root.key, keyPointer);
        if (!this.root || !rootMatch || rootMatch === 'none') {
            return null;
        } else if (rootMatch === 'full') {
            return { node: this.root, match: 'full', fullKey: this.root.key, sumIndex: 0 };
        }
        let candidateNode = this.root;
        let candidateMatch: TrieMapMatchType = rootMatch;
        let traverseNode: TrieMapNode<T> | null = this.root;
        let traverseMatch: TrieMapMatchType = rootMatch;
        let sumIndex = traverseMatch.index;
        let fullKey = traverseNode.key;
        const originalKeyPointerPos = keyPointer.pos;
        keyPointer.pos += traverseMatch.index;
        while (traverseNode && traverseMatch.index === traverseNode.key.length) {
            traverseNode = null;
            for (const child of candidateNode.children) {
                const match = this.matchPrefix(child.key, keyPointer);
                if (match === 'full') {
                    return { node: child, match, fullKey: fullKey + child.key, sumIndex: 0 };
                } else if (isPrefixMatch(match)) {
                    traverseNode = child;
                    traverseMatch = match;
                    break;
                }
            }
            if (traverseNode) {
                candidateNode = traverseNode;
                candidateMatch = traverseMatch;
                keyPointer.pos += traverseMatch.index;
                sumIndex += traverseMatch.index;
                fullKey += traverseNode.key;
            }
        }
        keyPointer.pos = originalKeyPointerPos;
        return { node: candidateNode, match: candidateMatch, fullKey, sumIndex };
    }

    private matchPrefix(prefix: string, keyPointer: TrieMapKeyPointer): TrieMapMatchType {
        let index: number;
        for (index = 0; keyPointer.pos + index < keyPointer.posMax; ++index) {
            if (index >= prefix.length || !this.charsEqual(prefix[index], keyPointer.data[keyPointer.pos + index])) {
                return index > 0 || prefix.length === 0 ? { index } : 'none';
            }
        }
        return keyPointer.pos + index === keyPointer.posMax && index === prefix.length ? 'full' : { index };
    }

    private keyAsPointer(key: TrieMapKeyPointer | string): TrieMapKeyPointer {
        return typeof key === 'string' ? { data: key, pos: 0, posMax: key.length } : key;
    }

    private keyAsString(key: TrieMapKeyPointer | string): string {
        return typeof key === 'string' ? key : key.data.slice(key.pos, key.posMax);
    }

    private nodeToJson(node: TrieMapNode<T>) {
        return {
            key: node.key,
            value: node.value,
            children: node.children.map(child => this.nodeToJson(child)),
        };
    }
}

type TrieMapMatchType = 'full' | 'none' | TrieMapPrefixMatch;

interface TrieMapNode<T> {
    key: string;
    value: T | null;
    parent: TrieMapNode<T> | null;
    children: TrieMapNode<T>[];
}

interface TrieMapClosestMatchingNode<T> {
    node: TrieMapNode<T>;
    match: TrieMapMatchType;
    fullKey: string;
    sumIndex: number;
}

interface TrieMapPrefixMatch {
    index: number;
}

const nonBoundaryRegex = /[A-Z]/i;

const isNonBoundary = (src: string, pos: number): boolean => nonBoundaryRegex.test(src[pos]);

const isPrefixMatch = (x: TrieMapMatchType): x is TrieMapPrefixMatch => typeof x !== 'string';
