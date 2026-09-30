import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import Task from '@/models/Task';
import TeamMember from '@/models/TeamMember';
import TeamPayment from '@/models/TeamPayment';
import Project from '@/models/Project';
import Client from '@/models/Client';
import TeamMemberMessage from '@/models/TeamMemberMessage';
import TeamMemberConversation from '@/models/TeamMemberConversation';
import { TaskService } from '@/services/task.service';
import { TeamPaymentService } from '@/services/team-payment.service';
import { TeamChatService } from '@/services/team-chat.service';
import { TeamMemberService } from '@/services/team-member.service';
import { StorageService } from '@/services/storage.service';

// Mock DB connection to guarantee ZERO production DB queries or writes
vi.mock('@/lib/db/connect', () => ({
  dbConnect: vi.fn().mockResolvedValue(null),
  default: vi.fn().mockResolvedValue(null),
}));

// Mock AuditService
vi.mock('@/services/audit.service', () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(true),
    logAction: vi.fn().mockResolvedValue(true),
  },
}));

// Mock TelegramService
vi.mock('@/services/telegram.service', () => ({
  TelegramService: {
    sendMessageRaw: vi.fn().mockResolvedValue({ success: true, messageId: 999 }),
    sendMediaRaw: vi.fn().mockResolvedValue({ success: true, messageId: 1001, fileId: 'tg_file_123' }),
    sendMessage: vi.fn().mockResolvedValue(true),
  },
}));

// Mock StorageService
vi.mock('@/services/storage.service', () => ({
  StorageService: {
    uploadFile: vi.fn().mockResolvedValue({
      fileKey: 'team-chat/test/file.pdf',
      fileName: 'file.pdf',
      fileSize: 2048,
      mimeType: 'application/pdf',
      storagePath: 'team-chat/test/file.pdf',
      uploadedAt: new Date(),
    }),
    getSignedUrl: vi.fn().mockResolvedValue('https://storage.local/team-chat/test/file.pdf'),
  },
}));

// Helper to mock mongoose query chains
function mockMongooseQuery(result: any) {
  const query: any = {
    lean: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis(),
    populate: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(result),
    then(resolve: any, reject: any) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return query;
}

describe('Full Audit: Task Payment, Chat Attachment & Task Counts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Task Payment Calculation & Validation Integrity', () => {
    it('enforces non-negative agreedAmount on task creation', async () => {
      await expect(
        TaskService.createTask({
          title: 'Design Logo',
          projectId: new mongoose.Types.ObjectId().toString(),
          agreedAmount: -500,
        })
      ).rejects.toThrow('Agreed amount must be a non-negative number');
    });

    it('prevents agreedAmount from being reduced below already paid amount', async () => {
      const taskId = new mongoose.Types.ObjectId();
      const mockTask: any = {
        _id: taskId,
        title: 'Build Landing Page',
        agreedAmount: 5000,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockTask);
      vi.spyOn(TeamPaymentService, 'getTaskPaymentSummary').mockResolvedValue({
        agreedAmount: 5000,
        totalPaid: 3500,
        totalPending: 0,
        outstanding: 1500,
        payments: [],
      });

      // Attempting to lower agreedAmount to ₹2,000 when ₹3,500 was already paid must fail
      await expect(
        TaskService.updateTask(taskId.toString(), { agreedAmount: 2000 })
      ).rejects.toThrow(/Cannot set agreed amount to ₹2000 because ₹3500 has already been paid/);
    });

    it('calculates authoritative totalPaid, pending, and outstanding amounts from actual payment records', async () => {
      const taskId = new mongoose.Types.ObjectId();
      const mockTask: any = {
        _id: taskId,
        agreedAmount: 10000,
      };

      const mockPayments = [
        { _id: new mongoose.Types.ObjectId(), amount: 2000, status: 'PAID', taskId },
        { _id: new mongoose.Types.ObjectId(), amount: 3000, status: 'PAID', taskId },
        { _id: new mongoose.Types.ObjectId(), amount: 1000, status: 'PENDING', taskId },
      ];

      vi.spyOn(Task, 'findById').mockReturnValue(mockMongooseQuery(mockTask));
      vi.spyOn(TeamPayment, 'find').mockReturnValue(mockMongooseQuery(mockPayments));

      // Temporarily simulate readyState = 1
      const origReadyState = mongoose.connection.readyState;
      Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

      const summary = await TeamPaymentService.getTaskPaymentSummary(taskId.toString());

      Object.defineProperty(mongoose.connection, 'readyState', { value: origReadyState, configurable: true });

      expect(summary.agreedAmount).toBe(10000);
      expect(summary.totalPaid).toBe(5000); // 2000 + 3000
      expect(summary.totalPending).toBe(1000);
      expect(summary.outstanding).toBe(5000); // 10000 - 5000
    });

    it('strictly forbids recording team payment if task assignedTo does not match team member', async () => {
      const taskId = new mongoose.Types.ObjectId();
      const memberAId = new mongoose.Types.ObjectId();
      const memberBId = new mongoose.Types.ObjectId();
      const projectId = new mongoose.Types.ObjectId();

      vi.spyOn(TeamMember, 'findById').mockResolvedValue({ _id: memberBId, status: 'ACTIVE' } as any);
      vi.spyOn(Project, 'findById').mockResolvedValue({ _id: projectId } as any);
      vi.spyOn(Task, 'findById').mockResolvedValue({
        _id: taskId,
        projectId,
        assignedTo: memberAId, // assigned to Member A
      } as any);

      await expect(
        TeamPaymentService.recordTeamPayment(
          {
            teamMemberId: memberBId.toString(), // Member B
            projectId: projectId.toString(),
            taskId: taskId.toString(),
            amount: 1500,
            status: 'PAID',
          },
          'admin@crm.local'
        )
      ).rejects.toThrow(/Task is assigned to a different team member/);
    });
  });

  describe('2. Chat File & Image Storage and Soft-Delete Safety', () => {
    it('uploads outbound admin image/file to storage and attaches metadata to TeamMemberMessage', async () => {
      const memberId = new mongoose.Types.ObjectId();
      const mockMember = {
        _id: memberId,
        name: 'John Developer',
        telegramConnected: true,
        telegramChatId: '123456789',
      };
      const mockConversation = {
        _id: new mongoose.Types.ObjectId(),
        teamMemberId: memberId,
        status: 'OPEN',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockMongooseQuery(mockMember));
      vi.spyOn(TeamChatService as any, 'getOrCreateConversation').mockResolvedValue({ conversation: mockConversation, isNew: false });

      const savedMessages: any[] = [];
      vi.spyOn(TeamMemberMessage.prototype, 'save').mockImplementation(function (this: any) {
        savedMessages.push(this);
        return Promise.resolve(this);
      });

      const buffer = Buffer.from('fake image content');
      await TeamChatService.sendMessageFromAdmin({
        teamMemberId: memberId.toString(),
        text: 'Check this diagram',
        attachments: [
          {
            buffer,
            originalName: 'diagram.png',
            mimeType: 'image/png',
            size: buffer.length,
            type: 'IMAGE',
          },
        ],
        adminUser: { id: 'admin1', email: 'admin@crm.local', name: 'Super Admin' },
      });

      // Verify StorageService was called
      expect(StorageService.uploadFile).toHaveBeenCalled();
      expect(StorageService.getSignedUrl).toHaveBeenCalled();

      // Verify saved message contains attachment metadata
      expect(savedMessages.length).toBeGreaterThan(0);
      const msg = savedMessages[0];
      expect(msg.attachments).toHaveLength(1);
      expect(msg.attachments[0].type).toBe('IMAGE');
      expect(msg.attachments[0].originalName).toBe('diagram.png');
      expect(msg.messageType).toBe('IMAGE');
    });

    it('soft-deletes single message without deleting team member, tasks, or credentials', async () => {
      const messageId = new mongoose.Types.ObjectId();
      const memberId = new mongoose.Types.ObjectId();

      const mockMsg = {
        _id: messageId,
        teamMemberId: memberId,
        conversationId: new mongoose.Types.ObjectId(),
        isDeleted: false,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(TeamMemberMessage, 'findOne').mockResolvedValue(mockMsg as any);

      // Spies to ensure NO destructive delete calls on other CRM entities
      const tmDeleteSpy = vi.spyOn(TeamMember, 'findByIdAndDelete');
      const taskDeleteSpy = vi.spyOn(Task, 'findByIdAndDelete');
      const paymentDeleteSpy = vi.spyOn(TeamPayment, 'findByIdAndDelete');

      const res = await TeamChatService.deleteMessage(messageId.toString(), memberId.toString(), {
        id: 'admin1',
        email: 'admin@crm.local',
        name: 'Super Admin',
      });

      expect(res.success).toBe(true);
      expect(mockMsg.isDeleted).toBe(true);
      expect(mockMsg.save).toHaveBeenCalled();

      // Unrelated CRM data is completely untouched
      expect(tmDeleteSpy).not.toHaveBeenCalled();
      expect(taskDeleteSpy).not.toHaveBeenCalled();
      expect(paymentDeleteSpy).not.toHaveBeenCalled();
    });

    it('clears conversation by soft-deleting chat messages only', async () => {
      const memberId = new mongoose.Types.ObjectId();
      const mockConv = {
        _id: new mongoose.Types.ObjectId(),
        teamMemberId: memberId,
        lastMessageText: 'Hello',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(TeamMemberConversation, 'findOne').mockResolvedValue(mockConv as any);
      const updateManySpy = vi.spyOn(TeamMemberMessage, 'updateMany').mockResolvedValue({ modifiedCount: 5 } as any);

      const res = await TeamChatService.clearConversation(memberId.toString(), {
        id: 'admin1',
        email: 'admin@crm.local',
        name: 'Super Admin',
      });

      expect(res.success).toBe(true);
      expect(updateManySpy).toHaveBeenCalledWith(
        { conversationId: mockConv._id },
        expect.objectContaining({
          $set: expect.objectContaining({ isDeleted: true }),
        })
      );
      expect(mockConv.lastMessageText).toBe('');
    });
  });

  describe('3. Team Member Task Counts Integrity (Pagination-Free)', () => {
    it('uses authoritative count queries for assigned and completed tasks', async () => {
      const memberId = new mongoose.Types.ObjectId();
      const mockMember = {
        _id: memberId,
        name: 'Dev One',
        email: 'dev@crm.local',
        role: 'DEVELOPER',
      };

      vi.spyOn(TeamMember, 'find').mockReturnValue(mockMongooseQuery([mockMember]));
      vi.spyOn(TeamMemberConversation, 'find').mockReturnValue(mockMongooseQuery([]));
      vi.spyOn(Project, 'countDocuments').mockResolvedValue(2);

      const countSpy = vi.spyOn(Task, 'countDocuments').mockImplementation(((query: any) => {
        if (query?.status === 'COMPLETED') return Promise.resolve(8);
        if (query?.status?.$nin) return Promise.resolve(4);
        return Promise.resolve(12); // Total assigned tasks
      }) as any);

      const members = await TeamMemberService.getTeamMembers();

      expect(members).toHaveLength(1);
      expect(members[0].assignedTasksCount).toBe(12);
      expect(members[0].completedTasksCount).toBe(8);
      expect(members[0].activeTasksCount).toBe(4);

      // Verify countDocuments was called with the exact member ID
      expect(countSpy).toHaveBeenCalledWith(expect.objectContaining({ assignedTo: memberId }));
      expect(countSpy).toHaveBeenCalledWith(expect.objectContaining({ assignedTo: memberId, status: 'COMPLETED' }));
    });
  });
});
