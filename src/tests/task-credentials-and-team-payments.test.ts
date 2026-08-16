import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db/connect';
import TeamMember from '@/models/TeamMember';
import Task from '@/models/Task';
import Project from '@/models/Project';
import Client from '@/models/Client';
import Credential from '@/models/Credential';
import TeamPayment from '@/models/TeamPayment';
import AuditLog from '@/models/AuditLog';
import DataRequest from '@/models/DataRequest';
import { TeamMemberService } from '@/services/team-member.service';
import { TaskService } from '@/services/task.service';
import { CredentialSharingService } from '@/services/credential-sharing.service';
import { TeamPaymentService } from '@/services/team-payment.service';
import { encrypt } from '@/lib/security/encryption';
import { TelegramService } from '@/services/telegram.service';

describe('Task-Based Minimal Credential Sharing & Team Member Payments', () => {
  let client: any;
  let project: any;
  let developer: any;
  let designer: any;
  let wpCredential: any;
  let cpanelCredential: any;
  let ftpCredential: any;
  let testTask: any;

  beforeAll(async () => {
    await dbConnect();

    // Clean up test data
    await TeamMember.deleteMany({ email: /@task-cred-test\.com$/ });
    await Task.deleteMany({ title: /^Task Cred/ });
    await Project.deleteMany({ name: /^Task Cred Project/ });
    await Client.deleteMany({ email: 'client@task-cred-test.com' });
    await TeamPayment.deleteMany({ reference: /^TP-TEST-/ });
    await AuditLog.deleteMany({ actor: 'test-admin' });

    // 1. Setup Client & Project
    client = await Client.create({
      clientCode: 'CL-TC-01',
      name: 'Task Cred Client',
      email: 'client@task-cred-test.com',
      status: 'ACTIVE',
    });

    project = await Project.create({
      projectCode: 'PRJ-TC-01',
      clientId: client._id,
      name: 'Task Cred Project (ABC Website)',
      serviceType: 'WEBSITE',
      totalAmount: 100000,
      currency: 'INR',
      status: 'IN_PROGRESS',
      teamMemberIds: [],
    });

    // 2. Setup Team Members
    developer = await TeamMemberService.createTeamMember(
      {
        name: 'Rahul Developer',
        email: 'rahul@task-cred-test.com',
        role: 'DEVELOPER',
        permissions: ['VIEW_CREDENTIALS', 'VIEW_TASKS', 'VIEW_PROJECT'],
      },
      'test-admin'
    );
    // Connect developer to Telegram
    developer.telegramConnected = true;
    developer.telegramUserId = '99887766';
    developer.telegramChatId = '99887766';
    await developer.save();

    designer = await TeamMemberService.createTeamMember(
      {
        name: 'Amit Designer',
        email: 'amit@task-cred-test.com',
        role: 'DESIGNER',
        permissions: ['VIEW_TASKS', 'VIEW_PROJECT'], // NO VIEW_CREDENTIALS!
      },
      'test-admin'
    );
    designer.telegramConnected = true;
    designer.telegramUserId = '11223344';
    designer.telegramChatId = '11223344';
    await designer.save();

    // Add developer & designer to project team
    project.teamMemberIds = [developer._id, designer._id];
    await project.save();

    // 3. Create Data Requests & Project Credentials
    const req1 = await DataRequest.create({
      requestId: 'REQ-2026-9001',
      clientId: client._id,
      projectId: project._id,
      type: 'CREDENTIAL',
      title: 'Request WordPress Credentials',
      message: 'Please send WP credentials',
      credentialType: 'WORDPRESS',
      requiredFields: ['service', 'username', 'password'],
      status: 'COMPLETED',
      telegramDeliveryStatus: 'SENT',
    });

    const req2 = await DataRequest.create({
      requestId: 'REQ-2026-9002',
      clientId: client._id,
      projectId: project._id,
      type: 'CREDENTIAL',
      title: 'Request cPanel Credentials',
      message: 'Please send cPanel credentials',
      credentialType: 'CPANEL',
      requiredFields: ['service', 'username', 'password'],
      status: 'COMPLETED',
      telegramDeliveryStatus: 'SENT',
    });

    const req3 = await DataRequest.create({
      requestId: 'REQ-2026-9003',
      clientId: client._id,
      projectId: project._id,
      type: 'CREDENTIAL',
      title: 'Request FTP Credentials',
      message: 'Please send FTP credentials',
      credentialType: 'FTP',
      requiredFields: ['service', 'username', 'password'],
      status: 'COMPLETED',
      telegramDeliveryStatus: 'SENT',
    });

    // Credential A: WordPress Admin (Required for Task)
    wpCredential = await Credential.create({
      requestId: req1._id,
      clientId: client._id,
      projectId: project._id,
      service: encrypt('WordPress Admin'),
      username: encrypt('wp_rahul'),
      password: encrypt('SuperSecretWpPass123!'),
      loginUrl: encrypt('https://abc-website.com/wp-admin'),
    });

    // Credential B: cPanel (Hosting - Unrelated)
    cpanelCredential = await Credential.create({
      requestId: req2._id,
      clientId: client._id,
      projectId: project._id,
      service: encrypt('cPanel Hosting'),
      username: encrypt('cpanel_root'),
      password: encrypt('RootServerPassword999!'),
      loginUrl: encrypt('https://abc-website.com:2083'),
    });

    // Credential C: FTP (Unrelated)
    ftpCredential = await Credential.create({
      requestId: req3._id,
      clientId: client._id,
      projectId: project._id,
      service: encrypt('FTP Server'),
      username: encrypt('ftp_user'),
      password: encrypt('FtpPass321!'),
    });
  });

  afterAll(async () => {
    await TeamMember.deleteMany({ email: /@task-cred-test\.com$/ });
    await Task.deleteMany({ title: /^Task Cred/ });
    await Project.deleteMany({ name: /^Task Cred Project/ });
    await Client.deleteMany({ email: 'client@task-cred-test.com' });
    await Credential.deleteMany({ projectId: project._id });
    await DataRequest.deleteMany({ requestId: /^REQ-2026-900/ });
    await TeamPayment.deleteMany({ reference: /^TP-TEST-/ });
  });

  describe('Part 1: Task Creation with Required Access & Least Privilege', () => {
    it('creates a task referencing ONLY the required credentials without storing plaintext/ciphertext copies', async () => {
      testTask = await TaskService.createTask(
        {
          title: 'Task Cred: Update WordPress Content',
          description: 'Update home page hero banner and copy',
          projectId: project._id.toString(),
          assignedTo: developer._id.toString(),
          priority: 'HIGH',
          agreedAmount: 5000,
          requiredCredentialIds: [wpCredential._id.toString()], // Only WordPress!
        },
        'test-admin'
      );

      expect(testTask.taskCode).toMatch(/^TSK-\d{4}$/);
      expect(testTask.requiredCredentialIds).toHaveLength(1);
      expect(testTask.requiredCredentialIds[0].toString()).toBe(wpCredential._id.toString());
      expect(testTask.agreedAmount).toBe(5000);
      expect((testTask as any).password).toBeUndefined();
      expect((testTask as any).username).toBeUndefined();
    });

    it('rejects credential sharing if team member lacks VIEW_CREDENTIALS permission', async () => {
      const designerTask = await TaskService.createTask(
        {
          title: 'Task Cred: Update UI Layout',
          projectId: project._id.toString(),
          assignedTo: designer._id.toString(),
          requiredCredentialIds: [wpCredential._id.toString()],
        },
        'test-admin'
      );

      await expect(
        CredentialSharingService.shareTaskCredentials(designerTask._id.toString(), 'test-admin')
      ).rejects.toThrow(/does not have VIEW_CREDENTIALS permission/i);
    });

    it('rejects credential sharing if team member is DEACTIVATED', async () => {
      const deactivatedDev = await TeamMemberService.createTeamMember(
        {
          name: 'Deactivated Dev',
          email: 'deactivated@task-cred-test.com',
          role: 'DEVELOPER',
          permissions: ['VIEW_CREDENTIALS'],
        },
        'test-admin'
      );
      deactivatedDev.status = 'DEACTIVATED';
      deactivatedDev.telegramConnected = true;
      deactivatedDev.telegramChatId = '123456';
      await deactivatedDev.save();

      project.teamMemberIds.push(deactivatedDev._id);
      await project.save();

      const deadTask = await Task.create({
        taskCode: 'TSK-9988',
        title: 'Task Cred: Inactive Task',
        clientId: client._id,
        projectId: project._id,
        assignedTo: deactivatedDev._id,
        createdBy: 'test-admin',
        priority: 'MEDIUM',
        status: 'TODO',
        requiredCredentialIds: [wpCredential._id],
      });

      await expect(
        CredentialSharingService.shareTaskCredentials(deadTask._id.toString(), 'test-admin')
      ).rejects.toThrow(/not active/i);
    });

    it('successfully shares ONLY the required task credentials and excludes unrelated project credentials', async () => {
      // Mock Telegram dispatch
      const sendMessageRawSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({
        success: true,
        messageId: 1001,
      });

      const result = await CredentialSharingService.shareTaskCredentials(
        testTask._id.toString(),
        'test-admin',
        { oneTime: true }
      );

      expect(result.success).toBe(true);
      expect(result.sharedCount).toBe(1);
      expect(result.teamMemberName).toBe('Rahul Developer');

      // Verify the dispatched Telegram text payload
      expect(sendMessageRawSpy).toHaveBeenCalled();
      const dispatchedMsg = sendMessageRawSpy.mock.calls[0][1];

      // Should include WordPress Admin
      expect(dispatchedMsg).toContain('WordPress Admin');
      expect(dispatchedMsg).toContain('wp_rahul');
      expect(dispatchedMsg).toContain('SuperSecretWpPass123!');
      expect(dispatchedMsg).toContain('https://abc-website.com/wp-admin');

      // MUST NOT include cPanel or FTP credentials!
      expect(dispatchedMsg).not.toContain('cPanel Hosting');
      expect(dispatchedMsg).not.toContain('RootServerPassword999!');
      expect(dispatchedMsg).not.toContain('FTP Server');
      expect(dispatchedMsg).not.toContain('FtpPass321!');

      sendMessageRawSpy.mockRestore();
    });

    it('verifies audit logs for task credential access without leaking plaintext passwords', async () => {
      const shareLogs = await AuditLog.find({
        action: 'TASK_CREDENTIAL_SHARED',
        'metadata.taskId': testTask._id,
      });

      expect(shareLogs.length).toBeGreaterThan(0);
      const log = shareLogs[0];
      expect(log.metadata?.serviceName).toBe('WordPress Admin');
      expect(log.metadata?.teamMemberName).toBe('Rahul Developer');

      // Crucial Security check: password and plaintext messages must NEVER be stored in audit logs
      const rawJson = JSON.stringify(log.toObject());
      expect(rawJson).not.toContain('SuperSecretWpPass123!');
      expect(rawJson).not.toContain('RootServerPassword999!');
    });

    it('revokes task credential access without deleting underlying project credentials', async () => {
      const revokeResult = await CredentialSharingService.revokeTaskCredentialAccess(
        testTask._id.toString(),
        'test-admin'
      );

      expect(revokeResult.success).toBe(true);

      const reloadedTask = await Task.findById(testTask._id);
      expect(reloadedTask?.credentialAccessRevoked).toBe(true);

      // Attempting to share again should now be rejected
      await expect(
        CredentialSharingService.shareTaskCredentials(testTask._id.toString(), 'test-admin')
      ).rejects.toThrow(/revoked/i);

      // Underlying project credential remains active in DB
      const credInDb = await Credential.findById(wpCredential._id);
      expect(credInDb).not.toBeNull();
      expect(credInDb?._id.toString()).toBe(wpCredential._id.toString());
    });
  });

  describe('Part 2: Team Member Payment System & Calculations', () => {
    let payment1: any;
    let payment2: any;

    it('records a team payment in PAID status with automated Telegram receipt dispatch', async () => {
      const sendTeamPaymentSpy = vi.spyOn(TelegramService, 'sendTeamPaymentNotification').mockResolvedValue(true);

      payment1 = await TeamPaymentService.recordTeamPayment(
        {
          teamMemberId: developer._id.toString(),
          projectId: project._id.toString(),
          taskId: testTask._id.toString(),
          amount: 2000,
          paymentMethod: 'UPI',
          reference: 'TP-TEST-UPI-001',
          description: 'First milestone payment for WordPress update',
          status: 'PAID',
        },
        'test-admin'
      );

      expect(payment1.paymentNumber).toMatch(/^TP-\d{4}-\d{4}$/);
      expect(payment1.amount).toBe(2000);
      expect(payment1.status).toBe('PAID');
      expect(payment1.notificationStatus).toBe('SENT');
      expect(payment1.notifiedEvents).toContain('PAID');
      expect(sendTeamPaymentSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'PAID'
      );

      sendTeamPaymentSpy.mockRestore();
    });

    it('records a second payment and accurately calculates task outstanding balance', async () => {
      payment2 = await TeamPaymentService.recordTeamPayment(
        {
          teamMemberId: developer._id.toString(),
          projectId: project._id.toString(),
          taskId: testTask._id.toString(),
          amount: 1500,
          paymentMethod: 'BANK_TRANSFER',
          reference: 'TP-TEST-BANK-002',
          description: 'Second milestone payment',
          status: 'PAID',
        },
        'test-admin'
      );

      const taskSummary = await TeamPaymentService.getTaskPaymentSummary(testTask._id.toString());
      expect(taskSummary.agreedAmount).toBe(5000);
      expect(taskSummary.totalPaid).toBe(3500); // 2000 + 1500
      expect(taskSummary.outstanding).toBe(1500); // 5000 - 3500
      expect(taskSummary.payments).toHaveLength(2);
    });

    it('accurately calculates team member payment balance (Assigned vs Paid vs Outstanding)', async () => {
      const memberSummary = await TeamPaymentService.getTeamMemberPaymentSummary(developer._id.toString());
      expect(memberSummary.totalAgreed).toBe(5000);
      expect(memberSummary.totalPaid).toBe(3500);
      expect(memberSummary.outstanding).toBe(1500);
      expect(memberSummary.paymentsCount).toBe(2);
    });

    it('accurately aggregates project team cost summary without impacting client revenue', async () => {
      const projSummary = await TeamPaymentService.getProjectTeamPaymentSummary(project._id.toString());
      expect(projSummary.totalAgreedCost).toBe(5000);
      expect(projSummary.totalPaidCost).toBe(3500);
      expect(projSummary.outstandingCost).toBe(1500);
      expect(projSummary.memberBreakdowns.length).toBeGreaterThanOrEqual(2);

      const devBreakdown = projSummary.memberBreakdowns.find((m) => m.teamMemberId === developer._id.toString());
      expect(devBreakdown?.paidAmount).toBe(3500);
      expect(devBreakdown?.outstandingAmount).toBe(1500);
    });

    it('retries failed notification successfully without creating duplicate payments', async () => {
      // Create payment with simulated failed notification
      const failedPayment = await TeamPayment.create({
        paymentNumber: 'TP-TEST-FAIL-01',
        teamMemberId: developer._id,
        projectId: project._id,
        amount: 500,
        currency: 'INR',
        paymentMethod: 'UPI',
        reference: 'TP-TEST-FAIL-REF',
        status: 'PAID',
        notificationStatus: 'FAILED',
        notificationError: 'Network timeout',
        notifiedEvents: [],
        createdBy: 'test-admin',
      });

      const notifySpy = vi.spyOn(TelegramService, 'sendTeamPaymentNotification').mockResolvedValue(true);

      const retryResult = await TeamPaymentService.retryTeamPaymentNotification(
        failedPayment._id.toString(),
        'test-admin'
      );

      expect(retryResult).toBe(true);

      const reloadedPayment = await TeamPayment.findById(failedPayment._id);
      expect(reloadedPayment?.notificationStatus).toBe('SENT');
      expect(reloadedPayment?.notifiedEvents).toContain('PAID');

      notifySpy.mockRestore();
    });

    it('prevents duplicate notification on update when payment is already notified', async () => {
      const notifySpy = vi.spyOn(TelegramService, 'sendTeamPaymentNotification');

      // Update description only
      await TeamPaymentService.updateTeamPayment(
        payment1._id.toString(),
        { description: 'Updated notes only' },
        'test-admin'
      );

      expect(notifySpy).not.toHaveBeenCalled();
      notifySpy.mockRestore();
    });
  });

  describe('Part 3: Telegram /mypayments Command', () => {
    it('returns only the authenticated team member payments summary and recent logs', async () => {
      const sendRawSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({
        success: true,
        messageId: 9999,
      });
      sendRawSpy.mockClear();

      await (TelegramService as any).handleTeamMemberCommand(
        developer.telegramChatId,
        '/mypayments',
        developer
      );

      expect(sendRawSpy).toHaveBeenCalled();
      const responseMsg = sendRawSpy.mock.calls[0][1];

      expect(responseMsg).toContain('Your Payments Summary');
      expect(responseMsg).toContain('Paid:');
      expect(responseMsg).toContain('Recent Payments');

      sendRawSpy.mockRestore();
    });
  });
});
