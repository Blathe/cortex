import { createError, getHeader } from 'h3'
import type { H3Event } from 'h3'
import { createHash, timingSafeEqual } from 'node:crypto'

export const safeStringEqual = (a: string, b: string): boolean => {
  const hashA = createHash('sha256').update(a).digest()
  const hashB = createHash('sha256').update(b).digest()
  return timingSafeEqual(hashA, hashB)
}

interface RateLimitOptions {
  key: string
  maxAttempts: number
  windowMs: number
}

interface RateLimitBucket {
  attempts: number
  resetAt: number
}

const rateLimitBuckets = new Map<string, RateLimitBucket>()

const getClientIp = (event: H3Event): string => {
  const forwarded = getHeader(event, 'x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return event.node?.req?.socket?.remoteAddress || 'unknown'
}

const clearExpiredBuckets = (now: number) => {
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key)
    }
  }
}

export const enforceRateLimit = (event: H3Event, options: RateLimitOptions): void => {
  const now = Date.now()

  if (rateLimitBuckets.size > 1000) {
    clearExpiredBuckets(now)
  }

  const ip = getClientIp(event)
  const bucketKey = `${options.key}:${ip}`
  const existing = rateLimitBuckets.get(bucketKey)

  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(bucketKey, { attempts: 1, resetAt: now + options.windowMs })
    return
  }

  if (existing.attempts >= options.maxAttempts) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests. Please try again shortly.' })
  }

  existing.attempts += 1
  rateLimitBuckets.set(bucketKey, existing)
}
