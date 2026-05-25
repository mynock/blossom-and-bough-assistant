import { encryptToken, decryptToken, generateEncryptionKey } from '../utils/encryption';

describe('encryption', () => {
  const validKey = generateEncryptionKey();
  const otherKey = generateEncryptionKey();

  beforeEach(() => {
    process.env.QBO_TOKEN_ENCRYPTION_KEY = validKey;
  });

  afterEach(() => {
    delete process.env.QBO_TOKEN_ENCRYPTION_KEY;
  });

  it('round-trips a token', () => {
    const plaintext = 'qbo-access-token-abc123';
    const encrypted = encryptToken(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it('produces a different ciphertext on each call (random IV)', () => {
    const plaintext = 'qbo-access-token-abc123';
    const a = encryptToken(plaintext);
    const b = encryptToken(plaintext);
    expect(a).not.toBe(b);
  });

  it('produces output in the documented v1 format', () => {
    const encrypted = encryptToken('hello');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
  });

  it('fails to decrypt with a different key', () => {
    const encrypted = encryptToken('secret');
    process.env.QBO_TOKEN_ENCRYPTION_KEY = otherKey;
    expect(() => decryptToken(encrypted)).toThrow();
  });

  it('fails to decrypt tampered ciphertext (GCM auth tag check)', () => {
    const encrypted = encryptToken('secret');
    const parts = encrypted.split(':');
    const tamperedCiphertext = Buffer.from(parts[3], 'base64');
    tamperedCiphertext[0] ^= 0xff;
    parts[3] = tamperedCiphertext.toString('base64');
    expect(() => decryptToken(parts.join(':'))).toThrow();
  });

  it('rejects unknown format versions', () => {
    const encrypted = encryptToken('secret');
    const parts = encrypted.split(':');
    parts[0] = 'v2';
    expect(() => decryptToken(parts.join(':'))).toThrow(/Invalid encrypted token format/);
  });

  it('rejects truncated input', () => {
    expect(() => decryptToken('v1:abc:def')).toThrow(/Invalid encrypted token format/);
  });

  it('throws a helpful error when key is missing', () => {
    delete process.env.QBO_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken('x')).toThrow(/QBO_TOKEN_ENCRYPTION_KEY/);
  });

  it('rejects a key that is the wrong length', () => {
    process.env.QBO_TOKEN_ENCRYPTION_KEY = 'abcd';
    expect(() => encryptToken('x')).toThrow(/32 bytes/);
  });

  it('handles unicode and long values', () => {
    const plaintext = '🌱'.repeat(1000) + '中文 émojis';
    expect(decryptToken(encryptToken(plaintext))).toBe(plaintext);
  });
});
