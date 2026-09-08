import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { metrics } from '../observability/metrics.js';

const databaseUrl = new URL(env.DATABASE_URL);
const databaseName = databaseUrl.pathname.replace(/^\//, '');

if (!databaseName) {
  throw new Error('DATABASE_URL must include a database name');
}

const adapter = new PrismaMariaDb({
  acquireTimeout: 5_000,
  connectTimeout: 3_000,
  connectionLimit: env.NODE_ENV === 'production' ? 20 : 5,
  database: databaseName,
  host: databaseUrl.hostname,
  password: decodeURIComponent(databaseUrl.password),
  port: databaseUrl.port ? Number(databaseUrl.port) : 3306,
  user: decodeURIComponent(databaseUrl.username),
});

export const prisma = new PrismaClient({
  adapter,
  log: [
    { emit: 'stdout', level: 'error' },
    ...(env.NODE_ENV === 'development'
      ? [{ emit: 'stdout' as const, level: 'warn' as const }]
      : []),
    { emit: 'event', level: 'query' },
  ],
});

prisma.$on('query', (event) => {
  metrics.recordDatabaseQuery(event.duration / 1_000);
  if (event.duration < env.SLOW_QUERY_THRESHOLD_MS) return;
  metrics.recordSlowQuery();
  logger.warn('Slow database query', {
    durationMs: event.duration,
    query: event.query.replaceAll(/\s+/g, ' ').slice(0, 500),
    target: event.target,
    thresholdMs: env.SLOW_QUERY_THRESHOLD_MS,
  });
});
