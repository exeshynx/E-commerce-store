import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { metrics } from '../../infrastructure/observability/metrics.js';

export const notFoundHandler: RequestHandler = (request, response) => {
  metrics.recordError('ROUTE_NOT_FOUND');
  response.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      errorId: randomUUID(),
      message: `No route exists for ${request.method} ${request.path}.`,
    },
    requestId: request.id,
  });
};
