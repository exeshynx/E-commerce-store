import { Router } from 'express';
import { prisma } from '../../infrastructure/database/prisma.js';
import { requireOperationalToken } from '../middleware/operational-auth.js';
import { env } from '../../config/env.js';

const startedAt = process.uptime();
export const healthRouter = Router();

const healthPayload = (status: 'ok' | 'ready' | 'not_ready') => ({
  deploymentEnvironment: env.DEPLOYMENT_ENVIRONMENT,
  releaseSha: env.RELEASE_SHA,
  service: 'veyora-api' as const,
  status,
  timestamp: new Date().toISOString(),
  uptimeSeconds: Math.max(0, Math.round(process.uptime() - startedAt)),
  version: env.APP_VERSION,
});

healthRouter.get('/live', (_request, response) => {
  response.status(200).json(healthPayload('ok'));
});

healthRouter.get('/ready', async (_request, response) => {
  const checkedAt = Date.now();
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Database readiness check timed out')), 3_000);
      }),
    ]);
    response.status(200).json({
      ...healthPayload('ready'),
      checks: { database: { latencyMs: Date.now() - checkedAt, status: 'ready' } },
    });
  } catch (error) {
    response.status(503).json({
      ...healthPayload('not_ready'),
      checks: {
        database: {
          latencyMs: Date.now() - checkedAt,
          message: error instanceof Error ? error.message : 'Database unavailable',
          status: 'not_ready',
        },
      },
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
});

healthRouter.get('/operational', requireOperationalToken, async (_request, response) => {
  const [jobs, emailGroups, failedWebhooks] = await Promise.all([
    prisma.backgroundJobState.findMany({ orderBy: { name: 'asc' } }),
    prisma.emailQueueItem.groupBy({ _count: { _all: true }, by: ['status'] }),
    prisma.paymentWebhookEvent.count({ where: { processingStatus: 'FAILED' } }),
  ]);
  response.json({
    ...healthPayload('ready'),
    backgroundJobs: jobs.map((job) => ({
      ...job,
      createdAt: job.createdAt.toISOString(),
      lastFailedAt: job.lastFailedAt?.toISOString() ?? null,
      lastStartedAt: job.lastStartedAt?.toISOString() ?? null,
      lastSucceededAt: job.lastSucceededAt?.toISOString() ?? null,
      updatedAt: job.updatedAt.toISOString(),
    })),
    emailQueue: Object.fromEntries(emailGroups.map((group) => [group.status, group._count._all])),
    failedWebhooks,
  });
});
