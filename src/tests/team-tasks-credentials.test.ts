import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db/connect';
import TeamMember from '@/models/TeamMember';
import Task from '@/models/Task';
import Project from '@/models/Project';
import Client from '@/models/Client';
import Credential from '@/models/Credential';
import AuditLog from '@/models/AuditLog';
import { TeamMemberService } from '@/services/team-member.service';
import { TaskService } from '@/services/task.service';
import { CredentialSharingService } from '@/services/credential-sharing.service';
import { encrypt, decrypt } from '@/lib/security/encryption';
import { TelegramService } from '@/services/telegram.service';

describe('Team Members, Task Management & Secure Telegram Credential Sharing', () => {
  let testClient: any;
  let testProject: any;
  let devMember: any;
  let unassignedMember: any;
  let primaryAdminMember: any;
  let testCredential: any;

  beforeAll(async () => {
    await dbConnect();

    // Clean up any test fixtures from previous runs
    await TeamMember.deleteMany({ email: /@test-team\.com$/ });
    await Task.deleteMany({ title: /^Test Task/ });
    await Project.deleteMany({ name: /^Test Team Project/ });
    await Client.deleteMany({ email: 'client@test-team.com' });
    await Credential.deleteMany({ 'data.service': 'Test Service API' });
    await AuditLog.deleteMany({ actor: 'test-runner' });

    // 1. Create a Test Client
    testClient = await Client.create({
      clientCode: 'CL-TEST99',
      name: 'Acme Test Corp',
      email: 'client@test-team.com',
      status: 'ACTIVE',
    });

    // 2. Create a Test Project
    testProject = await Project.create({
      projectCode: 'PRJ-TEST99',
      clientId: testClient._id,
      name: 'Test Team Project',
      serviceType: 'WEBSITE',
      totalAmount: 50000,
      currency: 'INR',
      status: 'IN_PROGRESS',
      teamMemberIds: [],
    });

    // 3. Create Primary Admin
    primaryAdminMember = await TeamMemberService.createTeamMember(
      {
        name: 'Primary Admin',
        email: 'admin@test-team.com',
        role: 'ADMIN',
        isPrimaryAdmin: true,
        permissions: ['VIEW_CREDENTIALS', 'REQUEST_CREDENTIALS', 'MANAGE_TASKS', 'VIEW_PROJECT', 'VIEW_CLIENT', 'MANAGE_PROJECT', 'VIEW_TASKS'],
      },
      'test-runner'
    );

    // 4. Create Developer Team Member with VIEW_CREDENTIALS permission
    devMember = await TeamMemberService.createTeamMember(
      {
        name: 'Alice Developer',
        email: 'alice@test-team.com',
        role: 'DEVELOPER',
        permissions: ['VIEW_PROJECT', 'VIEW_TASKS', 'VIEW_CREDENTIALS'],
      },
      'test-runner'
    );

    // 5. Create Team Member WITHOUT VIEW_CREDENTIALS permission
    unassignedMember = await TeamMemberService.createTeamMember(
      {
        name: 'Bob Designer',
        email: 'bob@test-team.com',
        role: 'DESIGNER',
        permissions: ['VIEW_PROJECT', 'VIEW_TASKS'],
      },
      'test-runner'
    );

    // 6. Mock TelegramService.sendMessageRaw for unit testing
    vi.spyOn(TelegramService, 'sendMessageRaw').mockImplementation(async () => {
      return { success: true, messageId: 99999 };
    });
    vi.spyOn(TelegramService, 'answerCallbackQuery').mockImplementation(async () => {
      return true;
    });

    // 7. Create a DataRequest & Encrypted Credential for the Project
    const fakeRequestId = new mongoose.Types.ObjectId();
    testCredential = await Credential.create({
      requestId: fakeRequestId,
      clientId: testClient._id,
      projectId: testProject._id,
      service: encrypt('Test Service API'),
      username: encrypt('admin_user'),
      password: encrypt('SuperSecretP@ss123!'),
      loginUrl: encrypt('https://api.example.com/login'),
      additionalInfo: encrypt('Staging API keys'),
      version: 1,
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await TeamMember.deleteMany({ email: /@test-team\.com$/ });
    await Task.deleteMany({ title: /^Test Task/ });
    await Project.deleteMany({ name: /^Test Team Project/ });
    await Client.deleteMany({ email: 'client@test-team.com' });
    await Credential.deleteMany({ 'data.service': 'Test Service API' });
    await AuditLog.deleteMany({ actor: 'test-runner' });
  });

  describe('1. Team Member Management & Security Policies', () => {
    it('creates team members with appropriate roles, permissions, and active status', async () => {
      expect(devMember._id).toBeDefined();
      expect(devMember.role).toBe('DEVELOPER');
      expect(devMember.status).toBe('ACTIVE');
      expect(devMember.permissions).toContain('VIEW_CREDENTIALS');
      expect(devMember.permissions).toContain('VIEW_TASKS');
    });

    it('generates a 24-hour one-time Telegram connection token', async () => {
      const result = await TeamMemberService.generateTelegramConnectionToken(devMember._id.toString(), 'test-runner');
      expect(result.token).toMatch(/^TEAM_[A-Za-z0-9_-]+/);
      expect(result.link).toContain(result.token);

      const memberInDb = await TeamMember.findById(devMember._id);
      expect(memberInDb?.telegramConnectionToken).toBe(result.token);
      expect(memberInDb?.telegramTokenExpiresAt).toBeDefined();
    });

    it('successfully connects Telegram profile using valid token and invalidates token', async () => {
      const memberInDb = await TeamMember.findById(devMember._id);
      const token = memberInDb!.telegramConnectionToken!;

      const connected = await TeamMemberService.connectTelegram(token, {
        telegramUserId: '77889911',
        telegramUsername: 'alicedev',
        telegramChatId: '77889911',
      });

      expect(connected.telegramConnected).toBe(true);
      expect(connected.telegramUserId).toBe('77889911');
      expect(connected.telegramChatId).toBe('77889911');
      expect(connected.telegramConnectionToken).toBeFalsy();
      expect(connected.telegramTokenExpiresAt).toBeFalsy();

      // Refresh local reference
      devMember = connected;
    });

    it('rejects connecting Telegram using an invalid or expired token', async () => {
      await expect(
        TeamMemberService.connectTelegram('TEAM_INVALID_TOKEN', {
          telegramUserId: '123456',
          telegramChatId: '123456',
        })
      ).rejects.toThrow(/Invalid or expired/i);
    });

    it('prevents deletion or deactivation of the Primary Admin', async () => {
      await expect(
        TeamMemberService.deleteTeamMember(primaryAdminMember._id.toString(), 'test-runner')
      ).rejects.toThrow(/Primary admin account cannot be deleted/i);

      await expect(
        TeamMemberService.deactivateTeamMember(primaryAdminMember._id.toString(), 'test-runner')
      ).rejects.toThrow(/Primary admin account cannot be deactivated/i);
    });
  });

  describe('2. Project Assignment & Team Operations', () => {
    it('assigns a team member to a project', async () => {
      const project = await Project.findById(testProject._id);
      expect(project).toBeDefined();
      if (project) {
        project.teamMemberIds = project.teamMemberIds || [];
        project.teamMemberIds.push(devMember._id);
        await project.save();
      }

      const updated = await Project.findById(testProject._id);
      expect(updated?.teamMemberIds?.map((id) => id.toString())).toContain(devMember._id.toString());
    });

    it('removes a team member from a project without deleting the team member', async () => {
      // Temporarily assign unassignedMember
      const project = await Project.findById(testProject._id);
      expect(project).toBeDefined();
      if (project) {
        project.teamMemberIds = project.teamMemberIds || [];
        project.teamMemberIds.push(unassignedMember._id);
        await project.save();

        // Remove unassignedMember
        project.teamMemberIds = project.teamMemberIds.filter(
          (id) => id.toString() !== unassignedMember._id.toString()
        );
        await project.save();
      }

      const memberStillExists = await TeamMember.findById(unassignedMember._id);
      expect(memberStillExists).not.toBeNull();
      expect(memberStillExists?.status).toBe('ACTIVE');
    });
  });

  describe('3. Task Creation, Assignment & Lifecycle', () => {
    let createdTask: any;

    it('creates a task, auto-derives clientId from project, and validates assignee', async () => {
      createdTask = await TaskService.createTask(
        {
          title: 'Test Task: Setup Production SSL',
          description: 'Configure Cloudflare SSL certificates',
          projectId: testProject._id.toString(),
          assignedTo: devMember._id.toString(),
          priority: 'HIGH',
          dueDate: new Date(Date.now() + 86400000),
        },
        'test-runner'
      );

      expect(createdTask.taskCode).toMatch(/^TSK-\d{4}$/);
      expect(createdTask.title).toBe('Test Task: Setup Production SSL');
      expect(createdTask.clientId.toString()).toBe(testClient._id.toString());
      expect(createdTask.status).toBe('TODO');
      expect(createdTask.priority).toBe('HIGH');
    });

    it('updates task status to IN_PROGRESS and then COMPLETED with completedAt timestamp', async () => {
      const inProg = await TaskService.updateTaskStatus(
        createdTask._id.toString(),
        'IN_PROGRESS',
        devMember.name,
        false
      );
      expect(inProg.status).toBe('IN_PROGRESS');
      expect(inProg.completedAt).toBeUndefined();

      const completed = await TaskService.updateTaskStatus(
        createdTask._id.toString(),
        'COMPLETED',
        devMember.name,
        false
      );
      expect(completed.status).toBe('COMPLETED');
      expect(completed.completedAt).toBeDefined();
      expect(new Date(completed.completedAt!).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('queries tasks by project, assignee, and status', async () => {
      const tasks = await TaskService.getTasks({
        projectId: testProject._id.toString(),
        assignedTo: devMember._id.toString(),
        status: 'COMPLETED',
      });

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0].taskCode).toBe(createdTask.taskCode);
    });
  });

  describe('4. Secure Server-Side Telegram Credential Sharing', () => {
    it('rejects sharing credential with a team member who lacks VIEW_CREDENTIALS permission', async () => {
      // Connect Bob to Telegram first
      await TeamMember.findByIdAndUpdate(unassignedMember._id, {
        telegramConnected: true,
        telegramUserId: '99887766',
        telegramChatId: '99887766',
      });

      // Add Bob to project
      await Project.findByIdAndUpdate(testProject._id, {
        $addToSet: { teamMemberIds: unassignedMember._id },
      });

      await expect(
        CredentialSharingService.shareCredentialWithTeamMember(
          testCredential._id.toString(),
          unassignedMember._id.toString(),
          'test-runner'
        )
      ).rejects.toThrow(/VIEW_CREDENTIALS permission/i);
    });

    it('rejects sharing credential if team member is NOT assigned to the project', async () => {
      // Remove Alice from project team
      await Project.findByIdAndUpdate(testProject._id, {
        $pull: { teamMemberIds: devMember._id },
      });

      await expect(
        CredentialSharingService.shareCredentialWithTeamMember(
          testCredential._id.toString(),
          devMember._id.toString(),
          'test-runner'
        )
      ).rejects.toThrow(/is not assigned to project/i);

      // Re-assign Alice for subsequent tests
      await Project.findByIdAndUpdate(testProject._id, {
        $addToSet: { teamMemberIds: devMember._id },
      });
    });

    it('rejects sharing credential if team member account is DEACTIVATED', async () => {
      await TeamMember.findByIdAndUpdate(devMember._id, { status: 'DEACTIVATED' });

      await expect(
        CredentialSharingService.shareCredentialWithTeamMember(
          testCredential._id.toString(),
          devMember._id.toString(),
          'test-runner'
        )
      ).rejects.toThrow(/is not active/i);

      // Reactivate Alice
      await TeamMember.findByIdAndUpdate(devMember._id, { status: 'ACTIVE' });
      devMember = await TeamMember.findById(devMember._id);
    });

    it('successfully authorizes and shares credential via Telegram when all criteria are met', async () => {
      // Ensure Alice is Active and assigned to project
      await TeamMember.findByIdAndUpdate(devMember._id, { status: 'ACTIVE' });
      await Project.findByIdAndUpdate(testProject._id, { $addToSet: { teamMemberIds: devMember._id } });

      let cred = await Credential.findById(testCredential._id);
      if (!cred) {
        cred = await Credential.create({
          requestId: new mongoose.Types.ObjectId(),
          clientId: testClient._id,
          projectId: testProject._id,
          service: encrypt('Test Service API'),
          username: encrypt('admin_user'),
          password: encrypt('SuperSecretP@ss123!'),
          loginUrl: encrypt('https://api.example.com/login'),
          additionalInfo: encrypt('Staging API keys'),
          version: 1,
        });
        testCredential = cred;
      }

      const result = await CredentialSharingService.shareCredentialWithTeamMember(
        testCredential._id.toString(),
        devMember._id.toString(),
        'test-runner',
        { oneTime: true, notes: 'Staging deployment' }
      );

      expect(result.success).toBe(true);
      expect(result.teamMemberName).toBe('Alice Developer');

      // Security check: API response must NOT contain plaintext password
      expect((result as any).password).toBeUndefined();
      expect((result as any).username).toBeUndefined();

      // Check Audit Log for CREDENTIAL_SHARED event
      const log = await AuditLog.findOne({
        action: 'CREDENTIAL_SHARED',
        entityId: testCredential._id,
      }).sort({ timestamp: -1 });

      expect(log).not.toBeNull();
      expect(log?.metadata?.teamMemberName).toBe('Alice Developer');
      expect(log?.metadata?.credentialCode).toBeDefined();
      // Must not contain plaintext in audit log metadata
      expect(JSON.stringify(log?.metadata)).not.toContain('SuperSecretP@ss123!');
    });
  });

  describe('5. Telegram Webhook Routing for Team Members', () => {
    it('handles interactive task callback query from team member', async () => {
      // Ensure Alice is Active and has project membership
      await TeamMember.findByIdAndUpdate(devMember._id, { status: 'ACTIVE' });
      await Project.findByIdAndUpdate(testProject._id, { $addToSet: { teamMemberIds: devMember._id } });

      const task = await TaskService.createTask(
        {
          title: 'Test Task: Configure Webhook',
          projectId: testProject._id.toString(),
          assignedTo: devMember._id.toString(),
          priority: 'MEDIUM',
        },
        'test-runner'
      );

      // Simulate Telegram inline callback query update
      const update = {
        update_id: Math.floor(Math.random() * 1000000),
        callback_query: {
          id: 'cb_test_123',
          from: { id: 77889911, username: 'alicedev' },
          message: { chat: { id: 77889911 } },
          data: `task_prog:${task._id}`,
        },
      };

      const res = await TelegramService.handleWebhookUpdate(update);
      expect(res?.command).toBe('callback');

      const updatedTask = await Task.findById(task._id);
      expect(updatedTask?.status).toBe('IN_PROGRESS');
    });
  });
});
