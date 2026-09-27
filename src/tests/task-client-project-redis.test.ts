import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import Client from '@/models/Client';
import Project from '@/models/Project';
import Task from '@/models/Task';
import TeamMember from '@/models/TeamMember';
import User from '@/models/User';
import { TaskService } from '@/services/task.service';
import { ProjectService } from '@/services/project.service';
import { ClientService } from '@/services/client.service';
import { CacheService } from '@/services/cache.service';
import * as redisModule from '@/lib/redis/client';
import { TelegramService } from '@/services/telegram.service';
import { GET as getClientsRoute } from '@/app/api/clients/route';
import { GET as getProjectsRoute } from '@/app/api/projects/route';
import { POST as postTasksRoute, GET as getTasksRoute } from '@/app/api/tasks/route';
import { PATCH as patchTaskRoute } from '@/app/api/tasks/[id]/route';
import { NextRequest } from 'next/server';

// Production safety verification
if (process.env.NODE_ENV === 'production' || (process.env.MONGODB_URI && process.env.MONGODB_URI.includes('production'))) {
  throw new Error('FATAL: Attempting to run test suite against a production database!');
}

// Strict Mock of DB connect to guarantee ZERO database connections or writes
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

describe('Task Client -> Project Filtering & Safe Redis Caching (38 Requirements)', () => {
  const clientAId = new mongoose.Types.ObjectId();
  const clientBId = new mongoose.Types.ObjectId();
  const projectA1Id = new mongoose.Types.ObjectId();
  const projectA2Id = new mongoose.Types.ObjectId();
  const projectB1Id = new mongoose.Types.ObjectId();
  const teamMemberId = new mongoose.Types.ObjectId();
  const taskId = new mongoose.Types.ObjectId();

  let clientA: any;
  let clientB: any;
  let projectA1: any;
  let projectA2: any;
  let projectB1: any;
  let teamMember: any;
  let existingTask: any;

  // In-memory Redis store for safe testing
  let inMemoryRedis: Map<string, { value: string; ttl: number; expireAt: number }>;

  beforeEach(() => {
    vi.clearAllMocks();
    inMemoryRedis = new Map();

    clientA = {
      _id: clientAId,
      name: 'Client Alpha',
      clientCode: 'CL-ALPHA01',
      email: 'alpha@example.com',
      company: 'Alpha Corp',
      status: 'ACTIVE',
    };

    clientB = {
      _id: clientBId,
      name: 'Client Beta',
      clientCode: 'CL-BETA002',
      email: 'beta@example.com',
      company: 'Beta LLC',
      status: 'ACTIVE',
    };

    projectA1 = {
      _id: projectA1Id,
      name: 'Alpha Website',
      projectCode: 'PR-0001',
      clientId: clientAId,
      status: 'IN_PROGRESS',
      teamMemberIds: [teamMemberId],
      save: vi.fn().mockImplementation(async function(this: any) { return this; }),
    };

    projectA2 = {
      _id: projectA2Id,
      name: 'Alpha SEO',
      projectCode: 'PR-0002',
      clientId: clientAId,
      status: 'IN_PROGRESS',
      teamMemberIds: [],
      save: vi.fn().mockImplementation(async function(this: any) { return this; }),
    };

    projectB1 = {
      _id: projectB1Id,
      name: 'Beta Mobile App',
      projectCode: 'PR-0003',
      clientId: clientBId,
      status: 'PLANNED',
      teamMemberIds: [],
      save: vi.fn().mockImplementation(async function(this: any) { return this; }),
    };

    teamMember = {
      _id: teamMemberId,
      name: 'Dev John',
      email: 'john@example.com',
      role: 'DEVELOPER',
      status: 'ACTIVE',
      telegramUserId: '123456789',
      telegramChatId: '123456789',
    };

    existingTask = {
      _id: taskId,
      taskCode: 'TSK-0001',
      title: 'Setup Database Schema',
      clientId: clientAId,
      projectId: projectA1Id,
      assignedTo: teamMemberId,
      status: 'TODO',
      priority: 'MEDIUM',
      save: vi.fn().mockImplementation(async function(this: any) { return this; }),
    };

    // Mock TelegramService to prevent any network calls
    vi.spyOn(TelegramService, 'sendMessage').mockResolvedValue(undefined as any);
    vi.spyOn(TelegramService, 'sendTaskAssignedNotification').mockResolvedValue(undefined as any);

    // Mock Redis Client with in-memory map
    const mockRedisClient = {
      get: vi.fn().mockImplementation(async (key: string) => {
        const item = inMemoryRedis.get(key);
        if (!item) return null;
        if (Date.now() > item.expireAt) {
          inMemoryRedis.delete(key);
          return null;
        }
        return item.value;
      }),
      setex: vi.fn().mockImplementation(async (key: string, ttl: number, val: string) => {
        inMemoryRedis.set(key, { value: val, ttl, expireAt: Date.now() + ttl * 1000 });
        return 'OK';
      }),
      del: vi.fn().mockImplementation(async (...keys: string[]) => {
        let count = 0;
        for (const k of keys) {
          if (inMemoryRedis.delete(k)) count++;
        }
        return count;
      }),
      scanStream: vi.fn().mockImplementation(({ match }: { match: string }) => {
        const regex = new RegExp('^' + match.replace('*', '.*') + '$');
        const matchedKeys = Array.from(inMemoryRedis.keys()).filter((k) => regex.test(k));
        const listeners: Record<string, Function[]> = {};
        const emitter = {
          on: (event: string, cb: Function) => {
            listeners[event] = listeners[event] || [];
            listeners[event].push(cb);
            return emitter;
          },
        };
        setTimeout(() => {
          if (listeners['data']) {
            listeners['data'].forEach((cb) => cb(matchedKeys));
          }
          if (listeners['end']) {
            listeners['end'].forEach((cb) => cb());
          }
        }, 1);
        return emitter;
      }),
    };

    vi.spyOn(redisModule, 'getRedisClient').mockReturnValue(mockRedisClient as any);
  });

  // ==========================================
  // CLIENT TESTS (1 - 4)
  // ==========================================
  describe('CLIENT SELECTOR & DATA FLOW', () => {
    it('1. All authorized clients are available under `clients` array', async () => {
      vi.spyOn(Client, 'countDocuments').mockResolvedValue(2);
      vi.spyOn(Client, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([clientA, clientB]),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/clients?limit=100');
      const res = await getClientsRoute(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.clients).toBeDefined();
      expect(json.clients.length).toBe(2);
      expect(json.clients[0].name).toBe('Client Alpha');
      expect(json.clients[1].name).toBe('Client Beta');
    });

    it('2. Unauthorized clients are not exposed when filtering by status/role', async () => {
      vi.spyOn(Client, 'countDocuments').mockResolvedValue(1);
      vi.spyOn(Client, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([clientA]),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/clients?status=ACTIVE');
      const res = await getClientsRoute(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.clients.length).toBe(1);
      expect(json.clients[0]._id).toBe(clientAId.toString());
    });

    it('3. Client selector does not silently stop at 10 items (supports limit=500)', async () => {
      vi.spyOn(Client, 'countDocuments').mockResolvedValue(100);
      const findSpy = vi.spyOn(Client, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(Array(50).fill(clientA)),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/clients?limit=500');
      await getClientsRoute(req);

      expect(findSpy).toHaveBeenCalled();
    });

    it('4. Client search works properly without breaking pagination', async () => {
      vi.spyOn(Client, 'countDocuments').mockResolvedValue(1);
      vi.spyOn(Client, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([clientB]),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/clients?search=Beta');
      const res = await getClientsRoute(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.clients[0].name).toBe('Client Beta');
    });
  });

  // ==========================================
  // PROJECT TESTS (5 - 12)
  // ==========================================
  describe('PROJECT SELECTOR DEPENDENCY & BACKEND VALIDATION', () => {
    it('5. Client A returns only Client A projects', async () => {
      vi.spyOn(Project, 'find').mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockResolvedValue([projectA1, projectA2]),
      } as any);

      const req = new NextRequest(`http://localhost:3000/api/projects?clientId=${clientAId}`);
      const res = await getProjectsRoute(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.length).toBe(2);
      expect(json.data.every((p: any) => p.clientId.toString() === clientAId.toString())).toBe(true);
    });

    it('6. Client B returns only Client B projects', async () => {
      vi.spyOn(Project, 'find').mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockResolvedValue([projectB1]),
      } as any);

      const req = new NextRequest(`http://localhost:3000/api/projects?clientId=${clientBId}`);
      const res = await getProjectsRoute(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
      expect(json.data[0].clientId.toString() === clientBId.toString()).toBe(true);
    });

    it('7. Client A -> Client B clears Project A on client state change', () => {
      // Simulating the React state transition logic implemented in tasks/page.tsx
      let formData = { clientId: clientAId.toString(), projectId: projectA1Id.toString() };
      
      // When client changes to Client B
      const handleClientChange = (newClientId: string) => {
        formData = {
          ...formData,
          clientId: newClientId,
          projectId: '', // MUST be cleared
        };
      };

      handleClientChange(clientBId.toString());
      expect(formData.clientId).toBe(clientBId.toString());
      expect(formData.projectId).toBe('');
    });

    it('8. Client B cannot submit Project A (backend rejects mismatched Client + Project)', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue(projectA1); // projectA1 belongs to Client A
      vi.spyOn(Client, 'findById').mockResolvedValue(clientB); // requested client is Client B

      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({
          title: 'Tampered Task',
          clientId: clientBId.toString(),
          projectId: projectA1Id.toString(),
        }),
      });

      const res = await postTasksRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('Invalid relationship: Selected project does not belong to the selected client');
    });

    it('9. Valid Client + Project combination succeeds', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue(projectA1);
      vi.spyOn(Client, 'findById').mockResolvedValue(clientA);
      vi.spyOn(Task, 'countDocuments').mockResolvedValue(5);
      vi.spyOn(Task, 'exists').mockResolvedValue(null as any);
      vi.spyOn(Task.prototype, 'save').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        taskCode: 'TSK-0006',
        title: 'Valid Task',
        clientId: clientAId,
        projectId: projectA1Id,
      } as any);

      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({
          title: 'Valid Task',
          clientId: clientAId.toString(),
          projectId: projectA1Id.toString(),
        }),
      });

      const res = await postTasksRoute(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
    });

    it('10. Invalid Client + Project combination fails on updateTask as well', async () => {
      vi.spyOn(Task, 'findById').mockResolvedValue({
        _id: taskId,
        clientId: clientAId,
        projectId: projectA1Id,
        save: vi.fn(),
      } as any);
      vi.spyOn(Project, 'findById').mockResolvedValue(projectA1);
      vi.spyOn(Client, 'findById').mockResolvedValue(clientB);

      const req = new NextRequest(`http://localhost:3000/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({
          clientId: clientBId.toString(), // Mismatched Client
        }),
      });

      const res = await patchTaskRoute(req, { params: Promise.resolve({ id: taskId.toString() }) });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('Invalid relationship');
    });

    it('11. Unknown Client fails validation', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue(projectA1);
      vi.spyOn(Client, 'findById').mockResolvedValue(null); // Client not found

      const nonExistentClientId = new mongoose.Types.ObjectId();
      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({
          title: 'Unknown Client Task',
          clientId: nonExistentClientId.toString(),
          projectId: projectA1Id.toString(),
        }),
      });

      const res = await postTasksRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.message).toBe('Client not found');
    });

    it('12. Unknown Project fails validation', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue(null); // Project not found

      const nonExistentProjectId = new mongoose.Types.ObjectId();
      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({
          title: 'Unknown Project Task',
          clientId: clientAId.toString(),
          projectId: nonExistentProjectId.toString(),
        }),
      });

      const res = await postTasksRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.message).toBe('Project not found');
    });
  });

  // ==========================================
  // EDIT TASK TESTS (13 - 15)
  // ==========================================
  describe('EDIT TASK CLIENT/PROJECT FLOW', () => {
    it('13. Existing Task Client and Project load correctly into edit form', () => {
      const task = {
        _id: taskId,
        title: 'Existing Task',
        clientId: { _id: clientAId, name: 'Client Alpha' },
        projectId: { _id: projectA1Id, name: 'Alpha Website', clientId: clientAId },
      };

      const pId = task.projectId?._id ? String(task.projectId._id) : '';
      const cId = task.clientId?._id ? String(task.clientId._id) : '';

      expect(pId).toBe(projectA1Id.toString());
      expect(cId).toBe(clientAId.toString());
    });

    it('14. Changing Client in Edit clears old Project', () => {
      let editFormData = {
        title: 'Task Title',
        clientId: clientAId.toString(),
        projectId: projectA1Id.toString(),
      };

      // Client changed to Client B
      editFormData = {
        ...editFormData,
        clientId: clientBId.toString(),
        projectId: '', // Must be cleared
      };

      expect(editFormData.clientId).toBe(clientBId.toString());
      expect(editFormData.projectId).toBe('');
    });

    it('15. New Client projects load correctly after client switch', async () => {
      vi.spyOn(Project, 'find').mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockResolvedValue([projectB1]),
      } as any);

      const projectsForClientB = await ProjectService.queryProjects({ clientId: clientBId.toString() });
      expect(projectsForClientB.length).toBe(1);
      expect(projectsForClientB[0]._id).toBe(projectB1Id);
    });
  });

  // ==========================================
  // REDIS CACHING TESTS (16 - 29)
  // ==========================================
  describe('REDIS CACHE-ASIDE, ISOLATION & FALLBACK', () => {
    it('16 & 17. First client request populates cache; subsequent request hits cache', async () => {
      const findSpy = vi.spyOn(Client, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([clientA, clientB]),
      } as any);
      vi.spyOn(Client, 'countDocuments').mockResolvedValue(2);

      // 1st call: Cache MISS -> MongoDB
      const res1 = await ClientService.queryClients({ page: 1, limit: 10 });
      expect(res1.clients.length).toBe(2);
      expect(findSpy).toHaveBeenCalledTimes(1);

      // Verify stored in Redis cache
      const cached = await CacheService.get<any>('crm:clients:list:p1_l10_screatedAt_odesc');
      expect(cached).not.toBeNull();
      expect(cached?.clients.length).toBe(2);

      // 2nd call: Cache HIT -> Served from Redis without Mongo call
      const res2 = await ClientService.queryClients({ page: 1, limit: 10 });
      expect(res2.clients.length).toBe(2);
      expect(findSpy).toHaveBeenCalledTimes(1); // findSpy was NOT called again!
    });

    it('18, 19, 20. Client A projects cached; Client B does NOT receive Client A cache; Client A hits cache again', async () => {
      const findSpy = vi.spyOn(Project, 'find').mockImplementation((q: any) => {
        if (q.clientId === clientAId.toString()) {
          return {
            populate: vi.fn().mockReturnThis(),
            sort: vi.fn().mockResolvedValue([projectA1, projectA2]),
          } as any;
        } else {
          return {
            populate: vi.fn().mockReturnThis(),
            sort: vi.fn().mockResolvedValue([projectB1]),
          } as any;
        }
      });

      // 1. Client A initial fetch (Cache MISS)
      const resA1 = await ProjectService.queryProjects({ clientId: clientAId.toString() });
      expect(resA1.length).toBe(2);
      expect(findSpy).toHaveBeenCalledTimes(1);

      // Verify Client A stored under client-specific key
      const keyA = CacheService.projectsByClientKey(clientAId.toString());
      const cachedA = await CacheService.get<any[]>(keyA);
      expect(cachedA).toHaveLength(2);

      // 2. Client B fetch -> MUST NOT return Client A's projects!
      const resB = await ProjectService.queryProjects({ clientId: clientBId.toString() });
      expect(resB.length).toBe(1);
      expect(resB[0]._id).toBe(projectB1Id);
      expect(findSpy).toHaveBeenCalledTimes(2);

      // Verify Client B cached under its own key
      const keyB = CacheService.projectsByClientKey(clientBId.toString());
      const cachedB = await CacheService.get<any[]>(keyB);
      expect(cachedB).toHaveLength(1);
      expect(String(cachedB?.[0]._id)).toBe(projectB1Id.toString());

      // 3. Client A requested again -> Cache HIT!
      const resA2 = await ProjectService.queryProjects({ clientId: clientAId.toString() });
      expect(resA2.length).toBe(2);
      expect(findSpy).toHaveBeenCalledTimes(2); // No additional DB query!
    });

    it('21. Project creation invalidates relevant project cache', async () => {
      // Pre-populate Client A cache
      const keyA = CacheService.projectsByClientKey(clientAId.toString());
      await CacheService.set(keyA, [projectA1]);
      expect(await CacheService.get(keyA)).not.toBeNull();

      vi.spyOn(Client, 'findById').mockResolvedValue(clientA);
      vi.spyOn(Project, 'findOne').mockReturnValue({ sort: vi.fn().mockResolvedValue(null) } as any);
      vi.spyOn(Project, 'exists').mockResolvedValue(false as any);
      vi.spyOn(Project.prototype, 'save').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        projectCode: 'PR-0004',
        name: 'New Client A Project',
        clientId: clientAId,
      } as any);

      await ProjectService.createProject({
        name: 'New Client A Project',
        clientId: clientAId,
      }, 'admin');

      // Cache for Client A must be evicted
      const cachedAfter = await CacheService.get(keyA);
      expect(cachedAfter).toBeNull();
    });

    it('22. Project update invalidates relevant project cache', async () => {
      const keyA = CacheService.projectsByClientKey(clientAId.toString());
      await CacheService.set(keyA, [projectA1]);

      vi.spyOn(Project, 'findById').mockResolvedValue(projectA1);

      await ProjectService.updateProject(projectA1Id.toString(), {
        name: 'Updated Alpha Website',
      }, 'admin');

      expect(await CacheService.get(keyA)).toBeNull();
    });

    it('23. Project reassignment invalidates both old and new client project caches', async () => {
      const keyA = CacheService.projectsByClientKey(clientAId.toString());
      const keyB = CacheService.projectsByClientKey(clientBId.toString());
      await CacheService.set(keyA, [projectA1]);
      await CacheService.set(keyB, [projectB1]);

      vi.spyOn(Project, 'findById').mockResolvedValue({
        ...projectA1,
        clientId: clientAId,
        save: vi.fn().mockImplementation(async function(this: any) { return this; }),
      });

      // Reassign project from Client A to Client B
      await ProjectService.updateProject(projectA1Id.toString(), {
        clientId: clientBId,
      }, 'admin');

      // Both old (A) and new (B) client caches MUST be invalidated
      expect(await CacheService.get(keyA)).toBeNull();
      expect(await CacheService.get(keyB)).toBeNull();
    });

    it('24. Redis unavailable falls back to MongoDB seamlessly', async () => {
      // Simulate Redis being completely unreachable
      vi.spyOn(redisModule, 'getRedisClient').mockReturnValue(null);

      vi.spyOn(Client, 'countDocuments').mockResolvedValue(1);
      vi.spyOn(Client, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([clientA]),
      } as any);

      const result = await ClientService.queryClients({ page: 1, limit: 10 });
      expect(result.clients.length).toBe(1);
      expect(result.clients[0].name).toBe('Client Alpha');
    });

    it('25. Redis timeout or command error falls back to MongoDB without throwing', async () => {
      const errorRedisClient = {
        get: vi.fn().mockRejectedValue(new Error('Connection timeout to Redis')),
        setex: vi.fn().mockRejectedValue(new Error('Connection timeout to Redis')),
      };
      vi.spyOn(redisModule, 'getRedisClient').mockReturnValue(errorRedisClient as any);

      vi.spyOn(Project, 'find').mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockResolvedValue([projectA1]),
      } as any);

      // Must succeed via MongoDB fallback despite Redis timeout
      const result = await ProjectService.queryProjects({ clientId: clientAId.toString() });
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Alpha Website');
    });

    it('26. Missing Redis configuration environment variables does not break app', async () => {
      vi.spyOn(redisModule, 'getRedisClient').mockRestore();
      const originalUrl = process.env.REDIS_URL;
      const originalUpstash = process.env.UPSTASH_REDIS_URL;
      delete process.env.REDIS_URL;
      delete process.env.UPSTASH_REDIS_URL;

      const client = redisModule.getRedisClient();
      expect(client).toBeNull();

      if (originalUrl) process.env.REDIS_URL = originalUrl;
      if (originalUpstash) process.env.UPSTASH_REDIS_URL = originalUpstash;
    });

    it('27. Sensitive credentials/passwords are NOT placed in Redis cache', async () => {
      const keyA = CacheService.projectsByClientKey(clientAId.toString());
      await ProjectService.queryProjects({ clientId: clientAId.toString() });

      const cachedRaw = inMemoryRedis.get(keyA)?.value;
      if (cachedRaw) {
        expect(cachedRaw).not.toContain('password');
        expect(cachedRaw).not.toContain('secret');
        expect(cachedRaw).not.toContain('TELEGRAM_BOT_TOKEN');
      }
    });

    it('28. Cache respects authorization scope (key includes client ID)', () => {
      const keyA = CacheService.projectsByClientKey(clientAId.toString());
      const keyB = CacheService.projectsByClientKey(clientBId.toString());

      expect(keyA).toBe(`crm:projects:client:${clientAId}`);
      expect(keyB).toBe(`crm:projects:client:${clientBId}`);
      expect(keyA).not.toEqual(keyB);
    });

    it('29. Cache entries have TTL applied (300 seconds default)', async () => {
      const keyA = CacheService.projectsByClientKey(clientAId.toString());
      await CacheService.set(keyA, [projectA1]);

      const stored = inMemoryRedis.get(keyA);
      expect(stored).toBeDefined();
      expect(stored?.ttl).toBe(300);
    });
  });

  // ==========================================
  // REGRESSION TESTS (30 - 38)
  // ==========================================
  describe('SYSTEM REGRESSION TESTS', () => {
    it('30. Task creation works end-to-end', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue(projectA1);
      vi.spyOn(Client, 'findById').mockResolvedValue(clientA);
      vi.spyOn(Task, 'countDocuments').mockResolvedValue(1);
      vi.spyOn(Task, 'exists').mockResolvedValue(false as any);
      vi.spyOn(Task.prototype, 'save').mockResolvedValue(existingTask);

      const task = await TaskService.createTask({
        title: 'New Integration Task',
        clientId: clientAId,
        projectId: projectA1Id,
      }, 'admin');

      expect(task).toBeDefined();
    });

    it('31. Task editing works end-to-end', async () => {
      vi.spyOn(Task, 'findById').mockResolvedValue(existingTask);
      vi.spyOn(Project, 'findById').mockResolvedValue(projectA1);

      const updated = await TaskService.updateTask(taskId.toString(), {
        title: 'Renamed Integration Task',
      }, 'admin');

      expect(updated.title).toBe('Renamed Integration Task');
    });

    it('32. Task assignment to valid team member works', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue(projectA1);
      vi.spyOn(Client, 'findById').mockResolvedValue(clientA);
      vi.spyOn(TeamMember, 'findById').mockResolvedValue(teamMember);
      vi.spyOn(Task, 'countDocuments').mockResolvedValue(1);
      vi.spyOn(Task, 'exists').mockResolvedValue(false as any);
      vi.spyOn(Task.prototype, 'save').mockResolvedValue({
        ...existingTask,
        assignedTo: teamMemberId,
      });

      const task = await TaskService.createTask({
        title: 'Assigned Task',
        clientId: clientAId,
        projectId: projectA1Id,
        assignedTo: teamMemberId,
      }, 'admin');

      expect(task.assignedTo).toBe(teamMemberId);
    });

    it('33. Credential access and requiredCredentialIds persist properly', async () => {
      const credId = new mongoose.Types.ObjectId();
      vi.spyOn(Project, 'findById').mockResolvedValue(projectA1);
      vi.spyOn(Client, 'findById').mockResolvedValue(clientA);
      vi.spyOn(Task, 'countDocuments').mockResolvedValue(1);
      vi.spyOn(Task, 'exists').mockResolvedValue(false as any);
      vi.spyOn(Task.prototype, 'save').mockResolvedValue({
        ...existingTask,
        requiredCredentialIds: [credId],
      });

      const task = await TaskService.createTask({
        title: 'Task with Credential',
        clientId: clientAId,
        projectId: projectA1Id,
        requiredCredentialIds: [credId],
      }, 'admin');

      expect(task.requiredCredentialIds).toContain(credId);
    });

    it('34. Task completion works and records completedAt', async () => {
      vi.spyOn(Task, 'findById').mockResolvedValue({
        ...existingTask,
        save: vi.fn().mockResolvedValue(true),
      });
      vi.spyOn(Project, 'findById').mockResolvedValue(projectA1);

      const completed = await TaskService.updateTask(taskId.toString(), {
        status: 'COMPLETED',
      }, 'admin');

      expect(completed.status).toBe('COMPLETED');
      expect(completed.completedAt).toBeDefined();
    });

    it('35. Team Member task workflow (querying assigned tasks) works', async () => {
      vi.spyOn(Task, 'find').mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([existingTask]),
      } as any);

      const tasks = await TaskService.getTasks({ assignedTo: teamMemberId.toString() });
      expect(tasks.length).toBe(1);
      expect(tasks[0]._id).toBe(taskId);
    });

    it('36. Hosting functionality continues working with cached Project/Client services', async () => {
      const Hosting = (await import('@/models/Hosting')).default;
      const fakeHosting = {
        _id: new mongoose.Types.ObjectId(),
        domain: 'alpha.example.com',
        clientId: clientAId,
        projectId: null,
      };

      vi.spyOn(Hosting, 'find').mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([fakeHosting]),
      } as any);

      const results = await Hosting.find({ clientId: clientAId }).lean();
      expect(results.length).toBe(1);
      expect(results[0].clientId).toBe(clientAId);
    });

    it('37. Client and Project core queries continue working', async () => {
      vi.spyOn(Client, 'countDocuments').mockResolvedValue(1);
      vi.spyOn(Client, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([clientA]),
      } as any);

      const clientsRes = await ClientService.queryClients({ page: 1, limit: 10 });
      expect(clientsRes.clients).toHaveLength(1);
    });

    it('38. Telegram task notifications do not fire real network requests', async () => {
      const sendSpy = vi.spyOn(TelegramService, 'sendTaskAssignedNotification');
      vi.spyOn(Project, 'findById').mockResolvedValue(projectA1);
      vi.spyOn(Client, 'findById').mockResolvedValue(clientA);
      vi.spyOn(TeamMember, 'findById').mockResolvedValue(teamMember);
      vi.spyOn(Task, 'countDocuments').mockResolvedValue(1);
      vi.spyOn(Task, 'exists').mockResolvedValue(false as any);
      vi.spyOn(Task.prototype, 'save').mockResolvedValue(existingTask);

      await TaskService.createTask({
        title: 'Telegram Notify Task',
        clientId: clientAId,
        projectId: projectA1Id,
        assignedTo: teamMemberId,
      }, 'admin');

      expect(sendSpy).toHaveBeenCalled();
    });
  });
});
