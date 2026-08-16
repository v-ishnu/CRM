import mongoose from 'mongoose';
import TeamPayment, { ITeamPayment, TeamPaymentMethod, TeamPaymentStatus } from '@/models/TeamPayment';
import TeamMember from '@/models/TeamMember';
import Project from '@/models/Project';
import Task from '@/models/Task';
import { AuditService } from './audit.service';
import { TelegramService } from './telegram.service';
import { dbConnect } from '@/lib/db/connect';

export interface CreateTeamPaymentDto {
  teamMemberId: string;
  projectId: string;
  taskId?: string;
  amount: number;
  currency?: string;
  paymentDate?: Date | string;
  paymentMethod?: TeamPaymentMethod;
  reference?: string;
  description?: string;
  status?: TeamPaymentStatus;
}

export interface QueryTeamPaymentsFilter {
  teamMemberId?: string;
  projectId?: string;
  taskId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export class TeamPaymentService {
  /**
   * Helper to generate unique sequential payment code (e.g. TP-2026-0001)
   */
  static async generateNextPaymentNumber(): Promise<string> {
    await dbConnect();
    const currentYear = new Date().getFullYear();
    const prefix = `TP-${currentYear}-`;

    const lastPayment = await TeamPayment.findOne({
      paymentNumber: new RegExp(`^${prefix}\\d+$`),
    }).sort({ paymentNumber: -1 });

    let nextSeq = 1;
    if (lastPayment) {
      const match = lastPayment.paymentNumber.match(new RegExp(`^${prefix}(\\d+)$`));
      if (match) {
        nextSeq = parseInt(match[1], 10) + 1;
      }
    }

    let candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    while (await TeamPayment.exists({ paymentNumber: candidate })) {
      nextSeq++;
      candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }

    return candidate;
  }

  /**
   * Record a new team member payment
   */
  static async recordTeamPayment(data: CreateTeamPaymentDto, actor: string = 'Admin'): Promise<ITeamPayment> {
    await dbConnect();

    if (!data.teamMemberId || !data.projectId || data.amount === undefined) {
      throw new Error('teamMemberId, projectId, and amount are required');
    }

    const numAmount = Number(data.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Payment amount must be a positive number');
    }

    const teamMember = await TeamMember.findById(data.teamMemberId);
    if (!teamMember) {
      throw new Error('Team member not found');
    }

    const project = await Project.findById(data.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    let task: any = null;
    if (data.taskId) {
      task = await Task.findById(data.taskId);
      if (!task) {
        throw new Error('Task not found');
      }
      if (task.projectId.toString() !== project._id.toString()) {
        throw new Error('Task does not belong to the selected project');
      }
    }

    const paymentNumber = await this.generateNextPaymentNumber();
    const status: TeamPaymentStatus = data.status || 'PAID';

    const teamPayment = new TeamPayment({
      paymentNumber,
      teamMemberId: teamMember._id,
      projectId: project._id,
      taskId: task ? task._id : undefined,
      amount: numAmount,
      currency: data.currency || 'INR',
      paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
      paymentMethod: data.paymentMethod || 'UPI',
      reference: data.reference?.trim(),
      description: data.description?.trim(),
      status,
      notificationStatus: 'NONE',
      notifiedEvents: [],
      createdBy: actor,
    });

    // Handle Telegram Notification for PAID payments
    if (status === 'PAID' && teamMember.telegramConnected && teamMember.telegramChatId) {
      try {
        const sent = await TelegramService.sendTeamPaymentNotification(
          teamPayment,
          teamMember,
          project,
          task,
          'PAID'
        );
        if (sent) {
          teamPayment.notificationStatus = 'SENT';
          teamPayment.notifiedEvents = ['PAID'];
        } else {
          teamPayment.notificationStatus = 'FAILED';
          teamPayment.notificationError = 'Failed to deliver Telegram message';
        }
      } catch (tgErr: any) {
        console.error('Team payment notification error:', tgErr);
        teamPayment.notificationStatus = 'FAILED';
        teamPayment.notificationError = tgErr.message || 'Telegram notification error';
      }
    }

    await teamPayment.save();

    // Audit Logging
    await AuditService.log({
      actor,
      action: 'TEAM_PAYMENT_CREATED',
      entityType: 'TeamPayment',
      entityId: teamPayment._id,
      metadata: {
        paymentNumber: teamPayment.paymentNumber,
        teamMemberId: teamMember._id,
        teamMemberName: teamMember.name,
        projectId: project._id,
        projectName: project.name,
        taskId: task ? task._id : undefined,
        taskTitle: task ? task.title : undefined,
        amount: teamPayment.amount,
        currency: teamPayment.currency,
        status: teamPayment.status,
      },
    });

    if (status === 'PAID') {
      await AuditService.log({
        actor,
        action: 'TEAM_PAYMENT_MARKED_PAID',
        entityType: 'TeamPayment',
        entityId: teamPayment._id,
        metadata: {
          paymentNumber: teamPayment.paymentNumber,
          amount: teamPayment.amount,
          teamMemberName: teamMember.name,
        },
      });
    }

    return teamPayment;
  }

  /**
   * Update an existing team member payment
   */
  static async updateTeamPayment(
    id: string,
    updateData: Partial<CreateTeamPaymentDto>,
    actor: string = 'Admin'
  ): Promise<ITeamPayment> {
    await dbConnect();

    const payment = await TeamPayment.findById(id);
    if (!payment) {
      throw new Error('Team payment record not found');
    }

    const previousStatus = payment.status;

    if (updateData.amount !== undefined) {
      const amt = Number(updateData.amount);
      if (isNaN(amt) || amt <= 0) throw new Error('Payment amount must be positive');
      payment.amount = amt;
    }
    if (updateData.currency) payment.currency = updateData.currency;
    if (updateData.paymentDate) payment.paymentDate = new Date(updateData.paymentDate);
    if (updateData.paymentMethod) payment.paymentMethod = updateData.paymentMethod;
    if (updateData.reference !== undefined) payment.reference = updateData.reference;
    if (updateData.description !== undefined) payment.description = updateData.description;

    const newStatus = updateData.status;
    if (newStatus && newStatus !== previousStatus) {
      payment.status = newStatus;

      const teamMember = await TeamMember.findById(payment.teamMemberId);
      const project = await Project.findById(payment.projectId);
      const task = payment.taskId ? await Task.findById(payment.taskId) : null;

      // Send status transition notification idempotently
      if (teamMember && teamMember.telegramConnected && teamMember.telegramChatId) {
        if (newStatus === 'PAID' && !payment.notifiedEvents.includes('PAID')) {
          try {
            const sent = await TelegramService.sendTeamPaymentNotification(
              payment,
              teamMember,
              project,
              task,
              'PAID'
            );
            if (sent) {
              payment.notificationStatus = 'SENT';
              payment.notifiedEvents.push('PAID');
            } else {
              payment.notificationStatus = 'FAILED';
            }
          } catch (err) {
            console.error('Failed to notify payment update:', err);
            payment.notificationStatus = 'FAILED';
          }
        } else if (newStatus === 'CANCELLED' && !payment.notifiedEvents.includes('CANCELLED')) {
          try {
            const sent = await TelegramService.sendTeamPaymentNotification(
              payment,
              teamMember,
              project,
              task,
              'CANCELLED'
            );
            if (sent) {
              payment.notificationStatus = 'SENT';
              payment.notifiedEvents.push('CANCELLED');
            }
          } catch (err) {
            console.error('Failed to notify payment cancellation:', err);
          }
        }
      }

      if (newStatus === 'PAID') {
        await AuditService.log({
          actor,
          action: 'TEAM_PAYMENT_MARKED_PAID',
          entityType: 'TeamPayment',
          entityId: payment._id,
          metadata: { paymentNumber: payment.paymentNumber, amount: payment.amount },
        });
      } else if (newStatus === 'CANCELLED') {
        await AuditService.log({
          actor,
          action: 'TEAM_PAYMENT_CANCELLED',
          entityType: 'TeamPayment',
          entityId: payment._id,
          metadata: { paymentNumber: payment.paymentNumber, amount: payment.amount },
        });
      }
    }

    await payment.save();

    await AuditService.log({
      actor,
      action: 'TEAM_PAYMENT_UPDATED',
      entityType: 'TeamPayment',
      entityId: payment._id,
      metadata: {
        paymentNumber: payment.paymentNumber,
        previousStatus,
        newStatus: payment.status,
      },
    });

    return payment;
  }

  /**
   * Retry sending a failed Telegram payment notification
   */
  static async retryTeamPaymentNotification(id: string, actor: string = 'Admin'): Promise<boolean> {
    await dbConnect();

    const payment = await TeamPayment.findById(id);
    if (!payment) {
      throw new Error('Payment record not found');
    }

    const teamMember = await TeamMember.findById(payment.teamMemberId);
    if (!teamMember || !teamMember.telegramConnected || !teamMember.telegramChatId) {
      throw new Error('Team member does not have an active Telegram connection');
    }

    const project = await Project.findById(payment.projectId);
    const task = payment.taskId ? await Task.findById(payment.taskId) : null;

    const eventType = payment.status === 'CANCELLED' ? 'CANCELLED' : 'PAID';
    const sent = await TelegramService.sendTeamPaymentNotification(
      payment,
      teamMember,
      project,
      task,
      eventType
    );

    if (sent) {
      payment.notificationStatus = 'SENT';
      payment.notificationError = undefined;
      if (!payment.notifiedEvents.includes(eventType)) {
        payment.notifiedEvents.push(eventType);
      }
      await payment.save();

      await AuditService.log({
        actor,
        action: 'TEAM_PAYMENT_NOTIFICATION_RETRY',
        entityType: 'TeamPayment',
        entityId: payment._id,
        metadata: { paymentNumber: payment.paymentNumber, success: true },
      });
      return true;
    } else {
      payment.notificationStatus = 'FAILED';
      payment.notificationError = 'Retry failed: Telegram API error';
      await payment.save();
      return false;
    }
  }

  /**
   * Query team payments with multiple filters and summary metrics
   */
  static async getTeamPayments(filters: QueryTeamPaymentsFilter = {}): Promise<{
    payments: any[];
    summary: {
      totalPaid: number;
      totalPending: number;
      totalCount: number;
    };
  }> {
    await dbConnect();

    const query: any = {};
    if (filters.teamMemberId) query.teamMemberId = filters.teamMemberId;
    if (filters.projectId) query.projectId = filters.projectId;
    if (filters.taskId) query.taskId = filters.taskId;
    if (filters.status) query.status = filters.status;

    if (filters.startDate || filters.endDate) {
      query.paymentDate = {};
      if (filters.startDate) query.paymentDate.$gte = new Date(filters.startDate);
      if (filters.endDate) query.paymentDate.$lte = new Date(filters.endDate);
    }

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { paymentNumber: searchRegex },
        { reference: searchRegex },
        { description: searchRegex },
      ];
    }

    const payments = await TeamPayment.find(query)
      .populate('teamMemberId', 'name email role telegramConnected telegramUsername')
      .populate('projectId', 'name projectCode')
      .populate('taskId', 'title taskCode agreedAmount status')
      .sort({ paymentDate: -1, createdAt: -1 })
      .lean();

    let totalPaid = 0;
    let totalPending = 0;

    for (const p of payments) {
      if (p.status === 'PAID') {
        totalPaid += p.amount;
      } else if (p.status === 'PENDING') {
        totalPending += p.amount;
      }
    }

    return {
      payments,
      summary: {
        totalPaid,
        totalPending,
        totalCount: payments.length,
      },
    };
  }

  /**
   * Get payment summary for a specific team member
   */
  static async getTeamMemberPaymentSummary(teamMemberId: string): Promise<{
    totalAgreed: number;
    totalPaid: number;
    totalPending: number;
    outstanding: number;
    paymentsCount: number;
  }> {
    await dbConnect();

    // 1. Calculate sum of agreed task payouts for assigned tasks
    const tasks = await Task.find({
      assignedTo: teamMemberId,
      status: { $nin: ['CANCELLED'] },
    }).lean();

    const totalAgreed = tasks.reduce((sum, t) => sum + (t.agreedAmount || 0), 0);

    // 2. Calculate paid and pending from TeamPayment records
    const payments = await TeamPayment.find({
      teamMemberId,
    }).lean();

    let totalPaid = 0;
    let totalPending = 0;

    for (const p of payments) {
      if (p.status === 'PAID') {
        totalPaid += p.amount;
      } else if (p.status === 'PENDING') {
        totalPending += p.amount;
      }
    }

    const outstanding = Math.max(0, totalAgreed - totalPaid);

    return {
      totalAgreed,
      totalPaid,
      totalPending,
      outstanding,
      paymentsCount: payments.length,
    };
  }

  /**
   * Get payment summary for a single task
   */
  static async getTaskPaymentSummary(taskId: string): Promise<{
    agreedAmount: number;
    totalPaid: number;
    totalPending: number;
    outstanding: number;
    payments: any[];
  }> {
    await dbConnect();

    const task = await Task.findById(taskId).lean();
    const agreedAmount = task?.agreedAmount || 0;

    const payments = await TeamPayment.find({
      taskId,
    })
      .sort({ paymentDate: -1 })
      .lean();

    let totalPaid = 0;
    let totalPending = 0;

    for (const p of payments) {
      if (p.status === 'PAID') {
        totalPaid += p.amount;
      } else if (p.status === 'PENDING') {
        totalPending += p.amount;
      }
    }

    const outstanding = Math.max(0, agreedAmount - totalPaid);

    return {
      agreedAmount,
      totalPaid,
      totalPending,
      outstanding,
      payments,
    };
  }

  /**
   * Get team payment summary and breakdown for a project
   */
  static async getProjectTeamPaymentSummary(projectId: string): Promise<{
    totalAgreedCost: number;
    totalPaidCost: number;
    totalPendingCost: number;
    outstandingCost: number;
    memberBreakdowns: Array<{
      teamMemberId: string;
      name: string;
      role: string;
      agreedAmount: number;
      paidAmount: number;
      outstandingAmount: number;
    }>;
  }> {
    await dbConnect();

    const project = await Project.findById(projectId).populate('teamMemberIds', 'name role email').lean();
    if (!project) {
      throw new Error('Project not found');
    }

    const tasks = await Task.find({
      projectId,
      status: { $nin: ['CANCELLED'] },
    }).lean();

    const payments = await TeamPayment.find({
      projectId,
    }).lean();

    const members: any[] = (project.teamMemberIds as any[]) || [];
    const memberBreakdowns = [];

    let totalAgreedCost = 0;
    let totalPaidCost = 0;
    let totalPendingCost = 0;

    for (const m of members) {
      const mTasks = tasks.filter((t) => t.assignedTo && t.assignedTo.toString() === m._id.toString());
      const mAgreed = mTasks.reduce((sum, t) => sum + (t.agreedAmount || 0), 0);

      const mPayments = payments.filter((p) => p.teamMemberId.toString() === m._id.toString());
      const mPaid = mPayments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);

      const mOutstanding = Math.max(0, mAgreed - mPaid);

      totalAgreedCost += mAgreed;
      totalPaidCost += mPaid;

      memberBreakdowns.push({
        teamMemberId: m._id.toString(),
        name: m.name,
        role: m.role,
        agreedAmount: mAgreed,
        paidAmount: mPaid,
        outstandingAmount: mOutstanding,
      });
    }

    for (const p of payments) {
      if (p.status === 'PENDING') {
        totalPendingCost += p.amount;
      }
    }

    const outstandingCost = Math.max(0, totalAgreedCost - totalPaidCost);

    return {
      totalAgreedCost,
      totalPaidCost,
      totalPendingCost,
      outstandingCost,
      memberBreakdowns,
    };
  }
}
