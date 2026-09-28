import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import Hosting from '@/models/Hosting';
import Client from '@/models/Client';
import Project from '@/models/Project';
import Payment from '@/models/Payment';
import Invoice from '@/models/Invoice';
import Task from '@/models/Task';
import TeamMember from '@/models/TeamMember';
import User from '@/models/User';
import { HostingService } from '@/services/hosting.service';
import { TelegramService } from '@/services/telegram.service';
import { AuditService } from '@/services/audit.service';
import { GET as getHostingRoute } from '@/app/api/hosting/route';
import { GET as getHostingIdRoute } from '@/app/api/hosting/[id]/route';
import { NextRequest } from 'next/server';

// 1. Strict Mock of DB connect to guarantee ZERO production DB queries or writes
vi.mock('@/lib/db/connect', () => ({
  dbConnect: vi.fn().mockResolvedValue(null),
  default: vi.fn().mockResolvedValue(null),
}));

// 2. Mock AuditService to verify audit logging without DB writes
vi.mock('@/services/audit.service', () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(true),
    logAction: vi.fn().mockResolvedValue(true),
  },
}));

// 3. Mock InquiryService for unlinked public messages
vi.mock('@/services/inquiry.service', () => ({
  InquiryService: {
    handlePublicMessage: vi.fn().mockResolvedValue({
      replyMessage: 'Account Not Connected. Please connect your account using the link from your administrator.',
      actionTaken: 'PROMPT_CONNECT',
    }),
  },
}));

function mockChainable(doc: any) {
  return {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(doc),
  } as any;
}

describe('Hosting Module - Project/Client Relationship & Telegram Hosting View (Isolated Unit Tests)', () => {
  // Test Entities
  const fakeClientAId = new mongoose.Types.ObjectId();
  const fakeClientBId = new mongoose.Types.ObjectId();

  const fakeProjectAId = new mongoose.Types.ObjectId();
  const fakeProjectA2Id = new mongoose.Types.ObjectId();
  const fakeProjectBId = new mongoose.Types.ObjectId();

  const fakeHostingAId = new mongoose.Types.ObjectId();
  const fakeHostingA2Id = new mongoose.Types.ObjectId();
  const fakeHostingBId = new mongoose.Types.ObjectId();

  const fakeTelegramUserAId = '111222333';
  const fakeTelegramUserBId = '444555666';
  const fakeTelegramUnlinkedId = '999888777';

  let fakeClientA: any;
  let fakeClientB: any;
  let fakeProjectA: any;
  let fakeProjectA2: any;
  let fakeProjectB: any;
  let fakeHostingA: any;
  let fakeHostingA2: any;
  let fakeHostingB: any;

  beforeEach(() => {
    vi.clearAllMocks();

    fakeClientA = {
      _id: fakeClientAId,
      name: 'Client Alpha Corp',
      clientCode: 'CL-0001',
      email: 'alpha@example.com',
      company: 'Alpha Corporation',
      telegramUserId: fakeTelegramUserAId,
      telegramChatId: fakeTelegramUserAId,
      telegramConnected: true,
      status: 'ACTIVE',
    };

    fakeClientB = {
      _id: fakeClientBId,
      name: 'Client Beta LLC',
      clientCode: 'CL-0002',
      email: 'beta@example.com',
      company: 'Beta Industries',
      telegramUserId: fakeTelegramUserBId,
      telegramChatId: fakeTelegramUserBId,
      telegramConnected: true,
      status: 'ACTIVE',
    };

    fakeProjectA = {
      _id: fakeProjectAId,
      name: 'Alpha Ecommerce Platform',
      projectCode: 'PR-0001',
      clientId: fakeClientAId,
      totalAmount: 150000,
      currency: 'INR',
      status: 'ACTIVE',
      serviceType: 'ECOMMERCE',
    };

    fakeProjectA2 = {
      _id: fakeProjectA2Id,
      name: 'Alpha Mobile App',
      projectCode: 'PR-0002',
      clientId: fakeClientAId,
      totalAmount: 200000,
      currency: 'INR',
      status: 'ACTIVE',
      serviceType: 'MOBILE_APPLICATION',
    };

    fakeProjectB = {
      _id: fakeProjectBId,
      name: 'Beta Corporate Website',
      projectCode: 'PR-0003',
      clientId: fakeClientBId,
      totalAmount: 80000,
      currency: 'INR',
      status: 'ACTIVE',
      serviceType: 'WEBSITE',
    };

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);

    fakeHostingA = {
      _id: fakeHostingAId,
      clientId: fakeClientAId,
      projectId: fakeProjectAId,
      domain: 'alpha-ecommerce.com',
      hostingProvider: 'Hostinger',
      hostingType: 'Cloud',
      serverHost: '192.168.1.100',
      panelUrl: 'https://hpanel.hostinger.com',
      planName: 'Cloud Professional',
      port: 22,
      username: 'alpha_admin',
      password: { ciphertext: 'enc_pwd', iv: 'iv', authTag: 'tag' },
      sshKey: { ciphertext: 'enc_ssh', iv: 'iv', authTag: 'tag' },
      apiToken: { ciphertext: 'enc_api', iv: 'iv', authTag: 'tag' },
      expiryDate: futureDate,
      startDate: new Date(),
      status: 'ACTIVE',
      autoRenewal: true,
      notificationsSent: new Map(),
      save: vi.fn().mockResolvedValue(true),
    };

    fakeHostingA2 = {
      _id: fakeHostingA2Id,
      clientId: fakeClientAId,
      projectId: fakeProjectA2Id,
      domain: 'api.alpha-mobile.com',
      hostingProvider: 'AWS',
      hostingType: 'VPS',
      serverHost: 'ec2.aws.com',
      panelUrl: 'https://aws.amazon.com',
      planName: 't3.medium',
      port: 22,
      username: 'ubuntu',
      password: { ciphertext: 'enc_pwd2', iv: 'iv', authTag: 'tag' },
      expiryDate: futureDate,
      startDate: new Date(),
      status: 'ACTIVE',
      autoRenewal: false,
      notificationsSent: new Map(),
      save: vi.fn().mockResolvedValue(true),
    };

    fakeHostingB = {
      _id: fakeHostingBId,
      clientId: fakeClientBId,
      projectId: fakeProjectBId,
      domain: 'beta-corporate.com',
      hostingProvider: 'DigitalOcean',
      hostingType: 'Droplet',
      serverHost: '159.89.1.50',
      panelUrl: 'https://cloud.digitalocean.com',
      planName: 'Standard 4GB',
      port: 22,
      username: 'root',
      password: { ciphertext: 'enc_pwd_b', iv: 'iv', authTag: 'tag' },
      expiryDate: futureDate,
      startDate: new Date(),
      status: 'ACTIVE',
      autoRenewal: true,
      notificationsSent: new Map(),
      save: vi.fn().mockResolvedValue(true),
    };

    // Default mock for User, TeamMember & Client to avoid collision in identity resolver
    vi.spyOn(User, 'findOne').mockReturnValue(mockChainable(null));
    vi.spyOn(TeamMember, 'findOne').mockReturnValue(mockChainable(null));
    vi.spyOn(Client, 'findOne').mockReturnValue(mockChainable(null));

    // Mock TelegramService send helpers so NO external HTTP calls happen
    vi.spyOn(TelegramService, 'sendMessage').mockResolvedValue(undefined as any);
    vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ success: true, messageId: 1001 } as any);
  });

  // 1. Hosting creation with project
  it('1. Hosting creation with project successfully creates hosting record', async () => {
    vi.spyOn(Project, 'findById').mockResolvedValue(fakeProjectA as any);
    vi.spyOn(Client, 'findById').mockResolvedValue(fakeClientA as any);

    const createdHosting = { ...fakeHostingA };
    vi.spyOn(Hosting, 'create').mockResolvedValue(createdHosting as any);

    const result = await HostingService.createHosting(
      {
        projectId: fakeProjectAId.toString(),
        hostingProvider: 'Hostinger',
        domain: 'alpha-ecommerce.com',
        password: 'SecurePassword123!',
        expiryDate: new Date('2026-12-31'),
      },
      'admin@drdebuggers.com'
    );

    expect(result).toBeDefined();
    expect(result.domain).toBe('alpha-ecommerce.com');
    expect(Hosting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: fakeClientAId,
        domain: 'alpha-ecommerce.com',
      })
    );
  });

  // 2. Project's client is correctly resolved
  it('2. Project client is automatically derived and resolved from the Project record', async () => {
    vi.spyOn(Project, 'findById').mockResolvedValue(fakeProjectA as any);
    vi.spyOn(Client, 'findById').mockResolvedValue(fakeClientA as any);

    let passedClientId: any = null;
    vi.spyOn(Hosting, 'create').mockImplementation(async (payload: any) => {
      passedClientId = payload.clientId;
      return { ...fakeHostingA, ...payload };
    });

    // Provide only projectId (no clientId)
    await HostingService.createHosting(
      {
        projectId: fakeProjectAId.toString(),
        hostingProvider: 'Hostinger',
        domain: 'test-derived.com',
        password: 'Pass123!Secure',
        expiryDate: new Date('2026-12-31'),
      },
      'admin@drdebuggers.com'
    );

    expect(passedClientId.toString()).toBe(fakeClientAId.toString());
  });

  // 3. Hosting list displays client
  it('3. Hosting list API populates client name, clientCode, email, and company', async () => {
    const mockList = [
      {
        ...fakeHostingA,
        clientId: {
          _id: fakeClientAId,
          name: fakeClientA.name,
          clientCode: fakeClientA.clientCode,
          email: fakeClientA.email,
          company: fakeClientA.company,
          telegramConnected: true,
        },
        projectId: {
          _id: fakeProjectAId,
          name: fakeProjectA.name,
          projectCode: fakeProjectA.projectCode,
        },
      },
    ];

    vi.spyOn(Hosting, 'find').mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockList),
    } as any);

    const req = new NextRequest('http://localhost:3000/api/hosting');
    const res = await getHostingRoute(req);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].clientId.name).toBe('Client Alpha Corp');
    expect(body.data[0].clientId.clientCode).toBe('CL-0001');
    expect(body.data[0].projectId.name).toBe('Alpha Ecommerce Platform');
  });

  // 4. Hosting detail displays client
  it('4. Hosting detail API populates full client information', async () => {
    const mockDetail = {
      ...fakeHostingA,
      clientId: {
        _id: fakeClientAId,
        name: fakeClientA.name,
        clientCode: fakeClientA.clientCode,
        email: fakeClientA.email,
        company: fakeClientA.company,
        telegramConnected: true,
      },
      projectId: {
        _id: fakeProjectAId,
        name: fakeProjectA.name,
        projectCode: fakeProjectA.projectCode,
        serviceType: 'ECOMMERCE',
      },
    };

    vi.spyOn(Hosting, 'findById').mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockDetail),
      exec: vi.fn().mockResolvedValue(mockDetail),
      then: vi.fn().mockImplementation((fn: any) => Promise.resolve(fn(mockDetail))),
    } as any);

    const req = new NextRequest(`http://localhost:3000/api/hosting/${fakeHostingAId}`);
    const res = await getHostingIdRoute(req, { params: Promise.resolve({ id: fakeHostingAId.toString() }) });
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.data.clientId.name).toBe('Client Alpha Corp');
    expect(body.data.projectId.name).toBe('Alpha Ecommerce Platform');
  });

  // 5. Hosting creation cannot associate wrong client
  it('5. Hosting creation throws an error and rejects mismatched client and project', async () => {
    vi.spyOn(Project, 'findById').mockResolvedValue(fakeProjectA as any); // belongs to fakeClientAId

    await expect(
      HostingService.createHosting(
        {
          projectId: fakeProjectAId.toString(),
          clientId: fakeClientBId.toString(), // Mismatched! Belongs to Client B
          hostingProvider: 'Hostinger',
          domain: 'hacker-attempt.com',
          password: 'Pass123!Secure',
          expiryDate: new Date('2026-12-31'),
        },
        'admin@drdebuggers.com'
      )
    ).rejects.toThrow('Project does not belong to specified client');
  });

  // 6. Client A sees Hosting A
  it('6. Client A querying Telegram /hosting receives Hosting A records', async () => {
    vi.spyOn(Client, 'findOne').mockReturnValue(mockChainable(fakeClientA));

    const populatedListA = [
      {
        ...fakeHostingA,
        projectId: {
          _id: fakeProjectAId,
          name: fakeProjectA.name,
          projectCode: fakeProjectA.projectCode,
        },
      },
    ];

    vi.spyOn(Hosting, 'find').mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(populatedListA),
    } as any);

    const sendMessageRawSpy = vi.spyOn(TelegramService, 'sendMessageRaw');

    await TelegramService.handleWebhookUpdate({
      update_id: 101,
      message: {
        message_id: 1,
        chat: { id: Number(fakeTelegramUserAId), type: 'private' },
        from: { id: Number(fakeTelegramUserAId), is_bot: false, first_name: 'Alpha' },
        text: '/hosting',
      },
    });

    expect(sendMessageRawSpy).toHaveBeenCalled();
    const sentText = sendMessageRawSpy.mock.calls[0][1];
    expect(sentText).toContain('alpha-ecommerce.com');
    expect(sentText).toContain('Alpha Ecommerce Platform');
    expect(sentText).toContain('Hostinger');
  });

  // 7. Client A cannot see Hosting B
  it('7. Client A cannot see Hosting B (strict tenant isolation)', async () => {
    vi.spyOn(Client, 'findOne').mockReturnValue(mockChainable(fakeClientA));

    const hostingFindSpy = vi.spyOn(Hosting, 'find').mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    } as any);

    await TelegramService.handleWebhookUpdate({
      update_id: 102,
      message: {
        message_id: 2,
        chat: { id: Number(fakeTelegramUserAId), type: 'private' },
        from: { id: Number(fakeTelegramUserAId), is_bot: false, first_name: 'Alpha' },
        text: '/hosting',
      },
    });

    // Verification: Query strictly filters by clientId: client._id
    expect(hostingFindSpy).toHaveBeenCalledWith({ clientId: fakeClientAId });
    expect(hostingFindSpy).not.toHaveBeenCalledWith(expect.objectContaining({ clientId: fakeClientBId }));
  });

  // 8. Client with multiple projects sees hosting across all authorized projects
  it('8. Client with multiple projects sees all hosting records across authorized projects', async () => {
    vi.spyOn(Client, 'findOne').mockReturnValue(mockChainable(fakeClientA));

    const populatedMultiple = [
      {
        ...fakeHostingA,
        projectId: {
          _id: fakeProjectAId,
          name: fakeProjectA.name,
          projectCode: fakeProjectA.projectCode,
        },
      },
      {
        ...fakeHostingA2,
        projectId: {
          _id: fakeProjectA2Id,
          name: fakeProjectA2.name,
          projectCode: fakeProjectA2.projectCode,
        },
      },
    ];

    vi.spyOn(Hosting, 'find').mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(populatedMultiple),
    } as any);

    const sendMessageRawSpy = vi.spyOn(TelegramService, 'sendMessageRaw');

    await TelegramService.handleWebhookUpdate({
      update_id: 103,
      message: {
        message_id: 3,
        chat: { id: Number(fakeTelegramUserAId), type: 'private' },
        from: { id: Number(fakeTelegramUserAId), is_bot: false, first_name: 'Alpha' },
        text: '/hosting',
      },
    });

    const sentText = sendMessageRawSpy.mock.calls[0][1];
    expect(sentText).toContain('Your Hosting Services (2)');
    expect(sentText).toContain('alpha-ecommerce.com');
    expect(sentText).toContain('api.alpha-mobile.com');
    expect(sentText).toContain('Alpha Ecommerce Platform');
    expect(sentText).toContain('Alpha Mobile App');
  });

  // 9. Client with no hosting gets empty response
  it('9. Client with no hosting records receives clean, user-friendly empty state', async () => {
    vi.spyOn(Client, 'findOne').mockReturnValue(mockChainable(fakeClientB));

    vi.spyOn(Hosting, 'find').mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    } as any);

    const sendMessageRawSpy = vi.spyOn(TelegramService, 'sendMessageRaw');

    await TelegramService.handleWebhookUpdate({
      update_id: 104,
      message: {
        message_id: 4,
        chat: { id: Number(fakeTelegramUserBId), type: 'private' },
        from: { id: Number(fakeTelegramUserBId), is_bot: false, first_name: 'Beta' },
        text: '/hosting',
      },
    });

    const sentText = sendMessageRawSpy.mock.calls[0][1];
    expect(sentText).toContain("You currently don't have any hosting records associated with your projects.");
    expect(sentText).not.toContain('error');
    expect(sentText).not.toContain('MongoDB');
  });

  // 10. /hosting Telegram command works via reply button as well
  it('10. Telegram reply keyboard button "🖥️ Hosting" triggers /hosting command', async () => {
    vi.spyOn(Client, 'findOne').mockReturnValue(mockChainable(fakeClientA));

    const populatedListA = [
      {
        ...fakeHostingA,
        projectId: {
          _id: fakeProjectAId,
          name: fakeProjectA.name,
          projectCode: fakeProjectA.projectCode,
        },
      },
    ];

    vi.spyOn(Hosting, 'find').mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(populatedListA),
    } as any);

    const sendMessageRawSpy = vi.spyOn(TelegramService, 'sendMessageRaw');

    // Tapping the reply button text "🖥️ Hosting"
    await TelegramService.handleWebhookUpdate({
      update_id: 105,
      message: {
        message_id: 5,
        chat: { id: Number(fakeTelegramUserAId), type: 'private' },
        from: { id: Number(fakeTelegramUserAId), is_bot: false, first_name: 'Alpha' },
        text: '🖥️ Hosting',
      },
    });

    expect(sendMessageRawSpy).toHaveBeenCalled();
    const sentText = sendMessageRawSpy.mock.calls[0][1];
    expect(sentText).toContain('alpha-ecommerce.com');
  });

  // 11. Unlinked Telegram user cannot access client hosting
  it('11. Unlinked Telegram user cannot access hosting and receives unlinked prompt', async () => {
    vi.spyOn(Client, 'findOne').mockReturnValue(mockChainable(null));

    const hostingFindSpy = vi.spyOn(Hosting, 'find');
    const { InquiryService } = await import('@/services/inquiry.service');

    await TelegramService.handleWebhookUpdate({
      update_id: 106,
      message: {
        message_id: 6,
        chat: { id: Number(fakeTelegramUnlinkedId), type: 'private' },
        from: { id: Number(fakeTelegramUnlinkedId), is_bot: false, first_name: 'Stranger' },
        text: '/hosting',
      },
    });

    // Hosting database must NEVER be queried for unlinked user
    expect(hostingFindSpy).not.toHaveBeenCalled();
    expect(InquiryService.handlePublicMessage).toHaveBeenCalled();
  });

  // 12. Invalid Telegram identity cannot access hosting
  it('12. Telegram user passing spoofed parameter (/hosting CL-0002) is not permitted to view other clients', async () => {
    vi.spyOn(Client, 'findOne').mockReturnValue(mockChainable(fakeClientA));

    const hostingFindSpy = vi.spyOn(Hosting, 'find').mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    } as any);

    // Client A maliciously attempts to specify Client B's code in command
    await TelegramService.handleWebhookUpdate({
      update_id: 107,
      message: {
        message_id: 7,
        chat: { id: Number(fakeTelegramUserAId), type: 'private' },
        from: { id: Number(fakeTelegramUserAId), is_bot: false, first_name: 'Alpha' },
        text: '/hosting CL-0002',
      },
    });

    // Server-side authorization must strictly ignore arguments and query authenticated Client A's ID
    expect(hostingFindSpy).toHaveBeenCalledWith({ clientId: fakeClientAId });
    expect(hostingFindSpy).not.toHaveBeenCalledWith(expect.objectContaining({ clientId: fakeClientBId }));
  });

  // 13. Hosting credentials are not returned by /hosting
  it('13. Hosting credentials (passwords, SSH keys, API tokens) are strictly excluded from Telegram output', async () => {
    vi.spyOn(Client, 'findOne').mockReturnValue(mockChainable(fakeClientA));

    const populatedListA = [
      {
        ...fakeHostingA,
        projectId: {
          _id: fakeProjectAId,
          name: fakeProjectA.name,
          projectCode: fakeProjectA.projectCode,
        },
      },
    ];

    vi.spyOn(Hosting, 'find').mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(populatedListA),
    } as any);

    const sendMessageRawSpy = vi.spyOn(TelegramService, 'sendMessageRaw');

    await TelegramService.handleWebhookUpdate({
      update_id: 108,
      message: {
        message_id: 8,
        chat: { id: Number(fakeTelegramUserAId), type: 'private' },
        from: { id: Number(fakeTelegramUserAId), is_bot: false, first_name: 'Alpha' },
        text: '/hosting',
      },
    });

    const sentText = sendMessageRawSpy.mock.calls[0][1];
    expect(sentText).not.toContain('enc_pwd');
    expect(sentText).not.toContain('enc_ssh');
    expect(sentText).not.toContain('enc_api');
    expect(sentText).not.toContain('SecurePassword123!');
    expect(sentText).toContain('For security reasons, server passwords and keys are not shared over Telegram');
  });

  // 14. Expiry information is correct
  it('14. Expiry calculation and remaining days are calculated accurately', () => {
    const today = new Date();
    const expiryIn10Days = new Date(today);
    expiryIn10Days.setDate(today.getDate() + 10);

    const daysRemaining = HostingService.calculateDaysRemaining(expiryIn10Days);
    expect(daysRemaining).toBe(10);

    const derivedStatus = HostingService.deriveStatus(expiryIn10Days);
    expect(derivedStatus).toBe('EXPIRING_SOON');

    const pastDate = new Date(today);
    pastDate.setDate(today.getDate() - 5);
    expect(HostingService.calculateDaysRemaining(pastDate)).toBeLessThanOrEqual(0);
    expect(HostingService.deriveStatus(pastDate)).toBe('EXPIRED');
  });

  // 15. Existing expiry notifications remain functional
  it('15. checkAndDispatchExpiryNotifications dispatches alerts without duplicate sending', async () => {
    const today = new Date();
    const expiringHosting = {
      ...fakeHostingA,
      expiryDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
      clientId: {
        ...fakeClientA,
      },
      projectId: {
        ...fakeProjectA,
      },
      notificationsSent: new Map(),
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(Hosting, 'find').mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([expiringHosting]),
      then: vi.fn().mockImplementation((fn: any) => Promise.resolve(fn([expiringHosting]))),
    } as any);

    const sendMessageRawSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ success: true } as any);

    const res = await HostingService.checkAndDispatchExpiryNotifications();
    expect(res).toBeDefined();
    expect(res.notificationsSent).toBeGreaterThanOrEqual(1);
    expect(sendMessageRawSpy).toHaveBeenCalled();
    expect(expiringHosting.notificationsSent.has('7')).toBe(true);
  });

  // 16. Existing /start remains functional
  it('16. Existing /start command remains functional for authenticated client', async () => {
    vi.spyOn(Client, 'findOne').mockReturnValue(mockChainable(fakeClientA));

    const sendMessageRawSpy = vi.spyOn(TelegramService, 'sendMessageRaw');

    await TelegramService.handleWebhookUpdate({
      update_id: 109,
      message: {
        message_id: 9,
        chat: { id: Number(fakeTelegramUserAId), type: 'private' },
        from: { id: Number(fakeTelegramUserAId), is_bot: false, first_name: 'Alpha' },
        text: '/start',
      },
    });

    expect(sendMessageRawSpy).toHaveBeenCalled();
    const sentText = sendMessageRawSpy.mock.calls[0][1];
    expect(sentText).toContain('Hello, Client Alpha Corp!');
    expect(sentText).toContain('/hosting - View Hosting Details');
  });

  // 17. Existing /status remains functional
  it('17. Existing /status command remains functional for authenticated client', async () => {
    vi.spyOn(Client, 'findOne').mockReturnValue(mockChainable(fakeClientA));

    vi.spyOn(Project, 'find').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([fakeProjectA]),
    } as any);

    vi.spyOn(Payment, 'find').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ amount: 50000 }]),
    } as any);

    const sendMessageSpy = vi.spyOn(TelegramService, 'sendMessage');

    await TelegramService.handleWebhookUpdate({
      update_id: 110,
      message: {
        message_id: 10,
        chat: { id: Number(fakeTelegramUserAId), type: 'private' },
        from: { id: Number(fakeTelegramUserAId), is_bot: false, first_name: 'Alpha' },
        text: '/status',
      },
    });

    expect(sendMessageSpy).toHaveBeenCalled();
    const sentText = sendMessageSpy.mock.calls[0][1];
    expect(sentText).toContain('Project Status: Alpha Ecommerce Platform');
    expect(sentText).toContain('PR-0001');
  });

  // 18. Existing /payments remains functional
  it('18. Existing /payments command remains functional for authenticated client', async () => {
    vi.spyOn(Client, 'findOne').mockReturnValue(mockChainable(fakeClientA));

    vi.spyOn(Project, 'find').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([fakeProjectA]),
    } as any);

    vi.spyOn(Payment, 'find').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(),
          amount: 50000,
          currency: 'INR',
          status: 'COMPLETED',
          paymentDate: new Date(),
          transactionId: 'TXN-12345',
        },
      ]),
    } as any);

    const sendMessageSpy = vi.spyOn(TelegramService, 'sendMessage');

    await TelegramService.handleWebhookUpdate({
      update_id: 111,
      message: {
        message_id: 11,
        chat: { id: Number(fakeTelegramUserAId), type: 'private' },
        from: { id: Number(fakeTelegramUserAId), is_bot: false, first_name: 'Alpha' },
        text: '/payments',
      },
    });

    expect(sendMessageSpy).toHaveBeenCalled();
    const sentText = sendMessageSpy.mock.calls[0][1];
    expect(sentText).toContain('Payment History');
    expect(sentText).toContain('50,000');
  });

  // 19. Existing /project remains functional
  it('19. Existing /project command remains functional for authenticated client', async () => {
    vi.spyOn(Client, 'findOne').mockReturnValue(mockChainable(fakeClientA));

    vi.spyOn(Project, 'find').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([fakeProjectA]),
    } as any);

    vi.spyOn(Payment, 'find').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ amount: 50000 }]),
    } as any);

    const sendMessageSpy = vi.spyOn(TelegramService, 'sendMessage');

    await TelegramService.handleWebhookUpdate({
      update_id: 112,
      message: {
        message_id: 12,
        chat: { id: Number(fakeTelegramUserAId), type: 'private' },
        from: { id: Number(fakeTelegramUserAId), is_bot: false, first_name: 'Alpha' },
        text: '/myproject',
      },
    });

    expect(sendMessageSpy).toHaveBeenCalled();
    const sentText = sendMessageSpy.mock.calls[0][1];
    expect(sentText).toContain('Project Budget Details');
    expect(sentText).toContain('Alpha Ecommerce Platform');
  });

  // 20. Existing team-member Telegram flows remain functional
  it('20. Existing team-member Telegram flows remain functional and separate from client hosting', async () => {
    const fakeTeamMemberUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Bob Dev',
      email: 'bob@drdebuggers.com',
      role: 'DEVELOPER',
      status: 'ACTIVE',
      telegramUserId: '888777666',
      telegramConnected: true,
    };

    vi.spyOn(User, 'findOne').mockReturnValue(mockChainable(null));
    vi.spyOn(TeamMember, 'findOne').mockReturnValue(mockChainable(fakeTeamMemberUser));
    vi.spyOn(Client, 'findOne').mockReturnValue(mockChainable(null));

    vi.spyOn(Task, 'find').mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(),
          title: 'Implement Payment Gateway',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
        },
      ]),
    } as any);

    const sendMessageRawSpy = vi.spyOn(TelegramService, 'sendMessageRaw');

    await TelegramService.handleWebhookUpdate({
      update_id: 113,
      message: {
        message_id: 13,
        chat: { id: 888777666, type: 'private' },
        from: { id: 888777666, is_bot: false, first_name: 'Bob' },
        text: '/tasks',
      },
    });

    expect(sendMessageRawSpy).toHaveBeenCalled();
    const sentText = sendMessageRawSpy.mock.calls[0][1];
    expect(sentText).toContain('Your Assigned Tasks');
    expect(sentText).toContain('Implement Payment Gateway');
  });
});
