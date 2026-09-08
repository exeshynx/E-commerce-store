import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './infrastructure/database/prisma.js';
import { logStartupDiagnostics } from './config/startup-diagnostics.js';

const server = createServer(createApp());
logStartupDiagnostics('api');
let shuttingDown = false;

const shutdown = (signal: NodeJS.Signals) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Graceful shutdown started', { signal });

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close(async (error) => {
    await prisma.$disconnect();
    if (error) {
      logger.error('HTTP server failed to close', { error: error.message });
      process.exit(1);
    }
    logger.info('Graceful shutdown completed');
    process.exit(0);
  });
};

server.listen(env.API_PORT, env.API_HOST, () => {
  logger.info('API listening', {
    environment: env.NODE_ENV,
    host: env.API_HOST,
    port: env.API_PORT,
  });
});

server.on('error', (error) => {
  logger.error('HTTP server error', { error: error.message });
  process.exit(1);
});

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  void shutdown('SIGTERM');
});
