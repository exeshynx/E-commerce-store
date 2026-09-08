import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { backgroundJobsService } from './core/jobs/background-jobs.service.js';
import { prisma } from './infrastructure/database/prisma.js';
import { logStartupDiagnostics } from './config/startup-diagnostics.js';

let stopping = false;
let currentRun: Promise<void> | null = null;
logStartupDiagnostics('worker');

const run = () => {
  if (stopping || currentRun) return;
  currentRun = backgroundJobsService
    .runOnce()
    .catch((error: unknown) => {
      logger.error('Background worker pass failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      currentRun = null;
    });
};

logger.info('Background worker started', { pollIntervalMs: env.WORKER_POLL_INTERVAL_MS });
run();
const interval = setInterval(run, env.WORKER_POLL_INTERVAL_MS);

const shutdown = async (signal: NodeJS.Signals) => {
  if (stopping) return;
  stopping = true;
  clearInterval(interval);
  logger.info('Background worker shutdown started', { signal });
  await currentRun;
  await prisma.$disconnect();
  logger.info('Background worker shutdown completed');
};

process.on('SIGINT', () => void shutdown('SIGINT').finally(() => process.exit(0)));
process.on('SIGTERM', () => void shutdown('SIGTERM').finally(() => process.exit(0)));
process.on('unhandledRejection', (reason) => {
  logger.error('Background worker unhandled rejection', { reason: String(reason) });
});
