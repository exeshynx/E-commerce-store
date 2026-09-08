import type { RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

const trustedOrigin = new URL(env.WEB_URL).origin;

export const requireTrustedOrigin: RequestHandler = (request, _response, next) => {
  const origin = request.header('origin');
  if (!origin || origin === trustedOrigin) {
    next();
    return;
  }

  next(
    new AppError(
      403,
      'UNTRUSTED_REQUEST_ORIGIN',
      'The request origin is not allowed for this cookie-authenticated operation.',
    ),
  );
};
