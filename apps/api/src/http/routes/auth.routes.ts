import { Router, type CookieOptions, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authService } from '../../core/auth/auth.service.js';
import { loginSchema, registerSchema } from '../../core/auth/auth.schemas.js';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireTrustedOrigin } from '../middleware/csrf-origin.js';

const refreshCookieName = 'aurelia_refresh';
const refreshCookiePath = '/api/v1/auth';

const getRefreshToken = (request: Request) => {
  const value: unknown = request.signedCookies[refreshCookieName];
  return typeof value === 'string' ? value : undefined;
};

const baseCookieOptions = {
  httpOnly: true,
  path: refreshCookiePath,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  signed: true,
  priority: 'high',
} satisfies CookieOptions;

const authenticationRateLimit = (limit: number) =>
  rateLimit({
    handler: (_request, _response, next) =>
      next(
        new AppError(
          429,
          'AUTH_RATE_LIMIT_EXCEEDED',
          'Too many authentication attempts. Please try again later.',
        ),
      ),
    legacyHeaders: false,
    limit,
    standardHeaders: 'draft-8',
    windowMs: 15 * 60 * 1_000,
  });

const loginRateLimit = authenticationRateLimit(env.AUTH_LOGIN_RATE_LIMIT_MAX);
const registerRateLimit = authenticationRateLimit(env.AUTH_REGISTER_RATE_LIMIT_MAX);

const setRefreshCookie = (response: Response, token: string, expiresAt: Date) => {
  response.cookie(refreshCookieName, token, {
    ...baseCookieOptions,
    expires: expiresAt,
  });
};

export const authRouter = Router();

authRouter.post('/register', registerRateLimit, async (request, response) => {
  const result = await authService.register(registerSchema.parse(request.body));
  setRefreshCookie(response, result.refreshToken, result.refreshTokenExpiresAt);
  response.status(201).json({
    data: {
      accessToken: result.accessToken,
      user: result.user,
    },
    requestId: request.id,
  });
});

authRouter.post('/login', loginRateLimit, async (request, response) => {
  const result = await authService.login(loginSchema.parse(request.body), {
    ...(request.ip ? { ipAddress: request.ip } : {}),
    requestId: request.id,
  });
  setRefreshCookie(response, result.refreshToken, result.refreshTokenExpiresAt);
  response.json({
    data: {
      accessToken: result.accessToken,
      user: result.user,
    },
    requestId: request.id,
  });
});

authRouter.post('/refresh', requireTrustedOrigin, async (request, response) => {
  const refreshToken = getRefreshToken(request);
  if (!refreshToken) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh session is unavailable.');
  }

  const result = await authService.refresh(refreshToken);
  setRefreshCookie(response, result.refreshToken, result.refreshTokenExpiresAt);
  response.json({
    data: {
      accessToken: result.accessToken,
      user: result.user,
    },
    requestId: request.id,
  });
});

authRouter.post('/logout', requireTrustedOrigin, async (request, response) => {
  await authService.logout(getRefreshToken(request));
  response.clearCookie(refreshCookieName, baseCookieOptions);
  response.status(204).send();
});

authRouter.get('/me', authenticate, async (request, response) => {
  if (!request.auth) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }

  response.json({
    data: {
      user: await authService.getUser(request.auth.userId),
    },
    requestId: request.id,
  });
});
