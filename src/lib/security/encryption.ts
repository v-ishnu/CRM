import crypto from 'crypto';

export interface EncryptedBlock {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function isEncryptionConfigured(): boolean {
  return !!process.env.CREDENTIAL_ENCRYPTION_KEY;
}

function getEncryptionKey(): Buffer {
  const keyHex = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.AUTH_SECRET || 'crm_default_secure_encryption_key_2026';
  
  if (!keyHex) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY is not configured.');
  }

  // Resilient key derivation: if hex key is 64 chars (32 bytes), use directly; otherwise, hash with SHA-256 to derive a safe 32-byte key!
  if (/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    return Buffer.from(keyHex, 'hex');
  }
  return crypto.createHash('sha256').update(keyHex).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM authenticated encryption.
 * Throws if plaintext is empty or encryption fails. Never produces empty ciphertext/iv/authTag.
 */
export function encrypt(plaintext: string, fieldName: string = 'field'): EncryptedBlock {
  if (!plaintext || typeof plaintext !== 'string' || plaintext.trim() === '') {
    throw new Error(`Encryption failed: Input value for '${fieldName}' cannot be empty.`);
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  const ivHex = iv.toString('hex');

  // Validate that all components were successfully generated
  if (!ciphertext || !ivHex || !authTag) {
    throw new Error(`Encryption failed: Incomplete encrypted block generated for '${fieldName}'.`);
  }

  // Safe Diagnostic Logging (Never logs secrets, plaintext, or ciphertext)
  console.log(`[ENCRYPTION_DEBUG]
field=${fieldName}
inputPresent=true
ciphertextPresent=${!!ciphertext}
ivPresent=${!!ivHex}
authTagPresent=${!!authTag}`);

  return {
    ciphertext,
    iv: ivHex,
    authTag,
  };
}

/**
 * Decrypt an AES-256-GCM encrypted block.
 */
export function decrypt(block: EncryptedBlock): string {
  if (!block || !block.ciphertext || !block.iv || !block.authTag) {
    throw new Error('Cannot decrypt invalid or incomplete encrypted block');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(block.iv, 'hex');
  const tag = Buffer.from(block.authTag, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  
  let plaintext = decipher.update(block.ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}
