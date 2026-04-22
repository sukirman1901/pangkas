import { getPangkasConfig } from '../.opencode/plugins/pangkas/config';

describe('getPangkasConfig', () => {
  it('mengembalikan konfigurasi default jika file/env tidak ada', () => {
    const config = getPangkasConfig();
    expect(config.similarityThreshold).toBeDefined();
    expect(config.compressionLevel).toBeDefined();
  });
});
