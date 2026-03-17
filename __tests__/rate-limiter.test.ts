import { describe, it, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { RateLimiter } from '../lib/rate-limiter'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 1000, maxRequests: 3 })
  })

  after(() => {
    // Ensure no dangling timers
    limiter?.destroy()
  })

  it('allows requests up to the max limit', () => {
    const r1 = limiter.check('user-1')
    assert.equal(r1.allowed, true)
    assert.equal(r1.remaining, 2)

    const r2 = limiter.check('user-1')
    assert.equal(r2.allowed, true)
    assert.equal(r2.remaining, 1)

    const r3 = limiter.check('user-1')
    assert.equal(r3.allowed, true)
    assert.equal(r3.remaining, 0)
  })

  it('blocks requests after the max limit is reached', () => {
    limiter.check('user-1')
    limiter.check('user-1')
    limiter.check('user-1')

    const r4 = limiter.check('user-1')
    assert.equal(r4.allowed, false)
    assert.equal(r4.remaining, 0)
  })

  it('resets after the time window expires', async () => {
    // Use a very short window for this test
    const fastLimiter = new RateLimiter({ windowMs: 50, maxRequests: 1 })

    const r1 = fastLimiter.check('user-1')
    assert.equal(r1.allowed, true)

    const r2 = fastLimiter.check('user-1')
    assert.equal(r2.allowed, false)

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 60))

    const r3 = fastLimiter.check('user-1')
    assert.equal(r3.allowed, true)

    fastLimiter.destroy()
  })

  it('tracks different keys independently', () => {
    limiter.check('user-a')
    limiter.check('user-a')
    limiter.check('user-a')

    // user-a is now blocked
    const ra = limiter.check('user-a')
    assert.equal(ra.allowed, false)

    // user-b still has full quota
    const rb = limiter.check('user-b')
    assert.equal(rb.allowed, true)
    assert.equal(rb.remaining, 2)
  })

  it('cleanup removes expired entries', async () => {
    const fastLimiter = new RateLimiter({ windowMs: 50, maxRequests: 5 })

    fastLimiter.check('user-1')
    fastLimiter.check('user-2')
    assert.equal(fastLimiter.size, 2)

    // Wait for entries to expire
    await new Promise((resolve) => setTimeout(resolve, 60))

    fastLimiter.cleanup()
    assert.equal(fastLimiter.size, 0)

    fastLimiter.destroy()
  })

  it('returns correct resetAt timestamp', () => {
    const before = Date.now()
    const result = limiter.check('user-x')
    const after_ts = Date.now()

    // resetAt should be roughly now + windowMs
    assert.ok(result.resetAt >= before + 1000)
    assert.ok(result.resetAt <= after_ts + 1000)
  })
})
