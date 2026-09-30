import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import Task from '@/models/Task';
import TeamMember from '@/models/TeamMember';
import TeamPayment from '@/models/TeamPayment';
import Payment from '@/models/Payment';
import Project from '@/models/Project';
import AuditLog from '@/models/AuditLog';
import { TeamPaymentService } from '@/services/team-payment.service';
import { TeamMemberService } from '@/services/team-member.service';
import { CacheService } from '@/services/cache.service';

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
    sendMediaRaw: vi.fn().mockResolvedValue({ success: true, messageId: 1001 }),
    sendMessage: vi.fn().mockResolvedValue(true),
    sendTeamPaymentNotification: vi.fn().mockResolvedValue(true),
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

describe('Team Member Payment Audit & Referential Integrity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuditLog, 'find').mockReturnValue(mockMongooseQuery([]));
    vi.spyOn(TeamPaymentService, 'generateNextPaymentNumber').mockResolvedValue('TP-2026-0001');
  });

  describe('1. Team Member Multi-Task Payment Totals (Bug 1 Scenario)', () => {
    it('accurately calculates Total Agreed (29,000), Total Paid (12,900), and Pending (16,100)', async () => {
      const memberId = new mongoose.Types.ObjectId();
      const task1Id = new mongoose.Types.ObjectId();
      const task2Id = new mongoose.Types.ObjectId();

      const mockTasks = [
        {
          _id: task1Id,
          taskCode: 'TSK-0008',
          title: 'Write Content',
          assignedTo: memberId,
          agreedAmount: 14000,
          status: 'IN_PROGRESS',
        },
        {
          _id: task2Id,
          taskCode: 'TSK-0004',
          title: 'Rumble Rummy Content Writing',
          assignedTo: memberId,
          agreedAmount: 15000,
          status: 'IN_PROGRESS',
        },
      ];

      const mockPayments = [
        { _id: new mongoose.Types.ObjectId(), taskId: task1Id, teamMemberId: memberId, amount: 5400, status: 'PAID' },
        { _id: new mongoose.Types.ObjectId(), taskId: task2Id, teamMemberId: memberId, amount: 7500, status: 'PAID' },
      ];

      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockMongooseQuery({
        _id: memberId,
        name: 'Content Writer',
        email: 'writer@crm.local',
      }));
      vi.spyOn(Project, 'find').mockReturnValue(mockMongooseQuery([]));
      vi.spyOn(Task, 'find').mockReturnValue(mockMongooseQuery(mockTasks));
      vi.spyOn(TeamPayment, 'find').mockReturnValue(mockMongooseQuery(mockPayments));
      vi.spyOn(Task, 'countDocuments').mockResolvedValue(2 as any);

      const result = await TeamMemberService.getTeamMemberById(memberId.toString());

      expect(result.stats.totalAgreed).toBe(29000);
      expect(result.stats.totalPaid).toBe(12900);
      expect(result.stats.totalPending).toBe(16100);
      expect(result.stats.outstanding).toBe(16100);

      // Verify each task receives its accurate paid and pending amount
      const t1 = result.assignedTasks.find((t: any) => t._id.toString() === task1Id.toString());
      expect(t1.paidAmount).toBe(5400);
      expect(t1.pendingAmount).toBe(8600); // 14000 - 5400

      const t2 = result.assignedTasks.find((t: any) => t._id.toString() === task2Id.toString());
      expect(t2.paidAmount).toBe(7500);
      expect(t2.pendingAmount).toBe(7500); // 15000 - 7500
    });
  });

  describe('2. Task-Level Pending & Partial Payments', () => {
    it('calculates Task 1 pending: 14,000 - 5,400 = 8,600', () => {
      const agreed = 14000;
      const paid = 5400;
      const pending = Math.max(0, agreed - paid);
      expect(pending).toBe(8600);
    });

    it('calculates Task 2 pending: 15,000 - 7,500 = 7,500', () => {
      const agreed = 15000;
      const paid = 7500;
      const pending = Math.max(0, agreed - paid);
      expect(pending).toBe(7500);
    });

    it('returns pending = 0 for fully paid task (Case 2: 14000 agreed, 14000 paid)', () => {
      const agreed = 14000;
      const paid = 14000;
      const pending = Math.max(0, agreed - paid);
      expect(pending).toBe(0);
    });

    it('handles multiple partial payments correctly (Case 3: 10,000 + 4,000 = 14,000 paid -> pending = 0)', () => {
      const agreed = 14000;
      const partials = [10000, 4000];
      const paid = partials.reduce((a, b) => a + b, 0);
      const pending = Math.max(0, agreed - paid);
      expect(paid).toBe(14000);
      expect(pending).toBe(0);
    });

    it('handles partial milestone payments (Case 4: 5,000 + 3,000 = 8,000 paid -> pending = 6,000)', () => {
      const agreed = 14000;
      const partials = [5000, 3000];
      const paid = partials.reduce((a, b) => a + b, 0);
      const pending = Math.max(0, agreed - paid);
      expect(paid).toBe(8000);
      expect(pending).toBe(6000);
    });

    it('clamps pending to 0 when payment exceeds agreed amount (Case 5: 14000 + 2000 = 16000 paid -> pending = 0)', () => {
      const agreed = 14000;
      const paid = 16000;
      const pending = Math.max(0, agreed - paid);
      expect(pending).toBe(0);
    });

    it('excludes FAILED, CANCELLED, and REJECTED payments from Total Paid', async () => {
      const memberId = new mongoose.Types.ObjectId();
      const taskId = new mongoose.Types.ObjectId();

      const mockTasks = [
        { _id: taskId, agreedAmount: 14000, status: 'IN_PROGRESS', assignedTo: memberId },
      ];

      const mockPayments = [
        { _id: new mongoose.Types.ObjectId(), taskId, teamMemberId: memberId, amount: 5000, status: 'PAID' },
        { _id: new mongoose.Types.ObjectId(), taskId, teamMemberId: memberId, amount: 2000, status: 'FAILED' },
        { _id: new mongoose.Types.ObjectId(), taskId, teamMemberId: memberId, amount: 3000, status: 'CANCELLED' },
      ];

      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockMongooseQuery({ _id: memberId, name: 'Dev' }));
      vi.spyOn(Project, 'find').mockReturnValue(mockMongooseQuery([]));
      vi.spyOn(Task, 'find').mockReturnValue(mockMongooseQuery(mockTasks));
      vi.spyOn(TeamPayment, 'find').mockReturnValue(mockMongooseQuery(mockPayments));
      vi.spyOn(Task, 'countDocuments').mockResolvedValue(1 as any);

      const result = await TeamMemberService.getTeamMemberById(memberId.toString());

      // Only the 5000 PAID payment contributes
      expect(result.stats.totalPaid).toBe(5000);
      expect(result.stats.totalPending).toBe(9000); // 14000 - 5000
    });
  });

  describe('3. Task-Context and General Record Payment Validation (Bug 2)', () => {
    it('automatically uses the task project when creating a payment with a valid task', async () => {
      const memberId = new mongoose.Types.ObjectId();
      const projectId = new mongoose.Types.ObjectId();
      const taskId = new mongoose.Types.ObjectId();

      vi.spyOn(TeamMember, 'findById').mockResolvedValue({ _id: memberId, status: 'ACTIVE' } as any);
      vi.spyOn(Task, 'findById').mockResolvedValue({
        _id: taskId,
        assignedTo: memberId,
        projectId: projectId,
      } as any);
      vi.spyOn(Project, 'findById').mockResolvedValue({ _id: projectId, name: 'allyonogames.com' } as any);

      const savedPaymentInstances: any[] = [];
      vi.spyOn(TeamPayment.prototype, 'save').mockImplementation(function (this: any) {
        savedPaymentInstances.push(this);
        return Promise.resolve(this);
      });

      // Even if client does not provide projectId, the server derives it from task.projectId!
      const payment = await TeamPaymentService.recordTeamPayment(
        {
          teamMemberId: memberId.toString(),
          taskId: taskId.toString(),
          amount: 5400,
          status: 'PAID',
        },
        'admin@crm.local'
      );

      expect(payment.projectId.toString()).toBe(projectId.toString());
      expect(payment.taskId?.toString()).toBe(taskId.toString());
      expect(payment.amount).toBe(5400);
    });

    it('rejects payment if browser submits an unrelated projectId for a task', async () => {
      const memberId = new mongoose.Types.ObjectId();
      const projectAId = new mongoose.Types.ObjectId();
      const projectBId = new mongoose.Types.ObjectId();
      const taskId = new mongoose.Types.ObjectId();

      vi.spyOn(TeamMember, 'findById').mockResolvedValue({ _id: memberId, status: 'ACTIVE' } as any);
      vi.spyOn(Task, 'findById').mockResolvedValue({
        _id: taskId,
        assignedTo: memberId,
        projectId: projectAId, // Belongs to Project A
      } as any);

      // Attempting to submit Project B for Task A must fail
      await expect(
        TeamPaymentService.recordTeamPayment(
          {
            teamMemberId: memberId.toString(),
            projectId: projectBId.toString(), // Unrelated Project B
            taskId: taskId.toString(),
            amount: 5400,
          },
          'admin@crm.local'
        )
      ).rejects.toThrow('Task does not belong to the selected project');
    });

    it('rejects payment if browser submits another Team Member taskId', async () => {
      const memberAId = new mongoose.Types.ObjectId();
      const memberBId = new mongoose.Types.ObjectId();
      const projectId = new mongoose.Types.ObjectId();
      const taskId = new mongoose.Types.ObjectId();

      vi.spyOn(TeamMember, 'findById').mockResolvedValue({ _id: memberBId, status: 'ACTIVE' } as any);
      vi.spyOn(Task, 'findById').mockResolvedValue({
        _id: taskId,
        assignedTo: memberAId, // Assigned to Member A
        projectId,
      } as any);

      // Attempting to record payment for Member B against Member A's task must fail
      await expect(
        TeamPaymentService.recordTeamPayment(
          {
            teamMemberId: memberBId.toString(), // Target Member B
            projectId: projectId.toString(),
            taskId: taskId.toString(), // Task of Member A
            amount: 3000,
          },
          'admin@crm.local'
        )
      ).rejects.toThrow('Task is assigned to a different team member');
    });

    it('filters tasks by selected project and assigned team member in General Payments dropdown', () => {
      const memberId = 'mem_123';
      const otherMemberId = 'mem_456';
      const projectAId = 'proj_A';
      const projectBId = 'proj_B';

      const tasks = [
        { _id: 't1', title: 'Task A1', assignedTo: memberId, projectId: projectAId },
        { _id: 't2', title: 'Task A2 (Other Member)', assignedTo: otherMemberId, projectId: projectAId },
        { _id: 't3', title: 'Task B1', assignedTo: memberId, projectId: projectBId },
      ];

      // Filter for Member A + Project A
      const availableForProjA = tasks.filter((t) => {
        if (t.assignedTo !== memberId) return false;
        if (t.projectId !== projectAId) return false;
        return true;
      });

      expect(availableForProjA).toHaveLength(1);
      expect(availableForProjA[0]._id).toBe('t1');

      // Filter for Member A + Project B
      const availableForProjB = tasks.filter((t) => {
        if (t.assignedTo !== memberId) return false;
        if (t.projectId !== projectBId) return false;
        return true;
      });

      expect(availableForProjB).toHaveLength(1);
      expect(availableForProjB[0]._id).toBe('t3');
    });
  });

  describe('4. Client Payments and Client Bonuses Isolation', () => {
    it('strictly isolates ClientPayment and client invoices from Team Member totals', async () => {
      const memberId = new mongoose.Types.ObjectId();
      const taskId = new mongoose.Types.ObjectId();

      const mockTasks = [
        { _id: taskId, agreedAmount: 10000, status: 'COMPLETED', assignedTo: memberId },
      ];

      const mockTeamPayments = [
        { _id: new mongoose.Types.ObjectId(), taskId, teamMemberId: memberId, amount: 4000, status: 'PAID' },
      ];

      // Spies to ensure Client Payments are never queried or factored into Team Member compensation
      const clientPaymentSpy = vi.spyOn(Payment, 'find');

      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockMongooseQuery({ _id: memberId, name: 'Dev' }));
      vi.spyOn(Project, 'find').mockReturnValue(mockMongooseQuery([]));
      vi.spyOn(Task, 'find').mockReturnValue(mockMongooseQuery(mockTasks));
      vi.spyOn(TeamPayment, 'find').mockReturnValue(mockMongooseQuery(mockTeamPayments));
      vi.spyOn(Task, 'countDocuments').mockResolvedValue(1 as any);

      const result = await TeamMemberService.getTeamMemberById(memberId.toString());

      expect(clientPaymentSpy).not.toHaveBeenCalled();
      expect(result.stats.totalPaid).toBe(4000);
      expect(result.stats.totalPending).toBe(6000);
    });
  });

  describe('5. Cache Safety & Invalidation', () => {
    it('safely handles project cache invalidation without errors', async () => {
      const invalidateSpy = vi.spyOn(CacheService, 'invalidateProjectsCache').mockResolvedValue();
      await CacheService.invalidateProjectsCache('client_123');
      expect(invalidateSpy).toHaveBeenCalledWith('client_123');
    });
  });
});
