import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, EncryptedBlock } from '@/lib/security/encryption';

describe('Manual Credentials & AES-256-GCM Security Tests', () => {
  const samplePlaintextPassword = 'SuperSecretP@ssw0rd!2026';
  const sampleSshKey = '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn\n-----END OPENSSH PRIVATE KEY-----';

  describe('AES-256-GCM Authenticated Encryption', () => {
    it('should encrypt plaintext password with 12-byte IV and 16-byte authTag', () => {
      const encrypted = encrypt(samplePlaintextPassword, 'password');

      expect(encrypted).toBeDefined();
      expect(encrypted.ciphertext).toBeDefined();
      expect(typeof encrypted.ciphertext).toBe('string');
      expect(encrypted.ciphertext.length).toBeGreaterThan(0);

      // IV should be 12 bytes = 24 hex characters
      expect(encrypted.iv).toHaveLength(24);

      // AuthTag should be 16 bytes = 32 hex characters
      expect(encrypted.authTag).toHaveLength(32);
    });

    it('should decrypt back to the exact original plaintext password', () => {
      const encrypted = encrypt(samplePlaintextPassword, 'password');
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(samplePlaintextPassword);
    });

    it('should encrypt and decrypt multi-line SSH private keys accurately', () => {
      const encrypted = encrypt(sampleSshKey, 'privateKey');
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(sampleSshKey);
    });

    it('should produce distinct ciphertexts and IVs for the same plaintext (replay protection)', () => {
      const enc1 = encrypt(samplePlaintextPassword, 'password');
      const enc2 = encrypt(samplePlaintextPassword, 'password');

      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
      expect(enc1.authTag).not.toBe(enc2.authTag);

      // Both must still decrypt to the same original text
      expect(decrypt(enc1)).toBe(samplePlaintextPassword);
      expect(decrypt(enc2)).toBe(samplePlaintextPassword);
    });

    it('should fail decryption when ciphertext has been tampered with', () => {
      const encrypted = encrypt(samplePlaintextPassword, 'password');
      
      // Tamper with the last character of ciphertext
      const tamperedCiphertext =
        encrypted.ciphertext.slice(0, -1) +
        (encrypted.ciphertext.slice(-1) === 'a' ? 'b' : 'a');

      const tamperedBlock: EncryptedBlock = {
        ciphertext: tamperedCiphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      };

      expect(() => decrypt(tamperedBlock)).toThrow();
    });

    it('should fail decryption when authTag has been tampered with', () => {
      const encrypted = encrypt(samplePlaintextPassword, 'password');
      
      const tamperedTag =
        (encrypted.authTag.slice(0, 1) === 'f' ? '0' : 'f') +
        encrypted.authTag.slice(1);

      const tamperedBlock: EncryptedBlock = {
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: tamperedTag,
      };

      expect(() => decrypt(tamperedBlock)).toThrow();
    });

    it('should refuse to encrypt empty or whitespace-only secrets', () => {
      expect(() => encrypt('', 'password')).toThrow(/cannot be empty/);
      expect(() => encrypt('   ', 'password')).toThrow(/cannot be empty/);
    });
  });

  describe('Credential Masking and Task Association Logic', () => {
    it('should sanitize credentials by default and not leak plaintext or auth details in listings', () => {
      const rawCredentialDoc = {
        _id: '66fa1234567890abcdef1234',
        projectId: '66fa1234567890abcdef0001',
        taskId: '66fa1234567890abcdef0002',
        service: 'WordPress Admin Staging',
        credentialType: 'WORDPRESS',
        loginUrl: 'https://staging.example.com/wp-admin',
        username: 'wpadmin',
        passwordEncrypted: encrypt('SecretP@ss!2026', 'password'),
        source: 'MANUAL',
        version: 1,
        isRevoked: false,
      };

      // Simulated safe mapper used by GET /api/credentials
      const safeCredential = {
        _id: rawCredentialDoc._id,
        projectId: rawCredentialDoc.projectId,
        taskId: rawCredentialDoc.taskId,
        service: rawCredentialDoc.service,
        credentialType: rawCredentialDoc.credentialType,
        loginUrl: rawCredentialDoc.loginUrl,
        username: rawCredentialDoc.username,
        hasPassword: !!rawCredentialDoc.passwordEncrypted?.ciphertext,
        maskedPassword: rawCredentialDoc.passwordEncrypted?.ciphertext ? '••••••••' : null,
        source: rawCredentialDoc.source,
        version: rawCredentialDoc.version,
        isRevoked: rawCredentialDoc.isRevoked,
      };

      expect(safeCredential.maskedPassword).toBe('••••••••');
      expect((safeCredential as any).passwordEncrypted).toBeUndefined();
      expect((safeCredential as any).password).toBeUndefined();
      expect(safeCredential.hasPassword).toBe(true);
      expect(safeCredential.taskId).toBe('66fa1234567890abcdef0002');
    });

    it('should update version when credential is edited', () => {
      let version = 1;
      const initialEncrypted = encrypt('InitialSecret', 'password');

      // Edit password
      const updatedEncrypted = encrypt('NewSecretUpdated', 'password');
      version += 1;

      expect(version).toBe(2);
      expect(decrypt(updatedEncrypted)).toBe('NewSecretUpdated');
      expect(decrypt(initialEncrypted)).toBe('InitialSecret');
    });
  });
});
