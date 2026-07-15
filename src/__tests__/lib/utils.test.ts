import {
  formatDate,
  formatRelativeTime,
  truncateText,
  validateEmail,
  generateSlug,
  classNames,
  getInitials,
} from '@/lib/utils';

describe('Utils', () => {
  describe('formatDate', () => {
    it('should format a date string', () => {
      const date = '2024-01-15T10:30:00Z';
      const formatted = formatDate(date);
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    it('should format a Date object', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatDate(date);
      expect(formatted).toBeDefined();
    });
  });

  describe('formatRelativeTime', () => {
    it('should return "just now" for recent times', () => {
      const now = new Date();
      const result = formatRelativeTime(now);
      expect(result).toBe('just now');
    });

    it('should return minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = formatRelativeTime(fiveMinutesAgo);
      expect(result).toContain('minutes ago');
    });

    it('should return hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = formatRelativeTime(twoHoursAgo);
      expect(result).toContain('hours ago');
    });
  });

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const text = 'This is a long text that should be truncated';
      const truncated = truncateText(text, 20);
      expect(truncated.length).toBeLessThanOrEqual(23); // 20 + '...'
      expect(truncated).toContain('...');
    });

    it('should not truncate short text', () => {
      const text = 'Short';
      const truncated = truncateText(text, 20);
      expect(truncated).toBe(text);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct emails', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co')).toBe(true);
      expect(validateEmail('user+tag@domain.com')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('invalid@')).toBe(false);
      expect(validateEmail('@invalid.com')).toBe(false);
      expect(validateEmail('invalid@.com')).toBe(false);
    });
  });

  describe('generateSlug', () => {
    it('should generate a slug from text', () => {
      const text = 'Hello World';
      const slug = generateSlug(text);
      expect(slug).toBe('hello-world');
    });

    it('should handle special characters', () => {
      const text = 'Hello! @World #2024';
      const slug = generateSlug(text);
      expect(slug).toBe('hello-world-2024');
    });

    it('should handle multiple spaces', () => {
      const text = 'Hello   World';
      const slug = generateSlug(text);
      expect(slug).toBe('hello-world');
    });
  });

  describe('classNames', () => {
    it('should join class names', () => {
      const result = classNames('class1', 'class2', 'class3');
      expect(result).toBe('class1 class2 class3');
    });

    it('should filter falsy values', () => {
      const result = classNames('class1', false, null, undefined, 'class2');
      expect(result).toBe('class1 class2');
    });
  });

  describe('getInitials', () => {
    it('should get initials from name', () => {
      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('Jane Smith')).toBe('JS');
    });

    it('should handle single name', () => {
      expect(getInitials('John')).toBe('J');
    });

    it('should handle multiple names', () => {
      expect(getInitials('John Michael Doe')).toBe('JM');
    });
  });
});
