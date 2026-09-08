import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';

export type AuthTokenClaims = {
  role: 'ADMIN' | 'CUSTOMER';
  sessionId: string;
  subject: string;
};

const sign = (
  claims: AuthTokenClaims,
  secret: string,
  expiresIn: NonNullable<SignOptions['expiresIn']>,
  tokenType: 'access' | 'refresh',
) =>
  jwt.sign(
    {
      role: claims.role,
      sessionId: claims.sessionId,
      tokenType,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn,
      issuer: 'aurelia-api',
      audience: 'aurelia-web',
      subject: claims.subject,
    },
  );

const getExpiration = (token: string) => {
  const payload = jwt.decode(token);

  if (typeof payload === 'string' || typeof payload?.exp !== 'number') {
    throw new Error('Signed token does not contain an expiration');
  }

  return new Date(payload.exp * 1_000);
};

const verify = (token: string, secret: string, expectedType: 'access' | 'refresh') => {
  const payload = jwt.verify(token, secret, {
    algorithms: ['HS256'],
    audience: 'aurelia-web',
    issuer: 'aurelia-api',
  }) as JwtPayload & { role?: unknown; sessionId?: unknown; tokenType?: unknown };

  if (
    payload.tokenType !== expectedType ||
    (payload.role !== 'ADMIN' && payload.role !== 'CUSTOMER') ||
    typeof payload.sessionId !== 'string' ||
    typeof payload.sub !== 'string'
  ) {
    throw new jwt.JsonWebTokenError('Invalid token claims');
  }

  return {
    role: payload.role,
    sessionId: payload.sessionId,
    subject: payload.sub,
  } satisfies AuthTokenClaims;
};

export const tokenService = {
  createAccessToken: (claims: AuthTokenClaims) =>
    sign(claims, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_TTL, 'access'),
  createRefreshToken: (claims: AuthTokenClaims) => {
    const token = sign(claims, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_TTL, 'refresh');
    return { expiresAt: getExpiration(token), token };
  },
  verifyAccessToken: (token: string) => verify(token, env.JWT_ACCESS_SECRET, 'access'),
  verifyRefreshToken: (token: string) => verify(token, env.JWT_REFRESH_SECRET, 'refresh'),
};
