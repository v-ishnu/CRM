import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import Hosting from '@/models/Hosting';
import Credential from '@/models/Credential';
import Client from '@/models/Client';
import Project from '@/models/Project';
import Task from '@/models/Task';
import TeamMember from '@/models/TeamMember';
import { HostingService } from '@/services/hosting.service';
import { CredentialSharingService } from '@/services/credential-sharing.service';
import { TelegramService } from '@/services/telegram.service';
import { AuditService } from '@/services/audit.service';
import * as Encryption from '@/lib/security/encryption';
import { POST as postWebsiteRoute } from '@/app/api/hosting/[id]/websites/route';
import { PUT as putWebsiteRoute, DELETE as deleteWebsiteRoute } from '@/app/api/hosting/[id]/websites/[websiteId]/route';
import { GET as getWebCredentialsRoute, POST as postWebCredentialsRoute } from '@/app/api/hosting/[id]/websites/[websiteId]/credentials/route';
import { POST as revealWebCredentialRoute } from '@/app/api/hosting/[id]/websites/[websiteId]/credentials/[credentialId]/reveal/route';
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

describe('Multi-Website Hosting Management Test Suite', () => {
  const fakeClientId = new mongoose.Types.ObjectId();
  const fakeProjectId = new mongoose.Types.ObjectId();
  const fakeHostingId = new mongoose.Types.ObjectId();
  const fakeWebsite1Id = new mongoose.Types.ObjectId();
  const fakeWebsite2Id = new mongoose.Types.ObjectId();
  const fakeCred1Id = new mongoose.Types.ObjectId();
  const fakeCred2Id = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(TelegramService, 'sendMessage').mockResolvedValue(undefined as any);
    vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ success: true, messageId: 100 } as any);
  });

  // =========================================================================
  // 1. DOMAIN NORMALIZATION
  // =========================================================================
  describe('Domain Normalization', () => {
    it('1. normalizes https and www prefixes to bare lowercase domain', () => {
      expect(HostingService.normalizeDomain('https://www.example.com')).toBe('example.com');
      expect(HostingService.normalizeDomain('HTTP://WWW.ALLYONOGAMES.COM')).toBe('allyonogames.com');
    });

    it('2. strips URL paths, query strings, hashes, and ports', () => {
      expect(HostingService.normalizeDomain('https://sub.domain.org:8080/path/index.html?ref=1#top')).toBe('sub.domain.org');
      expect(HostingService.normalizeDomain('http://playrummy.com/admin/login')).toBe('playrummy.com');
    });

    it('3. trims whitespace and trailing slashes', () => {
      expect(HostingService.normalizeDomain('   test-site.in/   ')).toBe('test-site.in');
    });

    it('4. throws error for empty or invalid domain input', () => {
      expect(() => HostingService.normalizeDomain('')).toThrow('Domain is required');
      expect(() => HostingService.normalizeDomain('   ')).toThrow('Domain is required');
      expect(() => HostingService.normalizeDomain('invalid domain')).toThrow('Invalid domain format');
    });
  });

  // =========================================================================
  // 2. WEBSITE STATUS DERIVATION
  // =========================================================================
  describe('Website Status Derivation', () => {
    it('5. derives ACTIVE when days remaining > 30', () => {
      const futureDate = new Date();
      futureDate.setUTCDate(futureDate.getUTCDate() + 45);
      expect(HostingService.deriveWebsiteStatus(futureDate)).toBe('ACTIVE');
    });

    it('6. derives EXPIRING_SOON when days remaining <= 30 and > 0', () => {
      const soonDate = new Date();
      soonDate.setUTCDate(soonDate.getUTCDate() + 15);
      expect(HostingService.deriveWebsiteStatus(soonDate)).toBe('EXPIRING_SOON');
    });

    it('7. derives EXPIRED when days remaining <= 0', () => {
      const expiredDate = new Date();
      expiredDate.setUTCDate(expiredDate.getUTCDate() - 2);
      expect(HostingService.deriveWebsiteStatus(expiredDate)).toBe('EXPIRED');
    });

    it('8. preserves SUSPENDED and CANCELLED overrides regardless of expiry date', () => {
      const futureDate = new Date();
      futureDate.setUTCDate(futureDate.getUTCDate() + 100);
      expect(HostingService.deriveWebsiteStatus(futureDate, 'SUSPENDED')).toBe('SUSPENDED');
      expect(HostingService.deriveWebsiteStatus(futureDate, 'CANCELLED')).toBe('CANCELLED');
    });
  });

  // =========================================================================
  // 3. BACKWARD COMPATIBILITY NORMALIZATION
  // =========================================================================
  describe('Backward Compatibility Normalization', () => {
    it('9. returns existing websites array if already populated', () => {
      const mockHosting: any = {
        _id: fakeHostingId,
        websites: [
          { _id: fakeWebsite1Id, domain: 'site1.com', status: 'ACTIVE' },
          { _id: fakeWebsite2Id, domain: 'site2.com', status: 'EXPIRING_SOON' },
        ],
      };
      const websites = HostingService.normalizeWebsites(mockHosting);
      expect(websites).toHaveLength(2);
      expect(websites[0].domain).toBe('site1.com');
      expect(websites[1].domain).toBe('site2.com');
    });

    it('10. synthesizes website entry from legacy hosting top-level domain and expiry', () => {
      const legacyDate = new Date('2026-11-15T00:00:00.000Z');
      const mockLegacyHosting: any = {
        _id: fakeHostingId,
        domain: 'legacy-site.com',
        expiryDate: legacyDate,
        status: 'ACTIVE',
        notes: 'Legacy notes',
        websites: [],
      };
      const websites = HostingService.normalizeWebsites(mockLegacyHosting);
      expect(websites).toHaveLength(1);
      expect(websites[0].domain).toBe('legacy-site.com');
      expect(websites[0].expiryDate).toEqual(legacyDate);
      expect(websites[0].status).toBe('ACTIVE');
      expect(websites[0].notes).toBe('Legacy notes');
    });

    it('11. returns empty array if no websites and no legacy domain', () => {
      const mockEmptyHosting: any = {
        _id: fakeHostingId,
        websites: [],
      };
      expect(HostingService.normalizeWebsites(mockEmptyHosting)).toEqual([]);
    });
  });

  // =========================================================================
  // 4. MULTI-WEBSITE CRUD OPERATIONS
  // =========================================================================
  describe('Website CRUD Operations', () => {
    it('12. addWebsite normalizes domain and adds new website to hosting document', async () => {
      const initialHosting: any = {
        _id: fakeHostingId,
        hostingProvider: 'Hostinger',
        expiryDate: new Date('2027-01-01'),
        websites: [
          {
            _id: fakeWebsite1Id,
            domain: 'existing.com',
            status: 'ACTIVE',
            expiryDate: new Date('2026-11-15'),
            credentialIds: [],
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Hosting, 'findById').mockResolvedValue(initialHosting);

      const addedHosting = await HostingService.addWebsite(fakeHostingId.toString(), {
        domain: 'https://WWW.NEW-WEBSITE.COM/path',
        expiryDate: new Date(Date.now() + 40 * 86400000),
        notes: 'Test site',
      }, 'admin@test.com');

      const added = addedHosting.websites[addedHosting.websites.length - 1];
      expect(added.domain).toBe('new-website.com');
      expect(added.status).toBe('ACTIVE');
      expect(initialHosting.websites).toHaveLength(2);
      expect(initialHosting.save).toHaveBeenCalled();
    });

    it('13. addWebsite rejects duplicate domain on the same hosting account', async () => {
      const initialHosting: any = {
        _id: fakeHostingId,
        websites: [
          {
            _id: fakeWebsite1Id,
            domain: 'duplicate.com',
            status: 'ACTIVE',
            expiryDate: new Date(),
          },
        ],
        save: vi.fn(),
      };

      vi.spyOn(Hosting, 'findById').mockResolvedValue(initialHosting);

      await expect(
        HostingService.addWebsite(fakeHostingId.toString(), {
          domain: 'duplicate.com',
          expiryDate: new Date(),
        }, 'admin@test.com')
      ).rejects.toThrow('Website domain duplicate.com is already registered on this hosting account');
    });

    it('14. updateWebsite modifies website fields independently', async () => {
      const targetWebsiteId = new mongoose.Types.ObjectId();
      const initialHosting: any = {
        _id: fakeHostingId,
        expiryDate: new Date('2027-01-01'),
        websites: [
          {
            _id: targetWebsiteId,
            domain: 'old-name.com',
            status: 'ACTIVE',
            expiryDate: new Date('2026-05-01'),
            notes: 'Old notes',
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Hosting, 'findById').mockResolvedValue(initialHosting);

      const updatedHosting = await HostingService.updateWebsite(
        fakeHostingId.toString(),
        targetWebsiteId.toString(),
        {
          domain: 'https://new-name.com',
          notes: 'Updated notes',
          status: 'SUSPENDED',
        },
        'admin@test.com'
      );

      const updated = updatedHosting.websites.find((w: any) => w._id.toString() === targetWebsiteId.toString())!;
      expect(updated.domain).toBe('new-name.com');
      expect(updated.status).toBe('SUSPENDED');
      expect(updated.notes).toBe('Updated notes');
      expect(initialHosting.save).toHaveBeenCalled();
    });

    it('15. independent expiries: updating website expiry does not change hosting expiry or other websites', async () => {
      const hostingExpiry = new Date('2028-12-31');
      const site1Expiry = new Date('2026-06-01');
      const site2OriginalExpiry = new Date('2026-08-01');
      const site2NewExpiry = new Date('2027-04-15');

      const initialHosting: any = {
        _id: fakeHostingId,
        expiryDate: hostingExpiry,
        websites: [
          {
            _id: fakeWebsite1Id,
            domain: 'site1.com',
            expiryDate: site1Expiry,
            status: 'ACTIVE',
          },
          {
            _id: fakeWebsite2Id,
            domain: 'site2.com',
            expiryDate: site2OriginalExpiry,
            status: 'ACTIVE',
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Hosting, 'findById').mockResolvedValue(initialHosting);

      await HostingService.updateWebsite(
        fakeHostingId.toString(),
        fakeWebsite2Id.toString(),
        { expiryDate: site2NewExpiry },
        'admin@test.com'
      );

      // Verify hosting account expiry is untouched
      expect(initialHosting.expiryDate).toEqual(hostingExpiry);
      // Verify site 1 expiry is untouched
      expect(initialHosting.websites[0].expiryDate).toEqual(site1Expiry);
      // Verify site 2 expiry is updated
      expect(initialHosting.websites[1].expiryDate).toEqual(site2NewExpiry);
    });

    it('16. deleteWebsite removes website and cascades credential cleanup on hard delete', async () => {
      const credId = new mongoose.Types.ObjectId();
      const initialHosting: any = {
        _id: fakeHostingId,
        websites: [
          {
            _id: fakeWebsite1Id,
            domain: 'site-to-delete.com',
            credentialIds: [credId],
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Hosting, 'findById').mockResolvedValue(initialHosting);
      vi.spyOn(Credential, 'deleteMany').mockResolvedValue({ deletedCount: 1 } as any);

      await HostingService.deleteWebsite(
        fakeHostingId.toString(),
        fakeWebsite1Id.toString(),
        'admin@test.com',
        false // hard delete
      );

      expect(initialHosting.websites).toHaveLength(0);
      expect(Credential.deleteMany).toHaveBeenCalledWith({ _id: { $in: [credId] } });
      expect(initialHosting.save).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. WEBSITE CREDENTIAL ISOLATION & AUDITING
  // =========================================================================
  describe('Website Credential Isolation & Management', () => {
    it('17. addWebsiteCredential tags credential with hostingId and websiteId', async () => {
      const mockHosting: any = {
        _id: fakeHostingId,
        clientId: fakeClientId,
        projectId: fakeProjectId,
        websites: [
          {
            _id: fakeWebsite1Id,
            domain: 'isolated-site.com',
            credentialIds: [],
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Hosting, 'findById').mockResolvedValue(mockHosting);

      const createdCred: any = {
        _id: fakeCred1Id,
        service: 'encryptedService',
        username: 'encryptedUser',
        password: 'encryptedPassword',
        type: 'HOSTING',
        hostingId: fakeHostingId,
        websiteId: fakeWebsite1Id,
      };

      vi.spyOn(Credential, 'create').mockResolvedValue(createdCred as any);

      const res = await HostingService.addWebsiteCredential(
        fakeHostingId.toString(),
        fakeWebsite1Id.toString(),
        {
          service: 'WP Admin - isolated-site.com',
          username: 'wpadmin',
          password: 'SecretPassword123!',
          loginUrl: 'https://isolated-site.com/wp-admin',
        },
        'admin@crm.com'
      );

      expect(Credential.create).toHaveBeenCalled();
      expect(mockHosting.websites[0].credentialIds).toContainEqual(fakeCred1Id);
      expect(mockHosting.save).toHaveBeenCalled();
      expect(AuditService.logAction).toHaveBeenCalledWith(
        'admin@crm.com',
        'CREDENTIAL_CREATED',
        'Credential',
        fakeCred1Id,
        expect.any(Object)
      );
    });

    it('18. getWebsiteCredentials isolates credentials and masks passwords by default', async () => {
      vi.spyOn(Hosting, 'findById').mockResolvedValue({
        _id: fakeHostingId,
        websites: [
          {
            _id: fakeWebsite1Id,
            domain: 'isolated-site.com',
            credentialIds: [fakeCred1Id],
          },
        ],
      } as any);

      const mockCred1: any = {
        _id: fakeCred1Id,
        service: 'encryptedService',
        username: 'encryptedUser',
        password: 'encryptedPassword',
        hostingId: fakeHostingId,
        websiteId: fakeWebsite1Id,
        isRevoked: false,
      };

      vi.spyOn(Credential, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockCred1]),
      } as any);

      vi.spyOn(Encryption, 'decrypt').mockImplementation((val: any) => {
        if (val === 'encryptedService') return 'Site 1 Admin';
        if (val === 'encryptedUser') return 'admin1';
        return 'SecretPass123';
      });

      const list = await HostingService.getWebsiteCredentials(
        fakeHostingId.toString(),
        fakeWebsite1Id.toString(),
        'admin@crm.com',
        false // mask password
      );

      expect(list).toHaveLength(1);
      expect(list[0].service).toBe('Site 1 Admin');
      expect(list[0].passwordMasked).toBe('••••••••••••');
      expect(list[0].password).toBeUndefined();
    });

    it('19. shareTaskCredentials excludes website-specific credentials from generic project task queries', async () => {
      const mockTaskId = new mongoose.Types.ObjectId();
      const mockAssignedToId = new mongoose.Types.ObjectId();
      const mockProjectTask: any = {
        _id: mockTaskId,
        taskId: 'TSK-0001',
        projectId: fakeProjectId,
        assignedTo: mockAssignedToId,
        requiredCredentialIds: [],
        credentialAccessRevoked: false,
      };

      const mockProject: any = {
        _id: fakeProjectId,
        name: 'Test Project',
        teamMemberIds: [mockAssignedToId],
      };

      const mockTeamMember: any = {
        _id: mockAssignedToId,
        name: 'John Developer',
        status: 'ACTIVE',
        telegramConnected: true,
        telegramChatId: '987654321',
        permissions: ['VIEW_CREDENTIALS'],
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockProjectTask);
      vi.spyOn(Project, 'findById').mockResolvedValue(mockProject);
      vi.spyOn(TeamMember, 'findById').mockResolvedValue(mockTeamMember);

      const findSpy = vi.spyOn(Credential, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      } as any);

      await CredentialSharingService.shareTaskCredentials(mockTaskId.toString()).catch(() => {});

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            expect.objectContaining({
              projectId: fakeProjectId,
              websiteId: { $in: [null, undefined] },
            }),
          ]),
        })
      );
    });
  });

  // =========================================================================
  // 6. MULTI-THRESHOLD EXPIRY NOTIFICATIONS (HOSTING VS WEBSITE)
  // =========================================================================
  describe('Multi-Threshold Expiry Notifications', () => {
    it('20. checks and dispatches independent notifications for website expiry vs hosting expiry', async () => {
      const now = new Date();
      // Hosting expires in 100 days (no alert)
      const hostingExpiry = new Date(now.getTime() + 100 * 86400000);
      // Website expires in exactly 7 days (matches threshold 7)
      const siteExpiry = new Date(now.getTime() + 7 * 86400000);

      const mockHosting: any = {
        _id: fakeHostingId,
        clientId: {
          _id: fakeClientId,
          name: 'John Doe',
          telegramUserId: '123456789',
          telegramConnected: true,
        },
        hostingProvider: 'Hostinger',
        domain: 'account-domain.com',
        expiryDate: hostingExpiry,
        status: 'ACTIVE',
        notificationsSent: new Map(),
        websites: [
          {
            _id: fakeWebsite1Id,
            domain: 'expiring-site.com',
            expiryDate: siteExpiry,
            status: 'EXPIRING_SOON',
            notificationsSent: new Map(),
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Hosting, 'find').mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue([mockHosting]),
        }),
      } as any);

      const summary = await HostingService.checkAndDispatchExpiryNotifications();

      expect(summary.notificationsSent).toBe(1);
      expect(summary.results[0].domain).toContain('expiring-site.com');
      expect(mockHosting.save).toHaveBeenCalled();
      expect(TelegramService.sendMessageRaw).toHaveBeenCalledWith(
        '123456789',
        expect.stringContaining('Domain Expiry Reminder')
      );
      expect(TelegramService.sendMessageRaw).toHaveBeenCalledWith(
        '123456789',
        expect.stringContaining('expiring-site.com')
      );
    });

    it('21. prevents duplicate notifications if website threshold was already sent', async () => {
      const now = new Date();
      const siteExpiry = new Date(now.getTime() + 7 * 86400000);

      const websiteSentMap = new Map();
      websiteSentMap.set('7', new Date());

      const mockHosting: any = {
        _id: fakeHostingId,
        clientId: {
          _id: fakeClientId,
          telegramUserId: '123456789',
          telegramConnected: true,
        },
        hostingProvider: 'Hostinger',
        expiryDate: new Date(now.getTime() + 100 * 86400000),
        status: 'ACTIVE',
        notificationsSent: new Map(),
        websites: [
          {
            _id: fakeWebsite1Id,
            domain: 'already-notified.com',
            expiryDate: siteExpiry,
            status: 'EXPIRING_SOON',
            notificationsSent: websiteSentMap, // already sent for threshold 7
          },
        ],
        save: vi.fn(),
      };

      vi.spyOn(Hosting, 'find').mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue([mockHosting]),
        }),
      } as any);

      const summary = await HostingService.checkAndDispatchExpiryNotifications();

      expect(summary.notificationsSent).toBe(0);
      expect(TelegramService.sendMessageRaw).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 7. TELEGRAM /hosting COMMAND OUTPUT
  // =========================================================================
  describe('Telegram /hosting Command Output', () => {
    it('22. lists hosting account and child websites with independent expiries and status', async () => {
      const mockHostings: any = [
        {
          _id: fakeHostingId,
          hostingProvider: 'Hostinger',
          hostingType: 'Business Cloud',
          domain: 'hostinger-main.com',
          expiryDate: new Date('2027-01-01'),
          status: 'ACTIVE',
          websites: [
            {
              domain: 'allyonogames.com',
              expiryDate: new Date('2026-11-15'),
              status: 'ACTIVE',
            },
            {
              domain: 'playrummy.com',
              expiryDate: new Date('2027-02-20'),
              status: 'ACTIVE',
            },
          ],
        },
      ];

      vi.spyOn(Hosting, 'find').mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockHostings),
          }),
        }),
      } as any);

      const fakeClient: any = {
        _id: fakeClientId,
        name: 'Client A',
        telegramChatId: '12345',
      };

      await (TelegramService as any).handleClientCommand('12345', fakeClient, '/hosting');

      expect(TelegramService.sendMessageRaw).toHaveBeenCalledWith(
        '12345',
        expect.stringContaining('allyonogames.com'),
        expect.any(Object)
      );
      expect(TelegramService.sendMessageRaw).toHaveBeenCalledWith(
        '12345',
        expect.stringContaining('playrummy.com'),
        expect.any(Object)
      );
      expect(TelegramService.sendMessageRaw).toHaveBeenCalledWith(
        '12345',
        expect.stringContaining('Note: For security reasons, server passwords and keys are not shared over Telegram'),
        expect.any(Object)
      );
    });
  });

  // =========================================================================
  // 8. DRY-RUN RECONCILIATION / MIGRATION
  // =========================================================================
  describe('Reconciliation & Migration', () => {
    it('23. reconcileHostingWebsites in dryRun mode identifies legacy records without DB mutation', async () => {
      const mockLegacy: any = {
        _id: fakeHostingId,
        hostingProvider: 'Namecheap',
        domain: 'legacy-domain.com',
        expiryDate: new Date('2026-12-01'),
        status: 'ACTIVE',
        websites: [],
        save: vi.fn(),
      };

      vi.spyOn(Hosting, 'find').mockResolvedValue([mockLegacy]);

      const report = await HostingService.reconcileHostingWebsites({ dryRun: true });

      expect(report.totalRecords).toBe(1);
      expect(report.requiringTransformation).toBe(1);
      expect(report.alreadyCompatible).toBe(0);
      expect(report.details[0].action).toBe('NEEDS_MIGRATION');
      expect(mockLegacy.save).not.toHaveBeenCalled();
    });

    it('24. reconcileHostingWebsites in execute mode migrates legacy record to websites array', async () => {
      const mockLegacy: any = {
        _id: fakeHostingId,
        hostingProvider: 'Namecheap',
        domain: 'legacy-to-migrate.com',
        expiryDate: new Date('2026-12-01'),
        status: 'ACTIVE',
        notes: 'Legacy notes',
        websites: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Hosting, 'find').mockResolvedValue([mockLegacy]);

      const report = await HostingService.reconcileHostingWebsites({ dryRun: false });

      expect(report.requiringTransformation).toBe(1);
      expect(mockLegacy.websites).toHaveLength(1);
      expect(mockLegacy.websites[0].domain).toBe('legacy-to-migrate.com');
      expect(mockLegacy.save).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 9. API ROUTES & SECURITY
  // =========================================================================
  describe('API Routes & Security', () => {
    it('25. POST /api/hosting/[id]/websites validates and creates website', async () => {
      const mockHosting: any = {
        _id: fakeHostingId,
        websites: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Hosting, 'findById').mockResolvedValue(mockHosting);

      const req = new NextRequest(`http://localhost:3000/api/hosting/${fakeHostingId}/websites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: 'https://new-api-site.com',
          expiryDate: new Date('2027-01-01').toISOString(),
          notes: 'Added via API',
        }),
      });

      const res = await postWebsiteRoute(req, { params: Promise.resolve({ id: fakeHostingId.toString() }) });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.domain).toBe('new-api-site.com');
    });

    it('26. reveal website credential requires admin and logs audit entry', async () => {
      const mockCred: any = {
        _id: fakeCred1Id,
        title: 'WP Admin',
        hostingId: fakeHostingId,
        websiteId: fakeWebsite1Id,
        service: 'encryptedService',
        username: 'encryptedUser',
        password: 'encryptedPassword',
        isRevoked: false,
      };

      vi.spyOn(Credential, 'findById').mockResolvedValue(mockCred);
      vi.spyOn(Encryption, 'decrypt').mockReturnValue('PlainDecryptedPass123!');

      const req = new NextRequest(
        `http://localhost:3000/api/hosting/${fakeHostingId}/websites/${fakeWebsite1Id}/credentials/${fakeCred1Id}/reveal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': 'admin@crm.com',
            'x-user-role': 'ADMIN',
          },
          body: JSON.stringify({}),
        }
      );

      const res = await revealWebCredentialRoute(req, {
        params: Promise.resolve({
          id: fakeHostingId.toString(),
          websiteId: fakeWebsite1Id.toString(),
          credentialId: fakeCred1Id.toString(),
        }),
      });

      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.password).toBe('PlainDecryptedPass123!');
      expect(AuditService.logAction).toHaveBeenCalledWith(
        'admin@crm.com',
        'WEBSITE_CREDENTIAL_REVEALED',
        'Credential',
        fakeCred1Id,
        expect.any(Object)
      );
    });

    it('27. IDOR Protection: reveals/actions with mismatched hosting ID return 404', async () => {
      // Credential belongs to fakeHostingId, but caller sends a different hosting ID
      const differentHostingId = new mongoose.Types.ObjectId();
      const mockCred: any = {
        _id: fakeCred1Id,
        hostingId: fakeHostingId,
        websiteId: fakeWebsite1Id,
        isRevoked: false,
      };

      vi.spyOn(Credential, 'findById').mockResolvedValue(mockCred);

      const req = new NextRequest(
        `http://localhost:3000/api/hosting/${differentHostingId}/websites/${fakeWebsite1Id}/credentials/${fakeCred1Id}/reveal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': 'admin@crm.com',
            'x-user-role': 'ADMIN',
          },
          body: JSON.stringify({}),
        }
      );

      const res = await revealWebCredentialRoute(req, {
        params: Promise.resolve({
          id: differentHostingId.toString(),
          websiteId: fakeWebsite1Id.toString(),
          credentialId: fakeCred1Id.toString(),
        }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('28. createHosting creates hosting account without domain and initializes with 0 websites', async () => {
      const mockClient: any = { _id: fakeClientId, name: 'Client Test' };
      vi.spyOn(Client, 'findById').mockResolvedValue(mockClient);

      const createdHostingMock: any = {
        _id: fakeHostingId,
        clientId: fakeClientId,
        hostingProvider: 'Hostinger',
        hostingType: 'Business',
        domain: '',
        expiryDate: new Date('2027-12-30T00:00:00.000Z'),
        status: 'ACTIVE',
        websites: [],
      };

      vi.spyOn(Hosting, 'create').mockResolvedValue(createdHostingMock as any);

      const hosting = await HostingService.createHosting(
        {
          clientId: fakeClientId.toString(),
          hostingProvider: 'Hostinger',
          hostingType: 'Business',
          expiryDate: new Date('2027-12-30T00:00:00.000Z'),
          password: 'HostingAdminPassword123!',
        },
        'admin@crm.com'
      );

      expect(Hosting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hostingProvider: 'Hostinger',
          hostingType: 'Business',
          domain: '',
          websites: [],
        })
      );
      expect(hosting.websites).toHaveLength(0);
      expect(hosting.domain).toBe('');
    });
  });
});
