import { encrypt, decrypt } from '@/lib/encryption';

describe('Encryption Utils', () => {
  describe('encrypt', () => {
    it('should encrypt a string', () => {
      const plaintext = 'test secret value';
      const encrypted = encrypt(plaintext);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe('string');
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const plaintext = 'test secret value';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('decrypt', () => {
    it('should decrypt an encrypted string', () => {
      const plaintext = 'test secret value';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should return original text after encrypt/decrypt cycle', () => {
      const testCases = [
        'simple text',
        'text with numbers 12345',
        'text with special chars !@#$%^&*()',
        'long text '.repeat(100),
        '',
      ];

      for (const plaintext of testCases) {
        const encrypted = encrypt(plaintext);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(plaintext);
      }
    });
  });
});
