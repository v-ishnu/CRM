import crypto from 'crypto';

function getEncryptionKey(): Buffer {
  const keyHex = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.AUTH_SECRET || 'crm_default_secure_encryption_key_2026';
  
  // Resilient key derivation: if hex key is 64 chars (32 bytes), use directly; otherwise, hash with SHA-256 to derive a safe 32-byte key!
  if (/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    return Buffer.from(keyHex, 'hex');
  }
  return crypto.createHash('sha256').update(keyHex).digest();
}

export interface EncryptedBlock {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encrypt(plaintext: string): EncryptedBlock {
  if (!plaintext) {
    return { ciphertext: '', iv: '', authTag: '' };
  }
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag,
  };
}

export function decrypt(block: EncryptedBlock): string {
  if (!block || !block.ciphertext) {
    return '';
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
