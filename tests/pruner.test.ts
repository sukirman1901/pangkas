import { pruneContext } from '../.opencode/plugins/pangkas/pruner';

describe('pruneContext', () => {
  it('menghapus komentar dan baris kosong', () => {
    const input = `// komentar js
# komentar py

function foo() { // inline
  return 1; // trailing
}

`;
    const expected = 'function foo() {\nreturn 1;\n}';
    expect(pruneContext(input)).toBe(expected);
  });
});
