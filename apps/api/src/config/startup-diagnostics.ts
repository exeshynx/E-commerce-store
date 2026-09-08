import { env } from './env.js';
import { logger } from './logger.js';

export const logStartupDiagnostics = (processType: 'api' | 'worker') => {
  const memory = process.memoryUsage();
  logger.info('Runtime diagnostics', {
    architecture: process.arch,
    deploymentEnvironment: env.DEPLOYMENT_ENVIRONMENT,
    memoryRssBytes: memory.rss,
    nodeVersion: process.version,
    processId: process.pid,
    processType,
    releaseSha: env.RELEASE_SHA,
    runtimeEnvironment: env.NODE_ENV,
    version: env.APP_VERSION,
  });
};
