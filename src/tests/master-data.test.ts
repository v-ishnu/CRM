import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import MasterData, { MasterDataType, MASTER_DATA_TYPES } from '@/models/MasterData';
import Hosting from '@/models/Hosting';
import Project from '@/models/Project';
import Credential from '@/models/Credential';
import Payment from '@/models/Payment';
import TeamPayment from '@/models/TeamPayment';
import { MasterDataService } from '@/services/master-data.service';
import { CacheService } from '@/services/cache.service';
import * as redisModule from '@/lib/redis/client';
import { seedDefaultMasterData, DEFAULT_MASTER_DATA_ITEMS } from '@/lib/master-data/seed-defaults';
import { GET as getMasterDataRoute, POST as postMasterDataRoute } from '@/app/api/master-data/route';
import { GET as getItemRoute, PATCH as patchItemRoute, DELETE as deleteItemRoute } from '@/app/api/master-data/[id]/route';
import { NextRequest } from 'next/server';

// 1. Strict production database & environment safety verification
if (process.env.NODE_ENV === 'production' || (process.env.MONGODB_URI && process.env.MONGODB_URI.includes('production'))) {
  throw new Error('FATAL: Attempting to run test suite against a production database!');
}

// 2. Strict Mock of DB connect to guarantee ZERO database connections or writes
vi.mock('@/lib/db/connect', () => ({
  dbConnect: vi.fn().mockResolvedValue(null),
  default: vi.fn().mockResolvedValue(null),
}));

// 3. Mock NextAuth / Session
let mockSession: any = {
  user: {
    id: 'admin-user-id',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'ADMIN',
  },
};

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockImplementation(() => Promise.resolve(mockSession)),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

// 4. Mock AuditService
vi.mock('@/services/audit.service', () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(true),
    logAction: vi.fn().mockResolvedValue(true),
  },
}));

describe('Master Data / Configuration Architecture Test Suite', () => {
  let inMemoryRedis: Map<string, { value: string; ttl: number; expireAt: number }>;

  beforeEach(() => {
    vi.clearAllMocks();
    inMemoryRedis = new Map();

    mockSession = {
      user: {
        id: 'admin-user-id',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'ADMIN',
      },
    };

    // Mock Redis Client with robust scanStream support
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
      set: vi.fn().mockImplementation(async (key: string, value: string, mode?: string, ttl?: number) => {
        const expireAt = ttl ? Date.now() + ttl * 1000 : Infinity;
        inMemoryRedis.set(key, { value, ttl: ttl || 0, expireAt });
        return 'OK';
      }),
      setex: vi.fn().mockImplementation(async (key: string, ttl: number, value: string) => {
        inMemoryRedis.set(key, { value, ttl, expireAt: Date.now() + ttl * 1000 });
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

  describe('1. Model & Schema Constraints', () => {
    it('should validate allowed MasterData types and reject invalid types', () => {
      MASTER_DATA_TYPES.forEach((type) => {
        const item = new MasterData({
          type,
          key: 'test_key',
          label: 'Test Label',
        });
        const err = item.validateSync();
        expect(err?.errors['type']).toBeUndefined();
      });

      const invalidItem = new MasterData({
        type: 'INVALID_TYPE' as any,
        key: 'test_key',
        label: 'Test Label',
      });
      const err = invalidItem.validateSync();
      expect(err?.errors['type']).toBeDefined();
    });

    it('should normalize internal keys to lowercase alphanumeric with underscores', () => {
      expect(MasterDataService.normalizeKey('Hostinger Cloud 123')).toBe('hostinger_cloud_123');
      expect(MasterDataService.normalizeKey('  --Web-Development!!-- ')).toBe('web_development');
      expect(MasterDataService.normalizeKey('UPI (PhonePe / GPay)')).toBe('upi_phonepe_gpay');
    });
  });

  describe('2. MasterDataService Cache-Aside and MongoDB Resiliency', () => {
    it('should fetch from MongoDB and populate Redis cache on cache miss', async () => {
      const mockItems = [
        { _id: new mongoose.Types.ObjectId(), type: 'HOSTING_PROVIDER', key: 'hostinger', label: 'Hostinger', sortOrder: 0, isActive: true },
        { _id: new mongoose.Types.ObjectId(), type: 'HOSTING_PROVIDER', key: 'aws', label: 'AWS', sortOrder: 1, isActive: true },
      ];

      vi.spyOn(MasterData, 'find').mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockItems),
      } as any);

      const items = await MasterDataService.queryItems({ type: 'HOSTING_PROVIDER' });
      expect(items).toHaveLength(2);
      expect(items[0].key).toBe('hostinger');

      // Verify Redis now contains the cached result
      const cacheKey = CacheService.masterDataKey('HOSTING_PROVIDER', 'active');
      const cached = inMemoryRedis.get(cacheKey);
      expect(cached).toBeDefined();
      expect(JSON.parse(cached!.value)).toHaveLength(2);
    });

    it('should serve from Redis on cache hit without querying MongoDB', async () => {
      const cacheKey = CacheService.masterDataKey('HOSTING_PROVIDER', 'active');
      const cachedData = [
        { _id: '123', type: 'HOSTING_PROVIDER', key: 'cached_aws', label: 'Cached AWS', sortOrder: 0, isActive: true },
      ];
      inMemoryRedis.set(cacheKey, { value: JSON.stringify(cachedData), ttl: 3600, expireAt: Date.now() + 3600000 });

      const findSpy = vi.spyOn(MasterData, 'find');
      const items = await MasterDataService.queryItems({ type: 'HOSTING_PROVIDER' });

      expect(findSpy).not.toHaveBeenCalled();
      expect(items[0].key).toBe('cached_aws');
    });

    it('should gracefully query MongoDB if Redis throws an unexpected error', async () => {
      vi.spyOn(redisModule, 'getRedisClient').mockReturnValue(null);

      const mockItems = [
        { _id: new mongoose.Types.ObjectId(), type: 'HOSTING_PROVIDER', key: 'fallback_ovh', label: 'OVHcloud', sortOrder: 0, isActive: true },
      ];

      vi.spyOn(MasterData, 'find').mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockItems),
      } as any);

      const items = await MasterDataService.queryItems({ type: 'HOSTING_PROVIDER' });
      expect(items[0].key).toBe('fallback_ovh');
    });
  });

  describe('3. Parent-Child Validation (SERVICE -> SERVICE_CATEGORY)', () => {
    it('should enforce that a SERVICE must belong to an existing SERVICE_CATEGORY', async () => {
      vi.spyOn(MasterData, 'findOne').mockResolvedValue(null);
      vi.spyOn(MasterData, 'findById').mockResolvedValue(null);

      await expect(
        MasterDataService.createItem({
          type: 'SERVICE',
          key: 'wordpress_dev',
          label: 'WordPress Development',
          parentId: new mongoose.Types.ObjectId().toString(),
        })
      ).rejects.toThrow('Valid parent category of type SERVICE_CATEGORY is required');
    });

    it('should successfully associate a SERVICE with a valid SERVICE_CATEGORY', async () => {
      const categoryId = new mongoose.Types.ObjectId();
      const mockCategory = {
        _id: categoryId,
        type: 'SERVICE_CATEGORY',
        key: 'web_dev',
        label: 'Web Development',
      };

      vi.spyOn(MasterData, 'findById').mockResolvedValue(mockCategory as any);
      vi.spyOn(MasterData, 'findOne').mockResolvedValue(null); // No duplicate key
      vi.spyOn(MasterData, 'create').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        type: 'SERVICE',
        key: 'react_app',
        label: 'React Application',
        parentId: categoryId,
      } as any);

      const item = await MasterDataService.createItem({
        type: 'SERVICE',
        key: 'react_app',
        label: 'React Application',
        parentId: categoryId.toString(),
      });

      expect(item.key).toBe('react_app');
      expect(item.parentId).toEqual(categoryId);
    });
  });

  describe('4. Safe Deactivation and Reference-Safety Deletion', () => {
    it('should block deletion of system default items', async () => {
      const defaultItemId = new mongoose.Types.ObjectId();
      vi.spyOn(MasterData, 'findById').mockResolvedValue({
        _id: defaultItemId,
        type: 'HOSTING_PROVIDER',
        key: 'hostinger',
        label: 'Hostinger',
        isSystemDefault: true,
      } as any);

      await expect(MasterDataService.deleteItem(defaultItemId.toString())).rejects.toThrow(
        /System default master data cannot be deleted/
      );
    });

    it('should block deletion if the master data item is referenced in Hosting records', async () => {
      const itemId = new mongoose.Types.ObjectId();
      vi.spyOn(MasterData, 'findById').mockResolvedValue({
        _id: itemId,
        type: 'HOSTING_PROVIDER',
        key: 'digitalocean',
        label: 'DigitalOcean',
        isSystemDefault: false,
      } as any);

      vi.spyOn(Hosting, 'countDocuments').mockResolvedValue(3);

      await expect(MasterDataService.deleteItem(itemId.toString())).rejects.toThrow(
        /referenced in 3 existing record/
      );
    });

    it('should block deletion if referenced in Project, Credential, or Payment records', async () => {
      const itemId = new mongoose.Types.ObjectId();
      vi.spyOn(MasterData, 'findById').mockResolvedValue({
        _id: itemId,
        type: 'CREDENTIAL_TYPE',
        key: 'ssh',
        label: 'SSH Keys',
        isSystemDefault: false,
      } as any);

      vi.spyOn(Hosting, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(Project, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(Credential, 'countDocuments').mockResolvedValue(5);

      await expect(MasterDataService.deleteItem(itemId.toString())).rejects.toThrow(
        /referenced in 5 existing record/
      );
    });

    it('should block deletion of SERVICE_CATEGORY if child services reference it', async () => {
      const categoryId = new mongoose.Types.ObjectId();
      vi.spyOn(MasterData, 'findById').mockResolvedValue({
        _id: categoryId,
        type: 'SERVICE_CATEGORY',
        key: 'web_dev',
        label: 'Web Development',
        isSystemDefault: false,
      } as any);

      vi.spyOn(Hosting, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(Project, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(Credential, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(Payment, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(TeamPayment, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(MasterData, 'countDocuments').mockResolvedValue(2); // 2 child services

      await expect(MasterDataService.deleteItem(categoryId.toString())).rejects.toThrow(
        /referenced in 2 existing record/
      );
    });

    it('should allow deletion of unreferenced, non-system-default items and invalidate cache', async () => {
      const itemId = new mongoose.Types.ObjectId();
      vi.spyOn(MasterData, 'findById').mockResolvedValue({
        _id: itemId,
        type: 'HOSTING_PROVIDER',
        key: 'obsolete_vps',
        label: 'Obsolete VPS',
        isSystemDefault: false,
      } as any);

      vi.spyOn(Hosting, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(Project, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(Credential, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(Payment, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(TeamPayment, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(MasterData, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(MasterData, 'deleteOne').mockResolvedValue({ deletedCount: 1 } as any);

      const res = await MasterDataService.deleteItem(itemId.toString());
      expect(res.success).toBe(true);
    });
  });

  describe('5. RBAC & Security: Team Member Role vs Designation', () => {
    it('should confirm TEAM_DESIGNATION does not alter system authorization (TeamMember.role)', () => {
      const systemAuthRoles = ['ADMIN', 'DEVELOPER', 'PROJECT_MANAGER', 'DESIGNER', 'CONTENT_WRITER', 'TESTER'];
      const designations = ['Senior Full-Stack Architect', 'Frontend Specialist', 'Lead DevOps Engineer'];

      designations.forEach((d) => {
        const item = new MasterData({
          type: 'TEAM_DESIGNATION',
          key: MasterDataService.normalizeKey(d),
          label: d,
        });
        expect(item.validateSync()).toBeUndefined();
        expect(systemAuthRoles.includes(item.label)).toBe(false);
      });
    });

    it('should reject Master Data modification by non-ADMIN users in API route', async () => {
      const req = new NextRequest('http://localhost:3000/api/master-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'DEVELOPER', // Non-admin actor
        },
        body: JSON.stringify({
          type: 'HOSTING_PROVIDER',
          key: 'new_provider',
          label: 'New Provider',
        }),
      });

      const response = await postMasterDataRoute(req);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });
  });

  describe('6. Idempotent Seeder Verification', () => {
    it('should seed default categories and items when database is empty', async () => {
      vi.spyOn(MasterData, 'findOne').mockResolvedValue(null);
      vi.spyOn(MasterData, 'create').mockImplementation((data: any) =>
        Promise.resolve({ ...data, _id: new mongoose.Types.ObjectId() })
      );

      const result = await seedDefaultMasterData();
      expect(result.created).toBeGreaterThan(15);
      expect(result.updated).toBe(0);
    });

    it('should skip already existing items without modifying existing admin labels', async () => {
      vi.spyOn(MasterData, 'findOne').mockImplementation((query: any) => {
        return Promise.resolve({
          type: query.type,
          key: query.key,
          label: 'Custom Admin Label',
          save: vi.fn().mockResolvedValue(true),
        }) as any;
      });

      const createSpy = vi.spyOn(MasterData, 'create');
      const result = await seedDefaultMasterData();

      expect(createSpy).not.toHaveBeenCalled();
      expect(result.created).toBe(0);
      expect(result.updated).toBe(DEFAULT_MASTER_DATA_ITEMS.length);
    });
  });

  describe('7. API Route Endpoints', () => {
    it('GET /api/master-data should return type-filtered active items', async () => {
      const mockItems = [
        { _id: new mongoose.Types.ObjectId(), type: 'PAYMENT_METHOD', key: 'upi', label: 'UPI', sortOrder: 0, isActive: true },
      ];

      vi.spyOn(MasterData, 'find').mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockItems),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/master-data?type=PAYMENT_METHOD');
      const response = await getMasterDataRoute(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data[0].key).toBe('upi');
    });

    it('PATCH /api/master-data/[id] should allow changing label and active status', async () => {
      const itemId = new mongoose.Types.ObjectId().toString();
      const updatedItem = {
        _id: itemId,
        type: 'HOSTING_PROVIDER',
        key: 'hostinger',
        label: 'Hostinger Global Cloud',
        isActive: false,
      };

      vi.spyOn(MasterDataService, 'updateItem').mockResolvedValue(updatedItem as any);

      const req = new NextRequest(`http://localhost:3000/api/master-data/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: 'Hostinger Global Cloud',
          isActive: false,
        }),
      });

      const response = await patchItemRoute(req, { params: Promise.resolve({ id: itemId }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.label).toBe('Hostinger Global Cloud');
      expect(json.data.isActive).toBe(false);
    });
  });
});
