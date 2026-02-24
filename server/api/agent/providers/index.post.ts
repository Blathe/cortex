import { createError, defineEventHandler } from 'h3'

export default defineEventHandler(() => {
  throw createError({
    statusCode: 410,
    statusMessage: 'Deprecated endpoint. Use /api/agent/providers/active or /api/agent/providers/credentials.'
  })
})
