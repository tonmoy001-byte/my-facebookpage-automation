// @ts-nocheck
import { Queue } from 'bullmq'

// Redis connection config — reads from REDIS_URL env var
// Upstash provides: rediss://default:<password>@<host>:<port>
function getRedisConfig() {
  const url = process.env.REDIS_URL
  if (!url) {
    return null
  }

  try {
    const parsed = new URL(url)
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379'),
      password: parsed.password || undefined,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    }
  } catch {
    return null
  }
}

const connection = getRedisConfig()

// ─── Queue (used by Next.js API routes) ─────────────────────

export const publishQueue = connection
  ? new Queue('publish-jobs', {
      connection,
      defaultJobOptions: {
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
      },
    })
  : null

/**
 * Enqueue a delayed publish job.
 * @param publishJobId - The PublishJob ID to process
 * @param scheduledAt - When to publish (Date object)
 */
export async function schedulePublishJob(publishJobId: string, scheduledAt: Date) {
  if (!publishQueue) {
    console.warn('Redis not configured — skipping queue. Post will be processed by cron fallback.')
    return null
  }

  const delay = scheduledAt.getTime() - Date.now()
  if (delay < 0) throw new Error('Cannot schedule in the past')

  const job = await publishQueue.add('publish', { jobId: publishJobId }, {
    delay,
    jobId: `job-${publishJobId}`,
  })

  return job.id
}

/**
 * Remove a pending/delayed publish job (for cancellation or reschedule).
 */
export async function cancelPublishJob(publishJobId: string) {
  if (!publishQueue) return false

  const jobs = await publishQueue.getJobs(['delayed', 'waiting', 'active'])
  const job = jobs.find(j => j.data.jobId === publishJobId)
  if (job) {
    await job.remove()
    return true
  }
  return false
}

/**
 * Get the status of a publish job from Redis.
 */
export async function getPublishJobStatus(publishJobId: string) {
  if (!publishQueue) return null

  const jobs = await publishQueue.getJobs(['delayed', 'waiting', 'active', 'completed', 'failed'])
  return jobs.find(j => j.data.jobId === publishJobId) || null
}

/**
 * Check if Redis is available.
 */
export function isRedisAvailable(): boolean {
  return connection !== null
}
