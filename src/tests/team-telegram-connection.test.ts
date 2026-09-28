import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import TeamMember from '@/models/TeamMember';
import Client from '@/models/Client';
import Task from '@/models/Task';
import User from '@/models/User';
import { TeamMemberService } from '@/services/team-member.service';
import { ClientService } from '@/services/client.service';
import { TelegramService } from '@/services/telegram.service';
import { AuditService } from '@/services/audit.service';
import { POST as connectRoute } from '@/app/api/team-members/[id]/connect/route';
import { POST as telegramTokenRoute } from '@/app/api/team-members/[id]/telegram-token/route';

// 1. Mock DB connection to guarantee ZERO production DB queries or writes
vi.mock('@/lib/db/connect', () => ({
  dbConnect: vi.fn().mockResolvedValue(null),
  default: vi.fn().mockResolvedValue(null),
}));

// 2. Mock AuditService to verify audit events without DB writes
vi.mock('@/services/audit.service', () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(true),
    logAction: vi.fn().mockResolvedValue(true),
  },
}));

describe('Team Member Telegram Bot Connection - Isolated Unit Tests', () => {
  const mockAdminEmail = 'admin@drdebuggers.com';
  const mockMemberId = new mongoose.Types.ObjectId().toString();
  const otherMemberId = new mongoose.Types.ObjectId().toString();
  const mockTelegramUserId = '987654321';
  const mockChatId = '987654321';

  let fakeTeamMember: any;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(User, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as any);

    fakeTeamMember = {
      _id: new mongoose.Types.ObjectId(mockMemberId),
      name: 'Alice Developer',
      email: 'alice@drdebuggers.com',
      role: 'DEVELOPER',
      status: 'ACTIVE',
      telegramConnected: false,
      telegramUserId: undefined,
      telegramUsername: undefined,
      telegramChatId: undefined,
      telegramConnectionToken: undefined,
      telegramTokenExpiresAt: undefined,
      save: vi.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };
  });

  // =========================================================================
  // 1. Token Generation via Service & Production Safety
  // =========================================================================
  it('1. Generates secure single-use Telegram link with TEAM_ prefix, 24h expiry, and correct bot username', async () => {
    vi.spyOn(TeamMember, 'findById').mockResolvedValue(fakeTeamMember);

    const result = await TeamMemberService.generateTelegramConnectionToken(mockMemberId, mockAdminEmail);

    expect(result.token).toMatch(/^TEAM_[A-F0-9]{32}$/);
    expect(result.link).toBe(`https://t.me/TestMockBot?start=${result.token}`);
    expect(fakeTeamMember.telegramConnectionToken).toBe(result.token);
    expect(fakeTeamMember.telegramTokenExpiresAt).toBeDefined();

    // Verify 24h validity
    const diffHours = (fakeTeamMember.telegramTokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(diffHours).toBeGreaterThan(23.9);
    expect(diffHours).toBeLessThanOrEqual(24);

    // Verify Audit Log was called without leaking raw token
    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: mockAdminEmail,
        action: 'TEAM_MEMBER_TELEGRAM_CONNECTION_LINK_CREATED',
        entityType: 'TeamMember',
        entityId: fakeTeamMember._id,
        metadata: expect.objectContaining({
          teamMemberId: mockMemberId,
        }),
      })
    );
    // Secret token must NOT be in audit metadata
    const auditCall = vi.mocked(AuditService.log).mock.calls[0][0];
    expect(auditCall.metadata?.token).toBeUndefined();
  });

  it('2. Sanitizes TELEGRAM_BOT_USERNAME if it includes a leading @ symbol', async () => {
    const originalUsername = process.env.TELEGRAM_BOT_USERNAME;
    process.env.TELEGRAM_BOT_USERNAME = '@PrefixedBot';

    vi.spyOn(TeamMember, 'findById').mockResolvedValue(fakeTeamMember);

    const result = await TeamMemberService.generateTelegramConnectionToken(mockMemberId, mockAdminEmail);
    expect(result.link).toContain('https://t.me/PrefixedBot?start=');
    expect(result.link).not.toContain('@PrefixedBot');

    process.env.TELEGRAM_BOT_USERNAME = originalUsername;
  });

  it('3. Rejects token generation for a deactivated team member', async () => {
    fakeTeamMember.status = 'DEACTIVATED';
    vi.spyOn(TeamMember, 'findById').mockResolvedValue(fakeTeamMember);

    await expect(
      TeamMemberService.generateTelegramConnectionToken(mockMemberId, mockAdminEmail)
    ).rejects.toThrow('Cannot generate connection token for a deactivated team member');
  });

  it('4. Rejects token generation for invalid ObjectId or non-existent member', async () => {
    await expect(
      TeamMemberService.generateTelegramConnectionToken('invalid-id', mockAdminEmail)
    ).rejects.toThrow('Team member not found');

    vi.spyOn(TeamMember, 'findById').mockResolvedValue(null);
    await expect(
      TeamMemberService.generateTelegramConnectionToken(mockMemberId, mockAdminEmail)
    ).rejects.toThrow('Team member not found');
  });

  // =========================================================================
  // 2. Backend API Route Verification
  // =========================================================================
  it('5. API route /api/team-members/[id]/connect generates connection link for ADMIN', async () => {
    vi.spyOn(TeamMember, 'findById').mockResolvedValue(fakeTeamMember);

    const req = new NextRequest(`http://localhost:3000/api/team-members/${mockMemberId}/connect`, {
      method: 'POST',
      headers: {
        'x-user-role': 'ADMIN',
        'x-user-email': mockAdminEmail,
      },
    });

    const res = await connectRoute(req, { params: Promise.resolve({ id: mockMemberId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.link).toContain('https://t.me/');
    expect(json.data.token).toMatch(/^TEAM_/);
    expect(json.data.expiresAt).toBeDefined();
  });

  it('6. API route rejects non-ADMIN requests with 403 FORBIDDEN', async () => {
    const req = new NextRequest(`http://localhost:3000/api/team-members/${mockMemberId}/connect`, {
      method: 'POST',
      headers: {
        'x-user-role': 'DEVELOPER',
        'x-user-email': 'dev@drdebuggers.com',
      },
    });

    const res = await connectRoute(req, { params: Promise.resolve({ id: mockMemberId }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('7. API route returns 404 NOT_FOUND for non-existent team member', async () => {
    vi.spyOn(TeamMember, 'findById').mockResolvedValue(null);

    const req = new NextRequest(`http://localhost:3000/api/team-members/${mockMemberId}/connect`, {
      method: 'POST',
      headers: {
        'x-user-role': 'ADMIN',
        'x-user-email': mockAdminEmail,
      },
    });

    const res = await connectRoute(req, { params: Promise.resolve({ id: mockMemberId }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('8. Alias route /api/team-members/[id]/telegram-token works identically to /connect', async () => {
    vi.spyOn(TeamMember, 'findById').mockResolvedValue(fakeTeamMember);

    const req = new NextRequest(`http://localhost:3000/api/team-members/${mockMemberId}/telegram-token`, {
      method: 'POST',
      headers: {
        'x-user-role': 'ADMIN',
        'x-user-email': mockAdminEmail,
      },
    });

    const res = await telegramTokenRoute(req, { params: Promise.resolve({ id: mockMemberId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.link).toContain('https://t.me/');
  });

  // =========================================================================
  // 3. Telegram Account Linking & Single-Use Enforcement
  // =========================================================================
  it('9. Successfully links Telegram profile using valid token and invalidates token', async () => {
    const validToken = 'TEAM_1234567890ABCDEF1234567890ABCDEF';
    fakeTeamMember.telegramConnectionToken = validToken;
    fakeTeamMember.telegramTokenExpiresAt = new Date(Date.now() + 3600000);

    (vi.spyOn(TeamMember, 'findOne') as any).mockImplementation(async (query: any) => {
      if (query.telegramConnectionToken === validToken) {
        return fakeTeamMember;
      }
      if (query.telegramUserId === mockTelegramUserId) {
        return null; // No duplicate
      }
      return null;
    });

    const connected = await TeamMemberService.connectTelegram(validToken, {
      telegramUserId: mockTelegramUserId,
      telegramUsername: 'AliceDev',
      telegramChatId: mockChatId,
    });

    expect(connected.telegramConnected).toBe(true);
    expect(connected.telegramUserId).toBe(mockTelegramUserId);
    expect(connected.telegramUsername).toBe('AliceDev');
    expect(connected.telegramChatId).toBe(mockChatId);
    expect(connected.telegramConnectionToken).toBeUndefined();
    expect(connected.telegramTokenExpiresAt).toBeUndefined();
    expect(fakeTeamMember.save).toHaveBeenCalled();
  });

  it('10. Rejects invalid or expired connection token', async () => {
    vi.spyOn(TeamMember, 'findOne').mockResolvedValue(null);

    await expect(
      TeamMemberService.connectTelegram('TEAM_NON_EXISTENT', {
        telegramUserId: mockTelegramUserId,
        telegramChatId: mockChatId,
      })
    ).rejects.toThrow('Invalid or expired team connection token');
  });

  it('11. Prevents duplicate Telegram account collision across team members', async () => {
    const validToken = 'TEAM_VALIDTOKEN1234567890ABCDEF12';
    fakeTeamMember.telegramConnectionToken = validToken;
    fakeTeamMember.telegramTokenExpiresAt = new Date(Date.now() + 3600000);

    // Another team member already has this telegramUserId
    const existingOtherMember = {
      _id: new mongoose.Types.ObjectId(otherMemberId),
      name: 'Bob',
      telegramUserId: mockTelegramUserId,
      telegramConnected: true,
      status: 'ACTIVE',
    };

    (vi.spyOn(TeamMember, 'findOne') as any).mockImplementation(async (query: any) => {
      if (query.telegramConnectionToken === validToken) {
        return fakeTeamMember;
      }
      if (query.telegramUserId === mockTelegramUserId) {
        return existingOtherMember as any;
      }
      return null;
    });

    await expect(
      TeamMemberService.connectTelegram(validToken, {
        telegramUserId: mockTelegramUserId,
        telegramChatId: mockChatId,
      })
    ).rejects.toThrow('This Telegram account is already connected to another team member.');
  });

  // =========================================================================
  // 4. Telegram Webhook Integration & Message Routing
  // =========================================================================
  it('12. Webhook accurately recognizes /start <TEAM_TOKEN> and executes team member connection', async () => {
    const token = 'TEAM_AABBCCDDEEFF00112233445566778899';
    vi.spyOn(TeamMemberService, 'connectTelegram').mockResolvedValue({
      name: 'Alice Developer',
      role: 'DEVELOPER',
    } as any);

    const mockSendRaw = vi.fn().mockResolvedValue({ success: true });
    vi.spyOn(TelegramService as any, 'sendMessageRaw').mockImplementation(mockSendRaw);
    vi.spyOn(TelegramService as any, 'syncChatCommands').mockResolvedValue(true);

    const update = {
      update_id: 10001,
      message: {
        message_id: 1,
        chat: { id: 12345, type: 'private' },
        from: { id: 12345, username: 'alice_bot_user', first_name: 'Alice' },
        text: `/start ${token}`,
      },
    };

    const result = await TelegramService.handleWebhookUpdate(update, performance.now());

    expect(TeamMemberService.connectTelegram).toHaveBeenCalledWith(token, {
      telegramUserId: '12345',
      telegramUsername: 'alice_bot_user',
      telegramChatId: '12345',
    });
    expect(mockSendRaw).toHaveBeenCalledWith(
      '12345',
      expect.stringContaining('Telegram Successfully Connected!'),
      expect.anything()
    );
  });

  it('13. Webhook cleanly handles /start@BotUsername <TEAM_TOKEN> with bot mention', async () => {
    const token = 'TEAM_AABBCCDDEEFF00112233445566778899';
    vi.spyOn(TeamMemberService, 'connectTelegram').mockResolvedValue({
      name: 'Alice Developer',
      role: 'DEVELOPER',
    } as any);

    vi.spyOn(TelegramService as any, 'sendMessageRaw').mockResolvedValue({ success: true });
    vi.spyOn(TelegramService as any, 'syncChatCommands').mockResolvedValue(true);

    const update = {
      update_id: 10002,
      message: {
        message_id: 2,
        chat: { id: 12345, type: 'private' },
        from: { id: 12345, username: 'alice_bot_user' },
        text: `/start@TestMockBot ${token}`,
      },
    };

    await TelegramService.handleWebhookUpdate(update, performance.now());

    expect(TeamMemberService.connectTelegram).toHaveBeenCalledWith(token, expect.anything());
  });

  it('14. Webhook gracefully sends failure notification when team token is invalid', async () => {
    vi.spyOn(TeamMemberService, 'connectTelegram').mockRejectedValue(
      new Error('Invalid or expired team connection token')
    );

    const mockSend = vi.fn().mockResolvedValue(true);
    vi.spyOn(TelegramService as any, 'sendMessage').mockImplementation(mockSend);

    const update = {
      update_id: 10003,
      message: {
        message_id: 3,
        chat: { id: 12345, type: 'private' },
        from: { id: 12345, username: 'alice_bot_user' },
        text: '/start TEAM_INVALID_EXPIRED',
      },
    };

    await TelegramService.handleWebhookUpdate(update, performance.now());

    expect(mockSend).toHaveBeenCalledWith(
      '12345',
      expect.stringContaining('Team Connection Failed'),
      expect.anything()
    );
  });

  // =========================================================================
  // 5. Regression Check: Existing Client & Team Member Flows
  // =========================================================================
  it('15. Preserves existing team member /start command for already connected members', async () => {
    fakeTeamMember.telegramConnected = true;
    fakeTeamMember.telegramUserId = mockTelegramUserId;
    fakeTeamMember.telegramChatId = mockChatId;

    vi.spyOn(TeamMember, 'findOne').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(fakeTeamMember),
      }),
      lean: vi.fn().mockResolvedValue(fakeTeamMember),
    } as any);
    vi.spyOn(Client, 'findOne').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
      lean: vi.fn().mockResolvedValue(null),
    } as any);

    const mockSendRaw = vi.fn().mockResolvedValue({ success: true });
    vi.spyOn(TelegramService as any, 'sendMessageRaw').mockImplementation(mockSendRaw);
    vi.spyOn(TelegramService as any, 'syncChatCommands').mockResolvedValue(true);

    const update = {
      update_id: 10004,
      message: {
        message_id: 4,
        chat: { id: Number(mockChatId), type: 'private' },
        from: { id: Number(mockTelegramUserId), username: 'AliceDev' },
        text: '/start',
      },
    };

    await TelegramService.handleWebhookUpdate(update, performance.now());

    expect(mockSendRaw).toHaveBeenCalledWith(
      mockChatId,
      expect.stringContaining('Welcome, Alice Developer!'),
      expect.anything()
    );
  });

  it('16. Preserves existing team member /tasks command', async () => {
    fakeTeamMember.telegramConnected = true;
    fakeTeamMember.telegramUserId = mockTelegramUserId;
    fakeTeamMember.telegramChatId = mockChatId;

    vi.spyOn(TeamMember, 'findOne').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(fakeTeamMember),
      }),
      lean: vi.fn().mockResolvedValue(fakeTeamMember),
    } as any);
    vi.spyOn(Client, 'findOne').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
      lean: vi.fn().mockResolvedValue(null),
    } as any);
    vi.spyOn(Task, 'find').mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as any);

    const mockSendRaw = vi.fn().mockResolvedValue({ success: true });
    vi.spyOn(TelegramService as any, 'sendMessageRaw').mockImplementation(mockSendRaw);
    vi.spyOn(TelegramService as any, 'syncChatCommands').mockResolvedValue(true);

    const update = {
      update_id: 10005,
      message: {
        message_id: 5,
        chat: { id: Number(mockChatId), type: 'private' },
        from: { id: Number(mockTelegramUserId), username: 'AliceDev' },
        text: '/tasks',
      },
    };

    await TelegramService.handleWebhookUpdate(update, performance.now());

    expect(mockSendRaw).toHaveBeenCalledWith(
      mockChatId,
      expect.stringContaining('Your Assigned Tasks'),
      expect.anything()
    );
  });

  it('17. Preserves existing Client /start <CLIENT_TOKEN> connection flow', async () => {
    const clientToken = 'CLIENT_TOKEN_12345';
    vi.spyOn(ClientService, 'connectTelegram').mockResolvedValue({
      name: 'Bob Client',
      clientCode: 'CL-1001',
    } as any);

    const mockSendRaw = vi.fn().mockResolvedValue({ success: true });
    vi.spyOn(TelegramService as any, 'sendMessageRaw').mockImplementation(mockSendRaw);
    vi.spyOn(TelegramService as any, 'syncChatCommands').mockResolvedValue(true);

    const update = {
      update_id: 10006,
      message: {
        message_id: 6,
        chat: { id: 554433, type: 'private' },
        from: { id: 554433, username: 'bob_client' },
        text: `/start ${clientToken}`,
      },
    };

    await TelegramService.handleWebhookUpdate(update, performance.now());

    expect(ClientService.connectTelegram).toHaveBeenCalledWith(clientToken, {
      telegramUserId: '554433',
      telegramUsername: 'bob_client',
      telegramChatId: '554433',
    });
    expect(mockSendRaw).toHaveBeenCalledWith(
      '554433',
      expect.stringContaining('CL-1001'),
      expect.anything()
    );
  });

  it('18. Preserves webhook secret token validation', async () => {
    // If webhook secret header does not match, request is rejected
    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret_webhook_pass';
    const { POST: webhookHandler } = await import('@/app/api/telegram/webhook/route');

    const req = new NextRequest('http://localhost:3000/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'x-telegram-bot-api-secret-token': 'wrong_secret',
      },
      body: JSON.stringify({}),
    });

    const res = await webhookHandler(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHORIZED');
  });
});
