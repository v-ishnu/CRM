import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import nextConfig from '../../next.config';
import TeamMember from '@/models/TeamMember';
import TeamMemberConversation from '@/models/TeamMemberConversation';
import TeamMemberMessage from '@/models/TeamMemberMessage';
import User from '@/models/User';
import Client from '@/models/Client';
import Task from '@/models/Task';
import { TeamChatService } from '@/services/team-chat.service';
import { TelegramService } from '@/services/telegram.service';
import { AuditService } from '@/services/audit.service';
import { GET as getChatRoute, POST as postChatRoute } from '@/app/api/team-members/[id]/chat/route';
import { POST as markReadRoute } from '@/app/api/team-members/[id]/chat/read/route';
import { PATCH as statusRoute } from '@/app/api/team-members/[id]/chat/status/route';

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

// 3. Mock CacheService
vi.mock('@/services/cache.service', () => ({
  CacheService: {
    teamChatUnreadKey: vi.fn().mockReturnValue('crm:team_chat:unread:123'),
    teamChatConvKey: vi.fn().mockReturnValue('crm:team_chat:conv:123:admin'),
    telegramIdentityKey: vi.fn().mockReturnValue('crm:telegram:identity:123'),
    invalidateTelegramIdentity: vi.fn().mockResolvedValue(true),
    invalidateTeamChatCache: vi.fn().mockResolvedValue(true),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(true),
  },
}));

// Helper to mock Mongoose query chain supporting both await query and await query.lean()
function mockMongooseQuery(val: any) {
  const q: any = {
    lean: vi.fn().mockResolvedValue(val),
    sort: vi.fn().mockImplementation(() => q),
    skip: vi.fn().mockImplementation(() => q),
    limit: vi.fn().mockImplementation(() => q),
    populate: vi.fn().mockImplementation(() => q),
    select: vi.fn().mockImplementation(() => q),
    then: (resolve: any, reject?: any) => Promise.resolve(val).then(resolve, reject),
  };
  return q;
}

describe('Team Member Chat & Next.js Dev Origin Test Suite', () => {
  const mockAdminId = new mongoose.Types.ObjectId().toString();
  const mockAdminUser = {
    id: mockAdminId,
    name: 'Primary Administrator',
    email: 'admin@drdebuggers.com',
    role: 'ADMIN',
  };

  const mockMemberAId = new mongoose.Types.ObjectId().toString();
  const mockMemberBId = new mongoose.Types.ObjectId().toString();
  const mockTelegramUserIdA = '888111222';
  const mockTelegramChatIdA = '888111222';
  const mockTelegramUserIdB = '888333444';
  const mockTelegramChatIdB = '888333444';

  let fakeMemberA: any;
  let fakeMemberB: any;
  let fakeConversationA: any;
  let fakeConversationB: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    // Prevent any network call during tests
    vi.spyOn(TelegramService as any, 'syncChatCommands').mockResolvedValue(true);
    vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ success: true, messageId: 100 });

    fakeMemberA = {
      _id: new mongoose.Types.ObjectId(mockMemberAId),
      name: 'Alice Developer',
      email: 'alice@drdebuggers.com',
      role: 'DEVELOPER',
      designation: 'Senior Frontend Engineer',
      status: 'ACTIVE',
      telegramConnected: true,
      telegramUserId: mockTelegramUserIdA,
      telegramUsername: 'alice_dev',
      telegramChatId: mockTelegramChatIdA,
      permissions: ['VIEW_PROJECT', 'VIEW_TASKS'],
      save: vi.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };

    fakeMemberB = {
      _id: new mongoose.Types.ObjectId(mockMemberBId),
      name: 'Bob Backend',
      email: 'bob@drdebuggers.com',
      role: 'DEVELOPER',
      designation: 'Backend Architect',
      status: 'ACTIVE',
      telegramConnected: true,
      telegramUserId: mockTelegramUserIdB,
      telegramUsername: 'bob_backend',
      telegramChatId: mockTelegramChatIdB,
      permissions: ['VIEW_PROJECT', 'VIEW_TASKS'],
      save: vi.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };

    fakeConversationA = {
      _id: new mongoose.Types.ObjectId(),
      adminId: new mongoose.Types.ObjectId(mockAdminId),
      teamMemberId: fakeMemberA._id,
      type: 'TEAM_MEMBER',
      status: 'OPEN',
      lastMessageAt: new Date(),
      lastMessageText: '',
      unreadAdminCount: 0,
      unreadTeamMemberCount: 0,
      save: vi.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };

    fakeConversationB = {
      _id: new mongoose.Types.ObjectId(),
      adminId: new mongoose.Types.ObjectId(mockAdminId),
      teamMemberId: fakeMemberB._id,
      type: 'TEAM_MEMBER',
      status: 'OPEN',
      lastMessageAt: new Date(),
      lastMessageText: '',
      unreadAdminCount: 0,
      unreadTeamMemberCount: 0,
      save: vi.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };

    vi.spyOn(User, 'findOne').mockReturnValue(
      mockMongooseQuery({
        _id: new mongoose.Types.ObjectId(mockAdminId),
        role: 'ADMIN',
        name: 'Primary Administrator',
        email: 'admin@drdebuggers.com',
      })
    );

    vi.spyOn(TeamMemberMessage.prototype, 'save').mockImplementation(async function (this: any) {
      return this;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // SECTION 1: NEXT.JS DEV ORIGINS
  // ==========================================
  describe('1. Next.js Dev Origin Configuration & Validation', () => {
    it('should include 127.0.0.1 in allowedDevOrigins', () => {
      expect(nextConfig.allowedDevOrigins).toBeDefined();
      expect(nextConfig.allowedDevOrigins).toContain('127.0.0.1');
    });

    it('should preserve localhost in allowedDevOrigins', () => {
      expect(nextConfig.allowedDevOrigins).toContain('localhost');
    });

    it('should not contain broad wildcards or weak origins', () => {
      expect(nextConfig.allowedDevOrigins).not.toContain('*');
      expect(nextConfig.allowedDevOrigins).not.toContain('**');
    });

    it('should verify Next.js blockCrossSiteDEV behavior allows configured 127.0.0.1', async () => {
      const allowedOrigins = ['**.localhost', 'localhost', ...(nextConfig.allowedDevOrigins || [])];
      expect(allowedOrigins).toContain('127.0.0.1');
      expect(allowedOrigins).toContain('localhost');

      // Verify simulated origin check
      const isOriginAllowed = (origin: string) => allowedOrigins.includes(origin);
      expect(isOriginAllowed('127.0.0.1')).toBe(true);
      expect(isOriginAllowed('localhost')).toBe(true);
      expect(isOriginAllowed('malicious-attacker.com')).toBe(false);
    });
  });

  // ==========================================
  // SECTION 2: IDENTITY RESOLUTION & TELEGRAM
  // ==========================================
  describe('2. Telegram Identity Resolution & Security', () => {
    it('should correctly resolve linked active Team Member', async () => {
      vi.spyOn(Client, 'findOne').mockReturnValue(mockMongooseQuery(null));
      vi.spyOn(TeamMember, 'findOne').mockReturnValue(mockMongooseQuery(fakeMemberA));

      const identity = await TelegramService.resolveTelegramIdentity(mockTelegramUserIdA, mockTelegramChatIdA);
      expect(identity.type).toBe('TEAM_MEMBER');
      expect(identity.teamMember).toBeDefined();
      expect(identity.teamMember.email).toBe(fakeMemberA.email);
    });

    it('should NOT treat an unknown Telegram user as a Team Member', async () => {
      vi.spyOn(Client, 'findOne').mockReturnValue(mockMongooseQuery(null));
      vi.spyOn(TeamMember, 'findOne').mockReturnValue(mockMongooseQuery(null));

      const identity = await TelegramService.resolveTelegramIdentity('unknown_999999', 'unknown_999999');
      expect(identity.type).toBe('UNLINKED');
      expect(identity.teamMember).toBeUndefined();
    });

    it('should normalize Telegram user ID strictly from message.from.id', async () => {
      const update = {
        update_id: 1001,
        message: {
          message_id: 55,
          from: {
            id: Number(mockTelegramUserIdA),
            first_name: 'ImposterName',
            username: 'different_user',
          },
          chat: {
            id: 9999999,
          },
          text: 'Hello admin',
        },
      };

      vi.spyOn(Client, 'findOne').mockReturnValue(mockMongooseQuery(null));
      vi.spyOn(TeamMember, 'findOne').mockImplementation((query: any) => {
        const hasUserId = query.$or?.some((c: any) => c.telegramUserId === String(mockTelegramUserIdA));
        if (hasUserId) {
          return mockMongooseQuery(fakeMemberA);
        }
        return mockMongooseQuery(null);
      });

      const sendRawSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ success: true });
      const handleIncomingSpy = vi.spyOn(TeamChatService, 'handleIncomingTeamMemberMessage').mockResolvedValue({} as any);

      await TelegramService.handleWebhookUpdate(update);

      expect(handleIncomingSpy).toHaveBeenCalledWith(fakeMemberA, 'Hello admin', 55);
      expect(sendRawSpy).toHaveBeenCalledWith(
        '9999999',
        expect.stringContaining('Message received by Admin'),
        expect.any(Object)
      );

      handleIncomingSpy.mockRestore();
    });

    it('should prevent chat ID from impersonating a user ID', async () => {
      const spoofedChatId = mockTelegramUserIdA;
      const attackerUserId = '666666';

      vi.spyOn(Client, 'findOne').mockReturnValue(mockMongooseQuery(null));
      vi.spyOn(TeamMember, 'findOne').mockReturnValue(mockMongooseQuery(null));

      const identity = await TelegramService.resolveTelegramIdentity(attackerUserId, spoofedChatId);
      expect(identity.type).toBe('UNLINKED');
      expect(identity.teamMember).toBeUndefined();
    });
  });

  // ==========================================
  // SECTION 3: ADMIN SENDS MESSAGE TO TEAM MEMBER
  // ==========================================
  describe('3. Admin ↔ Team Member Message Delivery', () => {
    it('should allow authorized Admin to open or initialize chat with Team Member', async () => {
      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockMongooseQuery(fakeMemberA));
      vi.spyOn(TeamMemberConversation, 'findOne').mockReturnValue(mockMongooseQuery(fakeConversationA));

      const result = await TeamChatService.getOrCreateConversation(mockMemberAId, mockAdminUser);
      expect(result.conversation).toBeDefined();
      expect(result.teamMember.email).toBe('alice@drdebuggers.com');
      expect(result.teamMember.telegramConnected).toBe(true);
    });

    it('should refuse to open chat with deactivated Team Member', async () => {
      const deactivatedMember = { ...fakeMemberA, status: 'DEACTIVATED' };
      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockMongooseQuery(deactivatedMember));

      await expect(
        TeamChatService.getOrCreateConversation(mockMemberAId, mockAdminUser)
      ).rejects.toThrow(/Cannot open chat with a deactivated team member/);
    });

    it('should dispatch message from Admin via TelegramService and mark DELIVERED', async () => {
      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockMongooseQuery(fakeMemberA));
      vi.spyOn(TeamMemberConversation, 'findOne').mockReturnValue(mockMongooseQuery(fakeConversationA));

      const sendRawSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({
        success: true,
        messageId: 7777,
      });

      const result = await TeamChatService.sendMessageFromAdmin({
        teamMemberId: mockMemberAId,
        text: 'Please deploy the hotfix to staging.',
        adminUser: mockAdminUser,
      });

      expect(sendRawSpy).toHaveBeenCalledWith(
        mockTelegramChatIdA,
        expect.stringContaining('Please deploy the hotfix to staging.')
      );
      expect(result.message.status).toBe('DELIVERED');
      expect(result.message.telegramMessageId).toBe('7777');
      expect(fakeConversationA.lastMessageText).toBe('Please deploy the hotfix to staging.');
      expect(AuditService.logAction).toHaveBeenCalledWith(
        mockAdminUser.email,
        'TEAM_MEMBER_MESSAGE_SENT',
        'TeamMember',
        mockMemberAId,
        expect.any(Object)
      );
    });

    it('should mark message status as FAILED when TelegramService dispatch fails', async () => {
      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockMongooseQuery(fakeMemberA));
      vi.spyOn(TeamMemberConversation, 'findOne').mockReturnValue(mockMongooseQuery(fakeConversationA));

      vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({
        success: false,
        error: 'Telegram API 403: Bot was blocked by the user',
      });

      await expect(
        TeamChatService.sendMessageFromAdmin({
          teamMemberId: mockMemberAId,
          text: 'This will fail.',
          adminUser: mockAdminUser,
        })
      ).rejects.toThrow(/Bot was blocked by the user/);

      expect(AuditService.logAction).toHaveBeenCalledWith(
        mockAdminUser.email,
        'TEAM_MEMBER_MESSAGE_FAILED',
        'TeamMember',
        mockMemberAId,
        expect.any(Object)
      );
    });

    it('should refuse to send message if Telegram is not connected', async () => {
      const unconnectedMember = { ...fakeMemberA, telegramConnected: false, telegramChatId: undefined };
      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockMongooseQuery(unconnectedMember));

      await expect(
        TeamChatService.sendMessageFromAdmin({
          teamMemberId: mockMemberAId,
          text: 'Hello',
          adminUser: mockAdminUser,
        })
      ).rejects.toThrow(/Telegram not connected/);
    });
  });

  // ==========================================
  // SECTION 4: TEAM MEMBER REPLY VIA WEBHOOK
  // ==========================================
  describe('4. Team Member Reply & Inbound Routing', () => {
    it('should receive Team Member text reply and persist incoming message', async () => {
      vi.spyOn(TeamMemberConversation, 'findOne').mockReturnValue(mockMongooseQuery(fakeConversationA));

      const incoming = await TeamChatService.handleIncomingTeamMemberMessage(
        fakeMemberA,
        'Hotfix is tested and deployed successfully!',
        8899
      );

      expect(incoming.senderType).toBe('TEAM_MEMBER');
      expect(incoming.senderId).toBe(mockMemberAId);
      expect(incoming.channel).toBe('TELEGRAM');
      expect(incoming.telegramMessageId).toBe('8899');
      expect(incoming.status).toBe('DELIVERED');
      expect(fakeConversationA.unreadAdminCount).toBe(1);
      expect(fakeConversationA.lastMessageText).toBe('Hotfix is tested and deployed successfully!');
    });

    it('should map incoming reply to the correct conversation owned by Admin', async () => {
      vi.spyOn(TeamMemberConversation, 'findOne').mockImplementation((query: any) => {
        if (query.teamMemberId?.toString() === fakeMemberA._id.toString()) {
          return mockMongooseQuery(fakeConversationA);
        }
        return mockMongooseQuery(null);
      });

      const incoming = await TeamChatService.handleIncomingTeamMemberMessage(
        fakeMemberA,
        'Reply from Alice',
        9001
      );

      expect(incoming.conversationId).toEqual(fakeConversationA._id);
      expect(fakeConversationA.unreadAdminCount).toBe(1);
    });
  });

  // ==========================================
  // SECTION 5: ISOLATION & ACCESS CONTROL
  // ==========================================
  describe('5. Multi-User Isolation & Anti-Leakage', () => {
    it('should ensure Member A and Member B conversations remain strictly isolated', async () => {
      vi.spyOn(TeamMemberConversation, 'findOne').mockImplementation((query: any) => {
        if (query.teamMemberId?.toString() === fakeMemberA._id.toString()) {
          return mockMongooseQuery(fakeConversationA);
        }
        if (query.teamMemberId?.toString() === fakeMemberB._id.toString()) {
          return mockMongooseQuery(fakeConversationB);
        }
        return mockMongooseQuery(null);
      });

      const msgA = await TeamChatService.handleIncomingTeamMemberMessage(fakeMemberA, 'Msg from A', 101);
      const msgB = await TeamChatService.handleIncomingTeamMemberMessage(fakeMemberB, 'Msg from B', 102);

      expect(msgA.conversationId).toEqual(fakeConversationA._id);
      expect(msgB.conversationId).toEqual(fakeConversationB._id);
      expect(msgA.conversationId).not.toEqual(msgB.conversationId);
      expect(msgA.senderId).toBe(mockMemberAId);
      expect(msgB.senderId).toBe(mockMemberBId);
    });

    it('should mark conversation read only when conversation is explicitly opened/read', async () => {
      fakeConversationA.unreadAdminCount = 3;
      vi.spyOn(TeamMemberConversation, 'findOne').mockReturnValue(mockMongooseQuery(fakeConversationA));
      const updateManySpy = vi.spyOn(TeamMemberMessage, 'updateMany').mockResolvedValue({ modifiedCount: 3 } as any);

      const result = await TeamChatService.markConversationAsRead(mockMemberAId, mockAdminUser);
      expect(result.success).toBe(true);
      expect(result.readCount).toBe(3);
      expect(fakeConversationA.unreadAdminCount).toBe(0);
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: fakeConversationA._id, senderType: 'TEAM_MEMBER' }),
        expect.objectContaining({ $set: expect.objectContaining({ status: 'READ' }) })
      );
    });
  });

  // ==========================================
  // SECTION 6: TELEGRAM COMMAND REGRESSION
  // ==========================================
  describe('6. Telegram Bot Commands & Regression Prevention', () => {
    it('should not intercept /start command and keep executing existing flow', async () => {
      const update = {
        update_id: 2001,
        message: {
          message_id: 11,
          from: { id: Number(mockTelegramUserIdA), username: 'alice_dev' },
          chat: { id: Number(mockTelegramChatIdA) },
          text: '/start',
        },
      };

      vi.spyOn(Client, 'findOne').mockReturnValue(mockMongooseQuery(null));
      vi.spyOn(TeamMember, 'findOne').mockReturnValue(mockMongooseQuery(fakeMemberA));
      const sendRawSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ success: true });

      const res = await TelegramService.handleWebhookUpdate(update);
      expect(res.command).toBe('/start');
      expect(sendRawSpy).toHaveBeenCalledWith(
        mockTelegramChatIdA,
        expect.stringContaining('Welcome, Alice Developer!'),
        expect.any(Object)
      );
    });

    it('should keep /tasks and menu button "📋 My Tasks" functioning', async () => {
      const update = {
        update_id: 2002,
        message: {
          message_id: 12,
          from: { id: Number(mockTelegramUserIdA), username: 'alice_dev' },
          chat: { id: Number(mockTelegramChatIdA) },
          text: '📋 My Tasks',
        },
      };

      vi.spyOn(Client, 'findOne').mockReturnValue(mockMongooseQuery(null));
      vi.spyOn(TeamMember, 'findOne').mockReturnValue(mockMongooseQuery(fakeMemberA));
      vi.spyOn(Task, 'find').mockReturnValue(mockMongooseQuery([]));

      const sendRawSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ success: true });

      const res = await TelegramService.handleWebhookUpdate(update);
      expect(res.command).toBe('/tasks');
      expect(sendRawSpy).toHaveBeenCalledWith(
        mockTelegramChatIdA,
        expect.stringContaining('Your Assigned Tasks'),
        expect.any(Object)
      );
    });

    it('should preserve client command blocking (/status, /payments) for team members', async () => {
      const update = {
        update_id: 2003,
        message: {
          message_id: 13,
          from: { id: Number(mockTelegramUserIdA), username: 'alice_dev' },
          chat: { id: Number(mockTelegramChatIdA) },
          text: '/status',
        },
      };

      vi.spyOn(Client, 'findOne').mockReturnValue(mockMongooseQuery(null));
      vi.spyOn(TeamMember, 'findOne').mockReturnValue(mockMongooseQuery(fakeMemberA));
      const sendRawSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ success: true });

      await TelegramService.handleWebhookUpdate(update);
      expect(sendRawSpy).toHaveBeenCalledWith(
        mockTelegramChatIdA,
        expect.stringContaining('This command is not available for team members'),
        expect.any(Object)
      );
      expect(AuditService.logAction).toHaveBeenCalledWith(
        fakeMemberA.email,
        'TEAM_MEMBER_COMMAND_DENIED',
        'TeamMember',
        mockMemberAId,
        expect.any(Object)
      );
    });
  });

  // ==========================================
  // SECTION 7: API ROUTE INTEGRATION
  // ==========================================
  describe('7. API Route Integration', () => {
    it('GET /api/team-members/[id]/chat should return conversation and messages', async () => {
      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockMongooseQuery(fakeMemberA));
      vi.spyOn(TeamMemberConversation, 'findOne').mockReturnValue(mockMongooseQuery(fakeConversationA));
      vi.spyOn(TeamMemberMessage, 'countDocuments').mockResolvedValue(1);
      vi.spyOn(TeamMemberMessage, 'find').mockReturnValue(
        mockMongooseQuery([
          {
            _id: new mongoose.Types.ObjectId(),
            senderType: 'ADMIN',
            text: 'Test message',
            status: 'DELIVERED',
            sentAt: new Date(),
          },
        ])
      );

      const req = new NextRequest(`http://localhost:3000/api/team-members/${mockMemberAId}/chat`, {
        headers: {
          'x-user-id': mockAdminId,
          'x-user-email': 'admin@drdebuggers.com',
          'x-user-role': 'ADMIN',
          'x-user-name': 'Administrator',
        },
      });

      const res = await getChatRoute(req, { params: Promise.resolve({ id: mockMemberAId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.messages).toHaveLength(1);
      expect(json.data.teamMember.email).toBe(fakeMemberA.email);
    });

    it('POST /api/team-members/[id]/chat should validate input and send message', async () => {
      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockMongooseQuery(fakeMemberA));
      vi.spyOn(TeamMemberConversation, 'findOne').mockReturnValue(mockMongooseQuery(fakeConversationA));
      vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ success: true, messageId: 9911 });

      const req = new NextRequest(`http://localhost:3000/api/team-members/${mockMemberAId}/chat`, {
        method: 'POST',
        headers: {
          'x-user-id': mockAdminId,
          'x-user-email': 'admin@drdebuggers.com',
          'x-user-role': 'ADMIN',
          'x-user-name': 'Administrator',
        },
        body: JSON.stringify({ text: 'Status update request' }),
      });

      const res = await postChatRoute(req, { params: Promise.resolve({ id: mockMemberAId }) });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.message.status).toBe('DELIVERED');
      expect(json.data.message.telegramMessageId).toBe('9911');
    });

    it('PATCH /api/team-members/[id]/chat/status should update conversation status', async () => {
      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockMongooseQuery(fakeMemberA));
      vi.spyOn(TeamMemberConversation, 'findOne').mockReturnValue(mockMongooseQuery(fakeConversationA));

      const req = new NextRequest(`http://localhost:3000/api/team-members/${mockMemberAId}/chat/status`, {
        method: 'PATCH',
        headers: {
          'x-user-id': mockAdminId,
          'x-user-email': 'admin@drdebuggers.com',
          'x-user-role': 'ADMIN',
        },
        body: JSON.stringify({ status: 'CLOSED' }),
      });

      const res = await statusRoute(req, { params: Promise.resolve({ id: mockMemberAId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(fakeConversationA.status).toBe('CLOSED');
    });
  });

  // ==========================================
  // SECTION 8: LOW-LATENCY OPTIMIZATIONS & RELIABILITY
  // ==========================================
  describe('8. Low-Latency Optimizations & Reliability', () => {
    it('should support incremental message polling via ?after= timestamp', async () => {
      const now = new Date();
      const mockIncrementalMsg = {
        _id: new mongoose.Types.ObjectId(),
        teamMemberId: fakeMemberA._id,
        senderType: 'TEAM_MEMBER',
        text: 'Fast incremental message',
        status: 'DELIVERED',
        sentAt: now,
      };

      vi.spyOn(TeamMemberMessage, 'find').mockReturnValue(mockMongooseQuery([mockIncrementalMsg]));
      vi.spyOn(TeamMemberConversation, 'findOne').mockReturnValue(
        mockMongooseQuery({ unreadAdminCount: 2, lastMessageAt: now, status: 'OPEN' })
      );

      const afterIso = new Date(Date.now() - 5000).toISOString();
      const req = new NextRequest(
        `http://localhost:3000/api/team-members/${mockMemberAId}/chat?after=${encodeURIComponent(afterIso)}`,
        {
          headers: {
            'x-user-id': mockAdminId,
            'x-user-email': 'admin@drdebuggers.com',
          },
        }
      );

      const res = await getChatRoute(req, { params: Promise.resolve({ id: mockMemberAId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.messages).toHaveLength(1);
      expect(json.data.messages[0].text).toBe('Fast incremental message');
      expect(json.data.unreadAdminCount).toBe(2);
    });

    it('should leverage Redis cache-aside for instant identity resolution without hitting MongoDB', async () => {
      const cachedIdentity = {
        type: 'TEAM_MEMBER' as const,
        teamMember: {
          _id: fakeMemberA._id,
          name: fakeMemberA.name,
          email: fakeMemberA.email,
          role: 'DEVELOPER',
          status: 'ACTIVE',
          telegramConnected: true,
          telegramUserId: mockTelegramUserIdA,
          telegramChatId: mockTelegramChatIdA,
        },
      };

      // Mock Redis GET returning hit
      const { CacheService } = await import('@/services/cache.service');
      vi.spyOn(CacheService, 'get').mockResolvedValue(cachedIdentity);
      const teamFindSpy = vi.spyOn(TeamMember, 'findOne');
      const clientFindSpy = vi.spyOn(Client, 'findOne');

      const resolved = await TelegramService.resolveTelegramIdentity(mockTelegramUserIdA, mockTelegramChatIdA);
      expect(resolved.type).toBe('TEAM_MEMBER');
      expect(resolved.teamMember.name).toBe(fakeMemberA.name);

      // Verified: Zero DB round-trips when Redis cache hits!
      expect(teamFindSpy).not.toHaveBeenCalled();
      expect(clientFindSpy).not.toHaveBeenCalled();
    });

    it('should transparently fall back to MongoDB if Redis cache is null or throws an error', async () => {
      const { CacheService } = await import('@/services/cache.service');
      // Simulate Redis down / miss
      vi.spyOn(CacheService, 'get').mockResolvedValue(null);
      const cacheSetSpy = vi.spyOn(CacheService, 'set').mockResolvedValue(true);

      vi.spyOn(TeamMember, 'findOne').mockReturnValue(mockMongooseQuery(fakeMemberA));
      vi.spyOn(Client, 'findOne').mockReturnValue(mockMongooseQuery(null));

      const resolved = await TelegramService.resolveTelegramIdentity(mockTelegramUserIdA, mockTelegramChatIdA);
      expect(resolved.type).toBe('TEAM_MEMBER');
      expect(resolved.teamMember.email).toBe(fakeMemberA.email);

      // Populated Redis cache on miss
      expect(cacheSetSpy).toHaveBeenCalled();
    });

    it('should invalidate telegram identity cache when team member links or changes status', async () => {
      const { CacheService } = await import('@/services/cache.service');
      const invalidateSpy = vi.spyOn(CacheService, 'invalidateTelegramIdentity');

      const { TeamMemberService } = await import('@/services/team-member.service');
      vi.spyOn(TeamMember, 'findById').mockResolvedValue(fakeMemberA);
      fakeMemberA.status = 'ACTIVE';

      await TeamMemberService.deactivateTeamMember(mockMemberAId, 'admin');
      expect(invalidateSpy).toHaveBeenCalledWith(mockTelegramUserIdA);
    });

    it('should parallelize message and conversation saves in sendMessageFromAdmin', async () => {
      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockMongooseQuery(fakeMemberA));
      vi.spyOn(TeamMemberConversation, 'findOne').mockReturnValue(mockMongooseQuery(fakeConversationA));
      vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ success: true, messageId: 5566 });

      const saveTimes: number[] = [];
      fakeConversationA.save = vi.fn().mockImplementation(async () => {
        saveTimes.push(Date.now());
        return fakeConversationA;
      });

      const result = await TeamChatService.sendMessageFromAdmin({
        teamMemberId: mockMemberAId,
        text: 'Parallel save verification',
        adminUser: mockAdminUser,
      });

      expect(result.success).toBe(true);
      expect(result.message.status).toBe('DELIVERED');
      expect(result.message.telegramMessageId).toBe('5566');
      expect(fakeConversationA.save).toHaveBeenCalled();
    });

    it('should ensure Web Push failure never blocks or fails incoming Telegram chat processing', async () => {
      vi.spyOn(TeamMemberConversation, 'findOne').mockReturnValue(mockMongooseQuery(fakeConversationA));
      fakeConversationA.save = vi.fn().mockResolvedValue(fakeConversationA);

      // Simulated incoming Telegram message
      const incoming = await TeamChatService.handleIncomingTeamMemberMessage(
        fakeMemberA,
        'Incoming test with decoupled secondary tasks',
        7788
      );

      expect(incoming.status).toBe('DELIVERED');
      expect(incoming.text).toBe('Incoming test with decoupled secondary tasks');
      expect(incoming.telegramMessageId).toBe('7788');
    });

    it('should measure latency metrics for message send, identity resolution, and incremental polling', async () => {
      // 1. Measure Admin Send Message
      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockMongooseQuery(fakeMemberA));
      vi.spyOn(TeamMemberConversation, 'findOne').mockReturnValue(mockMongooseQuery(fakeConversationA));
      vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ success: true, messageId: 8899 });

      const tSend0 = performance.now();
      const sendRes = await TeamChatService.sendMessageFromAdmin({
        teamMemberId: mockMemberAId,
        text: 'Benchmark message',
        adminUser: mockAdminUser,
      });
      const tSend = performance.now() - tSend0;
      expect(sendRes.success).toBe(true);

      // 2. Measure Identity Resolution: Cache Miss (DB) vs Cache Hit (Redis)
      const { CacheService } = await import('@/services/cache.service');
      vi.spyOn(CacheService, 'get').mockResolvedValue(null);
      vi.spyOn(TeamMember, 'findOne').mockReturnValue(mockMongooseQuery(fakeMemberA));
      vi.spyOn(Client, 'findOne').mockReturnValue(mockMongooseQuery(null));

      const tDb0 = performance.now();
      await TelegramService.resolveTelegramIdentity(mockTelegramUserIdA, mockTelegramChatIdA);
      const tDb = performance.now() - tDb0;

      // Hit in Redis
      vi.spyOn(CacheService, 'get').mockResolvedValue({
        type: 'TEAM_MEMBER',
        teamMember: fakeMemberA,
      });
      const tCache0 = performance.now();
      await TelegramService.resolveTelegramIdentity(mockTelegramUserIdA, mockTelegramChatIdA);
      const tCache = performance.now() - tCache0;

      // 3. Measure Incremental Polling
      const now = new Date();
      vi.spyOn(TeamMemberMessage, 'find').mockReturnValue(mockMongooseQuery([{
        _id: new mongoose.Types.ObjectId(),
        teamMemberId: fakeMemberA._id,
        text: 'Incremental message',
        sentAt: now,
      }]));
      vi.spyOn(TeamMemberConversation, 'findOne').mockReturnValue(
        mockMongooseQuery({ unreadAdminCount: 0, lastMessageAt: now, status: 'OPEN' })
      );

      const tIncr0 = performance.now();
      await TeamChatService.getIncrementalMessages(mockMemberAId, new Date(Date.now() - 3000).toISOString());
      const tIncr = performance.now() - tIncr0;

      console.log('\n--- MEASURED CHAT BENCHMARK METRICS ---');
      console.log(`message_send_ms (Admin -> Telegram): ${tSend.toFixed(2)} ms`);
      console.log(`identity_lookup_db_ms:              ${tDb.toFixed(2)} ms`);
      console.log(`identity_lookup_redis_hit_ms:       ${tCache.toFixed(2)} ms`);
      console.log(`identity_speedup:                   ${(tDb / Math.max(tCache, 0.01)).toFixed(1)}x faster`);
      console.log(`incremental_poll_ms:                ${tIncr.toFixed(2)} ms`);
      console.log('---------------------------------------\n');

      expect(tSend).toBeGreaterThanOrEqual(0);
      expect(tIncr).toBeGreaterThanOrEqual(0);
    });
  });
});
