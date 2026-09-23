import mongoose from 'mongoose';
import Task, { ITask, TaskPriority, TaskStatus, SubmissionType } from '@/models/Task';
import Project from '@/models/Project';
import TeamMember from '@/models/TeamMember';
import { AuditService } from './audit.service';
import { TelegramService } from './telegram.service';
import { CredentialSharingService } from './credential-sharing.service';
import { dbConnect } from '@/lib/db/connect';

export interface CreateTaskDTO {
  title: string;
  description?: string;
  projectId: string | mongoose.Types.ObjectId;
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

    const project = await Project.findById(data.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    let assignedMember: any = null;
    if (data.assignedTo) {
      assignedMember = await TeamMember.findById(data.assignedTo);
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
    if (data.requiredCredentialIds !== undefined) {
      task.requiredCredentialIds = data.requiredCredentialIds as any;
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

    const task = await Task.findById(id)
      .populate('projectId', 'name projectCode serviceType status totalAmount')
      .populate('clientId', 'name clientCode company email')
      .populate('assignedTo', 'name email phone role status permissions telegramConnected')
      .lean();

    if (!task) {
      throw new Error('Task not found');
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
      if (!task.assignedTo || (actorTeamMemberId && task.assignedTo.toString() !== actorTeamMemberId.toString())) {
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
}
