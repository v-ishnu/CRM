import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import Hosting from '@/models/Hosting';
import Client from '@/models/Client';
import Project from '@/models/Project';
import User from '@/models/User';
import TeamMember from '@/models/TeamMember';
import { HostingService } from '@/services/hosting.service';
import { TelegramService } from '@/services/telegram.service';
import { AuditService } from '@/services/audit.service';
import { GET as getClientsRoute } from '@/app/api/clients/route';
import { GET as getHostingRoute, POST as postHostingRoute } from '@/app/api/hosting/route';
import { NextRequest } from 'next/server';

// Strict Mock of DB connect to guarantee ZERO production DB queries or writes
vi.mock('@/lib/db/connect', () => ({
  dbConnect: vi.fn().mockResolvedValue(null),
  default: vi.fn().mockResolvedValue(null),
}));

// Mock AuditService to verify audit logging without DB writes
vi.mock('@/services/audit.service', () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(true),
    logAction: vi.fn().mockResolvedValue(true),
  },
}));

describe('Hosting Direct-Client vs Project-Based Selector & Creation (Unit Tests)', () => {
  const fakeClientWithProjectsId = new mongoose.Types.ObjectId();
  const fakeClientZeroProjectsId = new mongoose.Types.ObjectId();
  const fakeClientBId = new mongoose.Types.ObjectId();
  const fakeProjectId = new mongoose.Types.ObjectId();
  const fakeTelegramUserId = '555666777';

  let fakeClientWithProjects: any;
  let fakeClientZeroProjects: any;
  let fakeClientB: any;
  let fakeProject: any;

  beforeEach(() => {
    vi.clearAllMocks();

    fakeClientWithProjects = {
      _id: fakeClientWithProjectsId,
      name: 'Mahasin Islam',
      clientCode: 'CL-VX4XONFK',
      email: 'mahasin@example.com',
      company: 'Tech Solutions Inc',
      telegramUserId: fakeTelegramUserId,
      telegramChatId: fakeTelegramUserId,
      telegramConnected: true,
      status: 'ACTIVE',
    };

    fakeClientZeroProjects = {
      _id: fakeClientZeroProjectsId,
      name: 'Rishikant',
      clientCode: 'CL-0N8DGZ2N1',
      email: 'rishikant@example.com',
      company: 'Independent Consulting',
      status: 'LEAD',
    };

    fakeClientB = {
      _id: fakeClientBId,
      name: 'Piyush Kumar',
      clientCode: 'CL-YA4HDCX9',
      email: 'piyush@example.com',
      company: 'Piyush Enterprises',
      status: 'ACTIVE',
    };

    fakeProject = {
      _id: fakeProjectId,
      name: 'E-commerce Platform',
      projectCode: 'PRJ-101',
      clientId: fakeClientWithProjectsId,
      status: 'ACTIVE',
    };

    // Default mock for User & TeamMember to avoid collision in identity resolver
    vi.spyOn(User, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as any);
    vi.spyOn(TeamMember, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as any);

    // Mock TelegramService send helpers so NO external HTTP calls happen
    vi.spyOn(TelegramService, 'sendMessage').mockResolvedValue(undefined as any);
    vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ success: true, messageId: 2001 } as any);
  });

  // 1. GET /api/clients returns clients list under `clients` key
  it('1. GET /api/clients returns clients list with name and clientCode', async () => {
    const mockClients = [fakeClientWithProjects, fakeClientZeroProjects, fakeClientB];
    vi.spyOn(Client, 'countDocuments').mockResolvedValue(3);
    vi.spyOn(Client, 'find').mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockClients),
    } as any);

    const req = new NextRequest('http://localhost:3000/api/clients?limit=100');
    const res = await getClientsRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    // Crucial check: client array must be under data.clients or data.clients must exist
    expect(Array.isArray(data.clients)).toBe(true);
    expect(data.clients.length).toBe(3);
    expect(data.clients[0].name).toBe('Mahasin Islam');
    expect(data.clients[0].clientCode).toBe('CL-VX4XONFK');
    expect(data.clients[1].name).toBe('Rishikant');
    expect(data.clients[1].clientCode).toBe('CL-0N8DGZ2N1');
  });

  // 2. Client with ZERO projects appears in client query results
  it('2. Client with ZERO projects appears in client list', async () => {
    vi.spyOn(Client, 'countDocuments').mockResolvedValue(1);
    vi.spyOn(Client, 'find').mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([fakeClientZeroProjects]),
    } as any);

    const req = new NextRequest('http://localhost:3000/api/clients?limit=100');
    const res = await getClientsRoute(req);
    const data = await res.json();

    expect(data.clients.some((c: any) => c._id === fakeClientZeroProjectsId.toString() || c.name === 'Rishikant')).toBe(true);
  });

  // 3. Direct Client Hosting Creation: creates hosting with clientId and projectId = undefined
  it('3. Direct Client Hosting: creates hosting record with clientId and projectId = undefined', async () => {
    vi.spyOn(Client, 'findById').mockResolvedValue(fakeClientZeroProjects as any);

    let createdPayload: any = null;
    vi.spyOn(Hosting, 'create').mockImplementation(async (payload: any) => {
      createdPayload = payload;
      return {
        _id: new mongoose.Types.ObjectId(),
        ...payload,
        save: vi.fn().mockResolvedValue(true),
      };
    });

    const result = await HostingService.createHosting(
      {
        clientId: fakeClientZeroProjectsId.toString(),
        projectId: undefined, // Direct client mode: no project
        hostingProvider: 'Hostinger',
        domain: 'rishikant-consulting.com',
        password: 'DirectClientSecret123!',
        expiryDate: new Date('2027-01-01'),
      },
      'admin@drdebuggers.com'
    );

    expect(result).toBeDefined();
    expect(createdPayload).toBeDefined();
    expect(createdPayload.clientId.toString()).toBe(fakeClientZeroProjectsId.toString());
    expect(createdPayload.projectId).toBeUndefined();
    expect(createdPayload.domain).toBe('rishikant-consulting.com');
  });

  // 4. Project-based Hosting Creation: derives authoritative clientId from project
  it('4. Project-based Hosting: derives authoritative clientId from project', async () => {
    vi.spyOn(Project, 'findById').mockResolvedValue(fakeProject as any);
    vi.spyOn(Client, 'findById').mockResolvedValue(fakeClientWithProjects as any);

    let createdPayload: any = null;
    vi.spyOn(Hosting, 'create').mockImplementation(async (payload: any) => {
      createdPayload = payload;
      return {
        _id: new mongoose.Types.ObjectId(),
        ...payload,
        save: vi.fn().mockResolvedValue(true),
      };
    });

    const result = await HostingService.createHosting(
      {
        projectId: fakeProjectId.toString(),
        hostingProvider: 'Cloudways',
        domain: 'mahasin-shop.com',
        password: 'ProjectSecret123!',
        expiryDate: new Date('2027-06-01'),
      },
      'admin@drdebuggers.com'
    );

    expect(result).toBeDefined();
    expect(createdPayload.projectId.toString()).toBe(fakeProjectId.toString());
    expect(createdPayload.clientId.toString()).toBe(fakeClientWithProjectsId.toString());
  });

  // 5. Rejects mismatched clientId and projectId
  it('5. Rejects mismatched clientId and projectId', async () => {
    vi.spyOn(Project, 'findById').mockResolvedValue(fakeProject as any); // belongs to fakeClientWithProjectsId

    await expect(
      HostingService.createHosting(
        {
          projectId: fakeProjectId.toString(),
          clientId: fakeClientBId.toString(), // Mismatched client!
          hostingProvider: 'Hostinger',
          domain: 'conflict.com',
          password: 'Secret123!',
          expiryDate: new Date('2027-01-01'),
        },
        'admin@drdebuggers.com'
      )
    ).rejects.toThrow('Project does not belong to specified client');
  });

  // 6. Rejects creation when neither clientId nor projectId is provided
  it('6. Rejects creation when neither clientId nor projectId is provided', async () => {
    await expect(
      HostingService.createHosting(
        {
          hostingProvider: 'Hostinger',
          domain: 'orphan.com',
          password: 'Secret123!',
          expiryDate: new Date('2027-01-01'),
        },
        'admin@drdebuggers.com'
      )
    ).rejects.toThrow('Client is required (must select a valid Project or Client)');
  });

  // 7. POST /api/hosting endpoint handles direct client hosting payload
  it('7. POST /api/hosting creates direct client hosting via API', async () => {
    vi.spyOn(Client, 'findById').mockResolvedValue(fakeClientZeroProjects as any);

    vi.spyOn(Hosting, 'create').mockImplementation(async (payload: any) => ({
      _id: new mongoose.Types.ObjectId(),
      ...payload,
      status: 'ACTIVE',
    }));

    const req = new NextRequest('http://localhost:3000/api/hosting', {
      method: 'POST',
      headers: {
        'x-user-role': 'ADMIN',
        'x-user-email': 'admin@drdebuggers.com',
      },
      body: JSON.stringify({
        clientId: fakeClientZeroProjectsId.toString(),
        projectId: null, // explicit null from direct-client mode
        hostingProvider: 'DigitalOcean',
        domain: 'direct-api-test.com',
        password: 'SuperPassword123!',
        expiryDate: new Date('2027-03-01').toISOString(),
      }),
    });

    const res = await postHostingRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.domain).toBe('direct-api-test.com');
  });

  // 8. Client-only hosting appears on client detail query (Hosting.find({ clientId }))
  it('8. Client-only hosting appears when querying by clientId', async () => {
    const directHosting = {
      _id: new mongoose.Types.ObjectId(),
      clientId: fakeClientZeroProjectsId,
      projectId: undefined,
      domain: 'direct-rishikant.com',
      hostingProvider: 'Hostinger',
      hostingType: 'Shared',
      expiryDate: new Date('2027-05-01'),
      status: 'ACTIVE',
    };

    const mockQuery = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([directHosting]),
      }),
    };
    vi.spyOn(Hosting, 'find').mockReturnValue(mockQuery as any);

    const req = new NextRequest(`http://localhost:3000/api/hosting?clientId=${fakeClientZeroProjectsId}`);
    const res = await getHostingRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBe(1);
    expect(data.data[0].domain).toBe('direct-rishikant.com');
    expect(data.data[0].projectId).toBeUndefined();
  });

  // 9. Client-only hosting does NOT appear under project queries
  it('9. Client-only hosting does NOT appear under unrelated project queries', async () => {
    // Project query should only match records where projectId matches
    const mockQuery = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]), // No records match this project
      }),
    };
    const findSpy = vi.spyOn(Hosting, 'find').mockReturnValue(mockQuery as any);

    const req = new NextRequest(`http://localhost:3000/api/hosting?projectId=${fakeProjectId}`);
    const res = await getHostingRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.length).toBe(0);
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: fakeProjectId.toString(),
      })
    );
  });

  // 10. Telegram /hosting returns both project-linked and direct-client hosting
  it('10. Telegram /hosting returns both project-linked and direct-client hosting for client', async () => {
    const projectHosting = {
      _id: new mongoose.Types.ObjectId(),
      clientId: fakeClientWithProjectsId,
      projectId: { _id: fakeProjectId, name: 'E-commerce Platform', projectCode: 'PRJ-101' },
      domain: 'mahasin-store.com',
      hostingProvider: 'Hostinger',
      hostingType: 'Cloud',
      expiryDate: new Date('2027-01-01'),
      status: 'ACTIVE',
    };

    const directHosting = {
      _id: new mongoose.Types.ObjectId(),
      clientId: fakeClientWithProjectsId,
      projectId: null, // Direct client / No project
      domain: 'mahasin-blog.com',
      hostingProvider: 'AWS',
      hostingType: 'VPS',
      expiryDate: new Date('2027-02-01'),
      status: 'ACTIVE',
    };

    const mockQuery = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([projectHosting, directHosting]),
      }),
    };
    vi.spyOn(Hosting, 'find').mockReturnValue(mockQuery as any);
    vi.spyOn(Client, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(fakeClientWithProjects),
    } as any);

    let sentMessage = '';
    vi.spyOn(TelegramService, 'sendMessageRaw').mockImplementation(async (_chatId, msg) => {
      sentMessage = msg;
      return { success: true, messageId: 9999 } as any;
    });

    await TelegramService.handleWebhookUpdate({
      update_id: 8881,
      message: {
        message_id: 101,
        from: { id: parseInt(fakeTelegramUserId, 10), is_bot: false, first_name: 'Mahasin' },
        chat: { id: parseInt(fakeTelegramUserId, 10), type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: '/hosting',
      },
    });

    expect(sentMessage).toContain('mahasin-store.com');
    expect(sentMessage).toContain('PRJ-101');
    expect(sentMessage).toContain('mahasin-blog.com');
    expect(sentMessage).toContain('General Client Hosting'); // Fallback for direct hosting
  });
});
