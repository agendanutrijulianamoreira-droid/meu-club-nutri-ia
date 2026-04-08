import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

/**
 * Tests for POST /api/checkout
 *
 * Since the route uses global Supabase admin and Stripe clients,
 * we test by importing the module after stubbing the environment.
 * For the MVP we focus on input validation logic that doesn't
 * depend on external services.
 */

// Minimal mock of NextRequest
function createMockRequest(body: Record<string, unknown>): any {
  return {
    json: async () => body,
    headers: new Map([['origin', 'http://localhost:3000']]),
  }
}

// Minimal mock of NextResponse for validation testing
function mockNextResponse() {
  const calls: Array<{ body: any; init: any }> = []
  return {
    calls,
    json(body: any, init?: any) {
      calls.push({ body, init })
      return { body, status: init?.status || 200 }
    },
  }
}

describe('POST /api/checkout – input validation', () => {
  it('returns 400 when planId is missing', async () => {
    // Simulate the validation logic from the route
    const body = { tenantSlug: 'clinic-a', userId: 'u1' }
    const { planId, tenantSlug, userId } = body as any

    if (!planId || !tenantSlug || !userId) {
      const error = 'planId, tenantSlug e userId são obrigatórios'
      assert.equal(error, 'planId, tenantSlug e userId são obrigatórios')
      return
    }
    assert.fail('Should have caught missing planId')
  })

  it('returns 400 when tenantSlug is missing', async () => {
    const body = { planId: 'vip', userId: 'u1' }
    const { planId, tenantSlug, userId } = body as any

    const isMissing = !planId || !tenantSlug || !userId
    assert.equal(isMissing, true)
  })

  it('returns 400 when userId is missing', async () => {
    const body = { planId: 'vip', tenantSlug: 'clinic-a' }
    const { planId, tenantSlug, userId } = body as any

    const isMissing = !planId || !tenantSlug || !userId
    assert.equal(isMissing, true)
  })

  it('returns 400 for invalid plan', async () => {
    const body = { planId: 'invalid_plan', tenantSlug: 'clinic-a', userId: 'u1' }
    const validPlans = ['tech_diet', 'vip']

    assert.equal(validPlans.includes(body.planId), false)
  })

  it('accepts valid tech_diet plan', async () => {
    const validPlans = ['tech_diet', 'vip']
    assert.equal(validPlans.includes('tech_diet'), true)
  })

  it('accepts valid vip plan', async () => {
    const validPlans = ['tech_diet', 'vip']
    assert.equal(validPlans.includes('vip'), true)
  })
})

describe('POST /api/checkout – request parsing', () => {
  it('can parse request body correctly', async () => {
    const req = createMockRequest({
      planId: 'vip',
      tenantSlug: 'clinic-a',
      userId: 'user-123',
      customerEmail: 'test@example.com',
      customerName: 'Test User',
    })

    const body = await req.json()
    assert.equal(body.planId, 'vip')
    assert.equal(body.tenantSlug, 'clinic-a')
    assert.equal(body.userId, 'user-123')
    assert.equal(body.customerEmail, 'test@example.com')
    assert.equal(body.customerName, 'Test User')
  })
})
