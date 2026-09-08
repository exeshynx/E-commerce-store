export type SendEmailInput = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

export type SendEmailResult = {
  messageId: string | null;
};

export interface EmailProvider {
  readonly configured: boolean;
  readonly name: string;
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
