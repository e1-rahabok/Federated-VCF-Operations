import crypto from 'node:crypto';
import { CONFIG } from '../config.ts';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const key = Buffer.from(CONFIG.ENCRYPTION_KEY.slice(0, 64), 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptSecret(cipherText: string): string {
  if (!cipherText) return '';
  const parts = cipherText.split(':');
  if (parts.length !== 3) return cipherText;

  const key = Buffer.from(CONFIG.ENCRYPTION_KEY.slice(0, 64), 'hex');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
