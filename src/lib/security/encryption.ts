import crypto from 'crypto';

export interface EncryptedBlock {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function isEncryptionConfigured(): boolean {
  return !!process.env.CREDENTIAL_ENCRYPTION_KEY;
}

function deriveKey(raw?: string | null): Buffer | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Resilient key derivation: if hex key is 64 chars (32 bytes), use directly; otherwise, hash with SHA-256 to derive a safe 32-byte key!
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  return crypto.createHash('sha256').update(trimmed).digest();
}

export function getEncryptionKey(): Buffer {
  const primary = deriveKey(process.env.CREDENTIAL_ENCRYPTION_KEY);
  if (primary) return primary;

  const fallback = deriveKey(process.env.AUTH_SECRET);
  if (fallback) return fallback;

  return deriveKey('crm_default_secure_encryption_key_2026')!;
}

export function getDecryptionKeys(): Buffer[] {
  const keys: Buffer[] = [];
  const seen = new Set<string>();

  const pushKey = (raw?: string | null) => {
    const k = deriveKey(raw);
    if (!k) return;
    const hex = k.toString('hex');
    if (!seen.has(hex)) {
      seen.add(hex);
      keys.push(k);
    }
  };

  // 1. Primary active encryption key
  pushKey(process.env.CREDENTIAL_ENCRYPTION_KEY);

  // 2. Explicit fallback / previous keys from environment variables
  if (process.env.CREDENTIAL_ENCRYPTION_KEY_FALLBACK) {
    process.env.CREDENTIAL_ENCRYPTION_KEY_FALLBACK.split(',').forEach(pushKey);
  }
  if (process.env.PREVIOUS_ENCRYPTION_KEYS) {
    process.env.PREVIOUS_ENCRYPTION_KEYS.split(',').forEach(pushKey);
  }

  // 3. Fallback to AUTH_SECRET (historical fallback from initial commit e5b190e)
  pushKey(process.env.AUTH_SECRET);

  // 4. Default fallback key if no key is configured
  pushKey('crm_default_secure_encryption_key_2026');

  return keys;
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
 * Decrypt an AES-256-GCM encrypted block with multi-key keyring fallback.
 */
export function decrypt(block: EncryptedBlock | null | undefined): string {
  if (!block || (!block.ciphertext && !block.iv && !block.authTag)) {
    return '';
  }

  if (!block.ciphertext || !block.iv || !block.authTag) {
    throw new Error('Cannot decrypt invalid or incomplete encrypted block: missing ciphertext, iv, or authTag');
  }

  const keys = getDecryptionKeys();
  const iv = Buffer.from(block.iv, 'hex');
  const tag = Buffer.from(block.authTag, 'hex');

  let lastError: Error | null = null;
  for (const key of keys) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      let plaintext = decipher.update(block.ciphertext, 'hex', 'utf8');
      plaintext += decipher.final('utf8');
      return plaintext;
    } catch (err: any) {
      lastError = err;
      // Tag mismatch indicates this block was encrypted with another key in the keyring
    }
  }

  throw new Error(`Decryption failed: Authentication tag mismatch across all configured keys (${lastError?.message || 'unknown'})`);
}
