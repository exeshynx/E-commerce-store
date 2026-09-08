import bcrypt from 'bcrypt';
import { env } from '../../config/env.js';

export const passwordService = {
  hash: (password: string) => bcrypt.hash(password, env.BCRYPT_ROUNDS),
  verify: (password: string, passwordHash: string) => bcrypt.compare(password, passwordHash),
};
