import type { ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { ZodError } from 'zod';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../errors/app-error.js';
import { metrics } from '../../infrastructure/observability/metrics.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  const errorId = randomUUID();
  if (
    error instanceof Error &&
    'status' in error &&
    error.status === 413 &&
    'type' in error &&
    error.type === 'entity.too.large'
  ) {
    metrics.recordError('REQUEST_TOO_LARGE');
    response.status(413).json({
      error: {
        code: 'REQUEST_TOO_LARGE',
        errorId,
        message: 'The request body exceeds the allowed size.',
      },
      requestId: request.id,
    });
    return;
  }
  if (
    error instanceof SyntaxError &&
    'status' in error &&
    error.status === 400 &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  ) {
    metrics.recordError('INVALID_JSON');
    response.status(400).json({
      error: {
        code: 'INVALID_JSON',
        errorId,
        message: 'The request body must contain valid JSON.',
      },
      requestId: request.id,
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    metrics.recordError(
      error.code === 'LIMIT_FILE_SIZE' ? 'IMAGE_TOO_LARGE' : 'INVALID_IMAGE_UPLOAD',
    );
    response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 422).json({
      error: {
        code: error.code === 'LIMIT_FILE_SIZE' ? 'IMAGE_TOO_LARGE' : 'INVALID_IMAGE_UPLOAD',
        errorId,
        message:
          error.code === 'LIMIT_FILE_SIZE'
            ? 'The image must be 5 MB or smaller.'
            : 'The image upload is invalid.',
      },
      requestId: request.id,
    });
    return;
  }

  if (error instanceof ZodError) {
    metrics.recordError('VALIDATION_ERROR');
    response.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        errorId,
        message: 'The request contains invalid data.',
        details: error.flatten(),
      },
      requestId: request.id,
    });
    return;
  }

  if (error instanceof AppError) {
    metrics.recordError(error.code);
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        errorId,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
      requestId: request.id,
    });
    return;
  }

  logger.error('Unhandled request error', {
    error: error instanceof Error ? error.message : String(error),
    errorId,
    requestId: request.id,
    stack: error instanceof Error && env.NODE_ENV !== 'production' ? error.stack : undefined,
  });

  response.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      errorId,
      message: 'An unexpected error occurred.',
    },
    requestId: request.id,
  });
  metrics.recordError('INTERNAL_SERVER_ERROR');
};
