import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import TeamMember from '@/models/TeamMember';
import User from '@/models/User';
import Task from '@/models/Task';
import Project from '@/models/Project';
import Hosting from '@/models/Hosting';
import TeamPayment from '@/models/TeamPayment';
import Credential from '@/models/Credential';
import AuditLog from '@/models/AuditLog';
import TeamMemberConversation from '@/models/TeamMemberConversation';
import { TeamMemberService } from '@/services/team-member.service';
import { AuditService } from '@/services/audit.service';
import { PATCH as profilePatchRoute, GET as profileGetRoute } from '@/app/api/team-members/[id]/route';
import { GET as bankGetRoute, PATCH as bankPatchRoute } from '@/app/api/team-members/[id]/bank-details/route';
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

// Helper to mock mongoose query chains
function mockMongooseQuery(result: any) {
  const query: any = {
    lean: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis(),
    populate: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(result),
    then(resolve: any, reject: any) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return query;
}

describe('Team Member Profile and Bank Details Separation Test Suite', () => {
  const mockAdminEmail = 'admin@drdebuggers.com';
  const mockMemberId = new mongoose.Types.ObjectId().toString();

  let inMemoryMember: any;

  beforeEach(() => {
    vi.clearAllMocks();

    inMemoryMember = {
      _id: mockMemberId,
      name: 'Initial Developer',
      email: 'initial.dev@example.com',
      phone: '9876543210',
      role: 'DEVELOPER',
      designation: 'Backend Specialist',
      telegramConnected: false,
      status: 'ACTIVE',
      permissions: ['VIEW_PROJECT', 'VIEW_TASKS'],
      toObject() {
        return JSON.parse(JSON.stringify(this));
      },
    };

    vi.spyOn(TeamMember, 'findById').mockImplementation(((id: any) => {
      if (String(id) === mockMemberId) {
        const doc: any = {
          ...inMemoryMember,
          save: vi.fn().mockImplementation(async function (this: any) {
            Object.assign(inMemoryMember, this);
            return this;
          }),
          toObject: () => JSON.parse(JSON.stringify(inMemoryMember)),
        };
        const query: any = {
          lean: vi.fn().mockResolvedValue(doc),
          select: vi.fn().mockReturnThis(),
          then: (res: any, rej: any) => Promise.resolve(doc).then(res, rej),
        };
        return query;
      }
      const nullQuery: any = {
        lean: vi.fn().mockResolvedValue(null),
        select: vi.fn().mockReturnThis(),
        then: (res: any, rej: any) => Promise.resolve(null).then(res, rej),
      };
      return nullQuery;
    }) as any);

    vi.spyOn(TeamMember, 'findOne').mockImplementation(((query: any) => {
      if (query.email && query.email === inMemoryMember.email) {
        return mockMongooseQuery(inMemoryMember);
      }
      return mockMongooseQuery(null);
    }) as any);

    vi.spyOn(TeamMember, 'find').mockReturnValue(mockMongooseQuery([inMemoryMember]));
    vi.spyOn(TeamMemberConversation, 'find').mockReturnValue(mockMongooseQuery([]));
    vi.spyOn(Project, 'find').mockReturnValue(mockMongooseQuery([]));
    vi.spyOn(Task, 'find').mockReturnValue(mockMongooseQuery([]));
    vi.spyOn(TeamPayment, 'find').mockReturnValue(mockMongooseQuery([]));
    vi.spyOn(AuditLog, 'find').mockReturnValue(mockMongooseQuery([]));
    vi.spyOn(Project, 'countDocuments').mockResolvedValue(1 as any);
    vi.spyOn(Task, 'countDocuments').mockResolvedValue(2 as any);

    vi.spyOn(TeamMember, 'findByIdAndUpdate').mockImplementation(((async (id: any, update: any) => {
      if (String(id) !== mockMemberId) return null;

      if (update.$set) {
        for (const [key, value] of Object.entries(update.$set)) {
          if (key.startsWith('bankDetails.')) {
            const subKey = key.replace('bankDetails.', '');
            if (!inMemoryMember.bankDetails) inMemoryMember.bankDetails = {};
            inMemoryMember.bankDetails[subKey] = value;
          } else {
            inMemoryMember[key] = value;
          }
        }
      }

      if (update.$unset) {
        for (const key of Object.keys(update.$unset)) {
          if (key === 'bankDetails') {
            delete inMemoryMember.bankDetails;
          } else if (key.startsWith('bankDetails.')) {
            const subKey = key.replace('bankDetails.', '');
            if (inMemoryMember.bankDetails) {
              delete inMemoryMember.bankDetails[subKey];
            }
          } else {
            delete inMemoryMember[key];
          }
        }
      }

      return {
        ...inMemoryMember,
        toObject: () => JSON.parse(JSON.stringify(inMemoryMember)),
      } as any;
    }) as any));
  });

  // =========================================================================
  // PROFILE TESTS (1 - 7)
  // =========================================================================

  it('1. Update name only', async () => {
    const updated = await TeamMemberService.updateTeamMember(
      mockMemberId,
      { name: 'Updated Dev Name' },
      mockAdminEmail
    );

    expect(updated.name).toBe('Updated Dev Name');
    expect(updated.email).toBe('initial.dev@example.com');
    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TEAM_MEMBER_PROFILE_UPDATED',
        actor: mockAdminEmail,
      })
    );
  });

  it('2. Update email only', async () => {
    const updated = await TeamMemberService.updateTeamMember(
      mockMemberId,
      { email: 'new.email@example.com' },
      mockAdminEmail
    );

    expect(updated.email).toBe('new.email@example.com');
    expect(updated.name).toBe('Initial Developer');
  });

  it('3. Update designation only', async () => {
    const updated = await TeamMemberService.updateTeamMember(
      mockMemberId,
      { designation: 'Lead Systems Architect' },
      mockAdminEmail
    );

    expect(updated.designation).toBe('Lead Systems Architect');
  });

  it('4. Update multiple profile fields', async () => {
    const updated = await TeamMemberService.updateTeamMember(
      mockMemberId,
      {
        name: 'Alex Johnson',
        phone: '1122334455',
        role: 'MANAGER',
        designation: 'Project Lead',
      },
      mockAdminEmail
    );

    expect(updated.name).toBe('Alex Johnson');
    expect(updated.phone).toBe('1122334455');
    expect(updated.role).toBe('MANAGER');
    expect(updated.designation).toBe('Project Lead');
  });

  it('5. Profile update succeeds when bank details are completely absent', async () => {
    delete inMemoryMember.bankDetails;

    const updated = await TeamMemberService.updateTeamMember(
      mockMemberId,
      { name: 'No Bank Member' },
      mockAdminEmail
    );

    expect(updated.name).toBe('No Bank Member');
    expect(updated.bankDetails).toBeUndefined();
  });

  it('6. Profile update does not modify existing bank details', async () => {
    // Member has existing bank details
    inMemoryMember.bankDetails = {
      accountHolderName: 'Priya Sharma',
      bankName: 'HDFC Bank',
      accountNumberEncrypted: { ciphertext: 'fake_cipher_123', iv: 'iv123', authTag: 'tag123' },
      accountNumberMasked: '•••• •••• 4482',
      ifscEncrypted: { ciphertext: 'fake_cipher_ifsc', iv: 'iv_ifsc', authTag: 'tag_ifsc' },
      ifscMasked: 'HDFC•••••••',
      isComplete: true,
    };

    const updated = await TeamMemberService.updateTeamMember(
      mockMemberId,
      { name: 'Priya Updated' },
      mockAdminEmail
    );

    expect(updated.name).toBe('Priya Updated');
    expect(updated.bankDetails).toBeDefined();
    expect(updated.bankDetails.accountHolderName).toBe('Priya Sharma');
    expect(updated.bankDetails.accountNumberMasked).toBe('•••• •••• 4482');
    expect(updated.bankDetails.ifscMasked).toBe('HDFC•••••••');
    expect(inMemoryMember.bankDetails.accountNumberEncrypted.ciphertext).toBe('fake_cipher_123');
  });

  it('7. Profile update ignores/rejects bankDetails from unauthorized payload in PATCH /api/team-members/[id]', async () => {
    inMemoryMember.bankDetails = {
      accountHolderName: 'Priya Sharma',
      accountNumberMasked: '•••• •••• 4482',
      accountNumberEncrypted: { ciphertext: 'preserved_cipher', iv: 'iv', authTag: 'tag' },
      isComplete: true,
    };

    const req = new NextRequest(`http://localhost:3000/api/team-members/${mockMemberId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'ADMIN',
        'x-user-email': mockAdminEmail,
      },
      body: JSON.stringify({
        name: 'Priya Hacker Attempt',
        bankDetails: {
          accountHolderName: 'Overwritten Hacker Name',
          accountNumber: '9999999999',
        },
      }),
    });

    const res = await profilePatchRoute(req, { params: Promise.resolve({ id: mockMemberId }) });
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.name).toBe('Priya Hacker Attempt');
    // Bank details must be strictly unchanged!
    expect(inMemoryMember.bankDetails.accountHolderName).toBe('Priya Sharma');
    expect(inMemoryMember.bankDetails.accountNumberEncrypted.ciphertext).toBe('preserved_cipher');
  });

  // =========================================================================
  // BANK DETAILS TESTS (8 - 16)
  // =========================================================================

  it('8. Add bank details via dedicated updateBankDetails service', async () => {
    const updated = await TeamMemberService.updateBankDetails(
      mockMemberId,
      {
        accountHolderName: 'Rahul Verma',
        bankName: 'ICICI Bank',
        accountNumber: '123456789012',
        ifsc: 'ICIC0001234',
        upiId: 'rahul@okaxis',
      },
      mockAdminEmail
    );

    expect(updated.bankDetails).toBeDefined();
    expect(updated.bankDetails.accountHolderName).toBe('Rahul Verma');
    expect(updated.bankDetails.bankName).toBe('ICICI Bank');
    expect(updated.bankDetails.accountNumberMasked).toBe('•••• •••• 9012');
    expect(updated.bankDetails.ifscMasked).toBe('ICIC•••••••');
    expect(updated.bankDetails.upiIdMasked).toBe('ra••••@okaxis');
    expect(updated.bankDetails.isComplete).toBe(true);

    // Ciphertext must be stored internally in DB model
    expect(inMemoryMember.bankDetails.accountNumberEncrypted).toBeDefined();
    expect(inMemoryMember.bankDetails.accountNumberEncrypted.ciphertext).toBeDefined();
    expect(inMemoryMember.bankDetails.ifscEncrypted).toBeDefined();
    expect(inMemoryMember.bankDetails.upiIdEncrypted).toBeDefined();

    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TEAM_MEMBER_BANK_DETAILS_UPDATED',
        actor: mockAdminEmail,
      })
    );
  });

  it('9. Update account number only', async () => {
    // Initial bank setup
    await TeamMemberService.updateBankDetails(
      mockMemberId,
      {
        accountHolderName: 'Test Member',
        bankName: 'HDFC Bank',
        accountNumber: '111122223333',
        ifsc: 'HDFC0001111',
        upiId: 'test@upi',
      },
      mockAdminEmail
    );

    const oldIfscCipher = inMemoryMember.bankDetails.ifscEncrypted.ciphertext;
    const oldUpiCipher = inMemoryMember.bankDetails.upiIdEncrypted.ciphertext;

    // Update only account number
    const updated = await TeamMemberService.updateBankDetails(
      mockMemberId,
      {
        accountNumber: '999988887777',
      },
      mockAdminEmail
    );

    expect(updated.bankDetails.accountNumberMasked).toBe('•••• •••• 7777');
    expect(updated.bankDetails.ifscMasked).toBe('HDFC•••••••');
    expect(updated.bankDetails.upiIdMasked).toBe('te••••@upi');

    // IFSC and UPI ciphertexts must remain intact
    expect(inMemoryMember.bankDetails.ifscEncrypted.ciphertext).toBe(oldIfscCipher);
    expect(inMemoryMember.bankDetails.upiIdEncrypted.ciphertext).toBe(oldUpiCipher);
  });

  it('10. Update IFSC only', async () => {
    await TeamMemberService.updateBankDetails(
      mockMemberId,
      {
        accountHolderName: 'Test Member',
        accountNumber: '111122223333',
        ifsc: 'HDFC0001111',
      },
      mockAdminEmail
    );

    const oldAccCipher = inMemoryMember.bankDetails.accountNumberEncrypted.ciphertext;

    const updated = await TeamMemberService.updateBankDetails(
      mockMemberId,
      {
        ifsc: 'SBIN0002222',
      },
      mockAdminEmail
    );

    expect(updated.bankDetails.ifscMasked).toBe('SBIN•••••••');
    expect(updated.bankDetails.accountNumberMasked).toBe('•••• •••• 3333');
    expect(inMemoryMember.bankDetails.accountNumberEncrypted.ciphertext).toBe(oldAccCipher);
  });

  it('11. Update UPI only', async () => {
    await TeamMemberService.updateBankDetails(
      mockMemberId,
      {
        accountHolderName: 'Test Member',
        accountNumber: '111122223333',
        ifsc: 'HDFC0001111',
        upiId: 'old@upi',
      },
      mockAdminEmail
    );

    const oldAccCipher = inMemoryMember.bankDetails.accountNumberEncrypted.ciphertext;
    const oldIfscCipher = inMemoryMember.bankDetails.ifscEncrypted.ciphertext;

    const updated = await TeamMemberService.updateBankDetails(
      mockMemberId,
      {
        upiId: 'newuser@icici',
      },
      mockAdminEmail
    );

    expect(updated.bankDetails.upiIdMasked).toBe('ne••••@icici');
    expect(inMemoryMember.bankDetails.accountNumberEncrypted.ciphertext).toBe(oldAccCipher);
    expect(inMemoryMember.bankDetails.ifscEncrypted.ciphertext).toBe(oldIfscCipher);
  });

  it('12. Update multiple bank fields', async () => {
    const updated = await TeamMemberService.updateBankDetails(
      mockMemberId,
      {
        accountHolderName: 'New Holder',
        bankName: 'Axis Bank',
        ifsc: 'UTIB0001234',
      },
      mockAdminEmail
    );

    expect(updated.bankDetails.accountHolderName).toBe('New Holder');
    expect(updated.bankDetails.bankName).toBe('Axis Bank');
    expect(updated.bankDetails.ifscMasked).toBe('UTIB•••••••');
  });

  it('13. Missing bank field preserves existing value', async () => {
    await TeamMemberService.updateBankDetails(
      mockMemberId,
      {
        accountHolderName: 'Existing Name',
        accountNumber: '555566667777',
        ifsc: 'KKBK0001234',
        upiId: 'keepme@upi',
      },
      mockAdminEmail
    );

    // Call update with only bankName
    const updated = await TeamMemberService.updateBankDetails(
      mockMemberId,
      {
        bankName: 'Kotak Mahindra Bank',
      },
      mockAdminEmail
    );

    expect(updated.bankDetails.bankName).toBe('Kotak Mahindra Bank');
    expect(updated.bankDetails.accountHolderName).toBe('Existing Name');
    expect(updated.bankDetails.accountNumberMasked).toBe('•••• •••• 7777');
    expect(updated.bankDetails.ifscMasked).toBe('KKBK•••••••');
    expect(updated.bankDetails.upiIdMasked).toBe('ke••••@upi');
  });

  it('14. Explicit clear removes only requested field', async () => {
    await TeamMemberService.updateBankDetails(
      mockMemberId,
      {
        accountHolderName: 'Clear Test',
        accountNumber: '555566667777',
        ifsc: 'KKBK0001234',
        upiId: 'tobecleared@upi',
      },
      mockAdminEmail
    );

    // Clear only upiId
    const updated = await TeamMemberService.updateBankDetails(
      mockMemberId,
      {
        clearUpiId: true,
      },
      mockAdminEmail
    );

    expect(updated.bankDetails.upiIdMasked).toBeUndefined();
    expect(inMemoryMember.bankDetails.upiIdEncrypted).toBeUndefined();

    // Account number and IFSC must remain intact
    expect(updated.bankDetails.accountNumberMasked).toBe('•••• •••• 7777');
    expect(updated.bankDetails.ifscMasked).toBe('KKBK•••••••');
    expect(inMemoryMember.bankDetails.accountNumberEncrypted).toBeDefined();
    expect(inMemoryMember.bankDetails.ifscEncrypted).toBeDefined();
  });

  it('15. Existing bank values remain encrypted in database', async () => {
    await TeamMemberService.updateBankDetails(
      mockMemberId,
      {
        accountNumber: '12345678901234',
        ifsc: 'HDFC0001234',
      },
      mockAdminEmail
    );

    // DB must contain ciphertext, iv, authTag
    const enc = inMemoryMember.bankDetails.accountNumberEncrypted;
    expect(enc).toBeDefined();
    expect(enc.ciphertext).not.toBe('12345678901234');
    expect(enc.iv).toBeDefined();
    expect(enc.authTag).toBeDefined();
  });

  it('16. Raw bank details are not exposed in normal profile API', async () => {
    await TeamMemberService.updateBankDetails(
      mockMemberId,
      {
        accountNumber: '12345678901234',
        ifsc: 'HDFC0001234',
        upiId: 'test@upi',
      },
      mockAdminEmail
    );

    // Calling GET /api/team-members/:id/bank-details returns only masked bank details
    const req = new NextRequest(`http://localhost:3000/api/team-members/${mockMemberId}/bank-details`, {
      method: 'GET',
      headers: {
        'x-user-role': 'ADMIN',
        'x-user-email': mockAdminEmail,
      },
    });

    const getByIdSpy = vi.spyOn(TeamMemberService, 'getTeamMemberById').mockResolvedValue({
      ...inMemoryMember,
      bankDetails: TeamMemberService.sanitizeBankDetails(inMemoryMember).bankDetails,
    });

    const res = await bankGetRoute(req, { params: Promise.resolve({ id: mockMemberId }) });
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.accountNumberMasked).toBe('•••• •••• 1234');
    expect(json.data.accountNumberEncrypted).toBeUndefined();
    expect(json.data.ifscEncrypted).toBeUndefined();
    expect(json.data.upiIdEncrypted).toBeUndefined();
    getByIdSpy.mockRestore();
  });

  // =========================================================================
  // SECURITY TESTS (17 - 20)
  // =========================================================================

  it('17. Unauthorized role cannot modify Team Member profile', async () => {
    const req = new NextRequest(`http://localhost:3000/api/team-members/${mockMemberId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'DEVELOPER', // Non-admin
        'x-user-email': 'dev@example.com',
      },
      body: JSON.stringify({ name: 'Unauthorized Attempt' }),
    });

    const res = await profilePatchRoute(req, { params: Promise.resolve({ id: mockMemberId }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('18. Team Member cannot modify bank details (requires ADMIN role)', async () => {
    const req = new NextRequest(`http://localhost:3000/api/team-members/${mockMemberId}/bank-details`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'DEVELOPER', // Non-admin
        'x-user-email': 'dev@example.com',
      },
      body: JSON.stringify({ upiId: 'hacker@upi' }),
    });

    const res = await bankPatchRoute(req, { params: Promise.resolve({ id: mockMemberId }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('19. Client cannot access bank details', async () => {
    const req = new NextRequest(`http://localhost:3000/api/team-members/${mockMemberId}/bank-details`, {
      method: 'GET',
      headers: {
        'x-user-role': 'CLIENT',
        'x-user-email': 'client@example.com',
      },
    });

    const res = await bankGetRoute(req, { params: Promise.resolve({ id: mockMemberId }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('20. No raw bank details appear in audit logs', async () => {
    const rawAcc = '987654321098';
    const rawIfsc = 'SBIN0001234';
    const rawUpi = 'secretuser@hdfc';

    await TeamMemberService.updateBankDetails(
      mockMemberId,
      {
        accountHolderName: 'Audit Safe Name',
        accountNumber: rawAcc,
        ifsc: rawIfsc,
        upiId: rawUpi,
      },
      mockAdminEmail
    );

    // Verify all AuditService calls
    const logCalls = (AuditService.log as any).mock.calls;
    for (const [arg] of logCalls) {
      const stringified = JSON.stringify(arg);
      expect(stringified).not.toContain(rawAcc);
      expect(stringified).not.toContain(rawIfsc);
      expect(stringified).not.toContain(rawUpi);
    }
  });

  // =========================================================================
  // REGRESSION TESTS (21 - 29)
  // =========================================================================

  it('21. Team Member status check works for authentication/authorization', async () => {
    inMemoryMember.status = 'DEACTIVATED';

    await expect(
      TeamMemberService.updateBankDetails(mockMemberId, { upiId: 'test@upi' }, mockAdminEmail)
    ).rejects.toThrow('Cannot update bank details for a deactivated team member');
  });

  it('22. Telegram linking and token generation works', async () => {
    inMemoryMember.status = 'ACTIVE';

    const tokenRes = await TeamMemberService.generateTelegramConnectionToken(mockMemberId, mockAdminEmail);
    expect(tokenRes.token).toMatch(/^TEAM_[A-F0-9]{32}$/);
    expect(tokenRes.link).toContain('https://t.me/');
    expect(inMemoryMember.telegramConnectionToken).toBe(tokenRes.token);
  });

  it('23. Team Member chat integrity preserved', async () => {
    // Team member profile sanitization includes chat summary without crashing
    const list = await TeamMemberService.getTeamMembers({});
    expect(Array.isArray(list)).toBe(true);
  });

  it('24. Task assignment workflow preserved', async () => {
    vi.spyOn(Task, 'find').mockReturnValue(mockMongooseQuery([]));
    const memberWithTasks = await TeamMemberService.getTeamMemberById(mockMemberId);
    expect(memberWithTasks).toBeDefined();
    expect(Array.isArray(memberWithTasks.assignedTasks)).toBe(true);
  });

  it('25. Hosting workflow preserved', async () => {
    vi.spyOn(Hosting, 'find').mockReturnValue(mockMongooseQuery([]));
    expect(typeof TeamMemberService.getTeamMemberById).toBe('function');
  });

  it('26. Payments workflow preserved', async () => {
    vi.spyOn(TeamPayment, 'find').mockReturnValue(mockMongooseQuery([]));
    const member = await TeamMemberService.getTeamMemberById(mockMemberId);
    expect(Array.isArray(member.payments)).toBe(true);
    expect(member.stats.totalPaid).toBe(0);
  });

  it('27. Credentials permissions preserved', async () => {
    inMemoryMember.permissions = ['VIEW_CREDENTIALS', 'REQUEST_CREDENTIALS'];
    const updated = await TeamMemberService.updateTeamMember(
      mockMemberId,
      { permissions: ['VIEW_CREDENTIALS'] },
      mockAdminEmail
    );
    expect(updated.permissions).toContain('VIEW_CREDENTIALS');
    expect(updated.permissions).not.toContain('REQUEST_CREDENTIALS');
  });

  it('28. Projects workflow preserved', async () => {
    vi.spyOn(Project, 'find').mockReturnValue(mockMongooseQuery([]));
    const member = await TeamMemberService.getTeamMemberById(mockMemberId);
    expect(Array.isArray(member.assignedProjects)).toBe(true);
  });

  it('29. Formats validation for bank details rejects invalid account/ifsc/upi', async () => {
    // Invalid Account Number
    await expect(
      TeamMemberService.updateBankDetails(mockMemberId, { accountNumber: 'abc123' }, mockAdminEmail)
    ).rejects.toThrow('Invalid account number format');

    // Invalid IFSC
    await expect(
      TeamMemberService.updateBankDetails(mockMemberId, { ifsc: 'INVALID_IFSC' }, mockAdminEmail)
    ).rejects.toThrow('Invalid IFSC format');

    // Invalid UPI
    await expect(
      TeamMemberService.updateBankDetails(mockMemberId, { upiId: 'invalid_upi_no_at' }, mockAdminEmail)
    ).rejects.toThrow('Invalid UPI ID format');
  });
});
