import { defineEventHandler } from 'h3'
import { readToken } from '../../../utils/authToken'

export default defineEventHandler(() => {
  const token = readToken()
  return { token, hasToken: token !== null }
})
