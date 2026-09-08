import type { EmailProvider } from './email-provider.js';
import { smtpEmailProvider } from './smtp-email.provider.js';

let currentProvider: EmailProvider = smtpEmailProvider;

export const getEmailProvider = () => currentProvider;

export const replaceEmailProvider = (provider: EmailProvider) => {
  const previous = currentProvider;
  currentProvider = provider;
  return () => {
    currentProvider = previous;
  };
};
