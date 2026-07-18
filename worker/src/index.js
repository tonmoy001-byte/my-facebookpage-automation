import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ─── Prisma Setup ────────────────────────────────────────────

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── Redis Connection ────────────────────────────────────────

function getRedisConnection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL is required');

  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

const connection = getRedisConnection();

// ─── Facebook Graph API Helper ───────────────────────────────

async function publishToFacebook(accessToken, pageId, content, mediaUrls) {
  // If there are media attachments, publish with photos/videos
  if (mediaUrls && mediaUrls.length > 0) {
    if (mediaUrls.length === 1) {
      // Single media: use /photos endpoint
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/photos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: mediaUrls[0],
            caption: content,
            access_token: accessToken,
          }),
        }
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.id;
    } else {
      // Multiple media: use /feed with attached_media
      const mediaIds = [];
      for (const url of mediaUrls) {
        const resp = await fetch(
          `https://graph.facebook.com/v21.0/${pageId}/photos`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url,
              published: false,
              access_token: accessToken,
            }),
          }
        );
        const d = await resp.json();
        if (d.error) throw new Error(d.error.message);
        mediaIds.push({ media_fbid: d.id });
      }

      const postResp = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/feed`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            attached_media: mediaIds,
            access_token: accessToken,
          }),
        }
      );
      const postData = await postResp.json();
      if (postData.error) throw new Error(postData.error.message);
      return postData.id;
    }
  }

  // Text-only post
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/feed`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: content,
        access_token: accessToken,
      }),
    }
  );
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.id;
}

// ─── Job Processing ──────────────────────────────────────────

async function processPublishJob(job) {
  const { jobId } = job.data;
  console.log(`[Worker] Processing publish job: ${jobId}`);

  // Fetch the PublishJob with relations
  const publishJob = await prisma.publishJob.findUnique({
    where: { id: jobId },
    include: {
      post: true,
      tenant: true,
    },
  });

  if (!publishJob) {
    throw new Error(`PublishJob ${jobId} not found`);
  }

  if (publishJob.status === 'cancelled') {
    console.log(`[Worker] Job ${jobId} cancelled, skipping`);
    return { skipped: true };
  }

  // Update status to publishing
  await prisma.publishJob.update({
    where: { id: jobId },
    data: { status: 'publishing', attempts: { increment: 1 } },
  });

  // Create attempt record
  const attempt = await prisma.publishAttempt.create({
    data: {
      jobId,
      tenantId: publishJob.tenantId,
      attemptNumber: publishJob.attempts + 1,
      status: 'running',
      startedAt: new Date(),
    },
  });

  try {
    // Get the Facebook page access token
    const post = publishJob.post;
    const page = await prisma.facebookPage.findFirst({
      where: { tenantId: publishJob.tenantId },
    });

    if (!page) {
      throw new Error('No Facebook page connected for this tenant');
    }

    // Publish to Facebook
    const facebookPostId = await publishToFacebook(
      page.accessToken,
      page.pageId,
      post.content,
      post.mediaUrls
    );

    // Success: update all records
    const now = new Date();

    await prisma.publishAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'completed',
        facebookPostId,
        finishedAt: now,
      },
    });

    await prisma.publishJob.update({
      where: { id: jobId },
      data: {
        status: 'published',
        facebookPostId,
        publishedAt: now,
      },
    });

    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: 'published',
        facebookPostId,
        publishedAt: now,
      },
    });

    console.log(`[Worker] Successfully published job ${jobId} → FB post ${facebookPostId}`);
    return { facebookPostId };
  } catch (error) {
    // Failure: update attempt and job
    const now = new Date();

    await prisma.publishAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'failed',
        errorMessage: error.message,
        finishedAt: now,
      },
    });

    await prisma.publishJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: error.message,
      },
    });

    await prisma.post.update({
      where: { id: publishJob.postId },
      data: {
        status: 'failed',
        errorMessage: error.message,
      },
    });

    console.error(`[Worker] Failed to publish job ${jobId}:`, error.message);
    throw error; // Let BullMQ handle retries
  }
}

// ─── Worker Setup ────────────────────────────────────────────

const worker = new Worker('publish-jobs', processPublishJob, {
  connection,
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 60000, // 10 jobs per minute
  },
});

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed for PublishJob ${job.data.jobId}`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

worker.on('ready', () => {
  console.log('[Worker] BullMQ worker ready, listening for publish-jobs...');
});

// ─── Graceful Shutdown ───────────────────────────────────────

async function shutdown() {
  console.log('[Worker] Shutting down...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[Worker] Starting fb-saas-worker...');
