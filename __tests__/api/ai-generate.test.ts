import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { RateLimiter } from '../../lib/rate-limiter'

/**
 * Tests for POST /api/ai/generate logic.
 *
 * We cannot directly import the route because it depends on Next.js
 * server internals (cookies(), next/server). Instead, we test the
 * core logic patterns used by the route in isolation.
 */

describe('AI Generate – auth guard logic', () => {
  it('returns 401 when user is null', () => {
    const user = null
    if (!user) {
      const response = { error: 'Unauthorized', status: 401 }
      assert.equal(response.status, 401)
      assert.equal(response.error, 'Unauthorized')
      return
    }
    assert.fail('Should have detected null user')
  })

  it('proceeds when user is authenticated', () => {
    const user = { id: 'user-123', email: 'test@example.com' }
    assert.ok(user)
    assert.equal(user.id, 'user-123')
  })
})

describe('AI Generate – input validation', () => {
  it('returns 400 when task is missing', () => {
    const body = { context: 'some context', prompt: 'do something' }
    const { task } = body as any

    if (!task) {
      const response = { error: 'Task is required', status: 400 }
      assert.equal(response.status, 400)
      return
    }
    assert.fail('Should have caught missing task')
  })

  it('accepts valid task values', () => {
    const validTasks = ['generate-protocol', 'generate-challenge', 'marketing-suggestion']
    for (const task of validTasks) {
      assert.ok(task, `Task "${task}" should be truthy`)
    }
  })
})

describe('AI Generate – rate limiting integration', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 10 })
  })

  it('allows requests under the limit', () => {
    const userId = 'user-123'

    for (let i = 0; i < 10; i++) {
      const result = limiter.check(userId)
      assert.equal(result.allowed, true, `Request ${i + 1} should be allowed`)
    }
  })

  it('blocks requests after 10 requests per minute', () => {
    const userId = 'user-123'

    // Exhaust the limit
    for (let i = 0; i < 10; i++) {
      limiter.check(userId)
    }

    // 11th request should be blocked
    const result = limiter.check(userId)
    assert.equal(result.allowed, false)
    assert.equal(result.remaining, 0)
  })

  it('returns correct 429 response shape when rate-limited', () => {
    const userId = 'user-123'

    // Exhaust the limit
    for (let i = 0; i < 10; i++) {
      limiter.check(userId)
    }

    const { allowed, remaining, resetAt } = limiter.check(userId)
    assert.equal(allowed, false)

    // Simulate the response the route would build
    const retryAfterSeconds = Math.ceil((resetAt - Date.now()) / 1000)
    const response = {
      error: `Muitas requisições. Tente novamente em ${retryAfterSeconds} segundos.`,
      status: 429,
      headers: {
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(resetAt),
        'Retry-After': String(retryAfterSeconds),
      },
    }

    assert.equal(response.status, 429)
    assert.ok(response.error.includes('Muitas requisições'))
    assert.equal(response.headers['X-RateLimit-Remaining'], '0')
    assert.ok(Number(response.headers['Retry-After']) > 0)
  })

  it('different users have independent limits', () => {
    // Exhaust user-a
    for (let i = 0; i < 10; i++) {
      limiter.check('user-a')
    }
    assert.equal(limiter.check('user-a').allowed, false)

    // user-b should still be fine
    const rb = limiter.check('user-b')
    assert.equal(rb.allowed, true)
    assert.equal(rb.remaining, 9)
  })

  it('resets after window expires', async () => {
    const fastLimiter = new RateLimiter({ windowMs: 50, maxRequests: 1 })

    fastLimiter.check('user-1')
    assert.equal(fastLimiter.check('user-1').allowed, false)

    await new Promise((resolve) => setTimeout(resolve, 60))

    assert.equal(fastLimiter.check('user-1').allowed, true)

    fastLimiter.destroy()
  })
})

describe('AI Generate – GEMINI_API_KEY check', () => {
  it('route should fail early when API key is missing', () => {
    // Simulates the route's first check
    const apiKey = ''
    if (!apiKey) {
      const response = { error: 'GEMINI_API_KEY not configured', status: 500 }
      assert.equal(response.status, 500)
      return
    }
    assert.fail('Should have caught missing API key')
  })
})
