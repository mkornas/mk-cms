import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NotFoundException } from '@nestjs/common';
import { LocalStorageAdapter } from './local-storage.adapter';
import type { AppConfigService } from '../../config/app-config.service';

describe('LocalStorageAdapter', () => {
  const root = join(tmpdir(), 'mkcms-media-test');
  const config = {
    media: { localDir: root, publicUrl: 'https://cdn.test/' },
  } as AppConfigService;
  const adapter = new LocalStorageAdapter(config);

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('round-trips put → get and deletes', async () => {
    const key = 'site/abc/original-file.png';
    await adapter.put(key, Buffer.from('hello'), 'image/png');
    expect((await adapter.get(key)).toString()).toBe('hello');
    await adapter.delete(key);
    await expect(adapter.get(key)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('builds a public URL from the base + key (trailing slash trimmed)', () => {
    expect(adapter.url('site/abc/w640.webp')).toBe(
      'https://cdn.test/media/file/site/abc/w640.webp',
    );
  });

  it('rejects path-traversal keys', () => {
    expect(() => adapter.url('../../etc/passwd')).not.toThrow(); // url() is pure
    return expect(
      adapter.put('../escape', Buffer.from('x'), 'text/plain'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
