import { JwtService } from '@nestjs/jwt';
import { PreviewService } from './preview.service';
import type { AppConfigService } from '../config/app-config.service';

describe('PreviewService', () => {
  const config = { jwt: { accessSecret: 'test-secret' } } as AppConfigService;
  const service = new PreviewService(new JwtService({}), config);

  it('round-trips a site-scoped token', () => {
    const token = service.sign('site-1');
    const payload = service.verify(token, 'site-1');
    expect(payload).toMatchObject({ type: 'preview', site: 'site-1' });
    expect(payload?.entry).toBeUndefined();
  });

  it('carries an entry id when given one', () => {
    const token = service.sign('site-1', 'entry-9');
    expect(service.verify(token, 'site-1')?.entry).toBe('entry-9');
  });

  it('rejects a token minted for another site (no cross-tenant preview)', () => {
    const token = service.sign('site-1');
    expect(service.verify(token, 'site-2')).toBeNull();
  });

  it('returns null for a garbage or tampered token instead of throwing', () => {
    expect(service.verify('not.a.jwt', 'site-1')).toBeNull();
  });
});
