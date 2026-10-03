import { test } from 'node:test';
import assert from 'node:assert';
import { encryptSecret, decryptSecret } from '../../src/backend/utils/encryption.ts';

test('Encryption Utility Unit Tests - encrypt and decrypt roundtrip', () => {
  const password = 'vcf_admin_password_123!';
  const encrypted = encryptSecret(password);
  assert.notStrictEqual(encrypted, password);
  assert.strictEqual(encrypted.split(':').length, 3);

  const decrypted = decryptSecret(encrypted);
  assert.strictEqual(decrypted, password);
});

test('Encryption Utility Unit Tests - empty input', () => {
  assert.strictEqual(encryptSecret(''), '');
  assert.strictEqual(decryptSecret(''), '');
});
