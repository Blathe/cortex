import { defineEventHandler } from 'h3'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { AgentChangeLog } from '~/types/cortex'

function parseLog(filename: string, content: string): AgentChangeLog {
  const tsMatch = filename.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})_/)
  const timestamp = tsMatch
    ? `${tsMatch[1]}T${tsMatch[2]}:${tsMatch[3]}:${tsMatch[4]}`
    : new Date().toISOString()

  const changedByMatch = content.match(/\*\*Changed by:\*\*\s*(.+)/)
  const changedBy = changedByMatch?.[1]?.trim() ?? 'unknown'

  let patch: Record<string, unknown> = {}
  const patchMatch = content.match(/## Patch\s*```json\s*([\s\S]*?)```/)
  if (patchMatch?.[1]) {
    try {
      patch = JSON.parse(patchMatch[1])
    } catch { /* ignore */ }
  }

  const reasonMatch = content.match(/## Reason\s*\n+([\s\S]+)$/)
  const reason = reasonMatch?.[1]?.trim() ?? ''

  return { filename, timestamp, changedBy, patch, reason }
}

export default defineEventHandler(async () => {
  const logsDir = resolve(process.cwd(), 'agent/logs')
  let files: string[]
  try {
    const entries = await readdir(logsDir)
    files = entries.filter(f => f.endsWith('.md'))
  } catch {
    return { logs: [] as AgentChangeLog[] }
  }

  const logs = await Promise.all(
    files.map(async (filename) => {
      const content = await readFile(resolve(logsDir, filename), 'utf-8')
      return parseLog(filename, content)
    })
  )

  logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  return { logs }
})
