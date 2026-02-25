import { defineEventHandler } from 'h3'
import { listOllamaModels } from '../../../utils/ollamaRuntime'

export default defineEventHandler(async () => {
  const models = await listOllamaModels()
  return { models }
})
