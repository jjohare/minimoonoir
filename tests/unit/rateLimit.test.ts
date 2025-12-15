/**
 * Rate Limiting Tests
 *
 * Tests for the token bucket rate limiting implementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  getRateLimitRemaining,
  resetRateLimit,
  RateLimitError,
  RATE_LIMITS
} from '../../src/lib/utils/rateLimit';

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Reset all rate limits before each test
    resetRateLimit('message');
    resetRateLimit('channelCreate');
    resetRateLimit('dm');
    resetRateLimit('api');
    resetRateLimit('login');
  });

  describe('checkRateLimit', () => {
    it('should allow actions within rate limit', () => {
      const result = checkRateLimit('message');
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBe(0);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    it('should track remaining tokens correctly', () => {
      // Message limit is 10 per minute
      const first = checkRateLimit('message', 'test-user');
      expect(first.remaining).toBe(9); // Started with 10, used 1

      const second = checkRateLimit('message', 'test-user');
      expect(second.remaining).toBe(8);
    });

    it('should block when rate limit exceeded', () => {
      const key = 'exhaust-test';

      // Exhaust all tokens (message capacity is 10)
      for (let i = 0; i < RATE_LIMITS.message.capacity; i++) {
        const result = checkRateLimit('message', key);
        expect(result.allowed).toBe(true);
      }

      // Next request should be blocked
      const blocked = checkRateLimit('message', key);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfter).toBeGreaterThan(0);
      expect(blocked.remaining).toBe(0);
    });

    it('should use separate buckets for different keys', () => {
      const key1 = 'user-1';
      const key2 = 'user-2';

      // Exhaust key1
      for (let i = 0; i < RATE_LIMITS.message.capacity; i++) {
        checkRateLimit('message', key1);
      }

      // key1 should be blocked
      expect(checkRateLimit('message', key1).allowed).toBe(false);

      // key2 should still be allowed
      expect(checkRateLimit('message', key2).allowed).toBe(true);
    });

    it('should use separate buckets for different actions', () => {
      const key = 'multi-action';

      // Use message rate limit
      checkRateLimit('message', key);

      // DM limit should be independent
      const dmResult = checkRateLimit('dm', key);
      expect(dmResult.allowed).toBe(true);
      expect(dmResult.remaining).toBe(19); // DM capacity is 20
    });
  });

  describe('getRateLimitRemaining', () => {
    it('should return full capacity for new keys', () => {
      const remaining = getRateLimitRemaining('message', 'new-key');
      expect(remaining).toBe(RATE_LIMITS.message.capacity);
    });

    it('should return correct remaining after usage', () => {
      const key = 'track-remaining';
      checkRateLimit('message', key);
      checkRateLimit('message', key);

      const remaining = getRateLimitRemaining('message', key);
      expect(remaining).toBe(8);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for a key', () => {
      const key = 'reset-test';

      // Use some tokens
      checkRateLimit('message', key);
      checkRateLimit('message', key);
      expect(getRateLimitRemaining('message', key)).toBe(8);

      // Reset
      resetRateLimit('message', key);

      // Should be back to full capacity
      expect(getRateLimitRemaining('message', key)).toBe(10);
    });
  });

  describe('Token refill', () => {
    it('should refill tokens over time', async () => {
      const key = 'refill-test';

      // Use all tokens
      for (let i = 0; i < RATE_LIMITS.message.capacity; i++) {
        checkRateLimit('message', key);
      }
      expect(checkRateLimit('message', key).allowed).toBe(false);

      // Mock time passing (message refills at 10/60 = 0.167 tokens/second)
      // After 6 seconds, should have ~1 token
      vi.useFakeTimers();
      vi.advanceTimersByTime(6000);

      const result = checkRateLimit('message', key);
      expect(result.allowed).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('RateLimitError', () => {
    it('should have correct properties', () => {
      const error = new RateLimitError('Test error', 30);

      expect(error.message).toBe('Test error');
      expect(error.retryAfter).toBe(30);
      expect(error.name).toBe('RateLimitError');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('Rate limit configurations', () => {
    it('should have correct message rate limit', () => {
      expect(RATE_LIMITS.message.capacity).toBe(10);
      expect(RATE_LIMITS.message.refillRate).toBeCloseTo(10 / 60, 5);
      expect(RATE_LIMITS.message.tokensPerAction).toBe(1);
    });

    it('should have correct channel creation rate limit', () => {
      expect(RATE_LIMITS.channelCreate.capacity).toBe(2);
      expect(RATE_LIMITS.channelCreate.refillRate).toBeCloseTo(2 / 3600, 8);
    });

    it('should have correct DM rate limit', () => {
      expect(RATE_LIMITS.dm.capacity).toBe(20);
      expect(RATE_LIMITS.dm.refillRate).toBeCloseTo(20 / 60, 5);
    });

    it('should have correct API rate limit', () => {
      expect(RATE_LIMITS.api.capacity).toBe(100);
      expect(RATE_LIMITS.api.refillRate).toBeCloseTo(100 / 60, 5);
    });

    it('should have correct login rate limit', () => {
      expect(RATE_LIMITS.login.capacity).toBe(5);
      expect(RATE_LIMITS.login.refillRate).toBeCloseTo(5 / 900, 8);
    });
  });

  describe('Edge cases', () => {
    it('should handle default key', () => {
      const result = checkRateLimit('message');
      expect(result.allowed).toBe(true);
    });

    it('should handle empty string key', () => {
      const result = checkRateLimit('message', '');
      expect(result.allowed).toBe(true);
    });

    it('should calculate correct retry time', () => {
      const key = 'retry-calc';

      // Exhaust tokens
      for (let i = 0; i < RATE_LIMITS.message.capacity; i++) {
        checkRateLimit('message', key);
      }

      const result = checkRateLimit('message', key);
      expect(result.allowed).toBe(false);

      // Retry after should be approximately (1 token / refill rate) = 6 seconds
      expect(result.retryAfter).toBeGreaterThanOrEqual(5);
      expect(result.retryAfter).toBeLessThanOrEqual(7);
    });
  });
});
