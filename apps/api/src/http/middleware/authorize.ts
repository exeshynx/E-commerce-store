import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { AppError } from '../errors/app-error.js';

export const authorize = (...allowedRoles: UserRole[]): RequestHandler => {
  return (request, _response, next) => {
    if (!request.auth) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    }

    if (!allowedRoles.includes(request.auth.role)) {
      throw new AppError(403, 'INSUFFICIENT_PERMISSIONS', 'Administrator access is required.');
    }

    next();
  };
};
