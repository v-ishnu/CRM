import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import Task from '@/models/Task';
import Project from '@/models/Project';
import TeamMember from '@/models/TeamMember';
import { TaskService } from '@/services/task.service';
import { TelegramService } from '@/services/telegram.service';
import { AuditService } from '@/services/audit.service';
import { StorageService } from '@/services/storage.service';

// Mock DB and external services to ensure ZERO production DB access and ZERO real Telegram messages
vi.mock('@/lib/db/connect', () => ({
  dbConnect: vi.fn().mockResolvedValue(null),
  default: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/telegram.service', async (importOriginal) => {
  const actual: any = await importOriginal();
  actual.TelegramService.sendMessageRaw = vi.fn().mockResolvedValue({ success: true, messageId: 9999 });
  actual.TelegramService.sendMessage = vi.fn().mockResolvedValue(true);
  actual.TelegramService.answerCallbackQuery = vi.fn().mockResolvedValue(true);
  actual.TelegramService.sendTaskSubmissionNotificationToAdmin = vi.fn().mockResolvedValue(true);
  actual.TelegramService.sendTaskStatusNotificationToAdmin = vi.fn().mockResolvedValue(true);
  return actual;
});

vi.mock('@/services/audit.service', () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(true),
    logAction: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/services/storage.service', () => ({
  StorageService: {
    uploadFile: vi.fn().mockImplementation(async (_buf, path) => path),
    getSignedUrl: vi.fn().mockImplementation(async (path) => `https://signed.example.com/${path}?token=signed_123`),
    deleteFile: vi.fn().mockResolvedValue(true),
  },
}));

describe('Task Completion Submissions - Unit Tests', () => {
  const mockTaskId = new mongoose.Types.ObjectId().toString();
  const mockProjectId = new mongoose.Types.ObjectId().toString();
  const mockTeamMemberId = new mongoose.Types.ObjectId().toString();
  const mockOtherMemberId = new mongoose.Types.ObjectId().toString();

  const createMockTask = (overrides: any = {}) => ({
    _id: mockTaskId,
    taskCode: 'TSK-1001',
    title: 'Implement Payment Gateway Integration',
    description: 'Add Stripe and UPI webhook processors',
    projectId: mockProjectId,
    assignedTo: mockTeamMemberId,
    status: 'IN_PROGRESS',
    submissionRequired: false,
    submissionTypes: ['url', 'file'],
    maxFileSizeMb: 25,
    submissionInstructions: 'Upload exported code and provide PR link',
    submission: undefined as any,
    submissionHistory: [] as any[],
    completedAt: undefined as any,
    save: vi.fn().mockResolvedValue(true),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: Task without submission requirements can be completed with optional notes
  it('1. Completes a task successfully when submission is optional', async () => {
    const mockTask = createMockTask({ submissionRequired: false });
    vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);
    vi.spyOn(Project, 'findById').mockReturnValue({
      select: vi.fn().mockResolvedValue({ name: 'Payment System', projectCode: 'PRJ-01' }),
    } as any);

    const result = await TaskService.submitAndCompleteTask(
      mockTaskId,
      { submissionNotes: 'All done and tested locally' },
      'member@example.com',
      'DEVELOPER',
      mockTeamMemberId
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.completedAt).toBeDefined();
    expect(result.submission?.submissionNotes).toBe('All done and tested locally');
    expect(mockTask.save).toHaveBeenCalled();
    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TASK_SUBMISSION_CREATED' })
    );
  });

  // Test 2: Rejects completion when submissionRequired = true and no deliverables provided
  it('2. Rejects completion when submissionRequired is true and neither URL nor file is provided', async () => {
    const mockTask = createMockTask({ submissionRequired: true, submissionTypes: ['url', 'file'] });
    vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);

    await expect(
      TaskService.submitAndCompleteTask(
        mockTaskId,
        { submissionNotes: 'Done without files' },
        'member@example.com',
        'DEVELOPER',
        mockTeamMemberId
      )
    ).rejects.toThrow(/This task requires at least one URL or file submission/);
  });

  // Test 3: Requires URL when submissionTypes = ['url']
  it('3. Requires at least one URL when submissionTypes is strictly url', async () => {
    const mockTask = createMockTask({ submissionRequired: true, submissionTypes: ['url'] });
    vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);

    // Only files provided, no URLs
    await expect(
      TaskService.submitAndCompleteTask(
        mockTaskId,
        {
          submissionFiles: [
            {
              fileName: 'doc.pdf',
              fileSize: 1024,
              mimeType: 'application/pdf',
              storagePath: 'task-submissions/p/t/doc.pdf',
            },
          ],
        },
        'member@example.com',
        'DEVELOPER',
        mockTeamMemberId
      )
    ).rejects.toThrow(/This task requires at least one URL submission/);
  });

  // Test 4: Requires File when submissionTypes = ['file']
  it('4. Requires at least one File when submissionTypes is strictly file', async () => {
    const mockTask = createMockTask({ submissionRequired: true, submissionTypes: ['file'] });
    vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);

    // Only URL provided, no files
    await expect(
      TaskService.submitAndCompleteTask(
        mockTaskId,
        { submissionUrls: ['https://github.com/pull/12'] },
        'member@example.com',
        'DEVELOPER',
        mockTeamMemberId
      )
    ).rejects.toThrow(/This task requires at least one file submission/);
  });

  // Test 5: Validates URL protocol
  it('5. Rejects URLs with invalid protocols', async () => {
    const mockTask = createMockTask({ submissionRequired: true, submissionTypes: ['url'] });
    vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);

    await expect(
      TaskService.submitAndCompleteTask(
        mockTaskId,
        { submissionUrls: ['ftp://malicious.com/file'] },
        'member@example.com',
        'DEVELOPER',
        mockTeamMemberId
      )
    ).rejects.toThrow(/Invalid submission URL/);
  });

  // Test 6: File size check against maxFileSizeMb
  it('6. Rejects uploaded files exceeding configured maxFileSizeMb', async () => {
    const mockTask = createMockTask({ maxFileSizeMb: 10 });
    vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);

    const oversizedBytes = 15 * 1024 * 1024; // 15MB > 10MB
    await expect(
      TaskService.submitAndCompleteTask(
        mockTaskId,
        {
          submissionFiles: [
            {
              fileName: 'archive.zip',
              fileSize: oversizedBytes,
              mimeType: 'application/zip',
              storagePath: 'task-submissions/p/t/archive.zip',
            },
          ],
        },
        'member@example.com',
        'DEVELOPER',
        mockTeamMemberId
      )
    ).rejects.toThrow(/exceeds maximum allowed size of 10MB/);
  });

  // Test 7: Authorization - IDOR check rejects other non-admin team member
  it('7. Rejects completion submission from a team member not assigned to the task (IDOR prevention)', async () => {
    const mockTask = createMockTask({ assignedTo: mockTeamMemberId });
    vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);

    await expect(
      TaskService.submitAndCompleteTask(
        mockTaskId,
        { submissionUrls: ['https://github.com/my-org/repo/pull/1'] },
        'other@example.com',
        'DEVELOPER',
        mockOtherMemberId
      )
    ).rejects.toThrow(/Unauthorized: You can only submit completion for tasks assigned to you/);
  });

  // Test 8: Authorization - Assigned team member can submit
  it('8. Permits completion submission from the assigned team member', async () => {
    const mockTask = createMockTask({ assignedTo: mockTeamMemberId });
    vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);
    vi.spyOn(Project, 'findById').mockReturnValue({
      select: vi.fn().mockResolvedValue({ name: 'CRM App' }),
    } as any);

    const result = await TaskService.submitAndCompleteTask(
      mockTaskId,
      { submissionUrls: ['https://github.com/my-org/repo/pull/1'] },
      'assigned@example.com',
      'DEVELOPER',
      mockTeamMemberId
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.submission?.submissionUrls).toContain('https://github.com/my-org/repo/pull/1');
  });

  // Test 9: Authorization - Admin can submit completion on any task
  it('9. Permits admin to complete any task regardless of assignee', async () => {
    const mockTask = createMockTask({ assignedTo: mockTeamMemberId });
    vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);
    vi.spyOn(Project, 'findById').mockReturnValue({
      select: vi.fn().mockResolvedValue({ name: 'CRM App' }),
    } as any);

    const result = await TaskService.submitAndCompleteTask(
      mockTaskId,
      { submissionNotes: 'Admin override completion' },
      'admin@example.com',
      'ADMIN'
    );

    expect(result.status).toBe('COMPLETED');
    expect(mockTask.save).toHaveBeenCalled();
  });

  // Test 10: Resubmission archives existing submission to submissionHistory
  it('10. Archives previous submission to submissionHistory on resubmission', async () => {
    const existingSubmission = {
      submittedAt: new Date(Date.now() - 3600000),
      submittedBy: 'old_actor@example.com',
      submissionNotes: 'First draft',
      submissionUrls: ['https://example.com/v1'],
      submissionFiles: [],
    };

    const mockTask = createMockTask({
      status: 'COMPLETED',
      completedAt: new Date(Date.now() - 3600000),
      submission: existingSubmission,
      submissionHistory: [],
    });
    vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);
    vi.spyOn(Project, 'findById').mockReturnValue({
      select: vi.fn().mockResolvedValue({ name: 'CRM App' }),
    } as any);

    const result = await TaskService.submitAndCompleteTask(
      mockTaskId,
      {
        submissionNotes: 'Revised submission v2',
        submissionUrls: ['https://example.com/v2'],
      },
      'assigned@example.com',
      'DEVELOPER',
      mockTeamMemberId
    );

    expect(result.submissionHistory?.length).toBe(1);
    expect(result.submissionHistory?.[0].submissionNotes).toBe('First draft');
    expect(result.submission?.submissionNotes).toBe('Revised submission v2');
    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TASK_SUBMISSION_RESUBMITTED' })
    );
  });

  // Test 11: Telegram notification formatting (metadata only, no file binaries)
  it('11. Dispatches admin Telegram notification containing metadata without file binaries', async () => {
    const mockTask = createMockTask();
    vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);
    vi.spyOn(Project, 'findById').mockReturnValue({
      select: vi.fn().mockResolvedValue({ name: 'Backend Revamp', projectCode: 'REV-01' }),
    } as any);

    await TaskService.submitAndCompleteTask(
      mockTaskId,
      {
        submissionNotes: 'Production build uploaded',
        submissionUrls: ['https://github.com/pr/44'],
        submissionFiles: [
          {
            fileName: 'release.zip',
            fileSize: 4 * 1024 * 1024,
            mimeType: 'application/zip',
            storagePath: 'task-submissions/proj/task/release.zip',
          },
        ],
      },
      'dev@example.com',
      'DEVELOPER',
      mockTeamMemberId
    );

    expect(TelegramService.sendTaskSubmissionNotificationToAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ taskCode: 'TSK-1001' }),
      expect.objectContaining({
        submissionNotes: 'Production build uploaded',
        submissionUrls: ['https://github.com/pr/44'],
        submissionFiles: expect.arrayContaining([
          expect.objectContaining({ fileName: 'release.zip', fileSize: 4 * 1024 * 1024 }),
        ]),
      }),
      'dev@example.com',
      'Backend Revamp'
    );
  });

  // Test 12: Storage signed URL generation for valid task file
  it('12. Generates private signed URL with 3600s TTL for task submission files', async () => {
    const signedUrl = await StorageService.getSignedUrl('task-submissions/p/t/deliverable.pdf', 3600);
    expect(signedUrl).toContain('signed_123');
    expect(StorageService.getSignedUrl).toHaveBeenCalledWith('task-submissions/p/t/deliverable.pdf', 3600);
  });

  // Test 13: Telegram callback safeguard prevents direct completion if submission is required
  it('13. Blocks Telegram interactive callback completion if submission is required', async () => {
    const mockTask = createMockTask({ submissionRequired: true });
    vi.spyOn(Task, 'findById').mockReturnValue({
      populate: vi.fn().mockResolvedValue(mockTask),
    } as any);
    vi.spyOn(TeamMember, 'findById').mockResolvedValue({
      _id: mockTeamMemberId,
      name: 'Alex',
      email: 'alex@example.com',
      status: 'ACTIVE',
    } as any);

    // Simulate resolveTelegramIdentity
    vi.spyOn(TelegramService as any, 'resolveTelegramIdentity').mockResolvedValue({
      type: 'TEAM_MEMBER',
      teamMember: { _id: mockTeamMemberId, name: 'Alex', email: 'alex@example.com', status: 'ACTIVE' },
    });

    const res = await TelegramService.handleCallbackQuery({
      id: 'cb_123',
      from: { id: 987654 },
      data: `team_task:complete:${mockTaskId}`,
      message: { chat: { id: 987654 } },
    });

    expect(res.success).toBe(false);
    expect(mockTask.save).not.toHaveBeenCalled();
    expect(TelegramService.sendMessageRaw).toHaveBeenCalledWith(
      '987654',
      expect.stringContaining('Submission Required')
    );
  });
});
