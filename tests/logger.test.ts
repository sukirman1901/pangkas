import { logStats } from '../.opencode/plugins/pangkas/logger';

describe('logStats', () => {
  it('log statistik ke console', () => {
    const stats = { event: 'test', tokens: 10 };
    // Hanya memastikan tidak error
    expect(() => logStats(stats)).not.toThrow();
  });
});
