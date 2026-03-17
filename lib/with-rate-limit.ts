import { NextRequest, NextResponse } from 'next/server'
import { RateLimiter } from './rate-limiter'

/**
 * Creates a rate-limit guard for API routes.
 * Returns null if the request is allowed, or a 429 NextResponse if rate-limited.
 */
export function withRateLimit(
  limiter: RateLimiter,
  getUserId: (req: NextRequest) => Promise<string | null>
) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    const userId = await getUserId(req)
    if (!userId) {
      // If we can't identify the user, let the route's own auth guard handle it
      return null
    }

    const { allowed, remaining, resetAt } = limiter.check(userId)

    if (allowed) {
      // Attach rate-limit headers to the eventual response via request headers
      // The caller can forward these, but for simplicity we return null (allowed)
      return null
    }

    const retryAfterSeconds = Math.ceil((resetAt - Date.now()) / 1000)

    return NextResponse.json(
      {
        error: `Muitas requisições. Tente novamente em ${retryAfterSeconds} segundos.`,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(resetAt),
          'Retry-After': String(retryAfterSeconds),
        },
      }
    )
  }
}
