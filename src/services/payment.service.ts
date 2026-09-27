import mongoose from 'mongoose';
import Payment, { IPayment } from '@/models/Payment';
import Project from '@/models/Project';
import Invoice from '@/models/Invoice';
import { AuditService } from './audit.service';
import { dbConnect } from '@/lib/db/connect';

export interface ProjectBalance {
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  currency: string;
  bonusAmount?: number;
  totalReceived?: number;
}

export class PaymentService {
  /**
   * Safe sequence number generator (e.g. PAY-2026-0001)
   */
  static async generateNextPaymentNumber(): Promise<string> {
    await dbConnect();
    const year = new Date().getFullYear();
    const prefix = `PAY-${year}-`;
    
    // Find the highest payment number for the current year
    const lastPayment = await Payment.findOne({
      paymentNumber: new RegExp(`^${prefix}`),
    }).sort({ paymentNumber: -1 });

    let nextSeq = 1;
    if (lastPayment) {
      const parts = lastPayment.paymentNumber.split('-');
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Calculate financial balances for a project
   * SINGLE SOURCE OF TRUTH: Aggregates total completed payments from DB
   * IMPORTANT: CLIENT_BONUS payments do NOT reduce the outstanding project balance.
   */
  static async calculateProjectBalances(projectId: string): Promise<ProjectBalance> {
    await dbConnect();

    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Sum all COMPLETED regular payments for this project (excluding CLIENT_BONUS)
    const regularPayments = await Payment.find({
      projectId,
      status: 'COMPLETED',
      paymentType: { $ne: 'CLIENT_BONUS' },
    });

    // Sum all COMPLETED client bonus payments for this project
    const bonusPayments = await Payment.find({
      projectId,
      status: 'COMPLETED',
      paymentType: 'CLIENT_BONUS',
    });

    const paidAmount = regularPayments.reduce((sum, p) => sum + p.amount, 0);
    const bonusAmount = bonusPayments.reduce((sum, p) => sum + p.amount, 0);
    const outstandingAmount = Math.max(0, project.totalAmount - paidAmount);
    const totalReceived = paidAmount + bonusAmount;

    return {
      totalAmount: project.totalAmount,
      paidAmount,
      outstandingAmount,
      currency: project.currency,
      bonusAmount,
      totalReceived,
    };
  }

  /**
   * Record a new payment or client bonus transaction with validations
   */
  static async recordPayment(
    paymentData: Partial<Omit<IPayment, 'clientId' | 'projectId' | 'invoiceId'>> & {
      clientId?: mongoose.Types.ObjectId | string;
      projectId?: mongoose.Types.ObjectId | string;
      invoiceId?: mongoose.Types.ObjectId | string;
    },
    actor: string
  ): Promise<IPayment> {
    await dbConnect();

    const { projectId, clientId, amount, paymentMethod, paymentType, transactionReference, notes, invoiceId, currency } = paymentData;

    const isBonus = paymentType === 'CLIENT_BONUS';

    if (!clientId || amount === undefined || amount === null || !paymentMethod) {
      throw new Error('Client, Amount, and Payment Method are required');
    }

    if (!isBonus && !projectId) {
      throw new Error('Project, Client, Amount, and Payment Method are required');
    }

    const numAmount = Number(amount);
    if (typeof numAmount !== 'number' || isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
      throw new Error('Payment amount must be a valid positive number');
    }

    // Verify client exists
    const Client = (await import('@/models/Client')).default;
    const client = await Client.findById(clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    let project: any = null;
    if (projectId) {
      project = await Project.findById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      if (project.clientId.toString() !== clientId.toString()) {
        throw new Error('Project does not belong to the specified client');
      }
    }

    let finalInvoiceId = invoiceId;
    let paymentCurrency = currency || 'INR';

    if (!isBonus) {
      // Financial integrity check: regular payments cannot exceed outstanding balance
      const balances = await this.calculateProjectBalances(projectId!.toString());
      
      const currencySymbol = project.currency === 'INR' ? '₹' : (project.currency === 'USD' ? '$' : project.currency);
      if (numAmount > balances.outstandingAmount) {
        throw new Error(
          `Payment exceeds outstanding balance. Outstanding: ${currencySymbol}${balances.outstandingAmount.toLocaleString('en-IN')} Maximum payment allowed: ${currencySymbol}${balances.outstandingAmount.toLocaleString('en-IN')}`
        );
      }

      paymentCurrency = project.currency;

      // Auto-link to existing invoice if not provided
      if (!finalInvoiceId) {
        const invoice = await Invoice.findOne({ projectId });
        if (invoice) {
          finalInvoiceId = invoice._id;
        }
      }
    } else {
      // Client bonus: optional project, does not check against project balance limit
      if (project && !currency) {
        paymentCurrency = project.currency;
      }
      finalInvoiceId = undefined; // Bonus does not link to standard invoice
    }

    let savedPayment: IPayment | null = null;
    let attempts = 0;
    while (attempts < 5) {
      try {
        const paymentNumber = await this.generateNextPaymentNumber();
        const payment = new Payment({
          paymentNumber,
          clientId,
          projectId: projectId || undefined,
          invoiceId: finalInvoiceId,
          amount: numAmount,
          currency: paymentCurrency,
          paymentMethod,
          paymentType: paymentType || 'INSTALLMENT',
          paymentDate: paymentData.paymentDate || new Date(),
          transactionReference,
          status: 'COMPLETED', // Payments recorded by admin default to COMPLETED
          notes,
        });

        savedPayment = await payment.save();
        break;
      } catch (err: any) {
        if (err.code === 11000 && err.keyPattern?.paymentNumber && attempts < 4) {
          attempts++;
          await new Promise(r => setTimeout(r, Math.random() * 50 + 20));
          continue;
        }
        throw err;
      }
    }

    if (!savedPayment) {
      throw new Error('Failed to generate unique payment number after multiple attempts');
    }

    // Invalidate client/project cache
    const { CacheService } = await import('./cache.service');
    await CacheService.invalidateClientsCache();
    if (projectId) {
      await CacheService.invalidateProjectsCache(clientId.toString());
    }

    // Log action
    const actionName = isBonus ? 'CLIENT_BONUS_RECORDED' : 'PAYMENT_CREATED';
    await AuditService.logAction(actor, actionName, 'Payment', savedPayment._id, {
      paymentNumber: savedPayment.paymentNumber,
      amount: savedPayment.amount,
      currency: savedPayment.currency,
      paymentMethod: savedPayment.paymentMethod,
      paymentType: savedPayment.paymentType,
      clientId: savedPayment.clientId,
      projectId: savedPayment.projectId,
      notes: savedPayment.notes,
    });

    if (!isBonus && project) {
      // Update project status to COMPLETED if fully paid
      const updatedBalances = await this.calculateProjectBalances(projectId!.toString());
      if (updatedBalances.outstandingAmount === 0 && project.status !== 'COMPLETED') {
        const oldStatus = project.status;
        project.status = 'COMPLETED';
        project.completionDate = new Date();
        await project.save();
        
        await AuditService.logAction(actor, 'PROJECT_STATUS_CHANGED', 'Project', project._id, {
          oldStatus,
          newStatus: 'COMPLETED',
        });
      }

      // Update invoice status and regenerate invoice PDF if linked
      if (finalInvoiceId) {
        await this.updateInvoiceStatusFromPayments(finalInvoiceId.toString());
        try {
          const { InvoiceService } = await import('./invoice.service');
          await InvoiceService.generatePDF(finalInvoiceId.toString());
        } catch (pdfErr) {
          console.error('Failed to regenerate invoice PDF after recording payment:', pdfErr);
        }
      }
    }

    return savedPayment;
  }

  /**
   * Helper to recalculate and update invoice status
   * Note: CLIENT_BONUS payments are excluded as they do not apply against invoice balances.
   */
  static async updateInvoiceStatusFromPayments(invoiceId: string): Promise<void> {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return;

    // Find all completed regular payments for this invoice
    const payments = await Payment.find({
      invoiceId,
      status: 'COMPLETED',
      paymentType: { $ne: 'CLIENT_BONUS' },
    });

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    if (totalPaid >= invoice.total) {
      invoice.status = 'PAID';
    } else if (totalPaid > 0) {
      invoice.status = 'PARTIALLY_PAID';
    } else {
      invoice.status = 'ISSUED';
    }

    await invoice.save();
  }

  /**
   * Update payment status (e.g. marking as REFUNDED)
   */
  static async updatePaymentStatus(
    paymentId: string,
    newStatus: IPayment['status'],
    actor: string
  ): Promise<IPayment> {
    await dbConnect();

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    const oldStatus = payment.status;
    if (oldStatus === newStatus) {
      return payment;
    }

    payment.status = newStatus;
    const updatedPayment = await payment.save();

    await AuditService.logAction(actor, 'PAYMENT_UPDATED', 'Payment', updatedPayment._id, {
      oldStatus,
      newStatus,
      paymentNumber: payment.paymentNumber,
    });

    // Recalculate invoice status if linked to an invoice
    if (payment.invoiceId) {
      await this.updateInvoiceStatusFromPayments(payment.invoiceId.toString());
    }

    return updatedPayment;
  }
}
