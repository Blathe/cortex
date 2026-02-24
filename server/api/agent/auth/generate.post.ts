import { defineEventHandler } from 'h3'
import { generateToken, writeToken } from '../../../utils/authToken'

export default defineEventHandler(() => {
  const token = generateToken()
  writeToken(token)
  return { token }
})
