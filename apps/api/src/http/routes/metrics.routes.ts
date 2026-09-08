import { Router } from 'express';
import { prisma } from '../../infrastructure/database/prisma.js';
import { metrics } from '../../infrastructure/observability/metrics.js';
import { requireOperationalToken } from '../middleware/operational-auth.js';

export const metricsRouter = Router();
metricsRouter.use(requireOperationalToken);

metricsRouter.get('/', async (_request, response) => {
  const [emailGroups, failedWebhooks, jobs] = await Promise.all([
    prisma.emailQueueItem.groupBy({ _count: { _all: true }, by: ['status'] }),
    prisma.paymentWebhookEvent.count({ where: { processingStatus: 'FAILED' } }),
    prisma.backgroundJobState.findMany({ orderBy: { name: 'asc' } }),
  ]);
  const gauges: Record<string, number> = {
    aurelia_payment_webhooks_failed: failedWebhooks,
  };
  for (const group of emailGroups) {
    gauges[`aurelia_email_queue_items{status="${group.status}"}`] = group._count._all;
  }
  for (const job of jobs) {
    const name = job.name.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
    gauges[`aurelia_background_job_processed_total{job="${name}"}`] = job.processedCount;
    gauges[`aurelia_background_job_last_success_timestamp_seconds{job="${name}"}`] =
      job.lastSucceededAt ? job.lastSucceededAt.getTime() / 1_000 : 0;
    gauges[`aurelia_background_job_last_failure_timestamp_seconds{job="${name}"}`] =
      job.lastFailedAt ? job.lastFailedAt.getTime() / 1_000 : 0;
  }
  response.type('text/plain; version=0.0.4').send(metrics.render(gauges));
});
