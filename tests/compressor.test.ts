import { compressPrompt } from '../.opencode/plugins/pangkas/compressor';

describe('compressPrompt', () => {
  it('menghapus spasi ganda dan trim', async () => {
    const input = 'Ini    adalah   prompt   '; 
    const expected = 'Ini adalah prompt';
    expect(await compressPrompt(input)).toBe(expected);
  });
});
