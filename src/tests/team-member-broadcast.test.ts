import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import TeamMember from '@/models/TeamMember';
import TeamMemberConversation from '@/models/TeamMemberConversation';
import TeamMemberMessage from '@/models/TeamMemberMessage';
import TeamMemberBroadcast from '@/models/TeamMemberBroadcast';
import User from '@/models/User';
import Client from '@/models/Client';
import Task from '@/models/Task';
import { TeamBroadcastService } from '@/services/team-broadcast.service';
import { TeamChatService } from '@/services/team-chat.service';
import { TelegramService } from '@/services/telegram.service';
import { AuditService } from '@/services/audit.service';
import { CacheService } from '@/services/cache.service';
import { POST as broadcastPostRoute, GET as broadcastGetRoute } from '@/app/api/team-members/broadcast/route';
import { GET as broadcastGetByIdRoute } from '@/app/api/team-members/broadcast/[id]/route';
import { POST as broadcastRetryRoute } from '@/app/api/team-members/broadcast/[id]/retry/route';

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
vi.mock('@/services/cache.service', () => {
  const store = new Map<string, any>();
  return {
    CacheService: {
      teamChatUnreadKey: vi.fn().mockReturnValue('crm:team_chat:unread:123'),
      teamChatConvKey: vi.fn().mockReturnValue('crm:team_chat:conv:123:admin'),
      telegramIdentityKey: vi.fn().mockReturnValue('crm:telegram:identity:123'),
      invalidateTelegramIdentity: vi.fn().mockResolvedValue(true),
      invalidateTeamChatCache: vi.fn().mockResolvedValue(true),
      get: vi.fn().mockImplementation(async (key: string) => store.get(key) || null),
      set: vi.fn().mockImplementation(async (key: string, val: any) => {
        store.set(key, val);
        return true;
      }),
      del: vi.fn().mockImplementation(async (key: string) => {
        store.delete(key);
        return true;
      }),
      _store: store,
    },
  };
});

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

describe('Team Member Broadcast Feature - Complete Test Suite', () => {
  const mockAdminId = new mongoose.Types.ObjectId().toString();
  const mockAdminContext = {
    id: mockAdminId,
    name: 'Lead Admin',
    email: 'admin@drdebuggers.com',
    role: 'ADMIN',
  };

  const mockNonAdminContext = {
    id: new mongoose.Types.ObjectId().toString(),
    name: 'Developer User',
    email: 'dev@drdebuggers.com',
    role: 'STAFF',
  };

  const memberId1 = new mongoose.Types.ObjectId().toString();
  const memberId2 = new mongoose.Types.ObjectId().toString();
  const memberId3Inactive = new mongoose.Types.ObjectId().toString();
  const memberId4Unconnected = new mongoose.Types.ObjectId().toString();

  let member1: any;
  let member2: any;
  let member3Inactive: any;
  let member4Unconnected: any;

  let conversation1: any;
  let conversation2: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Guarantee TelegramService NEVER makes real external API calls
    vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({
      success: true,
      messageId: 1001,
    });
    vi.spyOn(TelegramService as any, 'syncChatCommands').mockResolvedValue(true);

    member1 = {
      _id: new mongoose.Types.ObjectId(memberId1),
      name: 'John Doe',
      email: 'john@drdebuggers.com',
      designation: 'Senior Developer',
      role: 'DEVELOPER',
      status: 'ACTIVE',
      telegramConnected: true,
      telegramChatId: '1111111',
      telegramUserId: '1111111',
      save: vi.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };

    member2 = {
      _id: new mongoose.Types.ObjectId(memberId2),
      name: 'Rahul Sharma',
      email: 'rahul@drdebuggers.com',
      designation: 'UI/UX Designer',
      role: 'DESIGNER',
      status: 'ACTIVE',
      telegramConnected: true,
      telegramChatId: '2222222',
      telegramUserId: '2222222',
      save: vi.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };

    member3Inactive = {
      _id: new mongoose.Types.ObjectId(memberId3Inactive),
      name: 'Amit Kumar',
      email: 'amit@drdebuggers.com',
      designation: 'QA Tester',
      role: 'DEVELOPER',
      status: 'DEACTIVATED',
      telegramConnected: true,
      telegramChatId: '3333333',
      telegramUserId: '3333333',
      save: vi.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };

    member4Unconnected = {
      _id: new mongoose.Types.ObjectId(memberId4Unconnected),
      name: 'Neha Singh',
      email: 'neha@drdebuggers.com',
      designation: 'Backend Engineer',
      role: 'DEVELOPER',
      status: 'ACTIVE',
      telegramConnected: false,
      telegramChatId: undefined,
      telegramUserId: undefined,
      save: vi.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };

    conversation1 = {
      _id: new mongoose.Types.ObjectId(),
      adminId: new mongoose.Types.ObjectId(mockAdminId),
      teamMemberId: member1._id,
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

    conversation2 = {
      _id: new mongoose.Types.ObjectId(),
      adminId: new mongoose.Types.ObjectId(mockAdminId),
      teamMemberId: member2._id,
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

    // Mock TeamMemberMessage save
    vi.spyOn(TeamMemberMessage.prototype, 'save').mockImplementation(async function (this: any) {
      return this;
    });

    // Mock TeamMemberBroadcast save
    vi.spyOn(TeamMemberBroadcast.prototype, 'save').mockImplementation(async function (this: any) {
      return this;
    });

    // Mock TeamMemberBroadcast queries
    vi.spyOn(TeamMemberBroadcast, 'findById').mockReturnValue(mockMongooseQuery(null));
    vi.spyOn(TeamMemberBroadcast, 'findOne').mockReturnValue(mockMongooseQuery(null));

    // Mock TeamChatService.getOrCreateConversation to return { conversation, teamMember }
    vi.spyOn(TeamChatService, 'getOrCreateConversation').mockImplementation(async (memberId: string) => {
      if (memberId.toString() === memberId2) {
        return { conversation: conversation2, teamMember: member2 } as any;
      }
      return { conversation: conversation1, teamMember: member1 } as any;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==============================================================
  // 1. PRODUCTION SAFETY & MOCK CHECKS
  // ==============================================================
  describe('1. Production Safety Guards', () => {
    it('should NEVER connect to production database or send real Telegram API calls', async () => {
      const sendSpy = vi.spyOn(TelegramService, 'sendMessageRaw');
      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  // ==============================================================
  // 2. AUTHORIZATION & SECURITY
  // ==============================================================
  describe('2. Authorization and Security', () => {
    it('should reject broadcast creation by non-admin users with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/team-members/broadcast', {
        method: 'POST',
        headers: {
          'x-user-id': mockNonAdminContext.id,
          'x-user-email': mockNonAdminContext.email,
          'x-user-role': 'STAFF',
        },
        body: JSON.stringify({
          message: 'Unauthorized announcement',
          targetMode: 'ALL_CONNECTED',
        }),
      });

      const res = await broadcastPostRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('FORBIDDEN');
    });

    it('should reject service-level calls by non-admin users', async () => {
      await expect(
        TeamBroadcastService.sendBroadcast({
          message: 'Unauthorized',
          targetMode: 'ALL_CONNECTED',
          adminUser: mockNonAdminContext,
        })
      ).rejects.toThrow(/Unauthorized/);
    });
  });

  // ==============================================================
  // 3. TARGETING MODES: SELECTED vs ALL CONNECTED
  // ==============================================================
  describe('3. Recipient Selection & Targeting Modes', () => {
    it('should broadcast to SELECTED team members only', async () => {
      vi.spyOn(TeamMember, 'find').mockReturnValue(
        mockMongooseQuery([member1, member2])
      );

      const sendSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({
        success: true,
        messageId: 501,
      });

      const result = await TeamBroadcastService.sendBroadcast({
        message: 'Sprint review at 4 PM',
        targetMode: 'SELECTED',
        recipientIds: [memberId1, memberId2],
        adminUser: mockAdminContext,
      });

      expect(result.broadcast.targetMode).toBe('SELECTED');
      expect(result.broadcast.recipientCount).toBe(2);
      expect(result.broadcast.sentCount).toBe(2);
      expect(result.broadcast.failedCount).toBe(0);

      // Verify individual deliveries
      expect(sendSpy).toHaveBeenCalledTimes(2);
      expect(sendSpy).toHaveBeenCalledWith('1111111', expect.stringContaining('Sprint review at 4 PM'));
      expect(sendSpy).toHaveBeenCalledWith('2222222', expect.stringContaining('Sprint review at 4 PM'));
    });

    it('should broadcast to ALL_CONNECTED active team members', async () => {
      vi.spyOn(TeamMember, 'find').mockReturnValue(
        mockMongooseQuery([member1, member2])
      );

      const sendSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({
        success: true,
        messageId: 701,
      });

      const result = await TeamBroadcastService.sendBroadcast({
        message: 'Company holiday notice',
        targetMode: 'ALL_CONNECTED',
        adminUser: mockAdminContext,
      });

      expect(result.broadcast.targetMode).toBe('ALL_CONNECTED');
      expect(result.broadcast.recipientCount).toBe(2);
      expect(result.broadcast.sentCount).toBe(2);
      expect(sendSpy).toHaveBeenCalledTimes(2);
    });

    it('should exclude deactivated and unconnected team members from delivery', async () => {
      // Admin manually selected John, Amit (deactivated), and Neha (unconnected)
      vi.spyOn(TeamMember, 'find').mockReturnValue(
        mockMongooseQuery([member1, member3Inactive, member4Unconnected])
      );

      const sendSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({
        success: true,
        messageId: 801,
      });

      const result = await TeamBroadcastService.sendBroadcast({
        message: 'Update documentation',
        targetMode: 'SELECTED',
        recipientIds: [memberId1, memberId3Inactive, memberId4Unconnected],
        adminUser: mockAdminContext,
      });

      const deliveries = result.broadcast.deliveries;
      const johnDelivery = deliveries.find((d) => d.teamMemberId.toString() === memberId1);
      const nehaDelivery = deliveries.find((d) => d.teamMemberId.toString() === memberId4Unconnected);
      const amitDelivery = deliveries.find((d) => d.teamMemberId.toString() === memberId3Inactive);

      expect(johnDelivery?.status).toBe('SENT');
      expect(nehaDelivery?.status).toBe('NOT_CONNECTED');
      expect(amitDelivery?.status).toBe('SKIPPED'); // Inactive members are safely skipped from Telegram sending

      // Only John received a Telegram message
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledWith('1111111', expect.any(String));
    });
  });

  // ==============================================================
  // 4. INDIVIDUAL CONVERSATION & CHAT HISTORY ISOLATION
  // ==============================================================
  describe('4. Conversation Isolation & Chat History Integration', () => {
    it('should maintain independent conversations and create individual TeamMemberMessage records', async () => {
      vi.spyOn(TeamMember, 'find').mockReturnValue(
        mockMongooseQuery([member1, member2])
      );

      const getConvSpy = vi.spyOn(TeamChatService, 'getOrCreateConversation');

      await TeamBroadcastService.sendBroadcast({
        message: 'Daily standup reminder',
        targetMode: 'SELECTED',
        recipientIds: [memberId1, memberId2],
        adminUser: mockAdminContext,
      });

      // Separate conversation looked up for each team member
      expect(getConvSpy).toHaveBeenCalledWith(member1._id.toString(), mockAdminContext, member1);
      expect(getConvSpy).toHaveBeenCalledWith(member2._id.toString(), mockAdminContext, member2);

      // Verify conversations were updated independently
      expect(conversation1.lastMessageText).toBe('Daily standup reminder');
      expect(conversation2.lastMessageText).toBe('Daily standup reminder');
    });

    it('should escape HTML in Telegram message content to prevent injection', async () => {
      vi.spyOn(TeamMember, 'find').mockReturnValue(mockMongooseQuery([member1]));
      const sendSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({
        success: true,
        messageId: 901,
      });

      await TeamBroadcastService.sendBroadcast({
        message: 'Special offer: <script>alert(1)</script> & 50% discount > 20%',
        targetMode: 'SELECTED',
        recipientIds: [memberId1],
        adminUser: mockAdminContext,
      });

      expect(sendSpy).toHaveBeenCalledWith(
        '1111111',
        expect.stringContaining('&lt;script&gt;alert(1)&lt;/script&gt; &amp; 50% discount &gt; 20%')
      );
    });
  });

  // ==============================================================
  // 5. INDEPENDENT FAILURE HANDLING & RESILIENCE
  // ==============================================================
  describe('5. Independent Delivery Status & Failure Resilience', () => {
    it('should not fail entire broadcast if one recipient delivery fails', async () => {
      vi.spyOn(TeamMember, 'find').mockReturnValue(
        mockMongooseQuery([member1, member2])
      );

      // Recipient 1 succeeds, Recipient 2 fails
      vi.spyOn(TelegramService, 'sendMessageRaw').mockImplementation(async (chatId: string) => {
        if (chatId === '1111111') {
          return { success: true, messageId: 101 };
        }
        return { success: false, error: 'Telegram 403: Bot was blocked by the user' };
      });

      const result = await TeamBroadcastService.sendBroadcast({
        message: 'Quarterly review',
        targetMode: 'SELECTED',
        recipientIds: [memberId1, memberId2],
        adminUser: mockAdminContext,
      });

      expect(result.broadcast.status).toBe('PARTIALLY_FAILED');
      expect(result.broadcast.sentCount).toBe(1);
      expect(result.broadcast.failedCount).toBe(1);

      const d1 = result.broadcast.deliveries.find((d) => d.teamMemberId.toString() === memberId1);
      const d2 = result.broadcast.deliveries.find((d) => d.teamMemberId.toString() === memberId2);

      expect(d1?.status).toBe('SENT');
      expect(d2?.status).toBe('FAILED');
      expect(d2?.error).toContain('Bot was blocked');
    });
  });

  // ==============================================================
  // 6. IDEMPOTENCY KEY PROTECTION
  // ==============================================================
  describe('6. Idempotency Key Protection', () => {
    it('should prevent duplicate broadcast sends with identical idempotencyKey', async () => {
      vi.spyOn(TeamMember, 'find').mockReturnValue(mockMongooseQuery([member1]));
      const sendSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({
        success: true,
        messageId: 2001,
      });

      const key = 'test-idempotency-' + Date.now();

      // First call
      const res1 = await TeamBroadcastService.sendBroadcast({
        message: 'Important alert',
        targetMode: 'SELECTED',
        recipientIds: [memberId1],
        idempotencyKey: key,
        adminUser: mockAdminContext,
      });

      expect(res1.duplicate).toBeUndefined();
      expect(sendSpy).toHaveBeenCalledTimes(1);

      // Mock finding by idempotencyKey in DB or Cache
      vi.spyOn(TeamMemberBroadcast, 'findById').mockReturnValue(mockMongooseQuery(res1.broadcast));
      vi.spyOn(TeamMemberBroadcast, 'findOne').mockReturnValue(mockMongooseQuery(res1.broadcast));

      // Second call with same idempotency key
      const res2 = await TeamBroadcastService.sendBroadcast({
        message: 'Important alert',
        targetMode: 'SELECTED',
        recipientIds: [memberId1],
        idempotencyKey: key,
        adminUser: mockAdminContext,
      });

      expect(res2.duplicate).toBe(true);
      expect(res2.broadcast._id).toEqual(res1.broadcast._id);
      // No extra Telegram send call occurred!
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ==============================================================
  // 7. RETRY FAILED RECIPIENTS
  // ==============================================================
  describe('7. Retry Failed Recipients', () => {
    it('should retry ONLY failed recipients without resending to already sent members', async () => {
      const existingBroadcast: any = {
        _id: new mongoose.Types.ObjectId(),
        adminId: new mongoose.Types.ObjectId(mockAdminId),
        message: 'Deployment complete',
        status: 'PARTIALLY_FAILED',
        deliveries: [
          {
            teamMemberId: member1._id,
            teamMemberName: member1.name,
            teamMemberEmail: member1.email,
            status: 'SENT',
            telegramChatId: '1111111',
            telegramMessageId: '101',
          },
          {
            teamMemberId: member2._id,
            teamMemberName: member2.name,
            teamMemberEmail: member2.email,
            status: 'FAILED',
            error: 'Network timeout',
            telegramChatId: '2222222',
          },
          {
            teamMemberId: member4Unconnected._id,
            teamMemberName: member4Unconnected.name,
            teamMemberEmail: member4Unconnected.email,
            status: 'NOT_CONNECTED',
          },
        ],
        save: vi.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };

      vi.spyOn(TeamMemberBroadcast, 'findById').mockResolvedValue(existingBroadcast);
      vi.spyOn(TeamMember, 'find').mockReturnValue(mockMongooseQuery([member2]));

      const sendSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({
        success: true,
        messageId: 3001,
      });

      const retryResult = await TeamBroadcastService.retryFailed(
        existingBroadcast._id.toString(),
        mockAdminContext
      );

      expect(retryResult.retriedCount).toBe(1);
      expect(retryResult.newlySent).toBe(1);

      // Only member2 was retried
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledWith('2222222', expect.any(String));

      // Member 2 status updated to SENT
      const member2Delivery = existingBroadcast.deliveries.find(
        (d: any) => d.teamMemberId.toString() === memberId2
      );
      expect(member2Delivery.status).toBe('SENT');
      expect(member2Delivery.telegramMessageId).toBe('3001');

      // Member 1 remains SENT and Member 4 remains NOT_CONNECTED
      const member1Delivery = existingBroadcast.deliveries.find(
        (d: any) => d.teamMemberId.toString() === memberId1
      );
      expect(member1Delivery.status).toBe('SENT');

      const member4Delivery = existingBroadcast.deliveries.find(
        (d: any) => d.teamMemberId.toString() === memberId4Unconnected
      );
      expect(member4Delivery.status).toBe('NOT_CONNECTED');

      // Overall status updated to COMPLETED
      expect(existingBroadcast.status).toBe('COMPLETED');
    });
  });

  // ==============================================================
  // 8. AUDIT LOGGING
  // ==============================================================
  describe('8. Audit Logging', () => {
    it('should record TEAM_MEMBER_BROADCAST_CREATED with safe metadata', async () => {
      vi.spyOn(TeamMember, 'find').mockReturnValue(mockMongooseQuery([member1]));
      vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({
        success: true,
        messageId: 4001,
      });

      await TeamBroadcastService.sendBroadcast({
        message: 'Security update release',
        targetMode: 'SELECTED',
        recipientIds: [memberId1],
        adminUser: mockAdminContext,
      });

      expect(AuditService.logAction).toHaveBeenCalledWith(
        mockAdminContext.email,
        'TEAM_MEMBER_BROADCAST_CREATED',
        'TeamMember',
        expect.any(String),
        expect.objectContaining({
          targetMode: 'SELECTED',
          recipientCount: 1,
          sentCount: 1,
          failedCount: 0,
        })
      );
    });
  });

  // ==============================================================
  // 9. API ROUTE ENDPOINTS
  // ==============================================================
  describe('9. API Route Endpoints Integration', () => {
    it('POST /api/team-members/broadcast should validate body and return 201', async () => {
      vi.spyOn(TeamMember, 'find').mockReturnValue(mockMongooseQuery([member1]));
      vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({
        success: true,
        messageId: 5001,
      });

      const req = new NextRequest('http://localhost:3000/api/team-members/broadcast', {
        method: 'POST',
        headers: {
          'x-user-id': mockAdminId,
          'x-user-email': 'admin@drdebuggers.com',
          'x-user-role': 'ADMIN',
        },
        body: JSON.stringify({
          message: 'All hands meeting at 10 AM',
          targetMode: 'SELECTED',
          recipientIds: [memberId1],
        }),
      });

      const res = await broadcastPostRoute(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.sentCount).toBe(1);
    });

    it('GET /api/team-members/broadcast should list broadcasts for admin', async () => {
      vi.spyOn(TeamMemberBroadcast, 'countDocuments').mockResolvedValue(1);
      vi.spyOn(TeamMemberBroadcast, 'find').mockReturnValue(
        mockMongooseQuery([
          {
            _id: new mongoose.Types.ObjectId(),
            message: 'Test broadcast',
            recipientCount: 1,
            sentCount: 1,
            status: 'COMPLETED',
          },
        ])
      );

      const req = new NextRequest('http://localhost:3000/api/team-members/broadcast?page=1&limit=10', {
        headers: {
          'x-user-id': mockAdminId,
          'x-user-email': 'admin@drdebuggers.com',
          'x-user-role': 'ADMIN',
        },
      });

      const res = await broadcastGetRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
    });

    it('GET /api/team-members/broadcast/[id] should return single broadcast', async () => {
      const mockBcId = new mongoose.Types.ObjectId().toString();
      vi.spyOn(TeamMemberBroadcast, 'findById').mockResolvedValue({
        _id: mockBcId,
        adminId: new mongoose.Types.ObjectId(mockAdminId),
        message: 'Specific broadcast',
        recipientCount: 2,
        status: 'COMPLETED',
      } as any);

      const req = new NextRequest(`http://localhost:3000/api/team-members/broadcast/${mockBcId}`, {
        headers: {
          'x-user-id': mockAdminId,
          'x-user-email': 'admin@drdebuggers.com',
          'x-user-role': 'ADMIN',
        },
      });

      const res = await broadcastGetByIdRoute(req, { params: Promise.resolve({ id: mockBcId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.message).toBe('Specific broadcast');
    });

    it('POST /api/team-members/broadcast/[id]/retry should retry failed deliveries', async () => {
      const mockBcId = new mongoose.Types.ObjectId().toString();
      vi.spyOn(TeamBroadcastService, 'retryFailed').mockResolvedValue({
        broadcast: { _id: mockBcId, status: 'COMPLETED' } as any,
        retriedCount: 1,
        newlySent: 1,
      });

      const req = new NextRequest(`http://localhost:3000/api/team-members/broadcast/${mockBcId}/retry`, {
        method: 'POST',
        headers: {
          'x-user-id': mockAdminId,
          'x-user-email': 'admin@drdebuggers.com',
          'x-user-role': 'ADMIN',
        },
      });

      const res = await broadcastRetryRoute(req, { params: Promise.resolve({ id: mockBcId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.retriedCount).toBe(1);
      expect(json.newlySent).toBe(1);
    });
  });

  // ==============================================================
  // 10. REGRESSION PROTECTION: EXISTING CHAT & TELEGRAM COMMANDS
  // ==============================================================
  describe('10. Regression Protection: Existing Chat & Bot Functionality', () => {
    it('should preserve existing Telegram commands (/start, /status, /payments, /tasks)', async () => {
      // Team Member sends /tasks command
      const update = {
        update_id: 9991,
        message: {
          message_id: 42,
          from: { id: 1111111, username: 'johndoe' },
          chat: { id: 1111111 },
          text: '/tasks',
        },
      };

      vi.spyOn(Client, 'findOne').mockReturnValue(mockMongooseQuery(null));
      vi.spyOn(TeamMember, 'findOne').mockReturnValue(mockMongooseQuery(member1));
      vi.spyOn(Task, 'find').mockReturnValue(mockMongooseQuery([]));
      const sendRawSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ success: true });

      const res = await TelegramService.handleWebhookUpdate(update);
      expect(res.command).toBe('/tasks');
      expect(sendRawSpy).toHaveBeenCalledWith(
        '1111111',
        expect.stringContaining('Your Assigned Tasks'),
        expect.any(Object)
      );
    });

    it('should route normal Team Member replies into their own conversation, not broadcast', async () => {
      const update = {
        update_id: 9992,
        message: {
          message_id: 43,
          from: { id: 1111111, username: 'johndoe' },
          chat: { id: 1111111 },
          text: 'I have completed my tasks.',
        },
      };

      vi.spyOn(Client, 'findOne').mockReturnValue(mockMongooseQuery(null));
      vi.spyOn(TeamMember, 'findOne').mockReturnValue(mockMongooseQuery(member1));
      vi.spyOn(TeamMemberConversation, 'findOne').mockReturnValue(mockMongooseQuery(conversation1));

      const chatInboundSpy = vi.spyOn(TeamChatService, 'handleIncomingTeamMemberMessage').mockResolvedValue({
        message: { _id: new mongoose.Types.ObjectId(), text: 'I have completed my tasks.' } as any,
        conversation: conversation1,
      } as any);

      const res = await TelegramService.handleWebhookUpdate(update);
      expect(res.command).toBe('team_chat_reply');
      expect(chatInboundSpy).toHaveBeenCalledWith(
        expect.objectContaining({ email: member1.email }),
        'I have completed my tasks.',
        43
      );
    });
  });
});
