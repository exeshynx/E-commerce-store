import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

const digest = (value: string) => createHash('sha256').update(value).digest();

export const requireOperationalToken: RequestHandler = (request, _response, next) => {
  if (!env.METRICS_TOKEN && env.NODE_ENV !== 'production') {
    next();
    return;
  }
  const [scheme, token] = request.header('authorization')?.split(' ') ?? [];
  if (
    scheme !== 'Bearer' ||
    !token ||
    !env.METRICS_TOKEN ||
    !timingSafeEqual(digest(token), digest(env.METRICS_TOKEN))
  ) {
    throw new AppError(401, 'OPERATIONAL_AUTHENTICATION_REQUIRED', 'A metrics token is required.');
  }
  next();
};
