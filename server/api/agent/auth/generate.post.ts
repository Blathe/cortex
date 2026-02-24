import { createError, defineEventHandler, getHeader } from 'h3'
import { generateToken, readToken, writeToken } from '../../../utils/authToken'

export default defineEventHandler((event) => {
  const existing = readToken()

  // If a token already exists, require it to regenerate (prevent unauthenticated rotation)
  if (existing !== null) {
    const header = getHeader(event, 'authorization')
    if (!header || header !== `Bearer ${existing}`) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
  }

  const token = generateToken()
  writeToken(token)
  return { token }
})
