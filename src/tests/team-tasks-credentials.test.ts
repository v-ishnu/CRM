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

  describe('5. Telegram Webhook Routing, Identity Resolution & Task Callbacks', () => {
    beforeAll(async () => {
      await TeamMember.findByIdAndUpdate(devMember._id, {
        telegramUserId: '77889911',
        telegramChatId: '77889911',
        telegramUsername: 'alicedev',
        status: 'ACTIVE',
      });
      devMember.telegramUserId = '77889911';

      await Client.findByIdAndUpdate(testClient._id, {
        telegramUserId: '77889922',
        telegramChatId: '77889922',
        telegramConnected: true,
      });
      testClient.telegramUserId = '77889922';
    });

    it('accurately resolves telegram identity for ADMIN, TEAM_MEMBER, CLIENT, CONFLICT, and UNLINKED', async () => {
      process.env.ADMIN_TELEGRAM_ID = '99999999';

      // 1. ADMIN
      const adminIdent = await TelegramService.resolveTelegramIdentity('99999999');
      expect(adminIdent.type).toBe('ADMIN');

      // 2. TEAM_MEMBER
      const memberIdent = await TelegramService.resolveTelegramIdentity(devMember.telegramUserId);
      expect(memberIdent.type).toBe('TEAM_MEMBER');
      expect(memberIdent.teamMember?.email).toBe(devMember.email);

      // 3. CLIENT
      const clientIdent = await TelegramService.resolveTelegramIdentity(testClient.telegramUserId);
      expect(clientIdent.type).toBe('CLIENT');
      expect(clientIdent.client?.clientCode).toBe(testClient.clientCode);

      // 4. UNLINKED
      const unlinkedIdent = await TelegramService.resolveTelegramIdentity('123000999');
      expect(unlinkedIdent.type).toBe('UNLINKED');

      // 5. CONFLICT
      const conflictUserId = '777000111';
      const conflictClient = await Client.create({
        clientCode: 'CL-CON-01',
        name: 'Conflict Client',
        email: 'conflict_client@example.com',
        telegramUserId: conflictUserId,
        telegramConnected: true,
      });
      const conflictMember = await TeamMember.create({
        name: 'Conflict Member',
        email: 'conflict_member@example.com',
        role: 'DEVELOPER',
        telegramUserId: conflictUserId,
        status: 'ACTIVE',
      });

      const conflictIdent = await TelegramService.resolveTelegramIdentity(conflictUserId);
      expect(conflictIdent.type).toBe('CONFLICT');

      // Cleanup conflict test records
      await Client.deleteOne({ _id: conflictClient._id });
      await TeamMember.deleteOne({ _id: conflictMember._id });
    });

    it('handles structured team_task:start callback query from authorized team member', async () => {
      await TeamMember.findByIdAndUpdate(devMember._id, { telegramUserId: '77889911', status: 'ACTIVE' });
      await Project.findByIdAndUpdate(testProject._id, { $addToSet: { teamMemberIds: devMember._id } });

      const task = await TaskService.createTask(
        {
          title: 'Test Task: Start Action',
          projectId: testProject._id.toString(),
          assignedTo: devMember._id.toString(),
          priority: 'HIGH',
        },
        'test-runner'
      );

      const update = {
        update_id: Math.floor(Math.random() * 1000000),
        callback_query: {
          id: 'cb_start_01',
          from: { id: 77889911, username: 'alicedev' },
          message: { chat: { id: 77889911 }, message_id: 101 },
          data: `team_task:start:${task._id}`,
        },
      };

      const res = await TelegramService.handleWebhookUpdate(update);
      expect(res?.command).toBe('callback');

      const updatedTask = await Task.findById(task._id);
      expect(updatedTask?.status).toBe('IN_PROGRESS');

      // Verify audit log
      const startLog = await AuditLog.findOne({
        action: 'TASK_STARTED',
        entityId: { $in: [task._id, task._id.toString()] },
      });
      expect(startLog).not.toBeNull();
      expect(startLog?.actor).toBe(devMember.email);

      // Verify idempotency: starting already in-progress task does not error
      const repeatRes = await TelegramService.handleWebhookUpdate({
        ...update,
        update_id: Math.floor(Math.random() * 1000000),
      });
      expect(repeatRes?.command).toBe('callback');
    });

    it('handles structured team_task:complete callback query and records completedAt', async () => {
      const task = await TaskService.createTask(
        {
          title: 'Test Task: Complete Action',
          projectId: testProject._id.toString(),
          assignedTo: devMember._id.toString(),
          priority: 'URGENT',
        },
        'test-runner'
      );

      const update = {
        update_id: Math.floor(Math.random() * 1000000),
        callback_query: {
          id: 'cb_comp_01',
          from: { id: 77889911, username: 'alicedev' },
          message: { chat: { id: 77889911 }, message_id: 102 },
          data: `team_task:complete:${task._id}`,
        },
      };

      const res = await TelegramService.handleWebhookUpdate(update);
      expect(res?.command).toBe('callback');

      const updatedTask = await Task.findById(task._id);
      expect(updatedTask?.status).toBe('COMPLETED');
      expect(updatedTask?.completedAt).toBeDefined();

      // Verify audit log
      const compLog = await AuditLog.findOne({
        action: 'TASK_COMPLETED',
        entityId: { $in: [task._id, task._id.toString()] },
      });
      expect(compLog).not.toBeNull();
      expect(compLog?.actor).toBe(devMember.email);
    });

    it('rejects callback queries from unauthorized team member and logs TASK_ACTION_DENIED', async () => {
      // Create another team member with unique email and unique telegram ID
      const randSuffix = Math.floor(Math.random() * 1000000);
      const randUserId = String(Math.floor(Math.random() * 800000 + 100000));
      const otherMember = await TeamMember.create({
        name: 'Bob Other',
        email: `bob_other_${randSuffix}@example.com`,
        role: 'DEVELOPER',
        telegramUserId: randUserId,
        status: 'ACTIVE',
      });

      const task = await TaskService.createTask(
        {
          title: 'Alice Task: Unauthorized Test',
          projectId: testProject._id.toString(),
          assignedTo: devMember._id.toString(),
          priority: 'MEDIUM',
        },
        'test-runner'
      );

      // Bob attempts Alice's task
      const update = {
        update_id: Math.floor(Math.random() * 1000000),
        callback_query: {
          id: 'cb_denied_01',
          from: { id: Number(randUserId), username: 'bobother' },
          message: { chat: { id: Number(randUserId) }, message_id: 103 },
          data: `team_task:start:${task._id}`,
        },
      };

      await TelegramService.handleWebhookUpdate(update);

      // Task status should remain unchanged
      const taskCheck = await Task.findById(task._id);
      expect(taskCheck?.status).toBe('TODO');

      // Verify denied audit log
      const deniedLog = await AuditLog.findOne({
        action: 'TASK_ACTION_DENIED',
        entityId: { $in: [task._id, task._id.toString()] },
        actor: otherMember.email,
      });
      expect(deniedLog).not.toBeNull();
      expect(deniedLog?.metadata?.reason).toBe('NOT_ASSIGNED_TO_TASK');

      // Cleanup
      await TeamMember.deleteOne({ _id: otherMember._id });
    });

    it('handles role-based text commands and custom reply keyboard for Team Member', async () => {
      // 1. Team member /start
      const startRes = await TelegramService.handleWebhookUpdate({
        update_id: Math.floor(Math.random() * 1000000),
        message: {
          chat: { id: 77889911 },
          from: { id: 77889911, username: 'alicedev' },
          text: '/start',
        },
      });
      expect(startRes?.command).toBe('/start');

      // 2. Team member reply button "📋 My Tasks"
      const tasksRes = await TelegramService.handleWebhookUpdate({
        update_id: Math.floor(Math.random() * 1000000),
        message: {
          chat: { id: 77889911 },
          from: { id: 77889911, username: 'alicedev' },
          text: '📋 My Tasks',
        },
      });
      expect(tasksRes?.command).toBe('/tasks');

      // 3. Team member reply button "💰 My Payments"
      const paymentsRes = await TelegramService.handleWebhookUpdate({
        update_id: Math.floor(Math.random() * 1000000),
        message: {
          chat: { id: 77889911 },
          from: { id: 77889911, username: 'alicedev' },
          text: '💰 My Payments',
        },
      });
      expect(paymentsRes?.command).toBe('/mypayments');

      // 4. Team member reply button "📁 My Projects"
      const projectsRes = await TelegramService.handleWebhookUpdate({
        update_id: Math.floor(Math.random() * 1000000),
        message: {
          chat: { id: 77889911 },
          from: { id: 77889911, username: 'alicedev' },
          text: '📁 My Projects',
        },
      });
      expect(projectsRes?.command).toBe('/myprojects');

      // 5. Team member reply button "👤 My Profile"
      const profileRes = await TelegramService.handleWebhookUpdate({
        update_id: Math.floor(Math.random() * 1000000),
        message: {
          chat: { id: 77889911 },
          from: { id: 77889911, username: 'alicedev' },
          text: '👤 My Profile',
        },
      });
      expect(profileRes?.command).toBe('/myprofile');
    }, 15000);

    it('prevents team members from accessing client commands and logs TEAM_MEMBER_COMMAND_DENIED', async () => {
      // Team member attempts /invoices
      const invoicesRes = await TelegramService.handleWebhookUpdate({
        update_id: Math.floor(Math.random() * 1000000),
        message: {
          chat: { id: 77889911 },
          from: { id: 77889911, username: 'alicedev' },
          text: '/invoices',
        },
      });
      expect(invoicesRes?.command).toBe('/invoices');

      // Verify audit log
      const deniedCmdLog = await AuditLog.findOne({
        action: 'TEAM_MEMBER_COMMAND_DENIED',
        actor: devMember.email,
      });
      expect(deniedCmdLog).not.toBeNull();
      expect(deniedCmdLog?.metadata?.reason).toBe('CLIENT_COMMAND_BLOCKED_FOR_TEAM_MEMBER');
    });

    it('prevents client from accessing team member commands', async () => {
      // Client sends /tasks -> routes to client handler and returns unknown command response
      const clientTasksRes = await TelegramService.handleWebhookUpdate({
        update_id: Math.floor(Math.random() * 1000000),
        message: {
          chat: { id: 77889922 },
          from: { id: 77889922, username: 'test_client_team' },
          text: '/tasks',
        },
      });
      expect(clientTasksRes?.command).toBe('/tasks');
    });

    it('handles details and credentials callbacks with audit logging and permission enforcement', async () => {
      const task = await TaskService.createTask(
        {
          title: 'Test Task: Details and Creds',
          projectId: testProject._id.toString(),
          assignedTo: devMember._id.toString(),
          priority: 'MEDIUM',
          requiredCredentialIds: [testCredential._id.toString()],
        },
        'test-runner'
      );

      // 1. Details callback
      const detailsUpdate = {
        update_id: Math.floor(Math.random() * 1000000),
        callback_query: {
          id: 'cb_details_01',
          from: { id: 77889911, username: 'alicedev' },
          message: { chat: { id: 77889911 }, message_id: 104 },
          data: `team_task:details:${task._id}`,
        },
      };

      const detRes = await TelegramService.handleWebhookUpdate(detailsUpdate);
      expect(detRes?.command).toBe('callback');

      const viewLog = await AuditLog.findOne({
        action: 'TASK_VIEWED',
        entityId: { $in: [task._id, task._id.toString()] },
      });
      expect(viewLog).not.toBeNull();
      expect(viewLog?.actor).toBe(devMember.email);

      // 2. Credentials callback
      const credsUpdate = {
        update_id: Math.floor(Math.random() * 1000000),
        callback_query: {
          id: 'cb_creds_01',
          from: { id: 77889911, username: 'alicedev' },
          message: { chat: { id: 77889911 }, message_id: 105 },
          data: `team_task:credentials:${task._id}`,
        },
      };

      const credsRes = await TelegramService.handleWebhookUpdate(credsUpdate);
      expect(credsRes?.command).toBe('callback');

      const credsLog = await AuditLog.findOne({
        action: 'TASK_CREDENTIALS_VIEWED',
        entityId: { $in: [task._id, task._id.toString()] },
      });
      expect(credsLog).not.toBeNull();
      expect(credsLog?.actor).toBe(devMember.email);
    });

    it('rejects client attempting a team task callback query', async () => {
      const task = await TaskService.createTask(
        {
          title: 'Alice Task: Client Callback Attack',
          projectId: testProject._id.toString(),
          assignedTo: devMember._id.toString(),
          priority: 'HIGH',
        },
        'test-runner'
      );

      // Client attempts Alice's task callback
      const update = {
        update_id: Math.floor(Math.random() * 1000000),
        callback_query: {
          id: 'cb_client_attack_01',
          from: { id: 77889922, username: 'test_client_team' },
          message: { chat: { id: 77889922 }, message_id: 106 },
          data: `team_task:start:${task._id}`,
        },
      };

      await TelegramService.handleWebhookUpdate(update);

      const taskCheck = await Task.findById(task._id);
      expect(taskCheck?.status).toBe('TODO');
    });

    it('syncChatCommands correctly configures role-specific command scopes', async () => {
      const spyFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          json: async () => ({ ok: true, result: true }),
        } as any;
      });

      const ok = await TelegramService.syncChatCommands('77889911', 'TEAM_MEMBER', true);
      expect(ok).toBe(true);

      const clientOk = await TelegramService.syncChatCommands('77889922', 'CLIENT', true);
      expect(clientOk).toBe(true);

      spyFetch.mockRestore();
    });

    it('handles team_task:done:<taskId> alias to mark task as completed', async () => {
      const task = await TaskService.createTask(
        {
          title: 'Test Task: Done Alias Action',
          projectId: testProject._id.toString(),
          assignedTo: devMember._id.toString(),
          priority: 'HIGH',
        },
        'test-runner'
      );

      const update = {
        update_id: Math.floor(Math.random() * 1000000),
        callback_query: {
          id: 'cb_done_alias_01',
          from: { id: 77889911, username: 'alicedev' },
          message: { chat: { id: 77889911 }, message_id: 107 },
          data: `team_task:done:${task._id}`,
        },
      };

      const res = await TelegramService.handleWebhookUpdate(update);
      expect(res?.command).toBe('callback');

      const updatedTask = await Task.findById(task._id);
      expect(updatedTask?.status).toBe('COMPLETED');
      expect(updatedTask?.completedAt).toBeDefined();
    });

    it('rejects callback queries from inactive/deactivated team members with TASK_ACTION_DENIED', async () => {
      const randSuffix = Math.floor(Math.random() * 1000000);
      const randUserId = String(Math.floor(Math.random() * 800000 + 100000));
      const inactiveMember = await TeamMember.create({
        name: 'Inactive Dev',
        email: `inactive_dev_${randSuffix}@example.com`,
        role: 'DEVELOPER',
        telegramUserId: randUserId,
        status: 'DEACTIVATED',
      });

      const task = await TaskService.createTask(
        {
          title: 'Task for Inactive Dev',
          projectId: testProject._id.toString(),
          priority: 'LOW',
        },
        'test-runner'
      );
      // Manually set assignee to bypass createTask validation
      task.assignedTo = inactiveMember._id as any;
      await task.save();

      const update = {
        update_id: Math.floor(Math.random() * 1000000),
        callback_query: {
          id: 'cb_inactive_01',
          from: { id: Number(randUserId), username: 'inactivedev' },
          message: { chat: { id: Number(randUserId) }, message_id: 108 },
          data: `team_task:start:${task._id}`,
        },
      };

      await TelegramService.handleWebhookUpdate(update);

      const taskCheck = await Task.findById(task._id);
      expect(taskCheck?.status).toBe('TODO');

      const deniedLog = await AuditLog.findOne({
        action: 'TASK_ACTION_DENIED',
        actor: inactiveMember.email,
      });
      expect(deniedLog).not.toBeNull();

      await TeamMember.deleteOne({ _id: inactiveMember._id });
    });

    it('rejects invalid MongoDB task ID cleanly without throwing CastError', async () => {
      const update = {
        update_id: Math.floor(Math.random() * 1000000),
        callback_query: {
          id: 'cb_invalid_id_01',
          from: { id: 77889911, username: 'alicedev' },
          message: { chat: { id: 77889911 }, message_id: 109 },
          data: `team_task:start:invalid_task_id_123`,
        },
      };

      const res = await TelegramService.handleWebhookUpdate(update);
      expect(res?.command).toBe('callback');
      expect(res?.action).toBe('start');
    });

    it('verifies sendTaskAssignedNotification creates exactly four inline buttons and task creation succeeds', async () => {
      const spySend = vi.spyOn(TelegramService, 'sendMessageRaw');

      const task = await TaskService.createTask(
        {
          title: 'Four Buttons Verification Task',
          projectId: testProject._id.toString(),
          assignedTo: devMember._id.toString(),
          priority: 'URGENT',
          dueDate: new Date('2026-08-28'),
          description: 'Add WordPress content to the website.',
        },
        'Admin'
      );

      expect(task).toBeDefined();
      expect(task.taskCode).toBeDefined();

      expect(spySend).toHaveBeenCalled();
      const lastCallArgs = spySend.mock.calls[spySend.mock.calls.length - 1];
      const buttons = lastCallArgs[2]?.reply_markup?.inline_keyboard;
      expect(buttons).toBeDefined();
      expect(buttons.length).toBe(2);
      expect(buttons[0].length).toBe(2);
      expect(buttons[1].length).toBe(2);

      // Verify button texts and callback data
      expect(buttons[0][0].text).toBe('⚡ Start Working');
      expect(buttons[0][0].callback_data).toBe(`team_task:start:${task._id}`);
      expect(buttons[0][1].text).toBe('✅ Mark as Done');
      expect(buttons[0][1].callback_data).toBe(`team_task:done:${task._id}`);
      expect(buttons[1][0].text).toBe('📋 View Details');
      expect(buttons[1][0].callback_data).toBe(`team_task:details:${task._id}`);
      expect(buttons[1][1].text).toBe('🔐 Credentials');
      expect(buttons[1][1].callback_data).toBe(`team_task:credentials:${task._id}`);
    });
  });
});
