import type { CortexJob, CortexJobLog, CortexCron } from '~/types/cortex'

// ─── MOCK DATA — Remove this block and replace with real API calls ─────────────

const MOCK_JOBS: CortexJob[] = [
  {
    id: 'job_001',
    name: 'Web Research: Competitor Analysis',
    type: 'scrape',
    status: 'running',
    startedAt: '2026-02-23T10:15:00Z',
    completedAt: null,
    durationSecs: null,
    progress: 42
  },
  {
    id: 'job_002',
    name: 'Summarise Q1 Reports',
    type: 'analysis',
    status: 'completed',
    startedAt: '2026-02-23T08:00:00Z',
    completedAt: '2026-02-23T08:14:22Z',
    durationSecs: 862,
    progress: 100
  },
  {
    id: 'job_003',
    name: 'Sync Customer Data',
    type: 'sync',
    status: 'failed',
    startedAt: '2026-02-23T07:30:00Z',
    completedAt: '2026-02-23T07:31:05Z',
    durationSecs: 65,
    progress: null
  },
  {
    id: 'job_004',
    name: 'Daily Market Digest',
    type: 'task',
    status: 'pending',
    startedAt: null,
    completedAt: null,
    durationSecs: null,
    progress: null
  },
  {
    id: 'job_005',
    name: 'Code Review Assistant',
    type: 'analysis',
    status: 'completed',
    startedAt: '2026-02-22T22:00:00Z',
    completedAt: '2026-02-22T22:08:40Z',
    durationSecs: 520,
    progress: 100
  }
]

const MOCK_LOGS: CortexJobLog[] = [
  { id: 'log_001', jobId: 'job_001', jobName: 'Web Research: Competitor Analysis', level: 'info', message: 'Starting scrape of target domains.', timestamp: '2026-02-23T10:15:01Z' },
  { id: 'log_002', jobId: 'job_001', jobName: 'Web Research: Competitor Analysis', level: 'info', message: 'Fetched https://example.com/pricing (200 OK).', timestamp: '2026-02-23T10:15:08Z' },
  { id: 'log_003', jobId: 'job_001', jobName: 'Web Research: Competitor Analysis', level: 'warn', message: 'Rate limit encountered on domain competitor.io — retrying in 5s.', timestamp: '2026-02-23T10:16:20Z' },
  { id: 'log_004', jobId: 'job_003', jobName: 'Sync Customer Data', level: 'error', message: 'Connection refused: CRM endpoint returned 503.', timestamp: '2026-02-23T07:31:04Z' },
  { id: 'log_005', jobId: 'job_003', jobName: 'Sync Customer Data', level: 'error', message: 'Job failed after 3 retries.', timestamp: '2026-02-23T07:31:05Z' },
  { id: 'log_006', jobId: 'job_002', jobName: 'Summarise Q1 Reports', level: 'info', message: 'Processing 14 PDF documents.', timestamp: '2026-02-23T08:00:05Z' },
  { id: 'log_007', jobId: 'job_002', jobName: 'Summarise Q1 Reports', level: 'info', message: 'All documents processed. Generating summary.', timestamp: '2026-02-23T08:13:50Z' },
  { id: 'log_008', jobId: 'job_002', jobName: 'Summarise Q1 Reports', level: 'info', message: 'Job completed successfully.', timestamp: '2026-02-23T08:14:22Z' },
  { id: 'log_009', jobId: 'job_001', jobName: 'Web Research: Competitor Analysis', level: 'debug', message: 'Parsed 87 product listings from page 1.', timestamp: '2026-02-23T10:18:44Z' },
  { id: 'log_010', jobId: 'job_005', jobName: 'Code Review Assistant', level: 'info', message: 'Reviewing 12 changed files.', timestamp: '2026-02-22T22:00:10Z' }
]

const MOCK_CRONS: CortexCron[] = [
  {
    id: 'cron_001',
    name: 'Daily Market Digest',
    schedule: '0 7 * * *',
    description: 'Collects and summarises market news every morning at 07:00.',
    enabled: true,
    lastRunAt: '2026-02-22T07:00:02Z',
    nextRunAt: '2026-02-23T07:00:00Z',
    lastStatus: 'success'
  },
  {
    id: 'cron_002',
    name: 'Sync Customer Data',
    schedule: '*/30 * * * *',
    description: 'Pulls latest customer records from the CRM every 30 minutes.',
    enabled: true,
    lastRunAt: '2026-02-23T07:30:00Z',
    nextRunAt: '2026-02-23T08:00:00Z',
    lastStatus: 'failed'
  },
  {
    id: 'cron_003',
    name: 'Weekly Report Generation',
    schedule: '0 9 * * 1',
    description: 'Generates and distributes the weekly performance report on Mondays.',
    enabled: true,
    lastRunAt: '2026-02-17T09:00:05Z',
    nextRunAt: '2026-02-24T09:00:00Z',
    lastStatus: 'success'
  },
  {
    id: 'cron_004',
    name: 'Log Cleanup',
    schedule: '0 2 * * 0',
    description: 'Archives logs older than 30 days every Sunday at 02:00.',
    enabled: false,
    lastRunAt: '2026-02-16T02:00:00Z',
    nextRunAt: '2026-02-23T02:00:00Z',
    lastStatus: 'success'
  }
]

// ─── END MOCK DATA ─────────────────────────────────────────────────────────────

export const useCortexJobs = () => {
  const jobs = useState<CortexJob[]>('cortex.jobs', () => MOCK_JOBS)
  const logs = useState<CortexJobLog[]>('cortex.logs', () => MOCK_LOGS)
  const crons = useState<CortexCron[]>('cortex.crons', () => MOCK_CRONS)

  return { jobs, logs, crons }
}
