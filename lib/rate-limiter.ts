interface RateLimiterConfig {
  windowMs: number
  maxRequests: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(private config: RateLimiterConfig) {
    // Run cleanup every window period to prevent memory leaks
    if (typeof setInterval !== 'undefined') {
      this.cleanupTimer = setInterval(() => this.cleanup(), this.config.windowMs)
      // Allow Node process to exit even if timer is active
      if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
        this.cleanupTimer.unref()
      }
    }
  }

  check(key: string): RateLimitResult {
    const now = Date.now()
    const entry = this.store.get(key)

    // No entry or window expired — start fresh
    if (!entry || now >= entry.resetAt) {
      const resetAt = now + this.config.windowMs
      this.store.set(key, { count: 1, resetAt })
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetAt,
      }
    }

    // Within window — check limit
    if (entry.count < this.config.maxRequests) {
      entry.count++
      return {
        allowed: true,
        remaining: this.config.maxRequests - entry.count,
        resetAt: entry.resetAt,
      }
    }

    // Over limit
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  /** Remove expired entries to free memory */
  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []
    this.store.forEach((entry, key) => {
      if (now >= entry.resetAt) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => this.store.delete(key))
  }

  /** Expose store size for testing */
  get size(): number {
    return this.store.size
  }

  /** Stop the cleanup timer (useful in tests) */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }
}

// Pre-configured instances for AI routes
export const aiChatLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 20 })
export const aiGenerateLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 10 })
export const aiMealPlanLimiter = new RateLimiter({ windowMs: 300_000, maxRequests: 5 })
