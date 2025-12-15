/**
 * Input Validation Tests
 *
 * Tests for Nostr event and input validation utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidPubkey,
  isValidEventId,
  isValidSignature,
  validateContent,
  validateTags,
  validateEvent,
  validateChannelName,
  sanitizeForDisplay
} from '../../src/lib/utils/validation';

describe('Input Validation', () => {
  describe('isValidPubkey', () => {
    it('should accept valid 64-char hex pubkey', () => {
      const validPubkey = 'a'.repeat(64);
      expect(isValidPubkey(validPubkey)).toBe(true);
    });

    it('should accept mixed case hex', () => {
      const mixedCase = 'aAbBcCdDeEfF0123456789' + 'a'.repeat(42);
      expect(isValidPubkey(mixedCase)).toBe(true);
    });

    it('should reject pubkey with non-hex characters', () => {
      const invalid = 'g' + 'a'.repeat(63);
      expect(isValidPubkey(invalid)).toBe(false);
    });

    it('should reject short pubkey', () => {
      expect(isValidPubkey('a'.repeat(63))).toBe(false);
    });

    it('should reject long pubkey', () => {
      expect(isValidPubkey('a'.repeat(65))).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidPubkey('')).toBe(false);
    });
  });

  describe('isValidEventId', () => {
    it('should accept valid 64-char hex event ID', () => {
      expect(isValidEventId('b'.repeat(64))).toBe(true);
    });

    it('should reject invalid event ID', () => {
      expect(isValidEventId('xyz')).toBe(false);
    });
  });

  describe('isValidSignature', () => {
    it('should accept valid 128-char hex signature', () => {
      expect(isValidSignature('c'.repeat(128))).toBe(true);
    });

    it('should reject 64-char string (pubkey length)', () => {
      expect(isValidSignature('c'.repeat(64))).toBe(false);
    });

    it('should reject invalid signature', () => {
      expect(isValidSignature('invalid')).toBe(false);
    });
  });

  describe('validateContent', () => {
    it('should accept valid content', () => {
      const result = validateContent('Hello, world!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept empty content', () => {
      const result = validateContent('');
      expect(result.valid).toBe(true);
    });

    it('should accept unicode content', () => {
      const result = validateContent('Hello 🌍 世界 مرحبا');
      expect(result.valid).toBe(true);
    });

    it('should reject content with null bytes', () => {
      const result = validateContent('Hello\0World');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Content contains null bytes');
    });

    it('should reject content exceeding max length', () => {
      const longContent = 'a'.repeat(65000);
      const result = validateContent(longContent);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('maximum length'))).toBe(true);
    });

    it('should reject non-string content', () => {
      // @ts-expect-error Testing invalid input
      const result = validateContent(123);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Content must be a string');
    });
  });

  describe('validateTags', () => {
    it('should accept valid tags array', () => {
      const tags = [
        ['p', 'a'.repeat(64)],
        ['e', 'b'.repeat(64)],
        ['t', 'nostr']
      ];
      const result = validateTags(tags);
      expect(result.valid).toBe(true);
    });

    it('should accept empty tags array', () => {
      const result = validateTags([]);
      expect(result.valid).toBe(true);
    });

    it('should reject non-array tags', () => {
      // @ts-expect-error Testing invalid input
      const result = validateTags('not an array');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tags must be an array');
    });

    it('should reject too many tags', () => {
      const tags = Array(2001).fill(['t', 'test']);
      const result = validateTags(tags);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Too many tags'))).toBe(true);
    });

    it('should reject tag that is not an array', () => {
      // @ts-expect-error Testing invalid input
      const result = validateTags([['t', 'test'], 'not-array']);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('not an array'))).toBe(true);
    });

    it('should reject tag value with null bytes', () => {
      const result = validateTags([['t', 'test\0value']]);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('null bytes'))).toBe(true);
    });

    it('should reject invalid pubkey in p tag', () => {
      const result = validateTags([['p', 'invalid-pubkey']]);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Invalid pubkey in 'p' tag"))).toBe(true);
    });

    it('should reject invalid event ID in e tag', () => {
      const result = validateTags([['e', 'invalid-event-id']]);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Invalid event ID in 'e' tag"))).toBe(true);
    });

    it('should reject tag value exceeding max length', () => {
      const longValue = 'x'.repeat(1025);
      const result = validateTags([['t', longValue]]);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('max length'))).toBe(true);
    });
  });

  describe('validateEvent', () => {
    const validEvent = {
      id: 'a'.repeat(64),
      pubkey: 'b'.repeat(64),
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'Hello, Nostr!',
      sig: 'c'.repeat(128)
    };

    it('should accept valid complete event', () => {
      const result = validateEvent(validEvent);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject event without pubkey', () => {
      const { pubkey, ...event } = validEvent;
      const result = validateEvent(event);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Event missing pubkey');
    });

    it('should reject event with invalid pubkey', () => {
      const result = validateEvent({ ...validEvent, pubkey: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid pubkey format');
    });

    it('should reject event without created_at', () => {
      const { created_at, ...event } = validEvent;
      const result = validateEvent(event);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Event missing created_at');
    });

    it('should reject event with negative timestamp', () => {
      const result = validateEvent({ ...validEvent, created_at: -1 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid created_at timestamp');
    });

    it('should reject event without kind', () => {
      const { kind, ...event } = validEvent;
      const result = validateEvent(event);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Event missing kind');
    });

    it('should reject event with invalid kind', () => {
      const result = validateEvent({ ...validEvent, kind: 70000 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid event kind');
    });

    it('should reject event without content', () => {
      const { content, ...event } = validEvent;
      const result = validateEvent(event);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Event missing content');
    });

    it('should reject event with invalid id', () => {
      const result = validateEvent({ ...validEvent, id: 'bad-id' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid event ID format');
    });

    it('should reject event with invalid signature', () => {
      const result = validateEvent({ ...validEvent, sig: 'bad-sig' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid signature format');
    });

    it('should collect multiple errors', () => {
      const result = validateEvent({
        pubkey: 'invalid',
        kind: -1,
        content: 'x'.repeat(65000)
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateChannelName', () => {
    it('should accept valid channel name', () => {
      const result = validateChannelName('General Discussion');
      expect(result.valid).toBe(true);
    });

    it('should accept name with punctuation', () => {
      const result = validateChannelName("What's New!");
      expect(result.valid).toBe(true);
    });

    it('should reject empty name', () => {
      const result = validateChannelName('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Channel name cannot be empty');
    });

    it('should reject name exceeding max length', () => {
      const result = validateChannelName('a'.repeat(101));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too long'))).toBe(true);
    });

    it('should reject name with special characters', () => {
      const result = validateChannelName('Channel <script>');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Channel name contains invalid characters');
    });

    it('should reject non-string name', () => {
      // @ts-expect-error Testing invalid input
      const result = validateChannelName(123);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Channel name must be a string');
    });
  });

  describe('sanitizeForDisplay', () => {
    it('should return empty string for non-string input', () => {
      // @ts-expect-error Testing invalid input
      expect(sanitizeForDisplay(null)).toBe('');
      // @ts-expect-error Testing invalid input
      expect(sanitizeForDisplay(undefined)).toBe('');
      // @ts-expect-error Testing invalid input
      expect(sanitizeForDisplay(123)).toBe('');
    });

    it('should remove null bytes', () => {
      expect(sanitizeForDisplay('Hello\0World')).toBe('HelloWorld');
    });

    it('should normalize unicode', () => {
      // Composed vs decomposed forms should normalize
      const composed = '\u00e9'; // é as single char
      const decomposed = '\u0065\u0301'; // e + combining accent
      expect(sanitizeForDisplay(composed)).toBe(sanitizeForDisplay(decomposed));
    });

    it('should truncate to max length', () => {
      const long = 'a'.repeat(70000);
      const result = sanitizeForDisplay(long);
      expect(result.length).toBeLessThanOrEqual(64000);
    });

    it('should preserve normal text', () => {
      const text = 'Hello, world! 123';
      expect(sanitizeForDisplay(text)).toBe(text);
    });
  });
});
