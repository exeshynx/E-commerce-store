import type { Request, RequestHandler } from 'express';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../errors/app-error.js';
import { tokenService } from '../../core/auth/token.service.js';

export const resolveAuthentication = async (request: Request) => {
  const authorization = request.header('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  try {
    const claims = tokenService.verifyAccessToken(token);
    const session = await prisma.authSession.findFirst({
      where: {
        expiresAt: { gt: new Date() },
        id: claims.sessionId,
        revokedAt: null,
        userId: claims.subject,
        user: { status: 'ACTIVE' },
      },
      select: {
        user: {
          select: { role: true },
        },
      },
    });

    if (!session) {
      throw new Error('Session is not active');
    }

    return {
      role: session.user.role,
      sessionId: claims.sessionId,
      userId: claims.subject,
    };
  } catch {
    throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'The access token is invalid or has expired.');
  }
};

export const authenticate: RequestHandler = async (request, _response, next) => {
  const auth = await resolveAuthentication(request);
  if (!auth) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }
  request.auth = auth;
  next();
};

export const optionalAuthenticate: RequestHandler = async (request, _response, next) => {
  const auth = await resolveAuthentication(request);
  if (auth) request.auth = auth;
  next();
};
