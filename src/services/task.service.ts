import mongoose from 'mongoose';
import Task, { ITask, TaskPriority, TaskStatus, SubmissionType } from '@/models/Task';
import Project from '@/models/Project';
import Client from '@/models/Client';
import TeamMember from '@/models/TeamMember';
import Credential from '@/models/Credential';
import { TeamMemberService } from './team-member.service';
import { AuditService } from './audit.service';
import { TelegramService } from './telegram.service';
import { CredentialSharingService } from './credential-sharing.service';
import { decrypt } from '@/lib/security/encryption';
import { dbConnect } from '@/lib/db/connect';

export interface CreateTaskDTO {
  title: string;
  description?: string;
  projectId: string | mongoose.Types.ObjectId;
  clientId?: string | mongoose.Types.ObjectId;
  assignedTo?: string | mongoose.Types.ObjectId;
  priority?: TaskPriority;
  dueDate?: string | Date;
  attachments?: Array<{ name: string; url: string; size?: number; type?: string }>;
  requiredCredentialIds?: Array<string | mongoose.Types.ObjectId>;
  agreedAmount?: number;
  autoShareCredentials?: boolean;
  submissionRequired?: boolean;
  submissionTypes?: SubmissionType[];
  maxFileSizeMb?: number;
  submissionInstructions?: string;
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  projectId?: string | mongoose.Types.ObjectId;
  clientId?: string | mongoose.Types.ObjectId;
  assignedTo?: string | mongoose.Types.ObjectId;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | Date;
  attachments?: Array<{ name: string; url: string; size?: number; type?: string }>;
  requiredCredentialIds?: Array<string | mongoose.Types.ObjectId>;
  agreedAmount?: number;
  autoShareCredentials?: boolean;
  credentialAccessRevoked?: boolean;
  submissionRequired?: boolean;
  submissionTypes?: SubmissionType[];
  maxFileSizeMb?: number;
  submissionInstructions?: string;
}

export interface SubmitTaskDTO {
  submissionNotes?: string;
  submissionUrls?: string[];
  submissionFiles?: Array<{
    fileName: string;
    fileSize: number;
    mimeType: string;
    storagePath: string;
    uploadedAt?: Date;
  }>;
}

export class TaskService {
  /**
   * Auto-generate sequential task codes (TSK-0001, TSK-0002, ...)
   */
  static async generateNextTaskCode(): Promise<string> {
    await dbConnect();
    const count = await Task.countDocuments();
    let num = count + 1;
    let code = `TSK-${String(num).padStart(4, '0')}`;

    while (await Task.exists({ taskCode: code })) {
      num++;
      code = `TSK-${String(num).padStart(4, '0')}`;
    }

    return code;
  }

  /**
   * Create a new task
   */
  static async createTask(data: CreateTaskDTO, actor: string = 'system'): Promise<ITask> {
    await dbConnect();

    if (!data.title || !data.title.trim()) {
      throw new Error('Task title is required');
    }

    if (!data.projectId) {
      throw new Error('Project is required');
    }

    // Parallelize validation lookups to eliminate serial round trips
    const [project, client, assignedMember] = await Promise.all([
      Project.findById(data.projectId),
      data.clientId ? Client.findById(data.clientId) : Promise.resolve(null),
      data.assignedTo ? TeamMember.findById(data.assignedTo) : Promise.resolve(null),
    ]);

    if (!project) {
      throw new Error('Project not found');
    }

    // Validate Client -> Project relationship
    if (data.clientId) {
      if (!client) {
        throw new Error('Client not found');
      }

      const projectClientId = project.clientId?.toString();
      const requestedClientId = data.clientId.toString();
      if (projectClientId && projectClientId !== requestedClientId) {
        throw new Error('Invalid relationship: Selected project does not belong to the selected client');
      }
    }

    if (data.assignedTo) {
      if (!assignedMember) {
        throw new Error('Assigned team member not found');
      }
      if (assignedMember.status === 'DEACTIVATED') {
        throw new Error('Cannot assign task to a deactivated team member');
      }

      // Ensure the assigned team member belongs to the project team
      const isProjectTeamMember = project.teamMemberIds && project.teamMemberIds.some(
        (id) => id.toString() === assignedMember._id.toString()
      );
      if (!isProjectTeamMember) {
        // Auto-add to project team if not already in list
        project.teamMemberIds = project.teamMemberIds || [];
        project.teamMemberIds.push(assignedMember._id as any);
        await project.save();
      }
    }

    // Server-side strict credential validation:
    // 1. Must belong to this project
    // 2. Must not be revoked
    // 3. Assigned team member must have VIEW_CREDENTIALS and permission for this credential type
    if (data.requiredCredentialIds && data.requiredCredentialIds.length > 0) {
      await this.validateTaskCredentials(data.requiredCredentialIds, project._id, assignedMember);
    }

    const taskCode = await this.generateNextTaskCode();

    const task = new Task({
      taskCode,
      title: data.title.trim(),
      description: data.description?.trim(),
      clientId: project.clientId, // Automatically derived from the project!
      projectId: project._id,
      assignedTo: assignedMember?._id,
      createdBy: actor,
      priority: data.priority || 'MEDIUM',
      status: 'TODO',
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      attachments: data.attachments || [],
      requiredCredentialIds: data.requiredCredentialIds || [],
      agreedAmount: data.agreedAmount !== undefined ? Number(data.agreedAmount) : undefined,
      autoShareCredentials: !!data.autoShareCredentials,
      credentialAccessRevoked: false,
      submissionRequired: !!data.submissionRequired,
      submissionTypes: data.submissionTypes && data.submissionTypes.length > 0 ? data.submissionTypes : ['url', 'file'],
      maxFileSizeMb: data.maxFileSizeMb || 25,
      submissionInstructions: data.submissionInstructions?.trim(),
    });

    await task.save();

    await AuditService.log({
      actor,
      action: 'TASK_CREATED',
      entityType: 'Task',
      entityId: task._id,
      metadata: {
        taskCode: task.taskCode,
        title: task.title,
        projectId: task.projectId,
        clientId: task.clientId,
        assignedTo: task.assignedTo,
        priority: task.priority,
        requiredCredentialsCount: task.requiredCredentialIds.length,
        agreedAmount: task.agreedAmount,
      },
    });

    // Notify assigned team member via Telegram if connected
    if (assignedMember && (assignedMember.telegramUserId || assignedMember.telegramChatId)) {
      try {
        await TelegramService.sendTaskAssignedNotification(task, project, assignedMember, actor);
      } catch (err) {
        console.error('Failed to send task Telegram notification:', err);
      }

      // Auto-share required credentials if requested and team member is authorized
      if (data.autoShareCredentials && task.requiredCredentialIds && task.requiredCredentialIds.length > 0) {
        try {
          await CredentialSharingService.shareTaskCredentials(task._id.toString(), actor, { oneTime: true });
        } catch (credErr) {
          console.warn('Auto credential sharing on task creation skipped or failed:', credErr);
        }
      }
    }

    return task;
  }

  /**
   * Update task details
   */
  static async updateTask(id: string, data: UpdateTaskDTO, actor: string = 'system'): Promise<ITask> {
    await dbConnect();

    const task = await Task.findById(id);
    if (!task) {
      throw new Error('Task not found');
    }

    const oldStatus = task.status;
    const oldAssignee = task.assignedTo?.toString();

    const effectiveProjectId = data.projectId !== undefined ? data.projectId : task.projectId;
    if (data.projectId !== undefined || data.clientId !== undefined) {
      if (!effectiveProjectId) {
        throw new Error('Project is required');
      }
      const project = await Project.findById(effectiveProjectId);
      if (!project) throw new Error('Project not found');

      const checkClientId = data.clientId || (data.projectId !== undefined ? undefined : task.clientId);
      if (checkClientId) {
        const client = await Client.findById(checkClientId);
        if (!client) throw new Error('Client not found');

        const projectClientId = project.clientId?.toString();
        const requestedClientId = checkClientId.toString();
        if (projectClientId && projectClientId !== requestedClientId) {
          throw new Error('Invalid relationship: Selected project does not belong to the selected client');
        }
      }
      if (data.projectId !== undefined) {
        task.projectId = project._id as any;
        task.clientId = project.clientId as any;
      }
    }

    if (data.title && data.title.trim()) {
      task.title = data.title.trim();
    }
    if (data.description !== undefined) {
      task.description = data.description?.trim();
    }
    if (data.priority) {
      task.priority = data.priority;
    }
    if (data.status) {
      task.status = data.status;
      if (data.status === 'COMPLETED' && !task.completedAt) {
        task.completedAt = new Date();
      }
    }
    if (data.dueDate !== undefined) {
      task.dueDate = data.dueDate ? new Date(data.dueDate) : undefined;
    }
    if (data.attachments !== undefined) {
      task.attachments = data.attachments as any;
    }
    if (data.agreedAmount !== undefined) {
      task.agreedAmount = Number(data.agreedAmount);
    }
    if (data.autoShareCredentials !== undefined) {
      task.autoShareCredentials = data.autoShareCredentials;
    }
    if (data.credentialAccessRevoked !== undefined) {
      task.credentialAccessRevoked = data.credentialAccessRevoked;
    }
    if (data.submissionRequired !== undefined) {
      task.submissionRequired = data.submissionRequired;
    }
    if (data.submissionTypes !== undefined) {
      task.submissionTypes = data.submissionTypes;
    }
    if (data.maxFileSizeMb !== undefined) {
      task.maxFileSizeMb = Number(data.maxFileSizeMb);
    }
    if (data.submissionInstructions !== undefined) {
      task.submissionInstructions = data.submissionInstructions?.trim();
    }

    if (data.assignedTo !== undefined) {
      if (data.assignedTo) {
        const member = await TeamMember.findById(data.assignedTo);
        if (!member) throw new Error('Assigned team member not found');
        if (member.status === 'DEACTIVATED') throw new Error('Cannot assign task to a deactivated team member');

        // Check if existing task credentials are valid for new member
        const credIdsToCheck = data.requiredCredentialIds !== undefined ? data.requiredCredentialIds : task.requiredCredentialIds;
        if (credIdsToCheck && credIdsToCheck.length > 0) {
          await this.validateTaskCredentials(credIdsToCheck, task.projectId, member);
        }

        // Check project team
        const project = await Project.findById(task.projectId);
        if (project && (!project.teamMemberIds || !project.teamMemberIds.some(mId => mId.toString() === member._id.toString()))) {
          project.teamMemberIds = project.teamMemberIds || [];
          project.teamMemberIds.push(member._id as any);
          await project.save();
        }

        task.assignedTo = member._id as any;

        // If new assignee, notify via Telegram
        if (oldAssignee !== member._id.toString() && (member.telegramUserId || member.telegramChatId)) {
          if (project) {
            TelegramService.sendTaskAssignedNotification(task, project, member, actor).catch((err) => {
              console.error('Failed to send reassigned task Telegram notification:', err);
            });
          }
        }
      } else {
        task.assignedTo = undefined;
      }
    }

    if (data.requiredCredentialIds !== undefined) {
      const targetMember = task.assignedTo ? await TeamMember.findById(task.assignedTo) : null;
      await this.validateTaskCredentials(data.requiredCredentialIds, task.projectId, targetMember);

      const oldCredIds = (task.requiredCredentialIds || []).map((id: any) => id.toString());
      const newCredIds = data.requiredCredentialIds.map((id: any) => id.toString());

      const added = newCredIds.filter((id: string) => !oldCredIds.includes(id));
      const removed = oldCredIds.filter((id: string) => !newCredIds.includes(id));

      task.requiredCredentialIds = data.requiredCredentialIds as any;

      for (const credId of added) {
        await AuditService.log({
          actor,
          action: 'CREDENTIAL_SHARED_WITH_TASK',
          entityType: 'Task',
          entityId: task._id,
          metadata: { taskId: task._id, taskCode: task.taskCode, credentialId: credId, projectId: task.projectId },
        });
      }

      for (const credId of removed) {
        await AuditService.log({
          actor,
          action: 'CREDENTIAL_REMOVED_FROM_TASK',
          entityType: 'Task',
          entityId: task._id,
          metadata: { taskId: task._id, taskCode: task.taskCode, credentialId: credId, projectId: task.projectId },
        });
      }
    }

    if (data.status !== undefined && data.status !== oldStatus) {
      task.status = data.status;
      if (data.status === 'COMPLETED') {
        task.completedAt = new Date();
      } else {
        task.completedAt = undefined;
      }

      await AuditService.log({
        actor,
        action: 'TASK_STATUS_CHANGED',
        entityType: 'Task',
        entityId: task._id,
        metadata: {
          taskCode: task.taskCode,
          oldStatus,
          newStatus: task.status,
        },
      });

      // Notify admin of status transition
      TelegramService.sendTaskStatusNotificationToAdmin(task, oldStatus, task.status, actor).catch((err) => {
        console.error('Failed to send task status update notification to admin:', err);
      });
    }

    await task.save();

    await AuditService.log({
      actor,
      action: 'TASK_UPDATED',
      entityType: 'Task',
      entityId: task._id,
      metadata: {
        taskCode: task.taskCode,
        status: task.status,
        priority: task.priority,
      },
    });

    return task;
  }

  /**
   * Update task status only (used by dashboard and Telegram interactive actions)
   */
  static async updateTaskStatus(
    id: string,
    newStatus: TaskStatus,
    actor: string = 'system',
    notifyAdmin: boolean = true
  ): Promise<ITask> {
    await dbConnect();

    const task = await Task.findById(id);
    if (!task) {
      throw new Error('Task not found');
    }

    const oldStatus = task.status;
    if (oldStatus === newStatus) {
      return task;
    }

    task.status = newStatus;
    if (newStatus === 'COMPLETED') {
      task.completedAt = new Date();
    } else {
      task.completedAt = undefined;
    }

    await task.save();

    await AuditService.log({
      actor,
      action: 'TASK_STATUS_CHANGED',
      entityType: 'Task',
      entityId: task._id,
      metadata: {
        taskCode: task.taskCode,
        oldStatus,
        newStatus,
      },
    });

    if (notifyAdmin) {
      TelegramService.sendTaskStatusNotificationToAdmin(task, oldStatus, newStatus, actor).catch((err) => {
        console.error('Failed to send status notification to admin:', err);
      });
    }

    return task;
  }

  /**
   * Delete task
   */
  static async deleteTask(id: string, actor: string = 'system'): Promise<boolean> {
    await dbConnect();

    const task = await Task.findById(id);
    if (!task) {
      throw new Error('Task not found');
    }

    await Task.deleteOne({ _id: id });

    await AuditService.log({
      actor,
      action: 'TASK_DELETED',
      entityType: 'Task',
      entityId: id,
      metadata: {
        taskCode: task.taskCode,
        title: task.title,
      },
    });

    return true;
  }

  /**
   * List tasks with multi-field filtering
   */
  static async getTasks(filter: {
    projectId?: string;
    clientId?: string;
    assignedTo?: string;
    status?: string;
    priority?: string;
    search?: string;
  } = {}): Promise<any[]> {
    await dbConnect();

    const query: any = {};
    if (filter.projectId) query.projectId = filter.projectId;
    if (filter.clientId) query.clientId = filter.clientId;
    if (filter.assignedTo) query.assignedTo = filter.assignedTo;
    if (filter.status) query.status = filter.status;
    if (filter.priority) query.priority = filter.priority;
    if (filter.search) {
      query.$or = [
        { title: { $regex: filter.search, $options: 'i' } },
        { description: { $regex: filter.search, $options: 'i' } },
        { taskCode: { $regex: filter.search, $options: 'i' } },
      ];
    }

    return Task.find(query)
      .populate('projectId', 'name projectCode serviceType')
      .populate('clientId', 'name clientCode company')
      .populate('assignedTo', 'name email role status')
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get single task by ID
   */
  static async getTaskById(id: string): Promise<any> {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid task ID format');
    }

    const task: any = await Task.findById(id)
      .populate('projectId', 'name projectCode serviceType status totalAmount')
      .populate('clientId', 'name clientCode company email')
      .populate('assignedTo', 'name email phone role status permissions telegramConnected')
      .lean();

    if (!task) {
      throw new Error('Task not found');
    }

    if (task.requiredCredentialIds && task.requiredCredentialIds.length > 0) {
      const creds = await Credential.find({
        _id: { $in: task.requiredCredentialIds },
      }).select('service credentialType isRevoked projectId').lean();

      task.requiredCredentials = creds.map((c: any) => {
        let serviceName = 'Credential';
        try {
          if (c.service) serviceName = decrypt(c.service);
        } catch {
          serviceName = 'Encrypted Service';
        }
        return {
          _id: c._id,
          service: serviceName,
          credentialType: c.credentialType,
          isRevoked: !!c.isRevoked,
          projectId: c.projectId,
        };
      });
    } else {
      task.requiredCredentials = [];
    }

    return task;
  }

  /**
   * Submit completion details and mark task as completed (or resubmit)
   */
  static async submitAndCompleteTask(
    id: string,
    data: SubmitTaskDTO,
    actor: string = 'system',
    actorRole: string = 'ADMIN',
    actorTeamMemberId?: string
  ): Promise<ITask> {
    await dbConnect();

    const task = await Task.findById(id);
    if (!task) {
      throw new Error('Task not found');
    }

    // Authorization check: Only assigned team member or Admin can submit
    if (actorRole !== 'ADMIN') {
      if (!task.assignedTo || !actorTeamMemberId || task.assignedTo.toString() !== actorTeamMemberId.toString()) {
        throw new Error('Unauthorized: You can only submit completion for tasks assigned to you');
      }
    }

    // Validate URLs if provided
    const urls = (data.submissionUrls || []).map(u => u.trim()).filter(Boolean);
    for (const url of urls) {
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('Invalid URL protocol');
        }
      } catch {
        throw new Error(`Invalid submission URL: ${url}`);
      }
    }

    const files = data.submissionFiles || [];
    const maxMb = task.maxFileSizeMb && task.maxFileSizeMb > 0 ? task.maxFileSizeMb : 25;
    const maxBytes = maxMb * 1024 * 1024;

    for (const f of files) {
      if (f.fileSize > maxBytes) {
        throw new Error(`File ${f.fileName} exceeds maximum allowed size of ${maxMb}MB`);
      }
    }

    // Enforce submission requirements if submissionRequired is true
    if (task.submissionRequired) {
      const types = task.submissionTypes && task.submissionTypes.length > 0
        ? task.submissionTypes
        : (['url', 'file'] as SubmissionType[]);

      const requiresUrl = types.includes('url') && !types.includes('file');
      const requiresFile = types.includes('file') && !types.includes('url');

      if (requiresUrl && urls.length === 0) {
        throw new Error('This task requires at least one URL submission');
      }
      if (requiresFile && files.length === 0) {
        throw new Error('This task requires at least one file submission');
      }
      if (!requiresUrl && !requiresFile && urls.length === 0 && files.length === 0) {
        throw new Error('This task requires at least one URL or file submission');
      }
    }

    const isResubmission = !!task.submission && !!task.completedAt;

    // Idempotency check: If an identical submission was received within 5 seconds, return without creating duplicate history
    if (task.submission && isResubmission) {
      const lastSub = task.submission;
      const isIdentical =
        (lastSub.submissionNotes || '') === (data.submissionNotes?.trim() || '') &&
        JSON.stringify(lastSub.submissionUrls || []) === JSON.stringify(urls) &&
        (lastSub.submissionFiles || []).length === files.length;
      const timeDiff = Date.now() - new Date(lastSub.submittedAt).getTime();
      if (isIdentical && timeDiff < 5000) {
        return task;
      }
    }

    // Archive previous submission into submissionHistory if present
    if (task.submission) {
      task.submissionHistory = task.submissionHistory || [];
      task.submissionHistory.push(task.submission as any);
    }

    task.submission = {
      submissionNotes: data.submissionNotes?.trim(),
      submissionUrls: urls,
      submissionFiles: files.map(f => ({
        fileName: f.fileName,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        storagePath: f.storagePath,
        uploadedAt: f.uploadedAt || new Date(),
      })),
      submittedBy: actor,
      submittedAt: new Date(),
    };

    task.status = 'COMPLETED';
    if (!task.completedAt) {
      task.completedAt = new Date();
    }

    await task.save();

    await AuditService.log({
      actor,
      action: isResubmission ? 'TASK_SUBMISSION_RESUBMITTED' : 'TASK_SUBMISSION_CREATED',
      entityType: 'Task',
      entityId: task._id,
      metadata: {
        taskCode: task.taskCode,
        submissionUrlsCount: urls.length,
        submissionFilesCount: files.length,
        hasNotes: !!data.submissionNotes?.trim(),
        isResubmission,
      },
    });

    // Send Telegram Notification to Admin
    try {
      const project = await Project.findById(task.projectId).select('name projectCode');
      await TelegramService.sendTaskSubmissionNotificationToAdmin(
        task,
        task.submission,
        actor,
        project?.name
      );
    } catch (telegramErr) {
      console.error('Failed to send task submission notification to admin:', telegramErr);
    }

    return task;
  }

  /**
   * Resubmit task completion details
   */
  static async resubmitTask(
    id: string,
    data: SubmitTaskDTO,
    actor: string = 'system',
    actorRole: string = 'ADMIN',
    actorTeamMemberId?: string
  ): Promise<ITask> {
    return this.submitAndCompleteTask(id, data, actor, actorRole, actorTeamMemberId);
  }

  /**
   * Validate credentials to ensure:
   * 1. They exist and are active (not revoked).
   * 2. They belong to the specified project (Strict Project Isolation).
   * 3. The assigned team member has VIEW_CREDENTIALS permission and is authorized for the credential type.
   */
  static async validateTaskCredentials(
    credentialIds: Array<string | mongoose.Types.ObjectId>,
    projectId: string | mongoose.Types.ObjectId,
    assignedMember?: any
  ): Promise<any[]> {
    if (!credentialIds || credentialIds.length === 0) return [];

    const projectStr = projectId.toString();
    const validatedCredentials: any[] = [];

    for (const credId of credentialIds) {
      if (!mongoose.Types.ObjectId.isValid(credId.toString())) {
        throw new Error(`Invalid credential ID format: ${credId}`);
      }

      const cred = await Credential.findById(credId);
      if (!cred) {
        throw new Error(`Credential not found: ${credId}`);
      }

      if (cred.isRevoked) {
        throw new Error(`Credential is no longer active or has been revoked: ${credId}`);
      }

      if (!cred.projectId || cred.projectId.toString() !== projectStr) {
        throw new Error(`Security Violation: Credential "${credId}" does not belong to this project.`);
      }

      if (assignedMember) {
        if (!TeamMemberService.hasPermission(assignedMember, 'VIEW_CREDENTIALS')) {
          throw new Error(`Security Violation: Assigned team member "${assignedMember.name}" lacks VIEW_CREDENTIALS permission.`);
        }

        if (!TeamMemberService.isAuthorizedForCredentialType(assignedMember, cred.credentialType)) {
          throw new Error(
            `Security Violation: Assigned team member "${assignedMember.name}" is not authorized for "${cred.credentialType || 'CUSTOM'}" credentials.`
          );
        }
      }

      validatedCredentials.push(cred);
    }

    return validatedCredentials;
  }

  /**
   * Safe asynchronous task notification dispatcher
   */
  static async dispatchTaskNotifications(task: ITask, data: any, actor: string = 'system'): Promise<void> {
    try {
      if (!task.assignedTo) return;
      const [project, assignedMember] = await Promise.all([
        Project.findById(task.projectId),
        TeamMember.findById(task.assignedTo),
      ]);

      if (assignedMember && (assignedMember.telegramUserId || assignedMember.telegramChatId)) {
        if (project) {
          try {
            await TelegramService.sendTaskAssignedNotification(task, project, assignedMember, actor);
          } catch (err) {
            console.error('Failed to send task Telegram notification:', err);
          }
        }

        if (data.autoShareCredentials && task.requiredCredentialIds && task.requiredCredentialIds.length > 0) {
          try {
            await CredentialSharingService.shareTaskCredentials(task._id.toString(), actor, { oneTime: true });
          } catch (credErr) {
            console.warn('Auto credential sharing on task creation skipped or failed:', credErr);
          }
        }
      }
    } catch (err) {
      console.error('Error dispatching task notifications:', err);
    }
  }
}
