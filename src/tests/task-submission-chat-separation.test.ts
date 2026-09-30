import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskService } from '@/services/task.service';
import { TelegramService } from '@/services/telegram.service';
import { TeamChatService } from '@/services/team-chat.service';
import Task from '@/models/Task';
import Project from '@/models/Project';
import mongoose from 'mongoose';

// Ensure mock isolation
vi.mock('@/lib/db/connect', () => ({
  dbConnect: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/services/audit.service', () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/services/storage.service', () => ({
  StorageService: {
    uploadFile: vi.fn().mockResolvedValue({
      fileKey: 'task-submissions/proj1/task1/test.pdf',
      fileName: 'test.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      storagePath: 'task-submissions/proj1/task1/test.pdf',
      uploadedAt: new Date(),
    }),
    getSignedDownloadUrl: vi.fn().mockResolvedValue('https://mock-storage.test/download-signed'),
    getSignedUrl: vi.fn().mockResolvedValue('https://mock-storage.test/download-signed'),
  },
}));

vi.mock('@/services/team-chat.service', () => ({
  TeamChatService: {
    handleIncomingTeamMemberMessage: vi.fn().mockResolvedValue({
      conversationId: 'mock-conv-123',
      messageId: 'mock-msg-123',
    }),
  },
}));

vi.mock('@/services/chrome-push.service', () => ({
  default: {
    sendPushNotification: vi.fn().mockResolvedValue(true),
  },
}));

describe('Task Submission vs Chat Hard Separation & Authorization Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (global.activeTeamTaskSubmissions) {
      delete global.activeTeamTaskSubmissions['123456789'];
      delete global.activeTeamTaskSubmissions['987654321'];
    }
  });

  describe('1. TaskService.submitAndCompleteTask Security & Authorization', () => {
    it('should reject submission if task is assigned to another team member (IDOR Protection)', async () => {
      const mockTaskId = new mongoose.Types.ObjectId().toString();
      const legitimateMemberId = new mongoose.Types.ObjectId().toString();
      const attackerMemberId = new mongoose.Types.ObjectId().toString();

      const mockTask: any = {
        _id: mockTaskId,
        title: 'Confidential Task',
        assignedTo: legitimateMemberId,
        status: 'IN_PROGRESS',
        submissionRequired: true,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);

      await expect(
        TaskService.submitAndCompleteTask(
          mockTaskId,
          {
            submissionNotes: 'Trying to complete someone else task',
            submissionUrls: ['https://github.com/attacker/repo'],
          },
          'Attacker Member',
          'MEMBER',
          attackerMemberId
        )
      ).rejects.toThrow('Unauthorized: You can only submit completion for tasks assigned to you');
    });

    it('should allow Admin to submit or complete on behalf of any team member', async () => {
      const mockTaskId = new mongoose.Types.ObjectId().toString();
      const memberId = new mongoose.Types.ObjectId().toString();

      const mockTask: any = {
        _id: mockTaskId,
        title: 'Review Task',
        assignedTo: memberId,
        status: 'IN_PROGRESS',
        submissionRequired: true,
        submissionHistory: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);
      vi.spyOn(Project, 'findById').mockReturnValue({
        select: vi.fn().mockResolvedValue({ name: 'Test Project', projectCode: 'PR-1' }),
      } as any);
      vi.spyOn(TelegramService, 'sendTaskSubmissionNotificationToAdmin').mockResolvedValue(true as any);

      const result = await TaskService.submitAndCompleteTask(
        mockTaskId,
        {
          submissionNotes: 'Approved and submitted by admin',
          submissionUrls: ['https://github.com/admin/repo'],
        },
        'Admin User',
        'ADMIN'
      );

      expect(result).toBeDefined();
      expect(mockTask.status).toBe('COMPLETED');
      expect(mockTask.submission.submissionNotes).toBe('Approved and submitted by admin');
      expect(mockTask.save).toHaveBeenCalled();
    });

    it('should handle duplicate submissions idempotently within 5 seconds without corrupting history', async () => {
      const mockTaskId = new mongoose.Types.ObjectId().toString();
      const memberId = new mongoose.Types.ObjectId().toString();
      const now = new Date();

      const mockTask: any = {
        _id: mockTaskId,
        title: 'Idempotency Test Task',
        assignedTo: memberId,
        status: 'COMPLETED',
        completedAt: now,
        submissionRequired: true,
        submission: {
          submittedAt: now,
          submittedBy: 'Test Member',
          submissionNotes: 'Deliverables ready',
          submissionUrls: ['https://github.com/pr/1'],
          submissionFiles: [],
        },
        submissionHistory: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);

      // Submitting identical payload 1 second later
      const result = await TaskService.submitAndCompleteTask(
        mockTaskId,
        {
          submissionNotes: 'Deliverables ready',
          submissionUrls: ['https://github.com/pr/1'],
          submissionFiles: [],
        },
        'Test Member',
        'MEMBER',
        memberId
      );

      expect(result).toBe(mockTask);
      expect(mockTask.submissionHistory.length).toBe(0); // History was NOT duplicated
      expect(mockTask.save).not.toHaveBeenCalled();
    });
  });

  describe('2. Telegram Webhook: Complete Separation of Task Submissions and Team Chat', () => {
    it('should route team member message directly to TeamChatService when NOT in active task submission state', async () => {
      const chatId = '123456789';
      const mockMember: any = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Alice Developer',
        role: 'DEVELOPER',
        telegramChatId: chatId,
      };

      const sendTelegramMsgSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ ok: true } as any);

      // Handle normal chat message
      await (TelegramService as any).handleTeamMemberCommand(
        chatId,
        'Hello admin, quick question about the API',
        mockMember,
        undefined,
        undefined
      );

      // Must call TeamChatService
      expect(TeamChatService.handleIncomingTeamMemberMessage).toHaveBeenCalledWith(
        mockMember,
        'Hello admin, quick question about the API',
        undefined
      );

      // Confirm sendMessageRaw was NOT called for task submission
      expect(sendTelegramMsgSpy).not.toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Deliverable received'),
        expect.anything()
      );
    });

    it('should route deliverable to TaskService and NEVER to TeamChatService when in active task submission state', async () => {
      const chatId = '123456789';
      const mockTaskId = new mongoose.Types.ObjectId().toString();
      const mockMember: any = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Alice Developer',
        role: 'DEVELOPER',
        telegramChatId: chatId,
      };

      // Set active task submission state for this team member
      if (!global.activeTeamTaskSubmissions) {
        global.activeTeamTaskSubmissions = {};
      }
      global.activeTeamTaskSubmissions[chatId] = {
        taskId: mockTaskId,
        taskCode: 'TSK-1001',
        title: 'Implement Auth API',
        timestamp: Date.now(),
      };

      const mockTask: any = {
        _id: mockTaskId,
        taskCode: 'TSK-1001',
        title: 'Implement Auth API',
        projectId: new mongoose.Types.ObjectId().toString(),
        assignedTo: mockMember._id.toString(),
        status: 'IN_PROGRESS',
        submissionRequired: true,
        submissionHistory: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);
      vi.spyOn(TaskService, 'submitAndCompleteTask').mockResolvedValue(mockTask);
      const sendTelegramMsgSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ ok: true } as any);

      // Team member sends a deliverable PR link
      await (TelegramService as any).handleTeamMemberCommand(
        chatId,
        'https://github.com/company/repo/pull/42 - all tests passing',
        mockMember,
        undefined,
        undefined
      );

      // MUST NOT call TeamChatService!
      expect(TeamChatService.handleIncomingTeamMemberMessage).not.toHaveBeenCalled();

      // MUST call TaskService.submitAndCompleteTask
      expect(TaskService.submitAndCompleteTask).toHaveBeenCalledWith(
        mockTaskId,
        expect.objectContaining({
          submissionUrls: ['https://github.com/company/repo/pull/42'],
        }),
        undefined,
        'DEVELOPER',
        mockMember._id.toString()
      );

      // Active submission state MUST be cleared
      expect(global.activeTeamTaskSubmissions[chatId]).toBeUndefined();

      // Team member receives confirmation
      expect(sendTelegramMsgSpy).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Task Deliverables Submitted Successfully!'),
        expect.anything()
      );
    });

    it('should allow team member to cancel active task submission mode via cancel_sub callback', async () => {
      const chatId = '123456789';
      if (!global.activeTeamTaskSubmissions) {
        global.activeTeamTaskSubmissions = {};
      }
      global.activeTeamTaskSubmissions[chatId] = {
        taskId: 'task-123',
        taskCode: 'TSK-999',
        title: 'Test Task',
        timestamp: Date.now(),
      };

      vi.spyOn(TelegramService as any, 'answerCallbackQuery').mockResolvedValue(true);
      const sendTelegramMsgSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ ok: true } as any);

      // Callback query action: cancel_sub
      await (TelegramService as any).handleTeamTaskCallback(
        'cb-123',
        'user-123',
        chatId,
        456,
        'team_task:cancel_sub:task-123',
        { type: 'TEAM_MEMBER', entity: { _id: 'member-123', role: 'DEVELOPER' } },
        { message_id: 456 }
      );

      expect(global.activeTeamTaskSubmissions[chatId]).toBeUndefined();
      expect(sendTelegramMsgSpy).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Task submission mode cancelled'),
        expect.anything()
      );
    });

    it('should upload deliverable file to Task storage and NOT to Chat when in active submission context', async () => {
      const chatId = '123456789';
      const mockTaskId = new mongoose.Types.ObjectId().toString();
      const mockMember: any = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Bob Designer',
        role: 'DESIGNER',
        email: 'bob@example.com',
        telegramChatId: chatId,
      };

      await TelegramService.setActiveTaskSubmission(chatId, {
        taskId: mockTaskId,
        taskCode: 'TSK-2002',
        title: 'Design UI Mockups',
        timestamp: Date.now(),
      });

      const mockTask: any = {
        _id: mockTaskId,
        taskCode: 'TSK-2002',
        title: 'Design UI Mockups',
        projectId: new mongoose.Types.ObjectId().toString(),
        assignedTo: mockMember._id.toString(),
        status: 'IN_PROGRESS',
        submissionRequired: true,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);
      vi.spyOn(TaskService, 'submitAndCompleteTask').mockResolvedValue(mockTask);
      const sendTelegramMsgSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ ok: true } as any);

      const rawAttachment = {
        file_id: 'tg_file_abc123',
        file_name: 'homepage_design_v2.zip',
        file_size: 5000,
      };

      await (TelegramService as any).handleTeamMemberCommand(
        chatId,
        'Here is the final design archive',
        mockMember,
        undefined,
        'msg-456',
        rawAttachment,
        'document'
      );

      // Must NOT route to Chat
      expect(TeamChatService.handleIncomingTeamMemberMessage).not.toHaveBeenCalled();

      // Must call TaskService.submitAndCompleteTask
      expect(TaskService.submitAndCompleteTask).toHaveBeenCalledWith(
        mockTaskId,
        expect.objectContaining({
          submissionNotes: 'Here is the final design archive',
          submissionFiles: expect.arrayContaining([
            expect.objectContaining({
              fileName: 'homepage_design_v2.zip',
              mimeType: 'application/zip',
            }),
          ]),
        }),
        mockMember.email,
        mockMember.role,
        mockMember._id.toString()
      );

      // Active submission context must be cleared
      const activeAfter = await TelegramService.getActiveTaskSubmission(chatId);
      expect(activeAfter).toBeNull();
      expect(sendTelegramMsgSpy).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Task Deliverables Submitted Successfully!'),
        expect.anything()
      );
    });

    it('should route photo/file to Chat and NOT to Task Submission when NO task submission context is active', async () => {
      const chatId = '123456789';
      await TelegramService.clearActiveTaskSubmission(chatId);

      const mockMember: any = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Bob Designer',
        role: 'DESIGNER',
        telegramChatId: chatId,
      };

      const sendTelegramMsgSpy = vi.spyOn(TelegramService, 'sendMessageRaw').mockResolvedValue({ ok: true } as any);

      // Mock Telegram CDN getFile and download
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
        if (url.toString().includes('getFile')) {
          return {
            json: async () => ({ ok: true, result: { file_path: 'photos/photo.jpg' } }),
          } as any;
        }
        return {
          arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
        } as any;
      });

      const rawAttachment = {
        file_id: 'random_photo_123',
        file_name: 'photo.jpg',
      };

      await (TelegramService as any).handleTeamMemberCommand(
        chatId,
        '',
        mockMember,
        undefined,
        'msg-789',
        rawAttachment,
        'photo'
      );

      // Must route to Chat with attachment
      expect(TeamChatService.handleIncomingTeamMemberMessage).toHaveBeenCalledWith(
        mockMember,
        '',
        'msg-789',
        expect.arrayContaining([
          expect.objectContaining({
            type: 'IMAGE',
            originalName: 'photo.jpg',
          }),
        ])
      );

      // Must NOT call TaskService submission
      expect(TaskService.submitAndCompleteTask).not.toHaveBeenCalled();

      // Must acknowledge receipt to team member
      expect(sendTelegramMsgSpy).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('received by Admin'),
        expect.anything()
      );

      fetchSpy.mockRestore();
    });

    it('should drop duplicate Telegram updates using update_id deduplication', async () => {
      const mockMember: any = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Alice Developer',
        role: 'DEVELOPER',
        telegramChatId: '12345',
      };
      vi.spyOn(TelegramService as any, 'resolveTelegramIdentity').mockResolvedValue({
        type: 'TEAM_MEMBER',
        teamMember: mockMember,
      });
      vi.spyOn(TelegramService as any, 'handleTeamMemberCommand').mockResolvedValue(undefined);
      vi.spyOn(TelegramService as any, 'syncChatCommands').mockResolvedValue(true);

      const update = {
        update_id: 888999111,
        message: {
          chat: { id: 12345 },
          from: { id: 12345 },
          text: '/help',
        },
      };

      const result1 = await TelegramService.handleWebhookUpdate(update);
      const result2 = await TelegramService.handleWebhookUpdate(update);

      expect(result2).toEqual(
        expect.objectContaining({
          command: 'duplicate',
        })
      );
    });
  });
});
