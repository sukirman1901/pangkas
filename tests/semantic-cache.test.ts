import { checkSemanticCache } from '../.opencode/plugins/pangkas/semantic-cache';

describe('checkSemanticCache', () => {
  it('return null jika belum ada integrasi', async () => {
    expect(await checkSemanticCache('tes')).toBeNull();
  });
});
