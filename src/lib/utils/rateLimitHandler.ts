/**
 * Rate Limit Handler with UI Feedback
 *
 * Provides toast notifications and error handling for rate-limited operations.
 */

import { toast } from '$lib/stores/toast';
import { checkRateLimit, RateLimitError, type RATE_LIMITS } from './rateLimit';

/**
 * Format seconds into human-readable time
 */
function formatRetryTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

/**
 * Action display names for user-friendly messages
 */
const ACTION_NAMES: Record<keyof typeof RATE_LIMITS, string> = {
  message: 'messages',
  channelCreate: 'channel creation',
  dm: 'direct messages',
  api: 'API requests',
  login: 'login attempts'
};

/**
 * Check rate limit with toast feedback
 * Returns true if action is allowed, false if rate limited
 */
export function checkRateLimitWithFeedback(
  action: keyof typeof RATE_LIMITS,
  key: string = 'default'
): boolean {
  const result = checkRateLimit(action, key);

  if (!result.allowed) {
    const actionName = ACTION_NAMES[action] || action;
    toast.warning(
      `Rate limit reached for ${actionName}. Try again in ${formatRetryTime(result.retryAfter)}.`,
      result.retryAfter * 1000 + 1000 // Auto-dismiss when limit resets
    );
    return false;
  }

  return true;
}

/**
 * Handle rate limit error with toast notification
 */
export function handleRateLimitError(error: unknown, action?: keyof typeof RATE_LIMITS): boolean {
  if (error instanceof RateLimitError) {
    const actionName = action ? ACTION_NAMES[action] : 'this action';
    toast.warning(
      `Rate limit exceeded for ${actionName}. Try again in ${formatRetryTime(error.retryAfter)}.`,
      error.retryAfter * 1000 + 1000
    );
    return true;
  }
  return false;
}

/**
 * Get remaining rate limit quota with optional warning
 */
export function checkQuotaWithWarning(
  action: keyof typeof RATE_LIMITS,
  key: string = 'default',
  warnThreshold: number = 2
): { remaining: number; warned: boolean } {
  const result = checkRateLimit(action, key);
  let warned = false;

  // Don't consume a token, just check remaining
  // Note: checkRateLimit already consumed one, so actual remaining is result.remaining

  if (result.remaining <= warnThreshold && result.remaining > 0) {
    const actionName = ACTION_NAMES[action] || action;
    toast.info(
      `${result.remaining} ${actionName} remaining before rate limit.`,
      3000
    );
    warned = true;
  }

  return { remaining: result.remaining, warned };
}

/**
 * Wrap an async function with rate limit handling
 */
export function withRateLimitFeedback<T extends (...args: unknown[]) => Promise<unknown>>(
  action: keyof typeof RATE_LIMITS,
  keyFn: (...args: Parameters<T>) => string = () => 'default'
) {
  return function (fn: T): T {
    return (async function (...args: Parameters<T>) {
      const key = keyFn(...args);

      if (!checkRateLimitWithFeedback(action, key)) {
        return undefined;
      }

      try {
        return await fn(...args);
      } catch (error) {
        if (!handleRateLimitError(error, action)) {
          throw error;
        }
        return undefined;
      }
    }) as T;
  };
}
