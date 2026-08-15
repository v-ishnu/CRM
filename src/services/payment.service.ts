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
   */
  static async calculateProjectBalances(projectId: string): Promise<ProjectBalance> {
    await dbConnect();

    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Sum all COMPLETED payments for this project
    const payments = await Payment.find({
      projectId,
      status: 'COMPLETED',
    });

    const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const outstandingAmount = Math.max(0, project.totalAmount - paidAmount);

    return {
      totalAmount: project.totalAmount,
      paidAmount,
      outstandingAmount,
      currency: project.currency,
    };
  }

  /**
   * Record a new payment transaction with validations
   */
  static async recordPayment(
    paymentData: Partial<IPayment>,
    actor: string
  ): Promise<IPayment> {
    await dbConnect();

    const { projectId, clientId, amount, paymentMethod, transactionReference, notes, invoiceId } = paymentData;

    if (!projectId || !clientId || !amount || !paymentMethod) {
      throw new Error('Project, Client, Amount, and Payment Method are required');
    }

    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    // Verify project and client
    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    if (project.clientId.toString() !== clientId.toString()) {
      throw new Error('Project does not belong to the specified client');
    }

    // Financial integrity check: check outstanding balance
    const balances = await this.calculateProjectBalances(projectId.toString());
    
    // Check if new payment exceeds outstanding balance
    if (amount > balances.outstandingAmount) {
      throw new Error(
        `Payment amount (${amount}) exceeds outstanding balance (${balances.outstandingAmount}) for project "${project.name}"`
      );
    }

    const paymentNumber = await this.generateNextPaymentNumber();

    const payment = new Payment({
      paymentNumber,
      clientId,
      projectId,
      invoiceId,
      amount,
      currency: project.currency,
      paymentMethod,
      paymentDate: paymentData.paymentDate || new Date(),
      transactionReference,
      status: 'COMPLETED', // Payments recorded by admin default to COMPLETED
      notes,
    });

    const savedPayment = await payment.save();

    // Log action
    await AuditService.logAction(actor, 'PAYMENT_CREATED', 'Payment', savedPayment._id, {
      paymentNumber: savedPayment.paymentNumber,
      amount: savedPayment.amount,
      projectId: savedPayment.projectId,
    });

    // Update project status to COMPLETED if fully paid
    const updatedBalances = await this.calculateProjectBalances(projectId.toString());
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

    // Update invoice status if this payment is linked to an invoice
    if (invoiceId) {
      await this.updateInvoiceStatusFromPayments(invoiceId.toString());
    }

    return savedPayment;
  }

  /**
   * Helper to recalculate and update invoice status
   */
  static async updateInvoiceStatusFromPayments(invoiceId: string): Promise<void> {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return;

    // Find all completed payments for this invoice
    const payments = await Payment.find({
      invoiceId,
      status: 'COMPLETED',
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
