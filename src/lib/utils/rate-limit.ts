/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for single-instance dev/preview; for multi-instance production
 * replace the Map with a Redis store.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

export interface RateLimitOptions {
  /** Unique key identifying the caller (e.g. user ID + route) */
  key: string
  /** Maximum number of requests allowed within the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number // epoch ms when the oldest request ages out
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const windowStart = now - windowMs

  const entry = store.get(key) ?? { timestamps: [] }

  // Drop timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

  if (entry.timestamps.length >= limit) {
    const resetAt = entry.timestamps[0] + windowMs
    store.set(key, entry)
    return { allowed: false, remaining: 0, resetAt }
  }

  entry.timestamps.push(now)
  store.set(key, entry)

  const remaining = limit - entry.timestamps.length
  const resetAt = entry.timestamps[0] + windowMs
  return { allowed: true, remaining, resetAt }
}
