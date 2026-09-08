import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import type { EmailProvider } from './email-provider.js';

const configured = env.SMTP_ENABLED;
const transporter = configured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      ...(env.SMTP_USER
        ? { auth: { pass: env.SMTP_PASSWORD as string, user: env.SMTP_USER } }
        : {}),
    })
  : null;

export const smtpEmailProvider: EmailProvider = {
  configured,
  name: 'smtp',
  send: async (input) => {
    if (!transporter || !env.EMAIL_FROM) {
      throw new Error('SMTP email delivery is not configured.');
    }
    const result = await transporter.sendMail({
      from: env.EMAIL_FROM,
      html: input.html,
      subject: input.subject,
      text: input.text,
      to: input.to,
    });
    return { messageId: result.messageId || null };
  },
};
