/**
 * Async Helper Utilities
 *
 * Provides utilities for managing async operations including
 * concurrency throttling and request deduplication.
 */

/**
 * Throttled promise executor
 * Limits concurrent async operations to prevent overwhelming resources
 */
export class AsyncThrottle<T> {
  private queue: Array<{
    fn: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
  }> = [];
  private activeCount = 0;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Execute a function with throttling
   */
  async execute(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeCount++;

    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }

  /**
   * Get current queue size
   */
  get queueSize(): number {
    return this.queue.length;
  }

  /**
   * Get current active count
   */
  get active(): number {
    return this.activeCount;
  }

  /**
   * Clear pending queue
   */
  clear(): void {
    for (const item of this.queue) {
      item.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }
}

/**
 * Request deduplication cache
 * Prevents duplicate concurrent requests for the same key
 */
export class RequestDeduplicator<T> {
  private pending = new Map<string, Promise<T>>();
  private cache = new Map<string, { value: T; timestamp: number }>();
  private readonly cacheDuration: number;

  constructor(cacheDurationMs: number = 5000) {
    this.cacheDuration = cacheDurationMs;
  }

  /**
   * Execute or return cached/pending result
   */
  async execute(key: string, fn: () => Promise<T>): Promise<T> {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.value;
    }

    // Check if request already pending
    const pending = this.pending.get(key);
    if (pending) {
      return pending;
    }

    // Execute new request
    const promise = fn().then(result => {
      this.cache.set(key, { value: result, timestamp: Date.now() });
      this.pending.delete(key);
      return result;
    }).catch(error => {
      this.pending.delete(key);
      throw error;
    });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Invalidate cache for a key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clean expired cache entries
   */
  cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.cacheDuration) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Batch executor - groups multiple calls into batches
 */
export class BatchExecutor<K, V> {
  private batch: K[] = [];
  private batchPromise: Promise<Map<K, V>> | null = null;
  private batchResolvers: Array<{
    keys: K[];
    resolve: (values: Map<K, V>) => void;
    reject: (error: unknown) => void;
  }> = [];
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly executor: (keys: K[]) => Promise<Map<K, V>>,
    private readonly maxBatchSize: number = 50,
    private readonly batchDelayMs: number = 10
  ) {}

  /**
   * Add keys to batch and return results when batch executes
   */
  async execute(keys: K[]): Promise<Map<K, V>> {
    return new Promise((resolve, reject) => {
      this.batch.push(...keys);
      this.batchResolvers.push({ keys, resolve, reject });

      if (this.batch.length >= this.maxBatchSize) {
        this.flush();
      } else if (!this.timeoutId) {
        this.timeoutId = setTimeout(() => this.flush(), this.batchDelayMs);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    const batchToProcess = [...new Set(this.batch)]; // Deduplicate
    const resolvers = [...this.batchResolvers];

    this.batch = [];
    this.batchResolvers = [];

    try {
      const results = await this.executor(batchToProcess);

      for (const { resolve } of resolvers) {
        resolve(results);
      }
    } catch (error) {
      for (const { reject } of resolvers) {
        reject(error);
      }
    }
  }
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffFactor?: number;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffFactor = 2,
    shouldRetry = () => true
  } = options;

  let lastError: unknown;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffFactor, maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Debounce async function
 */
export function debounceAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingPromise: Promise<ReturnType<T>> | null = null;
  let pendingResolve: ((value: ReturnType<T>) => void) | null = null;
  let pendingReject: ((error: unknown) => void) | null = null;

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!pendingPromise) {
      pendingPromise = new Promise((resolve, reject) => {
        pendingResolve = resolve;
        pendingReject = reject;
      });
    }

    timeoutId = setTimeout(async () => {
      try {
        const result = await fn(...args) as ReturnType<T>;
        pendingResolve?.(result);
      } catch (error) {
        pendingReject?.(error);
      } finally {
        pendingPromise = null;
        pendingResolve = null;
        pendingReject = null;
        timeoutId = null;
      }
    }, delayMs);

    return pendingPromise;
  };
}
