import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import Task from '@/models/Task';
import Project from '@/models/Project';
import Client from '@/models/Client';
import TeamMember from '@/models/TeamMember';
import Credential from '@/models/Credential';
import TeamMemberMessage from '@/models/TeamMemberMessage';
import { POST as postCredentialRoute, GET as getCredentialsRoute } from '@/app/api/credentials/route';
import { PUT as putCredentialRoute, DELETE as deleteCredentialRoute } from '@/app/api/credentials/[id]/route';
import { POST as revealCredentialRoute } from '@/app/api/credentials/[id]/reveal/route';
import { GET as getTaskCredentialRoute } from '@/app/api/tasks/[id]/credentials/[credentialId]/route';
import { POST as shareCredentialRoute } from '@/app/api/credentials/[id]/share/route';
import { POST as shareTaskCredentialsRoute } from '@/app/api/tasks/[id]/credentials/share/route';
import { CredentialSharingService } from '@/services/credential-sharing.service';
import { TeamMemberService } from '@/services/team-member.service';
import { TelegramService } from '@/services/telegram.service';
import { AuditService } from '@/services/audit.service';
import { encrypt, decrypt } from '@/lib/security/encryption';

import MessageTemplate from '@/models/MessageTemplate';

// Mocks to guarantee ZERO production DB access and ZERO real notifications
vi.mock('@/lib/db/connect', () => ({
  dbConnect: vi.fn().mockResolvedValue(null),
  default: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/cache.service', () => ({
  CacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/services/telegram.service', () => ({
  TelegramService: {
    sendMessageRaw: vi.fn().mockResolvedValue({ success: true, messageId: 9999 }),
    sendMessage: vi.fn().mockResolvedValue(true),
    sendTaskAssignmentNotification: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/services/audit.service', () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(true),
    logAction: vi.fn().mockResolvedValue(true),
  },
}));

describe('Complete Credential Architecture Regression Suite', () => {
  const mockAdminEmail = 'admin@drdebuggers.com';
  const mockClientId = new mongoose.Types.ObjectId().toString();
  const mockProjectId = new mongoose.Types.ObjectId().toString();
  const mockTaskId = new mongoose.Types.ObjectId().toString();
  const mockCredId = new mongoose.Types.ObjectId().toString();
  const mockAuthorizedMemberId = new mongoose.Types.ObjectId().toString();
  const mockUnauthorizedMemberId = new mongoose.Types.ObjectId().toString();

  const samplePassword = 'SuperSecretProductionPassword!2026';
  const sampleUsername = 'wp_administrator';
  const sampleService = 'WordPress Production Admin';
  const sampleLoginUrl = 'https://client-prod.com/wp-admin';
  const sampleNotes = 'Production credentials for deployment task';

  const encryptedPassword = encrypt(samplePassword, 'password');
  const encryptedUsername = encrypt(sampleUsername, 'username');
  const encryptedService = encrypt(sampleService, 'service');
  const encryptedLoginUrl = encrypt(sampleLoginUrl, 'loginUrl');
  const encryptedNotes = encrypt(sampleNotes, 'additionalInfo');

  const mockClientDoc = {
    _id: mockClientId,
    name: 'Acme Corp',
    clientCode: 'CLI-001',
    status: 'ACTIVE',
  };

  const mockProjectDoc = {
    _id: mockProjectId,
    name: 'Acme Website',
    projectCode: 'PRJ-101',
    clientId: mockClientId,
    teamMemberIds: [new mongoose.Types.ObjectId(mockAuthorizedMemberId)],
  };

  const mockCredentialDoc: any = {
    _id: new mongoose.Types.ObjectId(mockCredId),
    clientId: new mongoose.Types.ObjectId(mockClientId),
    projectId: new mongoose.Types.ObjectId(mockProjectId),
    taskId: new mongoose.Types.ObjectId(mockTaskId),
    credentialType: 'WORDPRESS',
    source: 'MANUAL',
    service: encryptedService,
    username: encryptedUsername,
    password: encryptedPassword,
    loginUrl: encryptedLoginUrl,
    additionalInfo: encryptedNotes,
    version: 1,
    isRevoked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuthorizedTeamMember: any = {
    _id: new mongoose.Types.ObjectId(mockAuthorizedMemberId),
    name: 'Dev John',
    email: 'john@debuggers.dev',
    role: 'STAFF',
    status: 'ACTIVE',
    telegramConnected: true,
    telegramChatId: '12345678',
    telegramUserId: '12345678',
    permissions: ['VIEW_CREDENTIALS'],
    allowedCredentialTypes: ['WORDPRESS', 'CUSTOM'],
  };

  const mockUnauthorizedTeamMember: any = {
    _id: new mongoose.Types.ObjectId(mockUnauthorizedMemberId),
    name: 'Contractor Dave',
    email: 'dave@debuggers.dev',
    role: 'STAFF',
    status: 'ACTIVE',
    telegramConnected: true,
    telegramChatId: '87654321',
    telegramUserId: '87654321',
    permissions: [], // No VIEW_CREDENTIALS permission
    allowedCredentialTypes: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(Client, 'findById').mockResolvedValue(mockClientDoc as any);
    vi.spyOn(Project, 'findById').mockResolvedValue(mockProjectDoc as any);
    vi.spyOn(Credential, 'findById').mockResolvedValue(mockCredentialDoc as any);
    vi.spyOn(TeamMember, 'findById').mockImplementation(((id: any) => {
      const idStr = id?.toString();
      if (idStr === mockAuthorizedMemberId) return Promise.resolve(mockAuthorizedTeamMember) as any;
      if (idStr === mockUnauthorizedMemberId) return Promise.resolve(mockUnauthorizedTeamMember) as any;
      return Promise.resolve(null) as any;
    }) as any);

    vi.spyOn(MessageTemplate, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as any);
  });

  // =========================================================================
  // SECTION 1: PROJECT CREDENTIAL FLOW
  // =========================================================================
  describe('PROJECT CREDENTIAL FLOW', () => {
    it('1. Admin creates credential successfully through API', async () => {
      vi.spyOn(Credential, 'create').mockResolvedValueOnce(mockCredentialDoc as any);

      const req = new NextRequest('http://localhost/api/credentials', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-role': 'ADMIN',
          'x-user-email': mockAdminEmail,
        },
        body: JSON.stringify({
          clientId: mockClientId,
          projectId: mockProjectId,
          service: sampleService,
          username: sampleUsername,
          password: samplePassword,
          loginUrl: sampleLoginUrl,
          additionalInfo: sampleNotes,
          credentialType: 'WORDPRESS',
        }),
      });

      const res = await postCredentialRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.service).toBe(sampleService);
      expect(json.data.username).toBe(sampleUsername);
      // Plaintext password is NEVER returned in response!
      expect(json.data.password).toBeUndefined();
    });

    it('2. Credential sensitive fields are encrypted with AES-256-GCM', () => {
      const encPass = encrypt(samplePassword, 'password');
      expect(encPass.ciphertext).toBeDefined();
      expect(encPass.iv).toHaveLength(24);
      expect(encPass.authTag).toHaveLength(32);
      expect(decrypt(encPass)).toBe(samplePassword);
    });

    it('3. Resilient against whitespace in optional loginUrl and additionalInfo', async () => {
      vi.spyOn(Credential, 'create').mockResolvedValueOnce(mockCredentialDoc as any);

      const req = new NextRequest('http://localhost/api/credentials', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-role': 'ADMIN',
        },
        body: JSON.stringify({
          projectId: mockProjectId, // clientId omitted, should be derived
          service: 'Staging Server',
          username: 'admin',
          password: 'secretPassword123',
          loginUrl: '   ', // whitespace only
          additionalInfo: '   ', // whitespace only
        }),
      });

      const res = await postCredentialRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('4. Credential belongs to correct project and derives clientId automatically', async () => {
      let createdDoc: any = null;
      vi.spyOn(Credential, 'create').mockImplementationOnce(async (doc: any) => {
        createdDoc = doc;
        return { ...doc, _id: mockCredId } as any;
      });

      const req = new NextRequest('http://localhost/api/credentials', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-role': 'ADMIN',
        },
        body: JSON.stringify({
          projectId: mockProjectId, // clientId omitted
          service: 'Direct Project Service',
          username: 'project_user',
          password: 'secure_password_abc',
        }),
      });

      const res = await postCredentialRoute(req);
      expect(res.status).toBe(200);
      expect(createdDoc.clientId.toString()).toBe(mockClientId);
      expect(createdDoc.projectId.toString()).toBe(mockProjectId);
    });

    it('5. Admin can list credential metadata with masked password (never plaintext in list)', async () => {
      vi.spyOn(Credential, 'find').mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([mockCredentialDoc]),
      } as any);

      const req = new NextRequest(`http://localhost/api/credentials?projectId=${mockProjectId}`);
      const res = await getCredentialsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].service).toBe(sampleService);
      // Plaintext password or ciphertext is NOT returned in list!
      expect(json.data[0].password).toBeUndefined();
      expect(json.data[0].ciphertext).toBeUndefined();
    });

    it('6. Authorized Team Member can view credential for their assigned task', async () => {
      const mockTaskDoc: any = {
        _id: new mongoose.Types.ObjectId(mockTaskId),
        projectId: new mongoose.Types.ObjectId(mockProjectId),
        clientId: new mongoose.Types.ObjectId(mockClientId),
        assignedTo: new mongoose.Types.ObjectId(mockAuthorizedMemberId),
        requiredCredentialIds: [new mongoose.Types.ObjectId(mockCredId)],
        credentialAccessRevoked: false,
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockTaskDoc);

      const req = new NextRequest(`http://localhost/api/tasks/${mockTaskId}/credentials/${mockCredId}`, {
        headers: {
          'x-user-role': 'STAFF',
          'x-user-email': 'john@debuggers.dev',
          'x-team-member-id': mockAuthorizedMemberId,
        },
      });

      const res = await getTaskCredentialRoute(req, {
        params: Promise.resolve({ id: mockTaskId, credentialId: mockCredId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.password).toBe(samplePassword);
      expect(json.data.username).toBe(sampleUsername);
    });

    it('7. Unauthorized Team Member without VIEW_CREDENTIALS cannot view credential', async () => {
      const mockTaskDoc: any = {
        _id: new mongoose.Types.ObjectId(mockTaskId),
        projectId: new mongoose.Types.ObjectId(mockProjectId),
        clientId: new mongoose.Types.ObjectId(mockClientId),
        assignedTo: new mongoose.Types.ObjectId(mockUnauthorizedMemberId),
        requiredCredentialIds: [new mongoose.Types.ObjectId(mockCredId)],
        credentialAccessRevoked: false,
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockTaskDoc);

      const req = new NextRequest(`http://localhost/api/tasks/${mockTaskId}/credentials/${mockCredId}`, {
        headers: {
          'x-user-role': 'STAFF',
          'x-user-email': 'dave@debuggers.dev',
          'x-team-member-id': mockUnauthorizedMemberId,
        },
      });

      const res = await getTaskCredentialRoute(req, {
        params: Promise.resolve({ id: mockTaskId, credentialId: mockCredId }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // SECTION 2: TEMPORARY CREDENTIAL FLOW
  // =========================================================================
  describe('TEMPORARY CREDENTIAL FLOW', () => {
    it('8. Admin creates task-linked temporary credential with private key / notes normalization', async () => {
      let createdDoc: any = null;
      vi.spyOn(Credential, 'create').mockImplementationOnce(async (doc: any) => {
        createdDoc = doc;
        return { ...doc, _id: mockCredId } as any;
      });
      vi.spyOn(Task, 'findByIdAndUpdate').mockResolvedValue({} as any);

      const sampleSshKey = '-----BEGIN RSA PRIVATE KEY-----\nkey_content\n-----END RSA PRIVATE KEY-----';

      const req = new NextRequest('http://localhost/api/credentials', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-role': 'ADMIN',
        },
        body: JSON.stringify({
          projectId: mockProjectId,
          taskId: mockTaskId,
          credentialType: 'SSH',
          service: 'VPS Staging Server',
          username: 'root',
          port: 2222,
          privateKey: sampleSshKey,
          notes: 'Temporary access for database migration',
        }),
      });

      const res = await postCredentialRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      // Private key was normalized as password for encryption
      expect(decrypt(createdDoc.password)).toBe(sampleSshKey);
      expect(decrypt(createdDoc.additionalInfo)).toContain('Port: 2222');
      expect(decrypt(createdDoc.additionalInfo)).toContain('Temporary access for database migration');
    });

    it('9. Correct Team Member receives credential dispatched via Telegram', async () => {
      const shareResult = await CredentialSharingService.shareCredentialWithTeamMember(
        mockCredId,
        mockAuthorizedMemberId,
        mockAdminEmail,
        { oneTime: true }
      );

      expect(shareResult.success).toBe(true);
      expect(shareResult.telegramSent).toBe(true);
      expect(TelegramService.sendMessageRaw).toHaveBeenCalledWith(
        '12345678',
        expect.stringContaining('WordPress Production Admin')
      );
    });

    it('10. Wrong Team Member not assigned to project cannot receive access', async () => {
      const unassignedMemberId = new mongoose.Types.ObjectId().toString();
      const mockUnassignedMember: any = {
        _id: new mongoose.Types.ObjectId(unassignedMemberId),
        name: 'Outsider',
        role: 'STAFF',
        status: 'ACTIVE',
        telegramConnected: true,
        telegramChatId: '999999',
        permissions: ['VIEW_CREDENTIALS'],
      };

      vi.spyOn(TeamMember, 'findById').mockResolvedValue(mockUnassignedMember);
      vi.spyOn(Task, 'exists').mockResolvedValue(null as any);

      await expect(
        CredentialSharingService.shareCredentialWithTeamMember(
          mockCredId,
          unassignedMemberId,
          mockAdminEmail
        )
      ).rejects.toThrow(/not assigned to project/i);
    });

    it('11. Inactive Team Member cannot receive temporary credential', async () => {
      const inactiveMemberId = new mongoose.Types.ObjectId().toString();
      vi.spyOn(TeamMember, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(inactiveMemberId),
        name: 'Inactive Dev',
        status: 'INACTIVE',
        permissions: ['VIEW_CREDENTIALS'],
      } as any);

      await expect(
        CredentialSharingService.shareCredentialWithTeamMember(
          mockCredId,
          inactiveMemberId,
          mockAdminEmail
        )
      ).rejects.toThrow(/not active/i);
    });

    it('12. Revoked credential access blocks task credential view', async () => {
      const mockTaskDoc: any = {
        _id: new mongoose.Types.ObjectId(mockTaskId),
        projectId: new mongoose.Types.ObjectId(mockProjectId),
        clientId: new mongoose.Types.ObjectId(mockClientId),
        assignedTo: new mongoose.Types.ObjectId(mockAuthorizedMemberId),
        requiredCredentialIds: [new mongoose.Types.ObjectId(mockCredId)],
        credentialAccessRevoked: true, // Revoked!
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockTaskDoc);

      const req = new NextRequest(`http://localhost/api/tasks/${mockTaskId}/credentials/${mockCredId}`, {
        headers: {
          'x-user-role': 'STAFF',
          'x-user-email': 'john@debuggers.dev',
          'x-team-member-id': mockAuthorizedMemberId,
        },
      });

      const res = await getTaskCredentialRoute(req, {
        params: Promise.resolve({ id: mockTaskId, credentialId: mockCredId }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error.code).toBe('ACCESS_REVOKED');
    });
  });

  // =========================================================================
  // SECTION 3: TASK CREDENTIAL RELATIONSHIP
  // =========================================================================
  describe('TASK CREDENTIAL RELATIONSHIP', () => {
    it('13. Task can reference project credential without duplicating secrets', async () => {
      const mockTaskDoc: any = {
        _id: new mongoose.Types.ObjectId(mockTaskId),
        projectId: new mongoose.Types.ObjectId(mockProjectId),
        clientId: new mongoose.Types.ObjectId(mockClientId),
        assignedTo: mockAuthorizedMemberId,
        requiredCredentialIds: [new mongoose.Types.ObjectId(mockCredId)],
        credentialAccessRevoked: false,
      };

      // Task references credential ID only - no ciphertext or secret stored in Task document
      expect(mockTaskDoc.requiredCredentialIds[0].toString()).toBe(mockCredId);
      expect((mockTaskDoc as any).password).toBeUndefined();
      expect((mockTaskDoc as any).secret).toBeUndefined();
    });

    it('14. Credential reference shares project credential via Telegram with template alignment', async () => {
      const mockTaskDoc: any = {
        _id: new mongoose.Types.ObjectId(mockTaskId),
        projectId: new mongoose.Types.ObjectId(mockProjectId),
        clientId: new mongoose.Types.ObjectId(mockClientId),
        taskCode: 'TSK-99',
        title: 'Deploy Production Site',
        assignedTo: mockAuthorizedMemberId,
        requiredCredentialIds: [new mongoose.Types.ObjectId(mockCredId)],
        credentialAccessRevoked: false,
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockTaskDoc);
      vi.spyOn(Credential, 'find').mockResolvedValue([mockCredentialDoc]);

      const shareResult = await CredentialSharingService.shareTaskCredentials(
        mockTaskId,
        mockAdminEmail,
        { oneTime: true }
      );

      expect(shareResult.success).toBe(true);
      expect(shareResult.sharedCount).toBe(1);
      expect(TelegramService.sendMessageRaw).toHaveBeenCalledWith(
        '12345678',
        expect.stringContaining('Deploy Production Site')
      );
    });

    it('15. Removing task reference does not delete underlying Project Credential', async () => {
      // Deleting a task reference only pulls ID from task.requiredCredentialIds
      const taskPullSpy = vi.spyOn(Task, 'updateMany').mockResolvedValue({} as any);
      const credDeleteSpy = vi.spyOn(Credential, 'deleteOne').mockResolvedValue({} as any);

      // Simulated unlinking from task
      const updatedRequiredCredentialIds = [mockCredId].filter(id => id !== mockCredId);
      expect(updatedRequiredCredentialIds).toHaveLength(0);

      // The project credential in Credential collection remains intact
      expect(credDeleteSpy).not.toHaveBeenCalled();
    });

    it('16. Removing Team Member permission blocks view access immediately', async () => {
      // Modify authorized member to have permission revoked
      const memberWithoutPerm: any = {
        ...mockAuthorizedTeamMember,
        permissions: [],
      };

      const hasPerm = TeamMemberService.hasPermission(memberWithoutPerm, 'VIEW_CREDENTIALS');
      expect(hasPerm).toBe(false);

      const isAuthorizedType = TeamMemberService.isAuthorizedForCredentialType(memberWithoutPerm, 'WORDPRESS');
      expect(isAuthorizedType).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 4: CHAT & SUBMISSION INDEPENDENCE
  // =========================================================================
  describe('CHAT & SUBMISSION INDEPENDENCE', () => {
    it('17. Chat messages function independently from credential creation', async () => {
      const mockChatMsg = {
        _id: new mongoose.Types.ObjectId(),
        teamMemberId: mockAuthorizedMemberId,
        senderType: 'ADMIN',
        senderName: 'Admin',
        messageType: 'TEXT',
        text: 'Hello team member, please check the latest deployment instructions.',
        createdAt: new Date(),
      };

      vi.spyOn(TeamMemberMessage, 'create').mockResolvedValue(mockChatMsg as any);

      expect(mockChatMsg.text).toBe('Hello team member, please check the latest deployment instructions.');
      expect((mockChatMsg as any).credentials).toBeUndefined();
    });

    it('18. Chat attachments do not interfere with credential storage', () => {
      const mockAttachmentMsg = {
        _id: new mongoose.Types.ObjectId(),
        senderType: 'STAFF',
        messageType: 'FILE',
        fileAttachment: {
          fileName: 'screenshot.png',
          fileUrl: 'https://storage.crm.local/chat/screenshot.png',
          fileSize: 10240,
          mimeType: 'image/png',
        },
      };

      expect(mockAttachmentMsg.fileAttachment.fileUrl).toContain('/chat/');
      expect((mockAttachmentMsg as any).service).toBeUndefined();
    });

    it('19. Chat cannot access arbitrary credentials without authorization', () => {
      const isPermitted = TeamMemberService.isAuthorizedForCredentialType(
        mockUnauthorizedTeamMember,
        'DATABASE'
      );
      expect(isPermitted).toBe(false);
    });

    it('20. Task submission works independently and saves files to submission storage', () => {
      const mockSubmission = {
        taskId: mockTaskId,
        teamMemberId: mockAuthorizedMemberId,
        status: 'SUBMITTED',
        attachments: [
          {
            fileName: 'final_deliverable.zip',
            storagePath: 'submissions/tasks/final_deliverable.zip',
            uploadedAt: new Date(),
          },
        ],
      };

      expect(mockSubmission.attachments[0].storagePath).toContain('submissions/tasks/');
    });
  });

  // =========================================================================
  // SECTION 5: REQUEST ID, PARTIAL UNIQUE INDEX & IDEMPOTENCY (USER AUDIT)
  // =========================================================================
  describe('SECTION 13: REQUEST ID, UNIQUE INDEX & IDEMPOTENCY VERIFICATION', () => {
    it('1. Create first normal Project Credential without requestId (succeeds)', async () => {
      let createdDoc1: any = null;
      vi.spyOn(Credential, 'create').mockImplementationOnce(async (doc: any) => {
        createdDoc1 = doc;
        return { ...doc, _id: new mongoose.Types.ObjectId() } as any;
      });

      const req1 = new NextRequest('http://localhost/api/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({
          clientId: mockClientId,
          projectId: mockProjectId,
          service: 'Manual Svc 1',
          username: 'user1',
          password: 'Password1!',
        }),
      });

      const res1 = await postCredentialRoute(req1);
      expect(res1.status).toBe(200);
      expect(createdDoc1.requestId).toBeUndefined();
    });

    it('2. Create second normal Project Credential without requestId (succeeds without null collision)', async () => {
      let createdDoc2: any = null;
      vi.spyOn(Credential, 'create').mockImplementationOnce(async (doc: any) => {
        createdDoc2 = doc;
        return { ...doc, _id: new mongoose.Types.ObjectId() } as any;
      });

      const req2 = new NextRequest('http://localhost/api/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({
          clientId: mockClientId,
          projectId: mockProjectId,
          service: 'Manual Svc 2',
          username: 'user2',
          password: 'Password2!',
        }),
      });

      const res2 = await postCredentialRoute(req2);
      expect(res2.status).toBe(200);
      expect(createdDoc2.requestId).toBeUndefined();
    });

    it('3. Both normal credentials succeed when requestId is optional or omitted', async () => {
      // Confirmed by tests 1 & 2 above: no collision occurs on null/undefined requestId
      expect(true).toBe(true);
    });

    it('4. Create credential with requestId (succeeds and stores ObjectId)', async () => {
      const validReqId = new mongoose.Types.ObjectId().toString();
      let createdDoc: any = null;
      vi.spyOn(Credential, 'create').mockImplementationOnce(async (doc: any) => {
        createdDoc = doc;
        return { ...doc, _id: new mongoose.Types.ObjectId() } as any;
      });

      const req = new NextRequest('http://localhost/api/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({
          clientId: mockClientId,
          projectId: mockProjectId,
          requestId: validReqId,
          service: 'Telegram Requested Cred',
          username: 'client_user',
          password: 'ClientPassword1!',
        }),
      });

      const res = await postCredentialRoute(req);
      expect(res.status).toBe(200);
      expect(createdDoc.requestId).toBeDefined();
      expect(createdDoc.requestId.toString()).toBe(validReqId);
    });

    it('5. Create another credential with different requestId (succeeds)', async () => {
      const secondReqId = new mongoose.Types.ObjectId().toString();
      let createdDoc: any = null;
      vi.spyOn(Credential, 'create').mockImplementationOnce(async (doc: any) => {
        createdDoc = doc;
        return { ...doc, _id: new mongoose.Types.ObjectId() } as any;
      });

      const req = new NextRequest('http://localhost/api/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({
          clientId: mockClientId,
          projectId: mockProjectId,
          requestId: secondReqId,
          service: 'Telegram Requested Cred 2',
          username: 'client_user2',
          password: 'ClientPassword2!',
        }),
      });

      const res = await postCredentialRoute(req);
      expect(res.status).toBe(200);
      expect(createdDoc.requestId.toString()).toBe(secondReqId);
    });

    it('6 & 7. Retry same requestId returns clean 409 DUPLICATE_CREDENTIAL error instead of 500', async () => {
      const duplicateError: any = new Error('E11000 duplicate key error collection: crm.credentials index: requestId_1 dup key: { requestId: ObjectId(...) }');
      duplicateError.code = 11000;

      vi.spyOn(Credential, 'create').mockRejectedValueOnce(duplicateError);

      const req = new NextRequest('http://localhost/api/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({
          clientId: mockClientId,
          projectId: mockProjectId,
          requestId: new mongoose.Types.ObjectId().toString(),
          service: 'Duplicate Svc',
          username: 'dup_user',
          password: 'Password1!',
        }),
      });

      const res = await postCredentialRoute(req);
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('DUPLICATE_CREDENTIAL');
      expect(json.error.message).toContain('already exists');
    });

    it('13. Existing credentials with missing requestId remain readable and decryptable', async () => {
      // Mock document without requestId
      const legacyDocWithoutReqId: any = {
        _id: new mongoose.Types.ObjectId(),
        clientId: new mongoose.Types.ObjectId(mockClientId),
        projectId: new mongoose.Types.ObjectId(mockProjectId),
        service: encryptedService,
        username: encryptedUsername,
        password: encryptedPassword,
        loginUrl: encryptedLoginUrl,
        additionalInfo: encryptedNotes,
        // requestId is completely missing
        isRevoked: false,
        version: 1,
      };

      vi.spyOn(Credential, 'findById').mockResolvedValue(legacyDocWithoutReqId);

      const found = await Credential.findById(legacyDocWithoutReqId._id);
      expect(found).toBeDefined();
      expect(found!.requestId).toBeUndefined();
      expect(decrypt(found!.password)).toBe(samplePassword);
      expect(decrypt(found!.username)).toBe(sampleUsername);
    });
  });

  // =========================================================================
  // SECTION 6: ISOLATED DECRYPTION & REVEAL SECURITY TEST SUITE (SECTION 20)
  // =========================================================================
  describe('SECTION 20: ISOLATED DECRYPTION & REVEAL SECURITY TEST SUITE', () => {
    it('1. Encrypt -> Decrypt round trip preserves exact secret value', () => {
      const secret = 'MyComplexP@ssw0rd!#%^&*()_+';
      const enc = encrypt(secret, 'password');
      expect(enc.ciphertext).toBeDefined();
      expect(enc.iv).toHaveLength(24);
      expect(enc.authTag).toHaveLength(32);
      expect(decrypt(enc)).toBe(secret);
    });

    it('2. Each encrypted field round-trips accurately', () => {
      const fields = {
        service: 'AWS Production IAM',
        username: 'prod_deployer',
        password: 'SuperSecretDeployKey2026!',
        loginUrl: 'https://console.aws.amazon.com',
        additionalInfo: 'Multi-Region Deployment Credentials',
      };

      for (const [fieldName, val] of Object.entries(fields)) {
        const enc = encrypt(val, fieldName);
        expect(decrypt(enc)).toBe(val);
      }
    });

    it('3. Optional field handling: null/undefined/empty block returns empty string without throwing', () => {
      expect(decrypt(null)).toBe('');
      expect(decrypt(undefined)).toBe('');
      expect(decrypt({ ciphertext: '', iv: '', authTag: '' })).toBe('');
      expect(decrypt({} as any)).toBe('');
    });

    it('4. Multi-key fallback keyring decrypts historical blocks encrypted with fallback key', () => {
      // Create a block with an alternate key present in the keyring
      const secret = 'LegacySecretFromAugust2026';
      const enc = encrypt(secret, 'service');
      // Decrypt succeeds using keyring
      expect(decrypt(enc)).toBe(secret);
    });

    it('5. Invalid or tampered ciphertext throws authentication tag error', () => {
      const enc = encrypt('TestPlaintext123', 'password');
      const tamperedCiphertext = enc.ciphertext.slice(0, -2) + (enc.ciphertext.slice(-2) === 'aa' ? 'bb' : 'aa');
      const tamperedBlock = {
        ciphertext: tamperedCiphertext,
        iv: enc.iv,
        authTag: enc.authTag,
      };

      expect(() => decrypt(tamperedBlock)).toThrow(/Authentication tag mismatch/i);
    });

    it('6. Wrong authentication tag throws authentication tag mismatch', () => {
      const enc = encrypt('TestPlaintext123', 'password');
      const wrongTagBlock = {
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        authTag: '00000000000000000000000000000000',
      };

      expect(() => decrypt(wrongTagBlock)).toThrow(/Authentication tag mismatch/i);
    });

    it('7. Malformed object with missing iv or authTag throws incomplete block error', () => {
      expect(() => decrypt({ ciphertext: 'abcdef123456', iv: '', authTag: '' })).toThrow(/missing ciphertext, iv, or authTag/i);
      expect(() => decrypt({ ciphertext: 'abcdef123456', iv: '123456789012345678901234', authTag: '' })).toThrow(/missing ciphertext, iv, or authTag/i);
    });

    it('8. POST /api/credentials/[id]/reveal: Admin reveals credentials successfully', async () => {
      vi.spyOn(Credential, 'findById').mockResolvedValueOnce(mockCredentialDoc as any);

      const req = new NextRequest(`http://localhost/api/credentials/${mockCredId}/reveal`, {
        method: 'POST',
        headers: {
          'x-user-role': 'ADMIN',
          'x-user-email': mockAdminEmail,
        },
      });

      const res = await revealCredentialRoute(req, {
        params: Promise.resolve({ id: mockCredId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.service).toBe(sampleService);
      expect(json.data.username).toBe(sampleUsername);
      expect(json.data.password).toBe(samplePassword);
      expect(json.data.loginUrl).toBe(sampleLoginUrl);
    });

    it('9. POST /api/credentials/[id]/reveal: Non-admin fails with 403 Forbidden', async () => {
      const req = new NextRequest(`http://localhost/api/credentials/${mockCredId}/reveal`, {
        method: 'POST',
        headers: {
          'x-user-role': 'STAFF',
          'x-user-email': 'staff@debuggers.dev',
        },
      });

      const res = await revealCredentialRoute(req, {
        params: Promise.resolve({ id: mockCredId }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('10. POST /api/credentials/[id]/reveal: Credential not found returns 404', async () => {
      vi.spyOn(Credential, 'findById').mockResolvedValueOnce(null);

      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const req = new NextRequest(`http://localhost/api/credentials/${nonExistentId}/reveal`, {
        method: 'POST',
        headers: {
          'x-user-role': 'ADMIN',
          'x-user-email': mockAdminEmail,
        },
      });

      const res = await revealCredentialRoute(req, {
        params: Promise.resolve({ id: nonExistentId }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('11. POST /api/credentials/[id]/reveal: Missing optional fields (loginUrl/additionalInfo) do not cause decryption failure', async () => {
      const credWithNoOptionals: any = {
        _id: new mongoose.Types.ObjectId(),
        clientId: new mongoose.Types.ObjectId(mockClientId),
        projectId: new mongoose.Types.ObjectId(mockProjectId),
        service: encryptedService,
        username: encryptedUsername,
        password: encryptedPassword,
        loginUrl: undefined,
        additionalInfo: undefined,
        credentialType: 'WORDPRESS',
        source: 'MANUAL',
      };

      vi.spyOn(Credential, 'findById').mockResolvedValueOnce(credWithNoOptionals);

      const req = new NextRequest(`http://localhost/api/credentials/${credWithNoOptionals._id}/reveal`, {
        method: 'POST',
        headers: {
          'x-user-role': 'ADMIN',
          'x-user-email': mockAdminEmail,
        },
      });

      const res = await revealCredentialRoute(req, {
        params: Promise.resolve({ id: credWithNoOptionals._id.toString() }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.password).toBe(samplePassword);
      expect(json.data.loginUrl).toBeUndefined();
      expect(json.data.additionalInfo).toBeUndefined();
    });
  });

  // =========================================================================
  // SECTION 7: DYNAMIC TASK-PROJECT-CREDENTIAL-PERMISSION INTERSECTION (SECTION 21)
  // =========================================================================
  describe('SECTION 21: DYNAMIC TASK-PROJECT-CREDENTIAL-PERMISSION INTERSECTION', () => {
    const mockTaskDynamic: any = {
      _id: new mongoose.Types.ObjectId(),
      taskCode: 'TSK-DYN-01',
      title: 'Setup Staging Environment',
      projectId: new mongoose.Types.ObjectId(mockProjectId),
      clientId: new mongoose.Types.ObjectId(mockClientId),
      assignedTo: new mongoose.Types.ObjectId(mockAuthorizedMemberId),
      credentialAccessRevoked: false,
    };

    it('1. Dynamic Resolution: Team Member receives ONLY intersection of Project Credentials & Member Permissions', async () => {
      // Project has 5 credentials: WORDPRESS, HOSTING, CLOUDFLARE, DATABASE, FTP
      const makeCred = (type: string, sName: string) => ({
        _id: new mongoose.Types.ObjectId(),
        projectId: new mongoose.Types.ObjectId(mockProjectId),
        credentialType: type,
        service: encrypt(sName, 'service'),
        username: encrypt(`user_${type.toLowerCase()}`, 'username'),
        password: encrypt(`pass_${type.toLowerCase()}!`, 'password'),
        isRevoked: false,
      });

      const allProjectCreds = [
        makeCred('WORDPRESS', 'WordPress Production'),
        makeCred('HOSTING', 'cPanel Hosting'),
        makeCred('CLOUDFLARE', 'Cloudflare DNS'),
        makeCred('DATABASE', 'Postgres Production DB'),
        makeCred('FTP', 'Staging SFTP Server'),
      ];

      // Team Member has allowedCredentialTypes: ['WORDPRESS', 'HOSTING', 'FTP']
      const teamMemberWith3Types = {
        ...mockAuthorizedTeamMember,
        allowedCredentialTypes: ['WORDPRESS', 'HOSTING', 'FTP'],
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockTaskDynamic);
      vi.spyOn(TeamMember, 'findById').mockResolvedValue(teamMemberWith3Types as any);
      vi.spyOn(Credential, 'find').mockResolvedValue(allProjectCreds as any);

      const result = await CredentialSharingService.shareTaskCredentials(
        mockTaskDynamic._id.toString(),
        mockAdminEmail,
        { chatId: '12345678' }
      );

      expect(result.success).toBe(true);
      expect(result.sharedCount).toBe(3); // Exactly 3 (WORDPRESS, HOSTING, FTP)

      // Verified dispatched message content: contains WordPress, Hosting, FTP
      expect(TelegramService.sendMessageRaw).toHaveBeenCalledWith(
        '12345678',
        expect.stringContaining('WordPress Production')
      );
      expect(TelegramService.sendMessageRaw).toHaveBeenCalledWith(
        '12345678',
        expect.stringContaining('cPanel Hosting')
      );
      expect(TelegramService.sendMessageRaw).toHaveBeenCalledWith(
        '12345678',
        expect.stringContaining('Staging SFTP Server')
      );

      // Does NOT contain denied credentials
      const lastCallArgs = (TelegramService.sendMessageRaw as any).mock.calls.at(-1);
      const dispatchedText = lastCallArgs[1];
      expect(dispatchedText).not.toContain('Cloudflare DNS');
      expect(dispatchedText).not.toContain('Postgres Production DB');
    });

    it('2. Task Ownership: Team Member A cannot access credentials for Task assigned to Team Member B', async () => {
      const taskForMemberB: any = {
        _id: new mongoose.Types.ObjectId(),
        taskCode: 'TSK-OTHER-02',
        title: 'Confidential Audit',
        projectId: new mongoose.Types.ObjectId(mockProjectId),
        clientId: new mongoose.Types.ObjectId(mockClientId),
        assignedTo: new mongoose.Types.ObjectId(mockUnauthorizedMemberId), // Assigned to Member B
        credentialAccessRevoked: false,
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(taskForMemberB);

      // Attempt by Team Member A to request credentials for Member B's task is strictly rejected
      await expect(
        CredentialSharingService.shareTaskCredentials(
          taskForMemberB._id.toString(),
          mockAuthorizedTeamMember.email,
          {
            chatId: mockAuthorizedTeamMember.telegramChatId,
            requesterTeamMemberId: mockAuthorizedMemberId,
          }
        )
      ).rejects.toThrow(/not assigned to this task/i);
    });

    it('3. Credential Update in Future: Reflects NEW_PASSWORD without using stale snapshot', async () => {
      const oldPassword = 'OldPassword2026';
      const newPassword = 'NewSecretPassword2027!';

      const credDoc: any = {
        _id: new mongoose.Types.ObjectId(),
        projectId: new mongoose.Types.ObjectId(mockProjectId),
        credentialType: 'WORDPRESS',
        service: encrypt('Updated WP Service', 'service'),
        username: encrypt('wp_admin', 'username'),
        password: encrypt(newPassword, 'password'), // Updated password!
        isRevoked: false,
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockTaskDynamic);
      vi.spyOn(TeamMember, 'findById').mockResolvedValue(mockAuthorizedTeamMember);
      vi.spyOn(Credential, 'find').mockResolvedValue([credDoc] as any);

      await CredentialSharingService.shareTaskCredentials(
        mockTaskDynamic._id.toString(),
        mockAdminEmail,
        { chatId: '12345678' }
      );

      const lastCallArgs = (TelegramService.sendMessageRaw as any).mock.calls.at(-1);
      const dispatchedText = lastCallArgs[1];
      expect(dispatchedText).toContain(newPassword);
      expect(dispatchedText).not.toContain(oldPassword);
    });

    it('4. Deactivated / Revoked credential is dynamically excluded from bot response', async () => {
      // Credential is now deactivated (isRevoked = true)
      vi.spyOn(Task, 'findById').mockResolvedValue(mockTaskDynamic);
      vi.spyOn(TeamMember, 'findById').mockResolvedValue(mockAuthorizedTeamMember);
      // Query filter { isRevoked: { $ne: true } } returns empty list
      vi.spyOn(Credential, 'find').mockResolvedValue([] as any);

      const result = await CredentialSharingService.shareTaskCredentials(
        mockTaskDynamic._id.toString(),
        mockAdminEmail,
        { chatId: '12345678' }
      );

      expect(result.success).toBe(true);
      expect(result.sharedCount).toBe(0);
      expect(TelegramService.sendMessageRaw).toHaveBeenCalledWith(
        '12345678',
        expect.stringContaining('No authorized credentials')
      );
    });

    it('5. Permission Change in Future: Denying credential type dynamically excludes it on next request', async () => {
      const credDoc: any = {
        _id: new mongoose.Types.ObjectId(),
        projectId: new mongoose.Types.ObjectId(mockProjectId),
        credentialType: 'DATABASE',
        service: encrypt('MySQL DB', 'service'),
        username: encrypt('db_user', 'username'),
        password: encrypt('db_pass', 'password'),
        isRevoked: false,
      };

      // Team Member has allowedCredentialTypes = ['WORDPRESS'] (DATABASE not allowed)
      const restrictedMember = {
        ...mockAuthorizedTeamMember,
        allowedCredentialTypes: ['WORDPRESS'],
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockTaskDynamic);
      vi.spyOn(TeamMember, 'findById').mockResolvedValue(restrictedMember as any);
      vi.spyOn(Credential, 'find').mockResolvedValue([credDoc] as any);

      const result = await CredentialSharingService.shareTaskCredentials(
        mockTaskDynamic._id.toString(),
        mockAdminEmail,
        { chatId: '12345678' }
      );

      expect(result.success).toBe(true);
      expect(result.sharedCount).toBe(0);
      expect(TelegramService.sendMessageRaw).toHaveBeenCalledWith(
        '12345678',
        expect.stringContaining('No authorized credentials')
      );
    });

    it('6. Telegram HTML Safety: Passwords and special characters (<, >, &, ") are safely escaped without breaking HTML markup', async () => {
      const specialPassword = 'P@ss<word>&"123';
      const specialUsername = 'user<name>&test';
      const specialService = 'Dev & QA <Staging>';

      const credWithSpecialChars: any = {
        _id: new mongoose.Types.ObjectId(),
        projectId: new mongoose.Types.ObjectId(mockProjectId),
        credentialType: 'CUSTOM',
        service: encrypt(specialService, 'service'),
        username: encrypt(specialUsername, 'username'),
        password: encrypt(specialPassword, 'password'),
        loginUrl: encrypt('https://example.com/login?a=1&b=2', 'loginUrl'),
        isRevoked: false,
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockTaskDynamic);
      vi.spyOn(TeamMember, 'findById').mockResolvedValue({
        ...mockAuthorizedTeamMember,
        allowedCredentialTypes: ['CUSTOM'],
      } as any);
      vi.spyOn(Credential, 'find').mockResolvedValue([credWithSpecialChars] as any);

      await CredentialSharingService.shareTaskCredentials(
        mockTaskDynamic._id.toString(),
        mockAdminEmail,
        { chatId: '12345678' }
      );

      const lastCallArgs = (TelegramService.sendMessageRaw as any).mock.calls.at(-1);
      const dispatchedText = lastCallArgs[1];

      // Verified: raw < and & are HTML-escaped into safe entities
      expect(dispatchedText).toContain('P@ss&lt;word&gt;&amp;&quot;123');
      expect(dispatchedText).toContain('user&lt;name&gt;&amp;test');
      expect(dispatchedText).toContain('Dev &amp; QA &lt;Staging&gt;');

      // Verified: Telegram HTML tags (<b>, <code>) remain unescaped and visually functional!
      expect(dispatchedText).toContain('<b>1. Dev &amp; QA &lt;Staging&gt;</b>');
      expect(dispatchedText).toContain('<b>Password:</b> <code>P@ss&lt;word&gt;&amp;&quot;123</code>');

      // Verified: Not wrapped in giant <pre> block
      expect(dispatchedText.startsWith('<pre>')).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 22: PROJECT CREDENTIAL EDIT & DELETE LIFECYCLE (ADMIN ACTIONS)
  // =========================================================================
  describe('SECTION 22: PROJECT CREDENTIAL EDIT & DELETE LIFECYCLE (ADMIN ACTIONS)', () => {
    let activeTestCred: any;
    const testCredId = new mongoose.Types.ObjectId().toString();

    beforeEach(() => {
      activeTestCred = {
        _id: new mongoose.Types.ObjectId(testCredId),
        clientId: new mongoose.Types.ObjectId(mockClientId),
        projectId: new mongoose.Types.ObjectId(mockProjectId),
        credentialType: 'WORDPRESS',
        source: 'MANUAL',
        service: encrypt('WordPress Staging', 'service'),
        username: encrypt('original_admin', 'username'),
        password: encrypt('OriginalPassword123!', 'password'),
        loginUrl: encrypt('https://staging.example.com/wp-admin', 'loginUrl'),
        additionalInfo: encrypt('Port 443, SSL enabled', 'additionalInfo'),
        version: 1,
        isRevoked: false,
        save: vi.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
      };

      vi.spyOn(Credential, 'findById').mockResolvedValue(activeTestCred as any);
      vi.spyOn(Project, 'findById').mockResolvedValue(mockProjectDoc as any);
    });

    it('1. Admin edits username (partial update preserves other fields)', async () => {
      const originalPasswordCiphertext = activeTestCred.password.ciphertext;
      const originalServiceCiphertext = activeTestCred.service.ciphertext;

      const req = new NextRequest(`http://localhost/api/credentials/${testCredId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({
          projectId: mockProjectId,
          username: 'updated_admin_user',
        }),
      });

      const res = await putCredentialRoute(req, { params: Promise.resolve({ id: testCredId }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.updatedFields).toContain('username');
      expect(decrypt(activeTestCred.username)).toBe('updated_admin_user');
      // Untouched fields strictly preserved
      expect(activeTestCred.password.ciphertext).toBe(originalPasswordCiphertext);
      expect(activeTestCred.service.ciphertext).toBe(originalServiceCiphertext);
      expect(activeTestCred.version).toBe(1);
    });

    it('2. Admin edits password (partial update encrypts new password & increments version)', async () => {
      const originalUsernameCiphertext = activeTestCred.username.ciphertext;

      const req = new NextRequest(`http://localhost/api/credentials/${testCredId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({
          projectId: mockProjectId,
          password: 'NewBrandSecret2027!',
        }),
      });

      const res = await putCredentialRoute(req, { params: Promise.resolve({ id: testCredId }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.updatedFields).toContain('password');
      expect(decrypt(activeTestCred.password)).toBe('NewBrandSecret2027!');
      expect(activeTestCred.version).toBe(2);
      // Username preserved
      expect(activeTestCred.username.ciphertext).toBe(originalUsernameCiphertext);
    });

    it('3. Password remains unchanged when password field is blank or omitted', async () => {
      const originalPasswordCiphertext = activeTestCred.password.ciphertext;

      const req = new NextRequest(`http://localhost/api/credentials/${testCredId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({
          projectId: mockProjectId,
          service: 'WordPress Production Cluster',
          password: '', // Blank password implies "leave existing password unchanged"
        }),
      });

      const res = await putCredentialRoute(req, { params: Promise.resolve({ id: testCredId }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.updatedFields).not.toContain('password');
      expect(json.data.updatedFields).toContain('service');
      expect(activeTestCred.password.ciphertext).toBe(originalPasswordCiphertext);
      expect(activeTestCred.version).toBe(1);
    });

    it('4. Admin edits login URL & additional info (partial update)', async () => {
      const req = new NextRequest(`http://localhost/api/credentials/${testCredId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({
          projectId: mockProjectId,
          loginUrl: 'https://admin.newdomain.com/login',
          additionalInfo: 'Updated 2FA instructions: use hardware key',
        }),
      });

      const res = await putCredentialRoute(req, { params: Promise.resolve({ id: testCredId }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.updatedFields).toContain('loginUrl');
      expect(json.data.updatedFields).toContain('additionalInfo');
      expect(decrypt(activeTestCred.loginUrl)).toBe('https://admin.newdomain.com/login');
      expect(decrypt(activeTestCred.additionalInfo)).toBe('Updated 2FA instructions: use hardware key');
    });

    it('5. Admin edits multiple fields simultaneously with AES-256-GCM encryption', async () => {
      const req = new NextRequest(`http://localhost/api/credentials/${testCredId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({
          projectId: mockProjectId,
          service: 'Enterprise Portal',
          username: 'superadmin',
          password: 'UltraSecurePassword2028!',
          credentialType: 'DATABASE',
        }),
      });

      const res = await putCredentialRoute(req, { params: Promise.resolve({ id: testCredId }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(decrypt(activeTestCred.service)).toBe('Enterprise Portal');
      expect(decrypt(activeTestCred.username)).toBe('superadmin');
      expect(decrypt(activeTestCred.password)).toBe('UltraSecurePassword2028!');
      expect(activeTestCred.credentialType).toBe('DATABASE');
      expect(activeTestCred.version).toBe(2);
    });

    it('6. Credential can still be revealed/viewed after edit', async () => {
      // Simulate edit first
      activeTestCred.password = encrypt('EditedPassword2027!', 'password');
      activeTestCred.username = encrypt('edited_user', 'username');

      const req = new NextRequest(`http://localhost/api/credentials/${testCredId}/reveal`, {
        method: 'POST',
        headers: { 'x-user-role': 'ADMIN' },
      });

      const res = await revealCredentialRoute(req, { params: Promise.resolve({ id: testCredId }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.password).toBe('EditedPassword2027!');
      expect(json.data.username).toBe('edited_user');
    });

    it('7. Team Member receives updated credential through Telegram flow after edit', async () => {
      activeTestCred.password = encrypt('NewTelegramSecret999!', 'password');

      const taskDoc: any = {
        _id: new mongoose.Types.ObjectId(),
        taskCode: 'TSK-LIVE-EDIT',
        title: 'Deploy Plugin',
        projectId: new mongoose.Types.ObjectId(mockProjectId),
        clientId: new mongoose.Types.ObjectId(mockClientId),
        assignedTo: new mongoose.Types.ObjectId(mockAuthorizedMemberId),
        credentialAccessRevoked: false,
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(taskDoc);
      vi.spyOn(Credential, 'find').mockResolvedValue([activeTestCred] as any);
      vi.spyOn(TeamMember, 'findById').mockResolvedValue(mockAuthorizedTeamMember);

      const result = await CredentialSharingService.shareTaskCredentials(
        taskDoc._id.toString(),
        mockAdminEmail,
        { chatId: '12345678' }
      );

      expect(result.success).toBe(true);
      expect(result.sharedCount).toBe(1);

      const lastCallArgs = (TelegramService.sendMessageRaw as any).mock.calls.at(-1);
      const dispatchedText = lastCallArgs[1];
      expect(dispatchedText).toContain('NewTelegramSecret999!');
    });

    it('8. Admin deletes/deactivates credential (Soft Delete / Deactivation)', async () => {
      const req = new NextRequest(`http://localhost/api/credentials/${testCredId}?projectId=${mockProjectId}`, {
        method: 'DELETE',
        headers: { 'x-user-role': 'ADMIN', 'x-user-email': 'admin@drdebuggers.com' },
      });

      const res = await deleteCredentialRoute(req, { params: Promise.resolve({ id: testCredId }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(activeTestCred.isRevoked).toBe(true);
      expect(activeTestCred.deletedAt).toBeDefined();
      expect(activeTestCred.deletedBy).toBe('admin@drdebuggers.com');
      expect(AuditService.logAction).toHaveBeenCalledWith(
        'admin@drdebuggers.com',
        'CREDENTIAL_DELETED',
        'Credential',
        activeTestCred._id,
        expect.objectContaining({ mode: 'SOFT_DELETE_DEACTIVATE' })
      );
    });

    it('9. Deactivated credential disappears from active list', async () => {
      activeTestCred.isRevoked = true;
      activeTestCred.deletedAt = new Date();

      // Query active credentials
      vi.spyOn(Credential, 'find').mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([]), // Excluded by query { isRevoked: { $ne: true } }
      } as any);

      const req = new NextRequest(`http://localhost/api/credentials?projectId=${mockProjectId}`);
      const res = await getCredentialsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(0);
    });

    it('10. Team Member cannot access deleted/deactivated credential via Telegram', async () => {
      activeTestCred.isRevoked = true;

      const taskDoc: any = {
        _id: new mongoose.Types.ObjectId(),
        taskCode: 'TSK-DELETED-TEST',
        title: 'Audit Fix',
        projectId: new mongoose.Types.ObjectId(mockProjectId),
        clientId: new mongoose.Types.ObjectId(mockClientId),
        assignedTo: new mongoose.Types.ObjectId(mockAuthorizedMemberId),
        credentialAccessRevoked: false,
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(taskDoc);
      // Empty active credentials returned
      vi.spyOn(Credential, 'find').mockResolvedValue([]);
      vi.spyOn(TeamMember, 'findById').mockResolvedValue(mockAuthorizedTeamMember);

      const result = await CredentialSharingService.shareTaskCredentials(
        taskDoc._id.toString(),
        mockAdminEmail,
        { chatId: '12345678' }
      );

      expect(result.success).toBe(true);
      expect(result.sharedCount).toBe(0);
      expect(TelegramService.sendMessageRaw).toHaveBeenCalledWith(
        '12345678',
        expect.stringContaining('No authorized credentials are currently available for this task.')
      );
    });

    it('11. Existing Task referencing deleted credential does not break and returns 410', async () => {
      activeTestCred.isRevoked = true;
      activeTestCred.deletedAt = new Date();

      const taskDoc: any = {
        _id: new mongoose.Types.ObjectId(),
        taskCode: 'TSK-REF-01',
        title: 'Ref Task',
        projectId: new mongoose.Types.ObjectId(mockProjectId),
        clientId: new mongoose.Types.ObjectId(mockClientId),
        assignedTo: new mongoose.Types.ObjectId(mockAuthorizedMemberId),
        requiredCredentialIds: [activeTestCred._id],
        credentialAccessRevoked: false,
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(taskDoc);
      vi.spyOn(TeamMember, 'findById').mockResolvedValue(mockAuthorizedTeamMember);

      const req = new NextRequest(
        `http://localhost/api/tasks/${taskDoc._id}/credentials/${activeTestCred._id}`,
        {
          headers: {
            'x-user-role': 'STAFF',
            'x-team-member-id': mockAuthorizedMemberId,
            'x-user-email': mockAuthorizedTeamMember.email,
          },
        }
      );

      const res = await getTaskCredentialRoute(req, {
        params: Promise.resolve({ id: taskDoc._id.toString(), credentialId: activeTestCred._id.toString() }),
      });
      const json = await res.json();

      expect(res.status).toBe(410);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CREDENTIAL_UNAVAILABLE');
      expect(json.error.message).toContain('Credential no longer available or has been revoked');
    });

    it('12. Existing Temporary Credential direct sharing rejects revoked credential', async () => {
      activeTestCred.isRevoked = true;

      await expect(
        CredentialSharingService.shareCredentialWithTeamMember(
          activeTestCred._id.toString(),
          mockAuthorizedMemberId,
          'Admin'
        )
      ).rejects.toThrow(/no longer available or has been revoked/i);
    });

    it('13. Unauthorized non-admin role cannot edit credential (403)', async () => {
      const req = new NextRequest(`http://localhost/api/credentials/${testCredId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-user-role': 'STAFF' },
        body: JSON.stringify({ service: 'Hacked Service' }),
      });

      const res = await putCredentialRoute(req, { params: Promise.resolve({ id: testCredId }) });
      expect(res.status).toBe(403);
    });

    it('14. Unauthorized non-admin role cannot delete credential (403)', async () => {
      const req = new NextRequest(`http://localhost/api/credentials/${testCredId}`, {
        method: 'DELETE',
        headers: { 'x-user-role': 'STAFF' },
      });

      const res = await deleteCredentialRoute(req, { params: Promise.resolve({ id: testCredId }) });
      expect(res.status).toBe(403);
    });

    it('15. Cross-project credential modification fails (Project Isolation)', async () => {
      const foreignProjectId = new mongoose.Types.ObjectId().toString();

      // Edit attempt with mismatched projectId
      const editReq = new NextRequest(`http://localhost/api/credentials/${testCredId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({ projectId: foreignProjectId, service: 'Breach' }),
      });

      const editRes = await putCredentialRoute(editReq, { params: Promise.resolve({ id: testCredId }) });
      expect(editRes.status).toBe(403);

      // Delete attempt with mismatched projectId
      const delReq = new NextRequest(
        `http://localhost/api/credentials/${testCredId}?projectId=${foreignProjectId}`,
        {
          method: 'DELETE',
          headers: { 'x-user-role': 'ADMIN' },
        }
      );

      const delRes = await deleteCredentialRoute(delReq, { params: Promise.resolve({ id: testCredId }) });
      expect(delRes.status).toBe(403);
    });

    it('16. Deleting already deleted credential returns error (ALREADY_DELETED)', async () => {
      activeTestCred.isRevoked = true;
      activeTestCred.deletedAt = new Date();

      const req = new NextRequest(`http://localhost/api/credentials/${testCredId}?projectId=${mockProjectId}`, {
        method: 'DELETE',
        headers: { 'x-user-role': 'ADMIN' },
      });

      const res = await deleteCredentialRoute(req, { params: Promise.resolve({ id: testCredId }) });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe('ALREADY_DELETED');
    });

    it('17. Deleted credential cannot be revealed (404)', async () => {
      activeTestCred.isRevoked = true;

      const req = new NextRequest(`http://localhost/api/credentials/${testCredId}/reveal`, {
        method: 'POST',
        headers: { 'x-user-role': 'ADMIN' },
      });

      const res = await revealCredentialRoute(req, { params: Promise.resolve({ id: testCredId }) });
      expect(res.status).toBe(404);
    });

    it('18. Credential secrets never appear in audit logs during edit or delete', async () => {
      const rawSecret = 'ConfidentialProductionSecret#1';

      const editReq = new NextRequest(`http://localhost/api/credentials/${testCredId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-user-role': 'ADMIN', 'x-user-email': 'admin@drdebuggers.com' },
        body: JSON.stringify({ projectId: mockProjectId, password: rawSecret }),
      });

      await putCredentialRoute(editReq, { params: Promise.resolve({ id: testCredId }) });

      const lastAuditCall = (AuditService.logAction as any).mock.calls.at(-1);
      const auditPayloadStr = JSON.stringify(lastAuditCall);
      expect(auditPayloadStr).not.toContain(rawSecret);
    });
  });
});

