import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import TeamMemberInvitation from '@/models/TeamMemberInvitation';
import TeamMember from '@/models/TeamMember';
import User from '@/models/User';
import { InvitationService } from '@/services/invitation.service';
import { TeamMemberService } from '@/services/team-member.service';
import { AuditService } from '@/services/audit.service';
import { POST as revealBankRoute } from '@/app/api/team-members/[id]/reveal-bank/route';

// Mock DB connection to guarantee ZERO production DB queries or writes
vi.mock('@/lib/db/connect', () => ({
  dbConnect: vi.fn().mockResolvedValue(null),
  default: vi.fn().mockResolvedValue(null),
}));

// Mock AuditService
vi.mock('@/services/audit.service', () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(true),
    logAction: vi.fn().mockResolvedValue(true),
  },
}));

// Mock TelegramService
vi.mock('@/services/telegram.service', () => ({
  TelegramService: {
    sendMessageRaw: vi.fn().mockResolvedValue({ success: true }),
    sendMessage: vi.fn().mockResolvedValue(true),
  },
}));

describe('Team Member Onboarding & Bank Details - Unit Tests', () => {
  const mockAdminEmail = 'admin@drdebuggers.com';
  const mockMemberId = new mongoose.Types.ObjectId().toString();
  const mockInvitationId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Cryptographic Token Generation & Hashing
  // =========================================================================
  it('1. Generates 32-byte hex token and stores SHA-256 hash in DB, never storing the raw token', async () => {
    let savedInvitation: any = null;
    vi.spyOn(TeamMemberInvitation.prototype, 'save').mockImplementation(async function (this: any) {
      savedInvitation = this;
      return this;
    });

    const result = await InvitationService.createInvitation(
      { role: 'DEVELOPER', expiresInDays: 7 },
      mockAdminEmail
    );

    // Raw token must be 64 hex characters (32 bytes)
    expect(result.rawToken).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(result.rawToken)).toBe(true);
    expect(result.inviteUrl).toContain(`/team/invite/${result.rawToken}`);

    // Verify SHA-256 hash
    const expectedHash = crypto.createHash('sha256').update(result.rawToken).digest('hex');
    expect(savedInvitation).not.toBeNull();
    expect(savedInvitation.tokenHash).toBe(expectedHash);
    // Raw token must never be a property on the saved model
    expect(savedInvitation.rawToken).toBeUndefined();
    expect(savedInvitation.token).toBeUndefined();
    expect(savedInvitation.status).toBe('PENDING');
    expect(savedInvitation.role).toBe('DEVELOPER');
    expect(savedInvitation.createdBy).toBe(mockAdminEmail);

    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INVITATION_CREATED',
        actor: mockAdminEmail,
      })
    );
  });

  // =========================================================================
  // 2. Token Verification (Valid, Expired, Used, Revoked)
  // =========================================================================
  it('2. Verifies valid invitation token by looking up SHA-256 hash', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const mockInvitation = {
      _id: mockInvitationId,
      tokenHash,
      role: 'DESIGNER',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86400000), // 1 day future
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(TeamMemberInvitation, 'findOne').mockResolvedValue(mockInvitation as any);

    const verified = await InvitationService.verifyInvitationToken(rawToken);
    expect(verified._id).toBe(mockInvitationId);
    expect(verified.role).toBe('DESIGNER');
    expect(TeamMemberInvitation.findOne).toHaveBeenCalledWith({ tokenHash });
  });

  it('3. Rejects non-existent token with an error', async () => {
    vi.spyOn(TeamMemberInvitation, 'findOne').mockResolvedValue(null);

    await expect(
      InvitationService.verifyInvitationToken('nonexistenttoken1234567890abcdef')
    ).rejects.toThrow('Invalid invitation link');
  });

  it('4. Rejects revoked invitation link', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    vi.spyOn(TeamMemberInvitation, 'findOne').mockResolvedValue({
      status: 'REVOKED',
      expiresAt: new Date(Date.now() + 86400000),
    } as any);

    await expect(InvitationService.verifyInvitationToken(rawToken)).rejects.toThrow(
      'This invitation link has been revoked'
    );
  });

  it('5. Rejects already used invitation link', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    vi.spyOn(TeamMemberInvitation, 'findOne').mockResolvedValue({
      status: 'USED',
      expiresAt: new Date(Date.now() + 86400000),
    } as any);

    await expect(InvitationService.verifyInvitationToken(rawToken)).rejects.toThrow(
      'This invitation link has already been used'
    );
  });

  it('6. Marks expired invitation as EXPIRED and rejects verification', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiredInvitation = {
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 3600000), // 1 hour in the past
      save: vi.fn().mockResolvedValue(true),
    };
    vi.spyOn(TeamMemberInvitation, 'findOne').mockResolvedValue(expiredInvitation as any);

    await expect(InvitationService.verifyInvitationToken(rawToken)).rejects.toThrow(
      'This invitation link has expired'
    );
    expect(expiredInvitation.status).toBe('EXPIRED');
    expect(expiredInvitation.save).toHaveBeenCalled();
  });

  // =========================================================================
  // 3. Invitation Revocation
  // =========================================================================
  it('7. Admin revokes pending invitation successfully', async () => {
    const mockInvitation = {
      _id: mockInvitationId,
      status: 'PENDING',
      role: 'DEVELOPER',
      createdBy: mockAdminEmail,
      save: vi.fn().mockResolvedValue(true),
      revokedAt: undefined,
      revokedBy: undefined,
    };
    vi.spyOn(TeamMemberInvitation, 'findById').mockResolvedValue(mockInvitation as any);

    const revoked = await InvitationService.revokeInvitation(mockInvitationId, mockAdminEmail);
    expect(revoked.status).toBe('REVOKED');
    expect(revoked.revokedBy).toBe(mockAdminEmail);
    expect(revoked.revokedAt).toBeInstanceOf(Date);
    expect(mockInvitation.save).toHaveBeenCalled();

    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INVITATION_REVOKED',
        actor: mockAdminEmail,
      })
    );
  });

  it('8. Rejects revoking an invitation that is not PENDING', async () => {
    vi.spyOn(TeamMemberInvitation, 'findById').mockResolvedValue({
      _id: mockInvitationId,
      status: 'USED',
    } as any);

    await expect(
      InvitationService.revokeInvitation(mockInvitationId, mockAdminEmail)
    ).rejects.toThrow('Cannot revoke an invitation with status USED');
  });

  // =========================================================================
  // 4. Onboarding via Invitation
  // =========================================================================
  it('9. Onboards team member, marks invitation USED, and binds teamMemberId', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const mockInvitation = {
      _id: mockInvitationId,
      role: 'QA_ENGINEER',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86400000),
      save: vi.fn().mockResolvedValue(true),
      usedAt: undefined as any,
      teamMemberId: undefined as any,
    };

    vi.spyOn(InvitationService, 'verifyInvitationToken').mockResolvedValue(mockInvitation as any);
    vi.spyOn(TeamMember, 'findOne').mockResolvedValue(null); // No duplicate email

    const createdMember = {
      _id: mockMemberId,
      name: 'Sarah Connor',
      email: 'sarah@example.com',
      role: 'QA_ENGINEER',
      status: 'ACTIVE',
    };
    vi.spyOn(TeamMemberService, 'createTeamMember').mockResolvedValue(createdMember as any);

    const result = await InvitationService.onboardTeamMember(rawToken, {
      name: 'Sarah Connor',
      email: 'sarah@example.com',
      phone: '+1 555-0199',
    });

    expect(result.teamMember.email).toBe('sarah@example.com');
    expect(mockInvitation.status).toBe('USED');
    expect(mockInvitation.usedAt).toBeInstanceOf(Date);
    expect(mockInvitation.teamMemberId).toBe(mockMemberId);
    expect(mockInvitation.save).toHaveBeenCalled();

    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INVITATION_USED',
        actor: 'sarah@example.com',
      })
    );
  });

  it('10. Rejects onboarding if email already exists', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    vi.spyOn(InvitationService, 'verifyInvitationToken').mockResolvedValue({
      _id: mockInvitationId,
      role: 'DEVELOPER',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86400000),
    } as any);

    vi.spyOn(TeamMember, 'findOne').mockResolvedValue({
      _id: 'existing_member',
      email: 'existing@example.com',
    } as any);

    await expect(
      InvitationService.onboardTeamMember(rawToken, {
        name: 'Duplicate Guy',
        email: 'existing@example.com',
      })
    ).rejects.toThrow('already exists');
  });

  // =========================================================================
  // 5. Bank Details AES-256-GCM Encryption & Masking
  // =========================================================================
  it('11. Encrypts bank details with AES-256-GCM and generates correct masked representations', () => {
    const rawBankData = {
      accountHolderName: 'Priya Sharma',
      bankName: 'HDFC Bank',
      accountNumber: '50100412344821',
      ifsc: 'hdfc0001234',
      upiId: 'priyasharma@okhdfcbank',
    };

    const encrypted = TeamMemberService.buildEncryptedBankDetails(rawBankData);

    expect(encrypted).toBeDefined();
    expect(encrypted!.accountHolderName).toBe('Priya Sharma');
    expect(encrypted!.bankName).toBe('HDFC Bank');
    expect(encrypted!.isComplete).toBe(true);

    // Ciphertext verification
    expect(encrypted!.accountNumberEncrypted).toBeDefined();
    expect(encrypted!.accountNumberEncrypted!.ciphertext).not.toBe(rawBankData.accountNumber);
    expect(encrypted!.accountNumberEncrypted!.iv).toBeDefined();
    expect(encrypted!.accountNumberEncrypted!.authTag).toBeDefined();

    expect(encrypted!.ifscEncrypted).toBeDefined();
    expect(encrypted!.ifscEncrypted!.ciphertext).not.toBe(rawBankData.ifsc);

    expect(encrypted!.upiIdEncrypted).toBeDefined();
    expect(encrypted!.upiIdEncrypted!.ciphertext).not.toBe(rawBankData.upiId);

    // Masked format verification
    expect(encrypted!.accountNumberMasked).toBe('•••• •••• 4821');
    expect(encrypted!.ifscMasked).toBe('HDFC•••••••');
    expect(encrypted!.upiIdMasked).toBe('pr••••@okhdfcbank');
  });

  // =========================================================================
  // 6. Bank Details Sanitization (Never leaking ciphertexts in lists)
  // =========================================================================
  it('12. Strips encrypted ciphertext, IV, and authTag in sanitizeBankDetails', () => {
    const rawBank = TeamMemberService.buildEncryptedBankDetails({
      accountHolderName: 'John Doe',
      accountNumber: '123456789012',
      ifsc: 'SBIN0001234',
      upiId: 'john@upi',
    });

    const memberWithBank = {
      _id: mockMemberId,
      name: 'John Doe',
      email: 'john@example.com',
      bankDetails: rawBank,
    };

    const sanitized = TeamMemberService.sanitizeBankDetails(memberWithBank);

    expect(sanitized.bankDetails).toBeDefined();
    expect(sanitized.bankDetails.accountHolderName).toBe('John Doe');
    expect(sanitized.bankDetails.accountNumberMasked).toBe('•••• •••• 9012');
    expect(sanitized.bankDetails.ifscMasked).toBe('SBIN•••••••');

    // CRITICAL SECURITY: Ciphertext fields must be completely absent
    expect(sanitized.bankDetails.accountNumberEncrypted).toBeUndefined();
    expect(sanitized.bankDetails.ifscEncrypted).toBeUndefined();
    expect(sanitized.bankDetails.upiIdEncrypted).toBeUndefined();
  });

  // =========================================================================
  // 7. Admin Reveal Bank Details with Password Confirmation & Audit Logging
  // =========================================================================
  it('13. Decrypts and reveals full bank details when called by service with audit logging', async () => {
    const encryptedBank = TeamMemberService.buildEncryptedBankDetails({
      accountHolderName: 'Priya Sharma',
      bankName: 'HDFC Bank',
      accountNumber: '50100412344821',
      ifsc: 'HDFC0001234',
      upiId: 'priyasharma@okhdfcbank',
    });

    const mockMember = {
      _id: mockMemberId,
      name: 'Priya Sharma',
      email: 'priya@example.com',
      bankDetails: encryptedBank,
    };

    vi.spyOn(TeamMember, 'findById').mockResolvedValue(mockMember as any);

    const revealed = await TeamMemberService.revealBankDetails(mockMemberId, mockAdminEmail);

    expect(revealed.accountHolderName).toBe('Priya Sharma');
    expect(revealed.bankName).toBe('HDFC Bank');
    expect(revealed.accountNumber).toBe('50100412344821');
    expect(revealed.ifsc).toBe('HDFC0001234');
    expect(revealed.upiId).toBe('priyasharma@okhdfcbank');

    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'BANK_DETAILS_REVEALED',
        actor: mockAdminEmail,
        entityId: mockMemberId,
        // Crucial security check: Plaintext account number must NOT appear in audit log metadata
        metadata: expect.not.objectContaining({
          accountNumber: '50100412344821',
        }),
      })
    );
  });

  it('14. Reveal route rejects non-ADMIN role with 403 Forbidden', async () => {
    const req = new NextRequest('http://localhost:3000/api/team-members/123/reveal-bank', {
      method: 'POST',
      headers: {
        'x-user-role': 'DEVELOPER',
        'x-user-email': 'dev@example.com',
      },
      body: JSON.stringify({ password: 'anypassword' }),
    });

    const res = await revealBankRoute(req, { params: Promise.resolve({ id: '123' }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('15. Reveal route rejects invalid admin password with 401 Unauthorized', async () => {
    // Set an ADMIN_PASSWORD in environment for test
    const originalEnv = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = 'CorrectSuperSecretAdminPass!2026';
    vi.spyOn(User, 'findOne').mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/team-members/123/reveal-bank', {
      method: 'POST',
      headers: {
        'x-user-role': 'ADMIN',
        'x-user-email': mockAdminEmail,
      },
      body: JSON.stringify({ password: 'WrongPassword123' }),
    });

    const res = await revealBankRoute(req, { params: Promise.resolve({ id: '123' }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PASSWORD');

    // Restore env
    process.env.ADMIN_PASSWORD = originalEnv;
  });

  it('16. Reveal route successfully reveals bank details when valid admin password is provided', async () => {
    const originalEnv = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = 'CorrectSuperSecretAdminPass!2026';

    const encryptedBank = TeamMemberService.buildEncryptedBankDetails({
      accountHolderName: 'Priya Sharma',
      bankName: 'HDFC Bank',
      accountNumber: '50100412344821',
      ifsc: 'HDFC0001234',
      upiId: 'priyasharma@okhdfcbank',
    });

    vi.spyOn(TeamMember, 'findById').mockResolvedValue({
      _id: mockMemberId,
      name: 'Priya Sharma',
      email: 'priya@example.com',
      bankDetails: encryptedBank,
    } as any);

    const req = new NextRequest(`http://localhost:3000/api/team-members/${mockMemberId}/reveal-bank`, {
      method: 'POST',
      headers: {
        'x-user-role': 'ADMIN',
        'x-user-email': mockAdminEmail,
      },
      body: JSON.stringify({ password: 'CorrectSuperSecretAdminPass!2026' }),
    });

    const res = await revealBankRoute(req, { params: Promise.resolve({ id: mockMemberId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.accountNumber).toBe('50100412344821');
    expect(body.data.ifsc).toBe('HDFC0001234');
    expect(body.data.upiId).toBe('priyasharma@okhdfcbank');

    process.env.ADMIN_PASSWORD = originalEnv;
  });
});
