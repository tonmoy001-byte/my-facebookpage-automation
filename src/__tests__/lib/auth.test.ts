import { hashPassword, verifyPassword, generateToken, verifyToken } from '@/lib/auth';

describe('Auth Utils', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'testpassword123';
      const hash = await hashPassword(password);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'testpassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify a correct password', async () => {
      const password = 'testpassword123';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const password = 'testpassword123';
      const wrongPassword = 'wrongpassword';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate a JWT token with tenantId', () => {
      const userId = 'user123';
      const tenantId = 'tenant1';
      const token = generateToken(userId, tenantId);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token and return tenantId', () => {
      const userId = 'user123';
      const tenantId = 'tenant1';
      const token = generateToken(userId, tenantId);
      const payload = verifyToken(token);
      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(userId);
      expect(payload?.tenantId).toBe(tenantId);
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      const payload = verifyToken(invalidToken);
      expect(payload).toBeNull();
    });
  });
});
