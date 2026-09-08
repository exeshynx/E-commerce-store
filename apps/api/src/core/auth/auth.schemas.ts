import { z } from 'zod';

const emailSchema = z
  .email('Enter a valid email address')
  .max(254)
  .transform((email) => email.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(12, 'Password must contain at least 12 characters')
  .max(128, 'Password must contain at most 128 characters')
  .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, {
    message: 'Password is too long when encoded',
  })
  .refine((password) => /[a-z]/.test(password), {
    message: 'Password must contain a lowercase letter',
  })
  .refine((password) => /[A-Z]/.test(password), {
    message: 'Password must contain an uppercase letter',
  })
  .refine((password) => /\d/.test(password), {
    message: 'Password must contain a number',
  });

const nameSchema = z.string().trim().min(1).max(80);

export const registerSchema = z.object({
  email: emailSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
