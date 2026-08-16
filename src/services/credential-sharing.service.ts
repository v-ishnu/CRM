import mongoose from 'mongoose';
import Credential from '@/models/Credential';
import Project from '@/models/Project';
import Task from '@/models/Task';
import TeamMember from '@/models/TeamMember';
import AuditLog from '@/models/AuditLog';
import { decrypt } from '@/lib/security/encryption';
import { AuditService } from './audit.service';
import { TelegramService } from './telegram.service';
import { TeamMemberService } from './team-member.service';
import { dbConnect } from '@/lib/db/connect';

export interface ShareCredentialOptions {
  oneTime?: boolean;
  notes?: string;
}

export class CredentialSharingService {
  /**
   * Securely share only the minimal credentials explicitly required for a specific task
   */
  static async shareTaskCredentials(
    taskId: string,
    actor: string = 'Admin',
    options: ShareCredentialOptions = {}
  ): Promise<{
    success: boolean;
    taskId: string;
    teamMemberName: string;
    sharedCount: number;
    telegramSent: boolean;
    message?: string;
  }> {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      throw new Error('Invalid task ID format');
    }

    // 1. Load Task
    const task = await Task.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // 2. Verify Task has an assigned team member
    if (!task.assignedTo) {
      throw new Error('Cannot share credentials: Task has no assigned team member');
    }

    // 3. Verify Task Credential Access is not revoked
    if (task.credentialAccessRevoked) {
      throw new Error('Credential access for this task has been revoked. Re-enable access before sharing.');
    }

    // 4. Verify Task has required credentials specified
    if (!task.requiredCredentialIds || task.requiredCredentialIds.length === 0) {
      throw new Error('No specific credentials are required for this task. Select required credentials before sharing.');
    }

    // 5. Load Project & verify Task belongs to Project
    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new Error('Associated project not found');
    }

    // 6. Load Team Member & verify ACTIVE status
    const teamMember = await TeamMember.findById(task.assignedTo);
    if (!teamMember) {
      throw new Error('Assigned team member not found');
    }

    if (teamMember.status !== 'ACTIVE') {
      await AuditService.log({
        actor,
        action: 'CREDENTIAL_SHARE_FAILED',
        entityType: 'Task',
        entityId: task._id,
        metadata: {
          taskId: task._id,
          teamMemberId: teamMember._id,
          reason: `Team member is not active (status: ${teamMember.status})`,
        },
      });
      throw new Error(`Cannot share credentials: Team member is not active (current status: ${teamMember.status})`);
    }

    // 7. Verify Team Member belongs to Project team
    const isAssignedToProject = project.teamMemberIds && project.teamMemberIds.some(
      (id) => id.toString() === teamMember._id.toString()
    );
    if (!isAssignedToProject) {
      await AuditService.log({
        actor,
        action: 'CREDENTIAL_SHARE_FAILED',
        entityType: 'Task',
        entityId: task._id,
        metadata: {
          taskId: task._id,
          teamMemberId: teamMember._id,
          projectId: project._id,
          reason: 'Team member is not assigned to project team',
        },
      });
      throw new Error(`Cannot share credentials: Team member "${teamMember.name}" is not assigned to project "${project.name}"`);
    }

    // 8. Verify Team Member has VIEW_CREDENTIALS permission
    const hasCredPerm = TeamMemberService.hasPermission(teamMember, 'VIEW_CREDENTIALS');
    if (!hasCredPerm) {
      await AuditService.log({
        actor,
        action: 'CREDENTIAL_SHARE_FAILED',
        entityType: 'Task',
        entityId: task._id,
        metadata: {
          taskId: task._id,
          teamMemberId: teamMember._id,
          reason: 'Team member does not have VIEW_CREDENTIALS permission',
        },
      });
      throw new Error(`Cannot share credentials: Team member "${teamMember.name}" does not have VIEW_CREDENTIALS permission`);
    }

    // 9. Verify Team Member has Telegram connected
    if (!teamMember.telegramConnected || !teamMember.telegramChatId) {
      throw new Error(`Team member "${teamMember.name}" has not connected their Telegram account yet.`);
    }

    // 10. Load ONLY required credentials belonging to this project (Strict Least Privilege)
    const credentials = await Credential.find({
      _id: { $in: task.requiredCredentialIds },
      projectId: project._id,
      isRevoked: { $ne: true },
    });

    if (credentials.length === 0) {
      throw new Error('None of the required credentials for this task were found or active in the project');
    }

    // 11. Decrypt ONLY the required credentials right before dispatch
    const decryptedItems: Array<{
      service: string;
      username: string;
      password: string;
      loginUrl?: string;
      additionalInfo?: string;
      credentialId: string;
    }> = [];

    for (const cred of credentials) {
      try {
        const decryptedService = decrypt(cred.service);
        const decryptedUsername = decrypt(cred.username);
        const decryptedPassword = decrypt(cred.password);
        const decryptedLoginUrl = cred.loginUrl ? decrypt(cred.loginUrl) : undefined;
        const decryptedInfo = cred.additionalInfo ? decrypt(cred.additionalInfo) : undefined;

        decryptedItems.push({
          service: decryptedService,
          username: decryptedUsername,
          password: decryptedPassword,
          loginUrl: decryptedLoginUrl,
          additionalInfo: decryptedInfo,
          credentialId: cred._id.toString(),
        });
      } catch (decError) {
        console.error('Failed to decrypt task credential:', decError);
        throw new Error('Decryption failed for one or more required task credentials');
      }
    }

    // 12. Format minimal Telegram message with task context & strictly required credentials
    let messageText = `🔐 <b>Credentials for Task</b>\n\n` +
      `<b>Project:</b> ${project.name} (<code>${project.projectCode}</code>)\n` +
      `<b>Task:</b> ${task.title} (<code>${task.taskCode}</code>)\n` +
      `<b>Credentials Provided:</b> ${decryptedItems.length}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (let i = 0; i < decryptedItems.length; i++) {
      const item = decryptedItems[i];
      messageText += `<b>${i + 1}. Required Access: ${item.service}</b>\n`;
      if (item.loginUrl) messageText += `   <b>URL:</b> ${item.loginUrl}\n`;
      messageText += `   <b>Username:</b> <code>${item.username}</code>\n`;
      messageText += `   <b>Password:</b> <code>${item.password}</code>\n`;
      if (item.additionalInfo) messageText += `   <b>Notes:</b> ${item.additionalInfo}\n`;
      messageText += `\n`;
    }

    messageText += `<b>Shared by:</b> ${actor}\n`;
    if (options.oneTime) {
      messageText += `⚠️ <i>Confidential: This access is granted solely for completing task ${task.taskCode}. Do not share or forward.</i>`;
    }

    // 13. Dispatch to Telegram
    const dispatchResult = await TelegramService.sendMessageRaw(teamMember.telegramChatId, messageText);

    if (!dispatchResult.success) {
      await AuditService.log({
        actor,
        action: 'CREDENTIAL_SHARE_FAILED',
        entityType: 'Task',
        entityId: task._id,
        metadata: {
          taskId: task._id,
          teamMemberId: teamMember._id,
          telegramUserId: teamMember.telegramUserId,
          reason: dispatchResult.error || 'Telegram API delivery error',
        },
      });
      throw new Error(`Failed to send credentials via Telegram: ${dispatchResult.error || 'Telegram API error'}`);
    }

    // 14. Write Audit Trail for each shared credential & task access
    for (const item of decryptedItems) {
      await AuditService.log({
        actor,
        action: 'TASK_CREDENTIAL_SHARED',
        entityType: 'Task',
        entityId: task._id,
        metadata: {
          taskId: task._id,
          taskCode: task.taskCode,
          projectId: project._id,
          clientId: task.clientId,
          credentialId: item.credentialId,
          serviceName: item.service,
          teamMemberId: teamMember._id,
          teamMemberName: teamMember.name,
          telegramUserId: teamMember.telegramUserId,
          sharedBy: actor,
        },
      });

      await AuditService.log({
        actor: teamMember.name,
        action: 'TASK_CREDENTIAL_ACCESSED',
        entityType: 'Credential',
        entityId: item.credentialId,
        metadata: {
          taskId: task._id,
          taskCode: task.taskCode,
          projectId: project._id,
          teamMemberId: teamMember._id,
          telegramUserId: teamMember.telegramUserId,
          accessedThroughTask: true,
        },
      });
    }

    return {
      success: true,
      taskId: task._id.toString(),
      teamMemberName: teamMember.name,
      sharedCount: decryptedItems.length,
      telegramSent: true,
      message: `Successfully shared ${decryptedItems.length} required credential(s) for task "${task.title}" with ${teamMember.name} via Telegram.`,
    };
  }

  /**
   * Revoke team member access to a task's credentials (e.g. upon task completion)
   */
  static async revokeTaskCredentialAccess(
    taskId: string,
    actor: string = 'Admin'
  ): Promise<{ success: boolean; message: string }> {
    await dbConnect();

    const task = await Task.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    task.credentialAccessRevoked = true;
    await task.save();

    await AuditService.log({
      actor,
      action: 'TASK_CREDENTIAL_REVOKED',
      entityType: 'Task',
      entityId: task._id,
      metadata: {
        taskId: task._id,
        taskCode: task.taskCode,
        projectId: task.projectId,
        assignedTo: task.assignedTo,
        revokedBy: actor,
      },
    });

    return {
      success: true,
      message: `Credential access revoked for task ${task.taskCode}.`,
    };
  }

  /**
   * Get sanitized audit history of credential sharing for a specific task
   */
  static async getTaskCredentialAccessHistory(taskId: string): Promise<any[]> {
    await dbConnect();
    if (!mongoose.Types.ObjectId.isValid(taskId)) return [];

    const logs = await AuditLog.find({
      $or: [
        { 'metadata.taskId': taskId },
        { entityId: taskId, action: { $in: ['TASK_CREDENTIAL_SHARED', 'TASK_CREDENTIAL_REVOKED', 'TASK_CREDENTIAL_ACCESSED', 'TASK_CREDENTIAL_ACCESS_GRANTED'] } },
      ],
    })
      .sort({ timestamp: -1 })
      .lean();

    return logs.map((log: any) => ({
      _id: log._id,
      action: log.action,
      actor: log.actor,
      timestamp: log.timestamp,
      serviceName: log.metadata?.serviceName || 'Credential',
      teamMemberName: log.metadata?.teamMemberName || log.actor,
      taskCode: log.metadata?.taskCode,
      sharedBy: log.metadata?.sharedBy,
    }));
  }

  /**
   * Backward-compatible direct single-credential sharing (validates active, project, and permissions)
   */
  static async shareCredentialWithTeamMember(
    credentialId: string,
    teamMemberId: string,
    actor: string = 'Admin',
    options: ShareCredentialOptions = {}
  ): Promise<{ success: boolean; credentialId: string; teamMemberName: string; telegramSent: boolean; message?: string }> {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(credentialId)) {
      throw new Error('Invalid credential ID format');
    }
    if (!mongoose.Types.ObjectId.isValid(teamMemberId)) {
      throw new Error('Invalid team member ID format');
    }

    const credential = await Credential.findById(credentialId);
    if (!credential) {
      throw new Error('Credential not found');
    }

    if (!credential.projectId) {
      throw new Error('Credential is not associated with any project');
    }

    const project = await Project.findById(credential.projectId);
    if (!project) {
      throw new Error('Associated project not found');
    }

    const teamMember = await TeamMember.findById(teamMemberId);
    if (!teamMember) {
      throw new Error('Team member not found');
    }

    if (teamMember.status !== 'ACTIVE') {
      await AuditService.log({
        actor,
        action: 'CREDENTIAL_SHARE_FAILED',
        entityType: 'Credential',
        entityId: credential._id,
        metadata: {
          teamMemberId: teamMember._id,
          reason: `Team member is not ACTIVE (status: ${teamMember.status})`,
        },
      });
      throw new Error(`Cannot share credential: Team member is not active (current status: ${teamMember.status})`);
    }

    const isAssigned = project.teamMemberIds && project.teamMemberIds.some(
      (id) => id.toString() === teamMember._id.toString()
    );
    if (!isAssigned) {
      await AuditService.log({
        actor,
        action: 'CREDENTIAL_SHARE_FAILED',
        entityType: 'Credential',
        entityId: credential._id,
        metadata: {
          teamMemberId: teamMember._id,
          projectId: project._id,
          reason: 'Team member is not assigned to this project team',
        },
      });
      throw new Error(`Cannot share credential: Team member "${teamMember.name}" is not assigned to project "${project.name}"`);
    }

    const hasCredPerm = TeamMemberService.hasPermission(teamMember, 'VIEW_CREDENTIALS');
    if (!hasCredPerm) {
      await AuditService.log({
        actor,
        action: 'CREDENTIAL_SHARE_FAILED',
        entityType: 'Credential',
        entityId: credential._id,
        metadata: {
          teamMemberId: teamMember._id,
          reason: 'Team member does not have VIEW_CREDENTIALS permission',
        },
      });
      throw new Error(`Cannot share credential: Team member "${teamMember.name}" does not have VIEW_CREDENTIALS permission`);
    }

    if (!teamMember.telegramConnected || !teamMember.telegramChatId) {
      throw new Error(`Team member "${teamMember.name}" has not connected their Telegram account yet. Please generate a Telegram connection link first.`);
    }

    let decryptedService = '';
    let decryptedUsername = '';
    let decryptedPassword = '';
    let decryptedLoginUrl = '';
    let decryptedNotes = '';

    try {
      decryptedService = decrypt(credential.service);
      decryptedUsername = decrypt(credential.username);
      decryptedPassword = decrypt(credential.password);
      if (credential.loginUrl) decryptedLoginUrl = decrypt(credential.loginUrl);
      if (credential.additionalInfo) decryptedNotes = decrypt(credential.additionalInfo);
    } catch (err: any) {
      console.error('Credential decryption error:', err);
      throw new Error('Failed to decrypt project credentials');
    }

    const credCode = `CRED-${credential._id.toString().slice(-6).toUpperCase()}`;

    const messageText = `🔐 <b>Project Credential Shared</b>\n\n` +
      `<b>Project:</b> ${project.name} (<code>${project.projectCode}</code>)\n` +
      `<b>Service:</b> ${decryptedService}\n` +
      `<b>Username:</b> <code>${decryptedUsername}</code>\n` +
      `<b>Password:</b> <code>${decryptedPassword}</code>\n` +
      `${decryptedLoginUrl ? `<b>Login URL:</b> ${decryptedLoginUrl}\n` : ''}${decryptedNotes ? `<b>Notes:</b> ${decryptedNotes}\n` : ''}` +
      `<b>Shared by:</b> ${actor}\n` +
      `<b>Credential ID:</b> <code>${credCode}</code>\n` +
      `${options.oneTime ? '\n⚠️ <i>Confidential: Do not forward or share these credentials outside your authorized scope.</i>' : ''}`;

    const dispatchResult = await TelegramService.sendMessageRaw(teamMember.telegramChatId, messageText);

    if (!dispatchResult.success) {
      await AuditService.log({
        actor,
        action: 'CREDENTIAL_SHARE_FAILED',
        entityType: 'Credential',
        entityId: credential._id,
        metadata: {
          teamMemberId: teamMember._id,
          telegramUserId: teamMember.telegramUserId,
          reason: dispatchResult.error || 'Telegram API returned error',
        },
      });

      throw new Error(`Failed to deliver credential via Telegram: ${dispatchResult.error || 'Telegram API error'}`);
    }

    await AuditService.log({
      actor,
      action: 'CREDENTIAL_SHARED',
      entityType: 'Credential',
      entityId: credential._id,
      metadata: {
        teamMemberId: teamMember._id,
        teamMemberName: teamMember.name,
        telegramUserId: teamMember.telegramUserId,
        projectId: project._id,
        clientId: credential.clientId,
        credentialCode: credCode,
        oneTime: !!options.oneTime,
      },
    });

    await AuditService.log({
      actor: teamMember.name,
      action: 'CREDENTIAL_ACCESSED',
      entityType: 'Credential',
      entityId: credential._id,
      metadata: {
        accessedBy: actor,
        teamMemberId: teamMember._id,
        telegramUserId: teamMember.telegramUserId,
        projectId: project._id,
      },
    });

    return {
      success: true,
      credentialId: credential._id.toString(),
      teamMemberName: teamMember.name,
      telegramSent: true,
      message: `Credential securely sent to ${teamMember.name} via Telegram.`,
    };
  }
}
