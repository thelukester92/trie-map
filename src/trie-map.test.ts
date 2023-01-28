import { TrieMap, TrieMapKeyPointer } from './trie-map';

describe('TrieMap', () => {
    it('adds and gets distinct keys', () => {
        const trie = new TrieMap<string>();
        trie.set('ABC', 'abc');
        trie.set('DEF', 'def');
        trie.set('GHI', 'ghi');
        trie.set('CBA', 'cba');
        expect(trie.get('ABC')).toBe('abc');
        expect(trie.get('DEF')).toBe('def');
        expect(trie.get('GHI')).toBe('ghi');
        expect(trie.get('CBA')).toBe('cba');
    });

    it('adds and gets keys with a shared prefix', () => {
        const trie = new TrieMap<string>();
        trie.set('ABCDEF', 'abcdef');
        trie.set('ABCGHIJKL', 'abcghijkl');
        trie.set('ABCGHI', 'abcghi');
        trie.set('ABC', 'abc');
        expect(trie.get('ABCDEF')).toBe('abcdef');
        expect(trie.get('ABCGHIJKL')).toBe('abcghijkl');
        expect(trie.get('ABCGHI')).toBe('abcghi');
        expect(trie.get('ABC')).toBe('abc');
    });

    it('adds and gets keys with distinct keys and shared prefixes', () => {
        const trie = new TrieMap<string>();
        trie.set('DEF', 'def');
        trie.set('GHI', 'ghi');
        trie.set('CBA', 'cba');
        trie.set('ABCDEF', 'abcdef');
        trie.set('ABCGHIJKL', 'abcghijkl');
        trie.set('ABCGHI', 'abcghi');
        trie.set('ABC', 'abc');
        expect(trie.get('DEF')).toBe('def');
        expect(trie.get('GHI')).toBe('ghi');
        expect(trie.get('CBA')).toBe('cba');
        expect(trie.get('ABCDEF')).toBe('abcdef');
        expect(trie.get('ABCGHIJKL')).toBe('abcghijkl');
        expect(trie.get('ABCGHI')).toBe('abcghi');
        expect(trie.get('ABC')).toBe('abc');
    });

    it('finds a match with an explicit KeyPointer', () => {
        const trie = new TrieMap<string>();
        trie.set('ABCDEF', 'abcdef');
        trie.set('ABCGHIJKL', 'abcghijkl');
        trie.set('ABCGHI', 'abcghi');
        trie.set('ABC', 'abc');

        const data = 'this is a long string but it has ABCGHI somewhere inside';
        const pos = data.indexOf('ABCGHI');
        const posMax = pos + 'ABCGHI'.length;
        const keyPointer: TrieMapKeyPointer = { data, pos, posMax };
        expect(trie.get(keyPointer)).toBe('abcghi');
    });

    it('skips an invalid match with an explicit KeyPointer', () => {
        const trie = new TrieMap<string>();
        trie.set('ABCDEF', 'abcdef');
        trie.set('ABCGHIJKL', 'abcghijkl');
        trie.set('ABCGHI', 'abcghi');
        trie.set('ABC', 'abc');

        const data = 'this is a long string but it has ABCGHI somewhere inside';
        const pos = data.indexOf('ABCGHI');
        const posMax = data.length;
        const keyPointer: TrieMapKeyPointer = { data, pos, posMax };
        expect(trie.get(keyPointer)).toBe(null);
    });

    it('handles `findByLongestPrefix` correctly with an explicit KeyPointer', () => {
        const trie = new TrieMap<string>([], { caseSensitive: true });
        trie.set('ABCDEF', 'abcdef');
        trie.set('ABCGHIJKL', 'abcghijkl');
        trie.set('ABCGHI', 'abcghi');
        trie.set('ABC', 'abc');

        let data = 'this is a long string but it has ABCGHIJKL somewhere inside';
        let keyPointer: TrieMapKeyPointer = { data, pos: data.indexOf('ABCGHI'), posMax: data.length };
        expect(trie.findByLongestPrefix(keyPointer, false)).toEqual(['ABCGHIJKL', 'abcghijkl']);

        data = 'this is a long string but it has ABCGHIJK somewhere inside';
        keyPointer = { data, pos: data.indexOf('ABCGHIJK'), posMax: data.length };
        expect(trie.findByLongestPrefix(keyPointer, false)).toEqual(['ABCGHI', 'abcghi']);

        data = 'this is a long string but it has ABCGH somewhere inside';
        keyPointer = { data, pos: data.indexOf('ABCGH'), posMax: data.length };
        expect(trie.findByLongestPrefix(keyPointer, false)).toEqual(['ABC', 'abc']);

        data = 'this is a long string but it has AB somewhere inside';
        keyPointer = { data, pos: data.indexOf('AB'), posMax: data.length };
        expect(trie.findByLongestPrefix(keyPointer, false)).toBe(null);

        data = 'this is a long string but it has ABCGHIJKL somewhere inside';
        keyPointer = { data, pos: data.indexOf('ABCGHIJKL'), posMax: data.indexOf('ABCGHIJKL') + 6 };
        expect(trie.findByLongestPrefix(keyPointer, false)).toEqual(['ABCGHI', 'abcghi']);
    });
});
