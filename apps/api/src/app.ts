import { randomUUID } from 'node:crypto';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { uploadsRoot } from './infrastructure/storage/product-image.storage.js';
import { env } from './config/env.js';
import { errorHandler } from './http/middleware/error-handler.js';
import { notFoundHandler } from './http/middleware/not-found.js';
import { authRouter } from './http/routes/auth.routes.js';
import { adminCatalogRouter } from './http/routes/admin-catalog.routes.js';
import { adminRouter } from './http/routes/admin.routes.js';
import { adminPaymentRouter } from './http/routes/admin-payment.routes.js';
import { adminShipmentRouter } from './http/routes/admin-shipment.routes.js';
import { adminAuditRouter } from './http/routes/admin-audit.routes.js';
import { catalogRouter } from './http/routes/catalog.routes.js';
import { commerceRouter } from './http/routes/commerce.routes.js';
import { healthRouter } from './http/routes/health.routes.js';
import { orderRouter } from './http/routes/order.routes.js';
import { paymentRouter } from './http/routes/payment.routes.js';
import { paymentWebhookRouter } from './http/routes/payment-webhook.routes.js';
import { shipmentRouter } from './http/routes/shipment.routes.js';
import { metricsRouter } from './http/routes/metrics.routes.js';
import { requestObservability } from './http/middleware/request-observability.js';
import { AppError } from './http/errors/app-error.js';
import { returnRouter } from './http/routes/return.routes.js';
import { adminReturnRouter } from './http/routes/admin-return.routes.js';
import { supportRouter } from './http/routes/support.routes.js';
import { adminSupportRouter } from './http/routes/admin-support.routes.js';
import { reviewRouter } from './http/routes/review.routes.js';
import { adminReviewRouter } from './http/routes/admin-review.routes.js';
import { couponRouter } from './http/routes/coupon.routes.js';
import { adminCouponRouter } from './http/routes/admin-coupon.routes.js';
import { accountRouter } from './http/routes/account.routes.js';
import { discoveryRouter } from './http/routes/discovery.routes.js';
import { adminDiscoveryRouter } from './http/routes/admin-discovery.routes.js';
import { adminCampaignRouter } from './http/routes/admin-campaign.routes.js';
import { adminCommerceActivityRouter } from './http/routes/admin-commerce-activity.routes.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((request, response, next) => {
    const suppliedRequestId = request.header('x-request-id');
    request.id =
      suppliedRequestId && /^[A-Za-z0-9._:-]{1,128}$/.test(suppliedRequestId)
        ? suppliedRequestId
        : randomUUID();
    response.setHeader('x-request-id', request.id);
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          baseUri: ["'none'"],
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts:
        env.NODE_ENV === 'production'
          ? { includeSubDomains: true, maxAge: 31_536_000, preload: true }
          : false,
      referrerPolicy: { policy: 'no-referrer' },
      xFrameOptions: { action: 'deny' },
    }),
  );
  app.use((_request, response, next) => {
    response.setHeader(
      'Permissions-Policy',
      'camera=(), geolocation=(), microphone=(), payment=(self), usb=()',
    );
    next();
  });
  app.use(
    cors({
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      origin: env.WEB_URL,
    }),
  );
  app.use(compression());
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(requestObservability);
  app.use(
    '/api/v1/payments/webhooks',
    rateLimit({
      handler: (_request, _response, next) =>
        next(
          new AppError(
            429,
            'WEBHOOK_RATE_LIMIT_EXCEEDED',
            'Too many webhook requests. Try again later.',
          ),
        ),
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      windowMs: 60 * 1000,
    }),
    express.raw({ limit: '256kb', type: 'application/json' }),
    paymentWebhookRouter,
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb', parameterLimit: 100 }));
  app.use(
    rateLimit({
      handler: (_request, _response, next) =>
        next(new AppError(429, 'API_RATE_LIMIT_EXCEEDED', 'Too many requests. Try again later.')),
      limit: env.API_RATE_LIMIT_MAX,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      windowMs: 15 * 60 * 1000,
    }),
  );
  app.use(
    '/uploads',
    express.static(uploadsRoot, {
      dotfiles: 'deny',
      index: false,
      maxAge: env.NODE_ENV === 'production' ? '1d' : 0,
    }),
  );
  app.use('/health', healthRouter);
  app.use('/metrics', metricsRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/admin', adminCatalogRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/admin', adminPaymentRouter);
  app.use('/api/v1/admin', adminShipmentRouter);
  app.use('/api/v1/admin', adminAuditRouter);
  app.use('/api/v1/admin', adminReturnRouter);
  app.use('/api/v1/admin', adminSupportRouter);
  app.use('/api/v1/admin', adminReviewRouter);
  app.use('/api/v1/admin', adminCouponRouter);
  app.use('/api/v1/admin', adminDiscoveryRouter);
  app.use('/api/v1/admin', adminCampaignRouter);
  app.use('/api/v1/admin', adminCommerceActivityRouter);
  app.use('/api/v1', orderRouter);
  app.use('/api/v1', paymentRouter);
  app.use('/api/v1', shipmentRouter);
  app.use('/api/v1', returnRouter);
  app.use('/api/v1', supportRouter);
  app.use('/api/v1', reviewRouter);
  app.use('/api/v1', couponRouter);
  app.use('/api/v1', accountRouter);
  app.use('/api/v1', discoveryRouter);
  app.use('/api/v1', commerceRouter);
  app.use('/api/v1', catalogRouter);
  app.get('/api/v1', (request, response) => {
    response.json({
      data: {
        name: 'Veyora Commerce API',
        version: 'v1',
      },
      requestId: request.id,
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
