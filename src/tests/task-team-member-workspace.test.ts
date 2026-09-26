import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import Task from '@/models/Task';
import Project from '@/models/Project';
import Client from '@/models/Client';
import TeamMember from '@/models/TeamMember';
import TeamPayment from '@/models/TeamPayment';
import AuditLog from '@/models/AuditLog';
import { TaskService } from '@/services/task.service';
import { TeamMemberService } from '@/services/team-member.service';
import { TelegramService } from '@/services/telegram.service';
import { AuditService } from '@/services/audit.service';
import { GET as getTasksRoute, POST as postTasksRoute } from '@/app/api/tasks/route';
import { GET as getTaskByIdRoute, PATCH as patchTaskByIdRoute, DELETE as deleteTaskByIdRoute } from '@/app/api/tasks/[id]/route';
import { GET as getTeamPaymentsRoute, POST as postTeamPaymentsRoute } from '@/app/api/team-payments/route';

// Mock DB and external services to ensure ZERO production DB access and ZERO real Telegram messages
vi.mock('@/lib/db/connect', () => ({
  dbConnect: vi.fn().mockResolvedValue(null),
  default: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/telegram.service', () => ({
  TelegramService: {
    sendMessageRaw: vi.fn().mockResolvedValue({ success: true, messageId: 9999 }),
    sendMessage: vi.fn().mockResolvedValue(true),
    answerCallbackQuery: vi.fn().mockResolvedValue(true),
    sendTaskSubmissionNotificationToAdmin: vi.fn().mockResolvedValue(true),
    sendTaskStatusNotificationToAdmin: vi.fn().mockResolvedValue(true),
    sendTaskAssignmentNotification: vi.fn().mockResolvedValue(true),
    sendTaskAssignedNotification: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/services/audit.service', () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(true),
    logAction: vi.fn().mockResolvedValue(true),
  },
}));

describe('Team Member ↔ Task Management Workspace & Security Tests', () => {
  const mockAdminId = new mongoose.Types.ObjectId().toString();
  const mockMemberAId = new mongoose.Types.ObjectId().toString();
  const mockMemberBId = new mongoose.Types.ObjectId().toString();
  const mockClientAId = new mongoose.Types.ObjectId().toString();
  const mockClientBId = new mongoose.Types.ObjectId().toString();
  const mockProjectAId = new mongoose.Types.ObjectId().toString();
  const mockTaskId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // 1. Client → Project Relationship Validation
  // ==========================================
  describe('Client → Project Relationship Validation', () => {
    it('1. Rejects task creation if clientId does not match project.clientId', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue({
        _id: mockProjectAId,
        clientId: mockClientAId,
        name: 'Project Alpha',
      } as any);

      await expect(
        TaskService.createTask(
          {
            title: 'Build API',
            projectId: mockProjectAId,
            clientId: mockClientBId, // Incorrect Client!
            assignedTo: mockMemberAId,
          },
          'admin@crm.local'
        )
      ).rejects.toThrow(/Selected project does not belong to the/);
    });

    it('2. Accepts task creation when clientId matches project.clientId', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue({
        _id: mockProjectAId,
        clientId: mockClientAId,
        name: 'Project Alpha',
        teamMemberIds: [mockMemberAId],
        save: vi.fn().mockResolvedValue(true),
      } as any);

      vi.spyOn(TeamMember, 'findById').mockResolvedValue({
        _id: mockMemberAId,
        name: 'Developer Alice',
        status: 'ACTIVE',
        telegramChatId: '12345678',
      } as any);

      vi.spyOn(Task, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(Task, 'exists').mockResolvedValue(false as any);

      vi.spyOn(Task.prototype, 'save').mockImplementation(async function (this: any) {
        return this;
      });

      const task = await TaskService.createTask(
        {
          title: 'Build API',
          projectId: mockProjectAId,
          clientId: mockClientAId, // Correct Client
          assignedTo: mockMemberAId,
        },
        'admin@crm.local'
      );

      expect(task).toBeDefined();
      expect(task.title).toBe('Build API');
    });

    it('3. Rejects task update if modified clientId does not match project.clientId', async () => {
      const existingTask = {
        _id: mockTaskId,
        projectId: mockProjectAId,
        clientId: mockClientAId,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(existingTask as any);
      vi.spyOn(Project, 'findById').mockResolvedValue({
        _id: mockProjectAId,
        clientId: mockClientAId,
      } as any);

      await expect(
        TaskService.updateTask(
          mockTaskId,
          {
            clientId: mockClientBId, // Mismatched client update
          },
          'admin@crm.local'
        )
      ).rejects.toThrow(/Selected project does not belong to the/);
    });
  });

  // ==========================================
  // 2. Team Member Assignment & Status Check
  // ==========================================
  describe('Team Member Assignment Integrity', () => {
    it('4. Rejects task assignment to deactivated team member', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue({
        _id: mockProjectAId,
        clientId: mockClientAId,
        teamMemberIds: [],
        save: vi.fn().mockResolvedValue(true),
      } as any);

      vi.spyOn(TeamMember, 'findById').mockResolvedValue({
        _id: mockMemberAId,
        name: 'Inactive Bob',
        status: 'DEACTIVATED',
      } as any);

      await expect(
        TaskService.createTask(
          {
            title: 'Deactivated Worker Task',
            projectId: mockProjectAId,
            assignedTo: mockMemberAId,
          },
          'admin@crm.local'
        )
      ).rejects.toThrow(/Cannot assign task to a deactivated team member/);
    });
  });

  // ==========================================
  // 3. Team Member Submission Role Separation
  // ==========================================
  describe('Team Member Submission Role Separation', () => {
    it('5. Team Member can submit work for their assigned task', async () => {
      const mockTask = {
        _id: mockTaskId,
        taskCode: 'TSK-201',
        title: 'Frontend Component',
        assignedTo: mockMemberAId,
        status: 'IN_PROGRESS',
        submissionRequired: true,
        submissionTypes: ['url'],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);
      vi.spyOn(Project, 'findById').mockReturnValue({
        select: vi.fn().mockResolvedValue({ name: 'CRM Web', projectCode: 'PRJ-01' }),
      } as any);

      const result = await TaskService.submitAndCompleteTask(
        mockTaskId,
        {
          submissionUrls: ['https://github.com/pull/42'],
          submissionNotes: 'PR is ready for review',
        },
        'alice@crm.local',
        'DEVELOPER',
        mockMemberAId
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.submission?.submissionUrls).toContain('https://github.com/pull/42');
      expect(result.submission?.submittedBy).toBe('alice@crm.local');
    });

    it('6. Rejects submission when another non-admin team member attempts submission', async () => {
      const mockTask = {
        _id: mockTaskId,
        taskCode: 'TSK-201',
        title: 'Frontend Component',
        assignedTo: mockMemberAId, // Assigned to Alice
        status: 'IN_PROGRESS',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Task, 'findById').mockResolvedValue(mockTask as any);

      await expect(
        TaskService.submitAndCompleteTask(
          mockTaskId,
          { submissionNotes: 'Hacking Bob submitting Alice task' },
          'bob@crm.local',
          'DEVELOPER',
          mockMemberBId // Bob attempts submission!
        )
      ).rejects.toThrow(/You can only submit completion for tasks assigned to you/);
    });
  });

  // ==========================================
  // 4. IDOR Protection in API Endpoints
  // ==========================================
  describe('IDOR & Authorization Protection in API Endpoints', () => {
    it('7. GET /api/tasks forces assignedTo = actorTeamMemberId for non-admin users', async () => {
      const mockChain: any = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([]),
      };
      const findSpy = vi.spyOn(Task, 'find').mockReturnValue(mockChain as any);

      // Non-admin Bob sends request trying to view Alice's tasks
      const req = new NextRequest(`http://localhost:3000/api/tasks?assignedTo=${mockMemberAId}`, {
        headers: {
          'x-user-role': 'DEVELOPER',
          'x-user-email': 'bob@crm.local',
          'x-team-member-id': mockMemberBId,
        },
      });

      const res = await getTasksRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify that Task.find was called with assignedTo = mockMemberBId (NOT mockMemberAId!)
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedTo: mockMemberBId,
        })
      );
    });

    it('8. POST /api/tasks blocks non-admin user without MANAGE_TASKS permission', async () => {
      vi.spyOn(TeamMember, 'findById').mockResolvedValue({
        _id: mockMemberBId,
        permissions: ['VIEW_PROJECT', 'VIEW_TASKS'],
      } as any);

      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'x-user-role': 'DEVELOPER',
          'x-user-email': 'bob@crm.local',
          'x-team-member-id': mockMemberBId,
        },
        body: JSON.stringify({
          title: 'Unauthorized Task',
          projectId: mockProjectAId,
        }),
      });

      const res = await postTasksRoute(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error?.message).toMatch(/MANAGE_TASKS permission required/);
    });

    it('9. GET /api/tasks/[id] prevents non-admin from reading tasks assigned to another member', async () => {
      const mockChain: any = {
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue({
          _id: mockTaskId,
          title: 'Alice Private Task',
          assignedTo: { _id: mockMemberAId, name: 'Alice' },
        }),
      };
      vi.spyOn(Task, 'findById').mockReturnValue(mockChain as any);

      // Bob tries to access Alice's task by ID
      const req = new NextRequest(`http://localhost:3000/api/tasks/${mockTaskId}`, {
        headers: {
          'x-user-role': 'DEVELOPER',
          'x-user-email': 'bob@crm.local',
          'x-team-member-id': mockMemberBId,
        },
      });

      const res = await getTaskByIdRoute(req, { params: Promise.resolve({ id: mockTaskId }) });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error?.message).toMatch(/Unauthorized to view this task/);
    });

    it('10. PATCH /api/tasks/[id] prevents non-admin from altering assignedTo or agreedAmount', async () => {
      // Bob owns this task
      vi.spyOn(Task, 'findById').mockResolvedValue({
        _id: mockTaskId,
        assignedTo: mockMemberBId,
      } as any);

      // Bob tries to reassign or change agreedAmount on his task
      const req = new NextRequest(`http://localhost:3000/api/tasks/${mockTaskId}`, {
        method: 'PATCH',
        headers: {
          'x-user-role': 'DEVELOPER',
          'x-user-email': 'bob@crm.local',
          'x-team-member-id': mockMemberBId,
        },
        body: JSON.stringify({
          assignedTo: mockMemberAId, // Attempt to reassign
          agreedAmount: 50000,       // Attempt to inflate compensation
        }),
      });

      const res = await patchTaskByIdRoute(req, { params: Promise.resolve({ id: mockTaskId }) });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error?.message).toMatch(/Unauthorized to reassign task/);
    });

    it('11. GET /api/team-payments blocks non-admin from viewing another member payments', async () => {
      const mockChain: any = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([]),
      };
      const findSpy = vi.spyOn(TeamPayment, 'find').mockReturnValue(mockChain as any);

      // Bob tries to query Alice's payments
      const req = new NextRequest(`http://localhost:3000/api/team-payments?teamMemberId=${mockMemberAId}`, {
        headers: {
          'x-user-role': 'DEVELOPER',
          'x-user-email': 'bob@crm.local',
          'x-team-member-id': mockMemberBId,
        },
      });

      const res = await getTeamPaymentsRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify that TeamPayment.find was forced to mockMemberBId
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          teamMemberId: mockMemberBId,
        })
      );
    });

    it('12. POST /api/team-payments strictly forbids non-admin from recording payments', async () => {
      const req = new NextRequest('http://localhost:3000/api/team-payments', {
        method: 'POST',
        headers: {
          'x-user-role': 'DEVELOPER',
          'x-user-email': 'bob@crm.local',
          'x-team-member-id': mockMemberBId,
        },
        body: JSON.stringify({
          teamMemberId: mockMemberBId,
          amount: 10000,
        }),
      });

      const res = await postTeamPaymentsRoute(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error?.message).toMatch(/Admin access required/);
    });
  });

  // ==========================================
  // 5. Team Member Workspace Enrichment
  // ==========================================
  describe('Team Member Workspace Aggregation & Security', () => {
    it('13. getTeamMemberById aggregates task summary stats, assigned tasks, and audit logs', async () => {
      const mockMemberDoc = {
        _id: mockMemberAId,
        name: 'Alice Dev',
        email: 'alice@crm.local',
        role: 'DEVELOPER',
        status: 'ACTIVE',
        bankDetails: {
          accountHolderName: 'Alice Dev',
          bankName: 'HDFC Bank',
          accountNumber: 'encrypted_val_123',
          accountNumberMasked: '•••• 1234',
          ifsc: 'HDFC0001234',
        },
      };

      vi.spyOn(TeamMember, 'findById').mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockMemberDoc),
      } as any);

      // Mock projects
      vi.spyOn(Project, 'find').mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      // Mock assigned tasks
      const mockTasks = [
        { _id: 't1', title: 'Task 1', status: 'TODO', agreedAmount: 5000 },
        { _id: 't2', title: 'Task 2', status: 'IN_PROGRESS', agreedAmount: 7000 },
        { _id: 't3', title: 'Task 3', status: 'COMPLETED', agreedAmount: 8000 },
      ];

      vi.spyOn(Task, 'find').mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockTasks),
        }),
      } as any);

      // Mock payments
      const mockPayments = [
        { _id: 'p1', amount: 5000, status: 'PAID' },
        { _id: 'p2', amount: 3000, status: 'PENDING' },
      ];

      vi.spyOn(TeamPayment, 'find').mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockPayments),
        }),
      } as any);

      // Mock audit logs
      vi.spyOn(AuditLog, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([
              { _id: 'a1', action: 'TASK_ASSIGNED', createdAt: new Date() },
            ]),
          }),
        }),
      } as any);

      const workspaceData = await TeamMemberService.getTeamMemberById(mockMemberAId);

      expect(workspaceData).toBeDefined();
      expect(workspaceData?.name).toBe('Alice Dev');
      // Bank account number must NOT expose raw encrypted string directly to standard queries
      expect(workspaceData?.bankDetails?.accountNumber).toBeUndefined();
      expect(workspaceData?.bankDetails?.accountNumberMasked).toBe('•••• 1234');

      // Verify aggregated stats
      expect(workspaceData?.stats).toBeDefined();
      expect(workspaceData?.stats.totalTasks).toBe(3);
      expect(workspaceData?.stats.todoTasks).toBe(1);
      expect(workspaceData?.stats.inProgressTasks).toBe(1);
      expect(workspaceData?.stats.completedTasks).toBe(1);
      expect(workspaceData?.stats.totalPaid).toBe(5000);
      expect(workspaceData?.stats.pendingPaymentsCount).toBe(1);
    });
  });
});
