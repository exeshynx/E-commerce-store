import { Router } from 'express';
import { paymentWebhookService } from '../../core/payments/payment-webhook.service.js';
import { AppError } from '../errors/app-error.js';

export const paymentWebhookRouter = Router();

paymentWebhookRouter.post('/safepay', async (request, response) => {
  if (!Buffer.isBuffer(request.body)) {
    throw new AppError(
      415,
      'WEBHOOK_CONTENT_TYPE_REQUIRED',
      'Safepay webhooks must use the application/json content type.',
    );
  }
  const header = (name: string) => request.header(name) ?? undefined;
  const result = await paymentWebhookService.handleSafepay(request.body, {
    'x-sfpy-event-id': header('x-sfpy-event-id'),
    'x-sfpy-event-type': header('x-sfpy-event-type'),
    'x-sfpy-signature': header('x-sfpy-signature'),
  });
  response.json({ data: result, requestId: request.id });
});
