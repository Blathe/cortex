import type { CortexJob, CortexJobLog, CortexCron } from '~/types/cortex'

export const useCortexJobs = () => {
  const jobs = useState<CortexJob[]>('cortex.jobs', () => [])
  const logs = useState<CortexJobLog[]>('cortex.logs', () => [])
  const crons = useState<CortexCron[]>('cortex.crons', () => [])

  return { jobs, logs, crons }
}
