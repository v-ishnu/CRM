import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import Task from '@/models/Task';
import Project from '@/models/Project';
import Client from '@/models/Client';
import TeamMember from '@/models/TeamMember';
import Credential from '@/models/Credential';
import AuditLog from '@/models/AuditLog';
import { TaskService } from '@/services/task.service';
import { TeamMemberService } from '@/services/team-member.service';
import { TelegramService } from '@/services/telegram.service';
import { AuditService } from '@/services/audit.service';
import { encrypt } from '@/lib/security/encryption';
import { PerfTimer } from '@/lib/diagnostics/timing';

// Routes under test
import { GET as getProjectCredentialsRoute } from '@/app/api/projects/[id]/credentials/route';
import { GET as getTaskCredentialViewRoute } from '@/app/api/tasks/[id]/credentials/[credentialId]/route';

// Mocks to guarantee ZERO production DB access and ZERO real notifications
vi.mock('@/lib/db/connect', () => ({
  dbConnect: vi.fn().mockResolvedValue(null),
  default: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/telegram.service', () => ({
  TelegramService: {
    sendMessageRaw: vi.fn().mockResolvedValue({ success: true, messageId: 8888 }),
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

describe('Task-Based Project Credential Access & Performance Suite', () => {
  const mockAdminEmail = 'admin@drdebuggers.com';
  const mockProjectId = new mongoose.Types.ObjectId().toString();
  const mockOtherProjectId = new mongoose.Types.ObjectId().toString();
  const mockClientId = new mongoose.Types.ObjectId().toString();
  const mockMemberId = new mongoose.Types.ObjectId().toString();
  const mockOtherMemberId = new mongoose.Types.ObjectId().toString();
  const mockTaskId = new mongoose.Types.ObjectId().toString();

  const mockWpCredId = new mongoose.Types.ObjectId().toString();
  const mockDbCredId = new mongoose.Types.ObjectId().toString();
  const mockOtherProjectCredId = new mongoose.Types.ObjectId().toString();

  const encryptedPassword = encrypt('superSecretP@ss123', 'password');
  const encryptedUsername = encrypt('wp_admin', 'username');
  const encryptedService = encrypt('WordPress Admin', 'service');

  const mockWpCredential = {
    _id: mockWpCredId,
    projectId: mockProjectId,
    clientId: mockClientId,
    credentialType: 'WORDPRESS',
    service: encryptedService,
    username: encryptedUsername,
    password: encryptedPassword,
    isRevoked: false,
  };

  const mockDbCredential = {
    _id: mockDbCredId,
    projectId: mockProjectId,
    clientId: mockClientId,
    credentialType: 'DATABASE',
    service: encrypt('Production PostgreSQL', 'service'),
    username: encrypt('postgres_user', 'username'),
    password: encrypt('dbSecret999', 'password'),
    isRevoked: false,
  };

  const mockOtherProjectCredential = {
    _id: mockOtherProjectCredId,
    projectId: mockOtherProjectId,
    clientId: mockClientId,
    credentialType: 'WORDPRESS',
    service: encrypt('Other Project Credential', 'service'),
    username: encrypt('other_user', 'username'),
    password: encrypt('otherSecret', 'password'),
    isRevoked: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(Client, 'findById').mockResolvedValue({
      _id: mockClientId,
      name: 'ABC Client',
      status: 'ACTIVE',
    } as any);

    vi.spyOn(Project, 'findById').mockImplementation((async (id: any) => {
      if (id?.toString() === mockProjectId) {
        return {
          _id: mockProjectId,
          name: 'ABC Website',
          clientId: mockClientId,
          status: 'IN_PROGRESS',
          teamMemberIds: [mockMemberId],
          save: vi.fn().mockResolvedValue(true),
        } as any;
      }
      return null;
    }) as any);

    vi.spyOn(TeamMember, 'findById').mockImplementation((async (id: any) => {
      if (id?.toString() === mockMemberId) {
        return {
          _id: mockMemberId,
          name: 'John Developer',
          email: 'john@example.com',
          role: 'DEVELOPER',
          status: 'ACTIVE',
          permissions: ['VIEW_PROJECT', 'VIEW_TASKS', 'VIEW_CREDENTIALS'],
          allowedCredentialTypes: ['WORDPRESS', 'HOSTING'], // Database is NOT allowed!
        } as any;
      }
      return null;
    }) as any);

    vi.spyOn(Credential, 'findById').mockImplementation((async (id: any) => {
      const sId = id?.toString();
      if (sId === mockWpCredId) return { ...mockWpCredential } as any;
      if (sId === mockDbCredId) return { ...mockDbCredential } as any;
      if (sId === mockOtherProjectCredId) return { ...mockOtherProjectCredential } as any;
      return null;
    }) as any);
  });

  // ==============================================================
  // 1 & 2 & 3: Project credentials listing & Member authorization
  // ==============================================================
  it('1. Project credentials can be associated with a project and listed for admin', async () => {
    vi.spyOn(Credential, 'find').mockReturnValue({
      lean: vi.fn().mockResolvedValue([mockWpCredential, mockDbCredential]),
    } as any);

    const req = new NextRequest(`http://localhost/api/projects/${mockProjectId}/credentials`, {
      headers: { 'x-user-role': 'ADMIN' },
    });
    const res = await getProjectCredentialsRoute(req, { params: Promise.resolve({ id: mockProjectId }) });
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.length).toBe(2);
    // Secrets must NOT be returned in credential listing
    expect(json.data[0].password).toBeUndefined();
    expect(json.data[0].service).toBe('WordPress Admin');
  });

  it('2. Authorized Team Member sees ONLY permitted credential types (WordPress allowed, Database denied)', async () => {
    vi.spyOn(Credential, 'find').mockReturnValue({
      lean: vi.fn().mockResolvedValue([mockWpCredential, mockDbCredential]),
    } as any);

    const req = new NextRequest(`http://localhost/api/projects/${mockProjectId}/credentials?teamMemberId=${mockMemberId}`, {
      headers: { 'x-user-role': 'ADMIN' },
    });
    const res = await getProjectCredentialsRoute(req, { params: Promise.resolve({ id: mockProjectId }) });
    const json = await res.json();

    expect(json.success).toBe(true);
    // John is only authorized for WORDPRESS and HOSTING. DATABASE must be excluded!
    expect(json.data.length).toBe(1);
    expect(json.data[0]._id).toBe(mockWpCredId);
    expect(json.data[0].credentialType).toBe('WORDPRESS');
  });

  it('3. Unauthorized Team Member without VIEW_CREDENTIALS permission cannot see any credentials', async () => {
    vi.spyOn(TeamMember, 'findById').mockResolvedValueOnce({
      _id: mockOtherMemberId,
      name: 'Unprivileged User',
      role: 'DEVELOPER',
      status: 'ACTIVE',
      permissions: ['VIEW_PROJECT', 'VIEW_TASKS'], // Missing VIEW_CREDENTIALS!
    } as any);

    vi.spyOn(Credential, 'find').mockReturnValue({
      lean: vi.fn().mockResolvedValue([mockWpCredential, mockDbCredential]),
    } as any);

    const req = new NextRequest(`http://localhost/api/projects/${mockProjectId}/credentials?teamMemberId=${mockOtherMemberId}`, {
      headers: { 'x-user-role': 'ADMIN' },
    });
    const res = await getProjectCredentialsRoute(req, { params: Promise.resolve({ id: mockProjectId }) });
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.length).toBe(0); // Zero credentials returned
  });

  // ==============================================================
  // 4, 5 & 6: Task credential assignment, isolation, and no secrets in task doc
  // ==============================================================
  it('4. Rejects task creation if credential belongs to another project (Project Isolation)', async () => {
    vi.spyOn(Credential, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockOtherProjectCredential]), // Belongs to mockOtherProjectId
      }),
    } as any);

    await expect(
      TaskService.createTask(
        {
          title: 'Fix issue',
          projectId: mockProjectId,
          assignedTo: mockMemberId,
          requiredCredentialIds: [mockOtherProjectCredId],
        },
        mockAdminEmail
      )
    ).rejects.toThrow(/does not belong to this project/);
  });

  it('5. Rejects assigning credential to a team member unauthorized for that credential type', async () => {
    vi.spyOn(Credential, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockDbCredential]), // Database credential
      }),
    } as any);

    await expect(
      TaskService.createTask(
        {
          title: 'Query DB',
          projectId: mockProjectId,
          assignedTo: mockMemberId, // John does not have DATABASE permission
          requiredCredentialIds: [mockDbCredId],
        },
        mockAdminEmail
      )
    ).rejects.toThrow(/not authorized for "DATABASE" credentials/);
  });

  it('6. Task references credential ID and does NOT duplicate secrets into task document', async () => {
    vi.spyOn(Credential, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockWpCredential]),
      }),
    } as any);

    vi.spyOn(Task, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(Task, 'exists').mockResolvedValue(false as any);

    let savedTaskDoc: any = null;
    vi.spyOn(Task.prototype, 'save').mockImplementation(async function (this: any) {
      savedTaskDoc = this;
      return this;
    });

    const task = await TaskService.createTask(
      {
        title: 'Fix WordPress plugin',
        projectId: mockProjectId,
        assignedTo: mockMemberId,
        requiredCredentialIds: [mockWpCredId],
      },
      mockAdminEmail
    );

    expect(task.requiredCredentialIds).toBeDefined();
    expect(task.requiredCredentialIds.length).toBe(1);
    expect(task.requiredCredentialIds[0].toString()).toBe(mockWpCredId);

    // Verify task doc contains NO plaintext secrets, passwords, or ciphertext duplicates
    expect((savedTaskDoc as any).credentials).toBeUndefined();
    expect((savedTaskDoc as any).password).toBeUndefined();
    expect((savedTaskDoc as any).secret).toBeUndefined();
  });

  // ==============================================================
  // 7, 8, 9, 10 & 11: View-Time Authorization, Revocation & Auditing
  // ==============================================================
  it('7. View-time check allows authorized team member to view their permitted task credential', async () => {
    vi.spyOn(Task, 'findById').mockResolvedValue({
      _id: mockTaskId,
      taskCode: 'TSK-001',
      projectId: mockProjectId,
      assignedTo: mockMemberId,
      requiredCredentialIds: [mockWpCredId],
      credentialAccessRevoked: false,
    } as any);

    const req = new NextRequest(`http://localhost/api/tasks/${mockTaskId}/credentials/${mockWpCredId}`, {
      headers: {
        'x-user-role': 'DEVELOPER',
        'x-team-member-id': mockMemberId,
        'x-user-email': 'john@example.com',
      },
    });

    const res = await getTaskCredentialViewRoute(req, {
      params: Promise.resolve({ id: mockTaskId, credentialId: mockWpCredId }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.service).toBe('WordPress Admin');
    expect(json.data.username).toBe('wp_admin');
    expect(json.data.password).toBe('superSecretP@ss123'); // Decrypted on demand only

    // Verify audit log call
    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREDENTIAL_VIEWED',
        entityId: mockWpCredId,
      })
    );
  });

  it('8. View-time check blocks access if team member permission is revoked after task assignment', async () => {
    vi.spyOn(Task, 'findById').mockResolvedValue({
      _id: mockTaskId,
      taskCode: 'TSK-001',
      projectId: mockProjectId,
      assignedTo: mockMemberId,
      requiredCredentialIds: [mockWpCredId],
      credentialAccessRevoked: false,
    } as any);

    // Simulate John's WORDPRESS permission being removed later by admin
    vi.spyOn(TeamMember, 'findById').mockResolvedValueOnce({
      _id: mockMemberId,
      name: 'John Developer',
      status: 'ACTIVE',
      permissions: ['VIEW_PROJECT', 'VIEW_TASKS', 'VIEW_CREDENTIALS'],
      allowedCredentialTypes: ['HOSTING'], // WORDPRESS permission revoked!
    } as any);

    const req = new NextRequest(`http://localhost/api/tasks/${mockTaskId}/credentials/${mockWpCredId}`, {
      headers: {
        'x-user-role': 'DEVELOPER',
        'x-team-member-id': mockMemberId,
        'x-user-email': 'john@example.com',
      },
    });

    const res = await getTaskCredentialViewRoute(req, {
      params: Promise.resolve({ id: mockTaskId, credentialId: mockWpCredId }),
    });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('FORBIDDEN');

    // Audit log records denial
    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREDENTIAL_ACCESS_DENIED',
      })
    );
  });

  it('9. Deactivated or revoked credential returns 410 and cannot be viewed', async () => {
    vi.spyOn(Task, 'findById').mockResolvedValue({
      _id: mockTaskId,
      taskCode: 'TSK-001',
      projectId: mockProjectId,
      assignedTo: mockMemberId,
      requiredCredentialIds: [mockWpCredId],
      credentialAccessRevoked: false,
    } as any);

    vi.spyOn(Credential, 'findById').mockResolvedValueOnce({
      ...mockWpCredential,
      isRevoked: true, // Credential deactivated!
    } as any);

    const req = new NextRequest(`http://localhost/api/tasks/${mockTaskId}/credentials/${mockWpCredId}`, {
      headers: {
        'x-user-role': 'DEVELOPER',
        'x-team-member-id': mockMemberId,
      },
    });

    const res = await getTaskCredentialViewRoute(req, {
      params: Promise.resolve({ id: mockTaskId, credentialId: mockWpCredId }),
    });
    const json = await res.json();

    expect(res.status).toBe(410);
    expect(json.error.code).toBe('CREDENTIAL_UNAVAILABLE');
  });

  it('10 & 11. Audit logs never contain secret, password, or encryption keys', async () => {
    vi.spyOn(Task, 'findById').mockResolvedValue({
      _id: mockTaskId,
      taskCode: 'TSK-001',
      projectId: mockProjectId,
      assignedTo: mockMemberId,
      requiredCredentialIds: [mockWpCredId],
      credentialAccessRevoked: false,
    } as any);

    const req = new NextRequest(`http://localhost/api/tasks/${mockTaskId}/credentials/${mockWpCredId}`, {
      headers: {
        'x-user-role': 'DEVELOPER',
        'x-team-member-id': mockMemberId,
        'x-user-email': 'john@example.com',
      },
    });

    await getTaskCredentialViewRoute(req, {
      params: Promise.resolve({ id: mockTaskId, credentialId: mockWpCredId }),
    });

    const auditCalls = vi.mocked(AuditService.log).mock.calls;
    expect(auditCalls.length).toBeGreaterThan(0);

    for (const [logEntry] of auditCalls) {
      const entryStr = JSON.stringify(logEntry);
      expect(entryStr).not.toContain('superSecretP@ss123');
      expect(entryStr).not.toContain('ciphertext');
      expect(entryStr).not.toContain('authTag');
    }
  });

  // ==============================================================
  // 18. Performance Diagnostic Timer Verification
  // ==============================================================
  it('18. PerfTimer accurately measures and formats multi-stage operational timing', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const timer = new PerfTimer('/api/test-timing');
    
    await new Promise((r) => setTimeout(r, 10));
    timer.checkpoint('auth');
    
    await new Promise((r) => setTimeout(r, 15));
    timer.checkpoint('mongo');
    
    const result = timer.end();

    expect(result.totalMs).toBeGreaterThanOrEqual(20);
    expect(result.metrics.auth).toBeGreaterThanOrEqual(5);
    expect(result.metrics.mongo).toBeGreaterThanOrEqual(10);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[PERF] /api/test-timing auth:'));
    consoleSpy.mockRestore();
  });
});
