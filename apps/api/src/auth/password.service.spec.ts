import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes to an argon2id string that is not the plaintext', async () => {
    const hash = await service.hash('s3cret-pw');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('s3cret-pw');
  });

  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await service.hash('correct horse');
    await expect(service.verify(hash, 'correct horse')).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong horse')).resolves.toBe(false);
  });

  it('returns false (never throws) on a malformed hash', async () => {
    await expect(service.verify('not-a-hash', 'x')).resolves.toBe(false);
  });
});
