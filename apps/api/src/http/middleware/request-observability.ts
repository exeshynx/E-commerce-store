import type { RequestHandler } from 'express';
import { logger } from '../../config/logger.js';
import { metrics } from '../../infrastructure/observability/metrics.js';

const routePathFrom = (value: unknown) => {
  if (!value || typeof value !== 'object' || !('path' in value)) return null;
  return typeof value.path === 'string' ? value.path : null;
};

const routePrefixFrom = (originalUrl: string) => {
  const path = originalUrl.split('?', 1)[0] ?? '';
  if (path.startsWith('/api/v1/payments/webhooks')) return '/api/v1/payments/webhooks';
  if (path.startsWith('/api/v1/admin')) return '/api/v1/admin';
  if (path.startsWith('/api/v1/auth')) return '/api/v1/auth';
  if (path.startsWith('/api/v1')) return '/api/v1';
  if (path.startsWith('/health')) return '/health';
  if (path.startsWith('/metrics')) return '/metrics';
  return '';
};

export const requestObservability: RequestHandler = (request, response, next) => {
  const startedAt = process.hrtime.bigint();
  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const matchedPath = routePathFrom(request.route as unknown);
    const routePath = matchedPath
      ? matchedPath.startsWith('/api/') || matchedPath.startsWith('/health')
        ? matchedPath
        : `${routePrefixFrom(request.originalUrl)}${matchedPath}`
      : 'unmatched';
    metrics.recordHttp(request.method, routePath, response.statusCode, durationMs / 1000);
    if (request.path !== '/health/live') {
      logger.info('HTTP request completed', {
        durationMs: Number(durationMs.toFixed(2)),
        method: request.method,
        requestId: request.id,
        route: routePath,
        statusCode: response.statusCode,
      });
    }
  });
  next();
};
