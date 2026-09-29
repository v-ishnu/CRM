import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import webpush from 'web-push';
import PushSubscription from '@/models/PushSubscription';
import TeamMember from '@/models/TeamMember';
import TeamMemberConversation from '@/models/TeamMemberConversation';
import TeamMemberMessage from '@/models/TeamMemberMessage';
import User from '@/models/User';
import { PushNotificationService } from '@/services/push-notification.service';
import { TeamChatService } from '@/services/team-chat.service';
import { GET as getVapidKeyRoute } from '@/app/api/notifications/vapid-public-key/route';
import { POST as subscribeRoute, DELETE as unsubscribeRoute } from '@/app/api/notifications/subscribe/route';
import { POST as testPushRoute } from '@/app/api/notifications/test/route';
import { GET as statusRoute } from '@/app/api/notifications/status/route';

// 1. Mock DB connection to guarantee ZERO production DB queries
vi.mock('@/lib/db/connect', () => ({
  dbConnect: vi.fn().mockResolvedValue(null),
  default: vi.fn().mockResolvedValue(null),
}));

// 2. Mock webpush so NO real FCM/Chrome notifications are dispatched over network during tests
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
    generateVAPIDKeys: vi.fn().mockReturnValue({
      publicKey: 'mock_public_key',
      privateKey: 'mock_private_key',
    }),
  },
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
}));

// 3. Mock AuditService & CacheService
vi.mock('@/services/audit.service', () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(true),
    logAction: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/services/cache.service', () => ({
  CacheService: {
    teamChatConvKey: vi.fn().mockReturnValue('crm:team_chat:conv:test'),
    teamChatUnreadKey: vi.fn().mockReturnValue('crm:team_chat:unread:test'),
    telegramIdentityKey: vi.fn().mockReturnValue('crm:telegram:identity:test'),
    invalidateTelegramIdentity: vi.fn().mockResolvedValue(true),
    invalidateTeamChatCache: vi.fn().mockResolvedValue(true),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(true),
  },
}));

function mockMongooseQuery(val: any) {
  const q: any = {
    lean: vi.fn().mockResolvedValue(val),
    select: vi.fn().mockImplementation(() => q),
    sort: vi.fn().mockImplementation(() => q),
    skip: vi.fn().mockImplementation(() => q),
    limit: vi.fn().mockImplementation(() => q),
    populate: vi.fn().mockImplementation(() => q),
    then: (resolve: any, reject?: any) => Promise.resolve(val).then(resolve, reject),
  };
  return q;
}

describe('Chrome Web Push Notifications Test Suite', () => {
  const mockAdminAId = new mongoose.Types.ObjectId().toString();
  const mockAdminBId = new mongoose.Types.ObjectId().toString();
  const mockEndpointA = 'https://fcm.googleapis.com/fcm/send/sub-admin-a';
  const mockEndpointB = 'https://fcm.googleapis.com/fcm/send/sub-admin-b';

  const fakeSubscriptionA = {
    _id: new mongoose.Types.ObjectId(),
    adminId: new mongoose.Types.ObjectId(mockAdminAId),
    endpoint: mockEndpointA,
    keys: {
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9bP0mV...',
      auth: 'tBHItJI5svbpez7KI4CCXg==',
    },
    save: vi.fn().mockImplementation(async function (this: any) {
      return this;
    }),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    process.env.VAPID_PUBLIC_KEY = 'BOVpbC4AWCsAQjOY18SCxieTqZL17XBkaPeJuy0rfJj8_FV_Nc9DCOJyCHpHWQVpZfe5qMBzfa0ebWPfITlXt8k';
    process.env.VAPID_PRIVATE_KEY = 'mock_private_vapid_key_server_only';
    process.env.VAPID_SUBJECT = 'mailto:admin@drdebuggers.com';
    (PushNotificationService as any).vapidConfigured = false;
    vi.spyOn(TeamMember, 'findOne').mockReturnValue(mockMongooseQuery(null));
    vi.spyOn(TeamMemberConversation.prototype, 'save').mockImplementation(async function (this: any) {
      return this;
    });
    vi.spyOn(TeamMemberMessage, 'findOne').mockResolvedValue(null);
    vi.spyOn(TeamMemberMessage.prototype, 'save').mockImplementation(async function (this: any) {
      return this;
    });
  });

  // ==========================================
  // 1. SERVICE WORKER VERIFICATION
  // ==========================================
  describe('1. Service Worker & File Verification', () => {
    it('public/sw.js should exist in the repository', () => {
      const swPath = path.join(process.cwd(), 'public', 'sw.js');
      expect(fs.existsSync(swPath)).toBe(true);
    });

    it('public/sw.js should register push event and call showNotification', () => {
      const swPath = path.join(process.cwd(), 'public', 'sw.js');
      const swContent = fs.readFileSync(swPath, 'utf8');

      expect(swContent).toContain("addEventListener('push'");
      expect(swContent).toContain('showNotification');
      expect(swContent).toContain('event.waitUntil');
    });

    it('public/sw.js should handle notificationclick event and focus/navigate to conversation URL', () => {
      const swPath = path.join(process.cwd(), 'public', 'sw.js');
      const swContent = fs.readFileSync(swPath, 'utf8');

      expect(swContent).toContain("addEventListener('notificationclick'");
      expect(swContent).toContain('event.notification.close()');
      expect(swContent).toContain('clients.matchAll');
      expect(swContent).toContain('client.focus()');
    });
  });

  // ==========================================
  // 2. VAPID CONFIGURATION & SECURITY
  // ==========================================
  describe('2. VAPID Configuration & Security', () => {
    it('should configure web-push VAPID details with correct keys', () => {
      const configured = PushNotificationService.configureVapid();
      expect(configured).toBe(true);
      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:admin@drdebuggers.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
    });

    it('should NEVER expose VAPID_PRIVATE_KEY in getPublicKey()', () => {
      const pubKey = PushNotificationService.getPublicKey();
      expect(pubKey).toBe(process.env.VAPID_PUBLIC_KEY);
      expect(pubKey).not.toContain(process.env.VAPID_PRIVATE_KEY);
    });

    it('GET /api/notifications/vapid-public-key should return public key', async () => {
      const res = await getVapidKeyRoute();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.vapidPublicKey).toBe(process.env.VAPID_PUBLIC_KEY);
    });
  });

  // ==========================================
  // 3. SUBSCRIPTION API & ADMIN ISOLATION
  // ==========================================
  describe('3. Subscription API & Admin Ownership', () => {
    it('POST /api/notifications/subscribe should associate subscription strictly with authenticated Admin', async () => {
      vi.spyOn(PushSubscription, 'findOneAndUpdate').mockResolvedValue(fakeSubscriptionA as any);

      const req = new NextRequest('http://localhost:3000/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'x-user-id': mockAdminAId,
          'user-agent': 'Mozilla/5.0 (Macintosh; Chrome)',
        },
        body: JSON.stringify({
          endpoint: mockEndpointA,
          keys: {
            p256dh: 'test_p256dh_key',
            auth: 'test_auth_key',
          },
        }),
      });

      const res = await subscribeRoute(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(PushSubscription.findOneAndUpdate).toHaveBeenCalledWith(
        { endpoint: mockEndpointA },
        expect.objectContaining({
          $set: expect.objectContaining({
            adminId: new mongoose.Types.ObjectId(mockAdminAId),
            endpoint: mockEndpointA,
          }),
        }),
        expect.anything()
      );
    });

    it('DELETE /api/notifications/subscribe should remove subscription for authenticated Admin', async () => {
      vi.spyOn(PushSubscription, 'deleteOne').mockResolvedValue({ deletedCount: 1 } as any);

      const req = new NextRequest('http://localhost:3000/api/notifications/subscribe', {
        method: 'DELETE',
        headers: {
          'x-user-id': mockAdminAId,
        },
        body: JSON.stringify({
          endpoint: mockEndpointA,
        }),
      });

      const res = await unsubscribeRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.removed).toBe(true);
    });

    it('POST /api/notifications/test should deliver test push to authenticated Admin only', async () => {
      vi.spyOn(PushSubscription, 'find').mockReturnValue(mockMongooseQuery([fakeSubscriptionA]));
      vi.spyOn(TeamMember, 'findOne').mockReturnValue(mockMongooseQuery({
        _id: new mongoose.Types.ObjectId(),
      }));
      vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201 } as any);

      const req = new NextRequest('http://localhost:3000/api/notifications/test', {
        method: 'POST',
        headers: {
          'x-user-id': mockAdminAId,
        },
      });

      const res = await testPushRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.sent).toBe(1);
      expect(webpush.sendNotification).toHaveBeenCalledWith(
        {
          endpoint: fakeSubscriptionA.endpoint,
          keys: fakeSubscriptionA.keys,
        },
        expect.stringContaining('Test Notification'),
        expect.anything()
      );
    });
  });

  // ==========================================
  // 4. ADMIN-SPECIFIC ROUTING (NO BROADCAST)
  // ==========================================
  describe('4. Conversation Owner Targeting (Anti-Broadcast)', () => {
    it('sendPushToAdmin should query subscriptions specifically for target adminId', async () => {
      const findSpy = vi.spyOn(PushSubscription, 'find').mockReturnValue(mockMongooseQuery([fakeSubscriptionA]));
      vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201 } as any);

      const result = await PushNotificationService.sendPushToAdmin(mockAdminAId, {
        title: 'New message',
        body: 'Hello Admin A',
      });

      expect(result.sent).toBe(1);
      expect(findSpy).toHaveBeenCalledWith({
        adminId: new mongoose.Types.ObjectId(mockAdminAId),
      });
      // Verified: Admin B is NOT queried or notified
      expect(findSpy).not.toHaveBeenCalledWith({
        adminId: new mongoose.Types.ObjectId(mockAdminBId),
      });
    });

    it('should return 0 sent when target admin has no registered push subscriptions', async () => {
      vi.spyOn(PushSubscription, 'find').mockReturnValue(mockMongooseQuery([]));
      const sendSpy = vi.spyOn(webpush, 'sendNotification');

      const result = await PushNotificationService.sendPushToAdmin(mockAdminBId, {
        title: 'New message',
        body: 'Hello Admin B',
      });

      expect(result.sent).toBe(0);
      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 5. STALE SUBSCRIPTION CLEANUP (404/410)
  // ==========================================
  describe('5. Error Handling & Stale Subscription Pruning', () => {
    it('should automatically delete expired subscriptions when web-push returns 410 Gone or 404', async () => {
      const deleteSpy = vi.spyOn(PushSubscription, 'deleteOne').mockResolvedValue({ deletedCount: 1 } as any);
      vi.spyOn(PushSubscription, 'find').mockReturnValue(mockMongooseQuery([fakeSubscriptionA]));

      // Simulate Google FCM reporting 410 Gone (User revoked or expired subscription)
      const expiredError: any = new Error('Subscription expired');
      expiredError.statusCode = 410;
      vi.spyOn(webpush, 'sendNotification').mockRejectedValue(expiredError);

      const result = await PushNotificationService.sendPushToAdmin(mockAdminAId, {
        title: 'New message',
        body: 'Prune test',
      });

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      expect(deleteSpy).toHaveBeenCalledWith({ _id: fakeSubscriptionA._id });
    });
  });

  // ==========================================
  // 6. TELEGRAM WEBHOOK -> INCOMING PUSH INTEGRATION
  // ==========================================
  describe('6. Telegram Incoming Message -> Web Push Dispatch', () => {
    it('handleIncomingTeamMemberMessage should trigger push notification for the conversation owner Admin', async () => {
      const mockConversation = {
        _id: new mongoose.Types.ObjectId(),
        adminId: new mongoose.Types.ObjectId(mockAdminAId),
        teamMemberId: new mongoose.Types.ObjectId(),
        status: 'OPEN',
        lastMessageAt: new Date(),
        unreadAdminCount: 0,
        save: vi.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };

      vi.spyOn(TeamMemberConversation, 'findOne').mockReturnValue(mockMongooseQuery(mockConversation));
      vi.spyOn(TeamMemberMessage.prototype, 'save').mockImplementation(async function (this: any) {
        return this;
      });

      const pushSpy = vi.spyOn(PushNotificationService, 'sendPushToAdmin').mockResolvedValue({ sent: 1, failed: 0 });

      const fakeMember = {
        _id: mockConversation.teamMemberId,
        name: 'Carlos Engineer',
        email: 'carlos@drdebuggers.com',
        status: 'ACTIVE',
      };

      const incoming = await TeamChatService.handleIncomingTeamMemberMessage(
        fakeMember,
        'Finished frontend unit testing and deployment verification.',
        1001
      );

      expect(incoming.status).toBe('DELIVERED');
      expect(pushSpy).toHaveBeenCalledWith(
        mockAdminAId,
        expect.objectContaining({
          title: '💬 Carlos Engineer',
          body: 'Finished frontend unit testing and deployment verification.',
          data: expect.objectContaining({
            url: `/dashboard/team/${fakeMember._id.toString()}?tab=chat&conversationId=${mockConversation._id.toString()}`,
            teamMemberId: fakeMember._id.toString(),
            conversationId: mockConversation._id.toString(),
          }),
        })
      );
    });

    it('Web Push failure or network timeout should NEVER block or fail Telegram message persistence', async () => {
      const mockConversation = {
        _id: new mongoose.Types.ObjectId(),
        adminId: new mongoose.Types.ObjectId(mockAdminAId),
        teamMemberId: new mongoose.Types.ObjectId(),
        status: 'OPEN',
        lastMessageAt: new Date(),
        unreadAdminCount: 0,
        save: vi.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };

      vi.spyOn(TeamMemberConversation, 'findOne').mockReturnValue(mockMongooseQuery(mockConversation));
      vi.spyOn(TeamMemberMessage.prototype, 'save').mockImplementation(async function (this: any) {
        return this;
      });

      // Simulate push failure
      vi.spyOn(PushNotificationService, 'sendPushToAdmin').mockRejectedValue(new Error('FCM network timeout'));

      const fakeMember = {
        _id: mockConversation.teamMemberId,
        name: 'Carlos Engineer',
        email: 'carlos@drdebuggers.com',
        status: 'ACTIVE',
      };

      // Message persistence MUST succeed even when Push throws
      const incoming = await TeamChatService.handleIncomingTeamMemberMessage(
        fakeMember,
        'Message when push network is down',
        1002
      );

      expect(incoming.status).toBe('DELIVERED');
      expect(incoming.text).toBe('Message when push network is down');
    });
  });

  // ==========================================
  // 7. NOTIFICATION CLICK ROUTING & DEEP LINKING
  // ==========================================
  describe('7. Notification Click Routing & Deep Linking', () => {
    it('public/sw.js should contain robust notificationclick handling with clients.matchAll, client.focus, client.navigate, and clients.openWindow', () => {
      const swPath = path.join(process.cwd(), 'public', 'sw.js');
      const swContent = fs.readFileSync(swPath, 'utf8');

      expect(swContent).toContain("addEventListener('notificationclick'");
      expect(swContent).toContain('event.notification.close()');
      expect(swContent).toContain('clients.matchAll');
      expect(swContent).toContain('client.focus()');
      expect(swContent).toContain('client.navigate(targetUrl)');
      expect(swContent).toContain('clients.openWindow(targetUrl)');
      expect(swContent).toContain('new URL(rawUrl, self.location.origin).href');
    });

    it('getConversationMessages should securely resolve specific conversationId belonging to team member', async () => {
      const memberId = new mongoose.Types.ObjectId();
      const convId = new mongoose.Types.ObjectId();
      const mockAdminUser = { id: mockAdminAId, name: 'Admin', email: 'admin@drdebuggers.com' };

      const mockTargetConversation = {
        _id: convId,
        adminId: new mongoose.Types.ObjectId(mockAdminAId),
        teamMemberId: memberId,
        status: 'OPEN',
      };

      const mockMember = {
        _id: memberId,
        name: 'Sara Engineer',
        email: 'sara@drdebuggers.com',
        role: 'DEVELOPER',
        telegramConnected: true,
      };

      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockMongooseQuery(mockMember));
      vi.spyOn(TeamChatService, 'getOrCreateConversation').mockResolvedValue({
        conversation: mockTargetConversation as any,
        teamMember: mockMember as any,
      });
      vi.spyOn(TeamMemberConversation, 'findOne').mockImplementation((query: any) => {
        if (query._id && query._id.toString() === convId.toString()) {
          return mockMongooseQuery(mockTargetConversation);
        }
        return mockMongooseQuery(null);
      });
      vi.spyOn(TeamMemberMessage, 'countDocuments').mockResolvedValue(1);
      vi.spyOn(TeamMemberMessage, 'find').mockReturnValue(mockMongooseQuery([{
        _id: new mongoose.Types.ObjectId(),
        conversationId: convId,
        text: 'Hello from Sara',
        sentAt: new Date(),
      }]));

      const result = await TeamChatService.getConversationMessages(
        memberId.toString(),
        mockAdminUser,
        { conversationId: convId.toString() }
      );

      expect(result.conversation._id.toString()).toBe(convId.toString());
      expect(result.messages.length).toBe(1);
      expect(result.teamMember.name).toBe('Sara Engineer');
    });

    it('getConversationMessages should reject or fallback safely if conversationId does not belong to team member (Anti-Leakage)', async () => {
      const memberIdA = new mongoose.Types.ObjectId();
      const memberIdB = new mongoose.Types.ObjectId();
      const convIdB = new mongoose.Types.ObjectId();
      const mockAdminUser = { id: mockAdminAId, name: 'Admin', email: 'admin@drdebuggers.com' };

      const mockMemberA = {
        _id: memberIdA,
        name: 'Member A',
        email: 'a@drdebuggers.com',
        role: 'DEVELOPER',
        telegramConnected: true,
      };

      const mockDefaultConvA = {
        _id: new mongoose.Types.ObjectId(),
        adminId: new mongoose.Types.ObjectId(mockAdminAId),
        teamMemberId: memberIdA,
        status: 'OPEN',
      };

      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockMongooseQuery(mockMemberA));
      vi.spyOn(TeamChatService, 'getOrCreateConversation').mockResolvedValue({
        conversation: mockDefaultConvA as any,
        teamMember: mockMemberA as any,
      });
      vi.spyOn(TeamMemberConversation, 'findOne').mockImplementation((query: any) => {
        // If query asks for convIdB for memberIdA, it must return null because convIdB belongs to memberIdB
        if (query._id && query._id.toString() === convIdB.toString() && query.teamMemberId?.toString() === memberIdA.toString()) {
          return mockMongooseQuery(null);
        }
        return mockMongooseQuery(mockDefaultConvA);
      });
      vi.spyOn(TeamMemberMessage, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(TeamMemberMessage, 'find').mockReturnValue(mockMongooseQuery([]));

      // Attempting to query Member A with Member B's conversation ID
      const result = await TeamChatService.getConversationMessages(
        memberIdA.toString(),
        mockAdminUser,
        { conversationId: convIdB.toString() }
      );

      // Must NOT leak Member B's conversation: falls back to Member A's conversation
      expect(result.conversation._id.toString()).not.toBe(convIdB.toString());
      expect(result.conversation._id.toString()).toBe(mockDefaultConvA._id.toString());
    });
  });
});
