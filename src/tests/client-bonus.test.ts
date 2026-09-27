import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import Payment, { IPayment } from '@/models/Payment';
import Client from '@/models/Client';
import Project from '@/models/Project';
import Invoice from '@/models/Invoice';
import AuditLog from '@/models/AuditLog';
import { PaymentService } from '@/services/payment.service';
import { NotificationService } from '@/services/notification.service';
import { POST as postPaymentRoute, GET as getPaymentsRoute } from '@/app/api/payments/route';
import { NextRequest } from 'next/server';

// 1. Strict production database & environment safety verification
if (
  process.env.NODE_ENV === 'production' ||
  (process.env.MONGODB_URI && process.env.MONGODB_URI.includes('production'))
) {
  throw new Error('FATAL: Attempting to run test suite against a production database!');
}

// 2. Mock dbConnect to guarantee zero production network connections
vi.mock('@/lib/db/connect', () => ({
  dbConnect: vi.fn().mockResolvedValue(null),
  default: vi.fn().mockResolvedValue(null),
}));

// 3. Mock CacheService
vi.mock('@/services/cache.service', () => ({
  CacheService: {
    invalidateClientsCache: vi.fn().mockResolvedValue(undefined),
    invalidateProjectsCache: vi.fn().mockResolvedValue(undefined),
  },
}));

// 4. Mock AuditService
vi.mock('@/services/audit.service', () => ({
  AuditService: {
    logAction: vi.fn().mockResolvedValue(true),
  },
}));

describe('Client Bonus Recording & Isolation Test Suite', () => {
  const mockClientId = new mongoose.Types.ObjectId().toString();
  const mockOtherClientId = new mongoose.Types.ObjectId().toString();
  const mockProjectId = new mongoose.Types.ObjectId().toString();
  const mockInvoiceId = new mongoose.Types.ObjectId().toString();

  const mockClient = {
    _id: mockClientId,
    name: 'Acme Corp',
    clientCode: 'CL-ACME',
    email: 'acme@example.com',
    telegramConnected: true,
    telegramChatId: '12345678',
  };

  const mockProject = {
    _id: mockProjectId,
    clientId: mockClientId,
    name: 'Website Redesign',
    projectCode: 'PRJ-ACME-01',
    totalAmount: 50000,
    currency: 'INR',
    status: 'IN_PROGRESS',
    save: vi.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Helper for Payment.findOne chain
  const mockFindOneSort = () => {
    vi.spyOn(Payment, 'findOne').mockReturnValue({
      sort: vi.fn().mockResolvedValue(null),
    } as any);
  };

  // TEST 1: Admin can record a bonus
  it('1. Admin can record a bonus with valid fields', async () => {
    vi.spyOn(Client, 'findById').mockResolvedValue(mockClient as any);
    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
    mockFindOneSort();

    let createdDoc: any = null;
    vi.spyOn(Payment.prototype, 'save').mockImplementation(function (this: any) {
      createdDoc = this;
      this._id = new mongoose.Types.ObjectId();
      return Promise.resolve(this);
    });

    const payment = await PaymentService.recordPayment(
      {
        clientId: mockClientId,
        projectId: mockProjectId,
        amount: 5000,
        currency: 'INR',
        paymentMethod: 'UPI',
        paymentType: 'CLIENT_BONUS',
        paymentDate: new Date(),
        notes: 'Reason: Appreciation for early delivery',
        transactionReference: 'UPI-TXN-12345',
      },
      'admin@debuggers.io'
    );

    expect(payment).toBeDefined();
    expect(payment.paymentType).toBe('CLIENT_BONUS');
    expect(payment.amount).toBe(5000);
    expect(payment.currency).toBe('INR');
    expect(payment.paymentMethod).toBe('UPI');
  });

  // TEST 2: Bonus appears in client payment history
  it('2. Bonus appears in client payment records with CLIENT_BONUS type', async () => {
    const mockPayments = [
      {
        _id: new mongoose.Types.ObjectId(),
        paymentNumber: 'PAY-2026-0001',
        paymentType: 'CLIENT_BONUS',
        amount: 5000,
        currency: 'INR',
        paymentMethod: 'UPI',
        clientId: { _id: mockClientId, name: 'Acme Corp', clientCode: 'CL-ACME' },
        status: 'COMPLETED',
      },
    ];

    vi.spyOn(Payment, 'find').mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockResolvedValue(mockPayments),
    } as any);

    const req = new NextRequest(`http://localhost:3000/api/payments?clientId=${mockClientId}`, {
      headers: { 'x-user-role': 'ADMIN' },
    });
    const res = await getPaymentsRoute(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.length).toBe(1);
    expect(json.data[0].paymentType).toBe('CLIENT_BONUS');
  });

  // TEST 3: Project-associated bonus works
  it('3. Project-associated bonus correctly links the project', async () => {
    vi.spyOn(Client, 'findById').mockResolvedValue(mockClient as any);
    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
    mockFindOneSort();

    let savedDoc: any = null;
    vi.spyOn(Payment.prototype, 'save').mockImplementation(function (this: any) {
      savedDoc = this;
      this._id = new mongoose.Types.ObjectId();
      return Promise.resolve(this);
    });

    const payment = await PaymentService.recordPayment(
      {
        clientId: mockClientId,
        projectId: mockProjectId,
        amount: 2500,
        currency: 'INR',
        paymentMethod: 'BANK_TRANSFER',
        paymentType: 'CLIENT_BONUS',
      },
      'admin@debuggers.io'
    );

    expect(payment.projectId?.toString()).toBe(mockProjectId);
  });

  // TEST 4: Client-only bonus works (direct client bonus without projectId)
  it('4. Client-only bonus works without a project attached', async () => {
    vi.spyOn(Client, 'findById').mockResolvedValue(mockClient as any);
    mockFindOneSort();

    let savedDoc: any = null;
    vi.spyOn(Payment.prototype, 'save').mockImplementation(function (this: any) {
      savedDoc = this;
      this._id = new mongoose.Types.ObjectId();
      return Promise.resolve(this);
    });

    const payment = await PaymentService.recordPayment(
      {
        clientId: mockClientId,
        amount: 10000,
        currency: 'USD',
        paymentMethod: 'STRIPE',
        paymentType: 'CLIENT_BONUS',
        notes: 'End of year appreciation bonus',
      },
      'admin@debuggers.io'
    );

    expect(payment.clientId.toString()).toBe(mockClientId);
    expect(payment.projectId).toBeUndefined();
    expect(payment.currency).toBe('USD');
  });

  // TEST 5: Invalid client/project combination is rejected
  it('5. Invalid client/project combination is rejected with authorization error', async () => {
    vi.spyOn(Client, 'findById').mockResolvedValue(mockClient as any);
    // Project belongs to mockOtherClientId, not mockClientId
    const foreignProject = {
      ...mockProject,
      clientId: mockOtherClientId,
    };
    vi.spyOn(Project, 'findById').mockResolvedValue(foreignProject as any);

    await expect(
      PaymentService.recordPayment(
        {
          clientId: mockClientId,
          projectId: mockProjectId,
          amount: 5000,
          currency: 'INR',
          paymentMethod: 'UPI',
          paymentType: 'CLIENT_BONUS',
        },
        'admin@debuggers.io'
      )
    ).rejects.toThrow('Project does not belong to the specified client');
  });

  // TEST 6: Bonus does not reduce outstanding balance
  it('6. Bonus does NOT reduce the project outstanding balance', async () => {
    // Project price: 50,000
    // Normal payments: 30,000
    // Bonus received: 5,000
    // Expected: Outstanding = 20,000 (NOT 15,000); TotalReceived = 35,000
    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);

    vi.spyOn(Payment, 'find').mockImplementation((query: any) => {
      if (query.paymentType?.$ne === 'CLIENT_BONUS') {
        // Regular payments
        return Promise.resolve([{ amount: 30000 }]) as any;
      }
      if (query.paymentType === 'CLIENT_BONUS') {
        // Bonus payments
        return Promise.resolve([{ amount: 5000 }]) as any;
      }
      return Promise.resolve([]) as any;
    });

    const balances = await PaymentService.calculateProjectBalances(mockProjectId);

    expect(balances.totalAmount).toBe(50000);
    expect(balances.paidAmount).toBe(30000); // Only regular payments count towards paidAmount
    expect(balances.outstandingAmount).toBe(20000); // 50000 - 30000 = 20000 (STRICTLY PRESERVED)
    expect(balances.bonusAmount).toBe(5000);
    expect(balances.totalReceived).toBe(35000); // Total cash = 30000 + 5000
  });

  // TEST 7: Bonus does not mark an invoice as paid or reduce invoice balance
  it('7. Bonus does NOT mark an invoice as paid', async () => {
    const mockInvoice = {
      _id: mockInvoiceId,
      totalAmount: 20000,
      status: 'ISSUED',
      save: vi.fn().mockResolvedValue(true),
    };
    vi.spyOn(Invoice, 'findById').mockResolvedValue(mockInvoice as any);

    // No regular payments, but 5,000 bonus recorded
    vi.spyOn(Payment, 'find').mockResolvedValue([]); // { invoiceId, status: 'COMPLETED', paymentType: { $ne: 'CLIENT_BONUS' } }

    await PaymentService.updateInvoiceStatusFromPayments(mockInvoiceId);

    // Invoice status must remain ISSUED, not PAID
    expect(mockInvoice.status).toBe('ISSUED');
  });

  // TEST 8: Bonus is counted once in bonus totals
  it('8. Bonus is counted once in bonus totals', async () => {
    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);

    vi.spyOn(Payment, 'find').mockImplementation((query: any) => {
      if (query.paymentType === 'CLIENT_BONUS') {
        return Promise.resolve([{ amount: 5000 }]) as any;
      }
      return Promise.resolve([]) as any;
    });

    const balances = await PaymentService.calculateProjectBalances(mockProjectId);
    expect(balances.bonusAmount).toBe(5000);
  });

  // TEST 9: Normal payment calculations remain unchanged
  it('9. Normal payment calculations remain unchanged', async () => {
    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);

    // 2 regular payments: 15,000 + 15,000 = 30,000
    vi.spyOn(Payment, 'find').mockImplementation((query: any) => {
      if (query.paymentType?.$ne === 'CLIENT_BONUS') {
        return Promise.resolve([{ amount: 15000 }, { amount: 15000 }]) as any;
      }
      return Promise.resolve([]) as any;
    });

    const balances = await PaymentService.calculateProjectBalances(mockProjectId);
    expect(balances.paidAmount).toBe(30000);
    expect(balances.outstandingAmount).toBe(20000);
    expect(balances.bonusAmount).toBe(0);
  });

  // TEST 10: Normal payment notifications remain unchanged
  it('10. Normal payment notifications remain enabled and functional', async () => {
    const notifySpy = vi.spyOn(NotificationService, 'sendPaymentNotification').mockResolvedValue({} as any);
    vi.spyOn(Client, 'findById').mockResolvedValue(mockClient as any);
    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
    vi.spyOn(Payment, 'findOne').mockResolvedValue(null);

    const normalPaymentDoc = {
      _id: new mongoose.Types.ObjectId(),
      paymentNumber: 'PAY-NORMAL-01',
      clientId: mockClientId,
      projectId: mockProjectId,
      amount: 10000,
      currency: 'INR',
      paymentMethod: 'UPI',
      paymentType: 'INSTALLMENT',
    };
    const recordSpy = vi.spyOn(PaymentService, 'recordPayment').mockResolvedValue(normalPaymentDoc as any);

    const req = new NextRequest('http://localhost:3000/api/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        clientId: mockClientId,
        projectId: mockProjectId,
        amount: 10000,
        paymentMethod: 'UPI',
        paymentType: 'INSTALLMENT',
        notifyClient: true,
      }),
    });

    const res = await postPaymentRoute(req);
    expect(res.status).toBe(200);
    expect(notifySpy).toHaveBeenCalledTimes(1);
    recordSpy.mockRestore();
    notifySpy.mockRestore();
  });

  // TEST 11: Bonus sends ZERO client Telegram messages
  it('11. Bonus sends ZERO client Telegram messages (Server-side enforced)', async () => {
    const notifySpy = vi.spyOn(NotificationService, 'sendPaymentNotification').mockResolvedValue({} as any);
    vi.spyOn(Client, 'findById').mockResolvedValue(mockClient as any);
    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);

    const bonusPaymentDoc = {
      _id: new mongoose.Types.ObjectId(),
      paymentNumber: 'PAY-BONUS-01',
      clientId: mockClientId,
      projectId: mockProjectId,
      amount: 5000,
      currency: 'INR',
      paymentMethod: 'UPI',
      paymentType: 'CLIENT_BONUS',
    };
    const recordSpy = vi.spyOn(PaymentService, 'recordPayment').mockResolvedValue(bonusPaymentDoc as any);

    // Even if client inadvertently passes notifyClient: true, the server MUST suppress it!
    const req = new NextRequest('http://localhost:3000/api/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        clientId: mockClientId,
        projectId: mockProjectId,
        amount: 5000,
        paymentMethod: 'UPI',
        paymentType: 'CLIENT_BONUS',
        notifyClient: true, // Attempt to trigger notification
      }),
    });

    const res = await postPaymentRoute(req);
    expect(res.status).toBe(200);

    // CRITICAL ASSERTION: notifyClient is overridden to false for CLIENT_BONUS
    expect(notifySpy).not.toHaveBeenCalled();
    recordSpy.mockRestore();
    notifySpy.mockRestore();
  });

  // TEST 12, 13, 14, 15: Guard in NotificationService throws if CLIENT_BONUS is ever dispatched
  it('12-15. NotificationService explicitly blocks and throws if CLIENT_BONUS is passed', async () => {
    const bonusPayment = {
      _id: new mongoose.Types.ObjectId(),
      clientId: mockClientId,
      projectId: mockProjectId,
      paymentType: 'CLIENT_BONUS',
      amount: 5000,
      currency: 'INR',
    };
    vi.spyOn(Client, 'findById').mockResolvedValue(mockClient as any);
    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
    vi.spyOn(Payment, 'findById').mockResolvedValue(bonusPayment as any);

    await expect(
      NotificationService.sendPaymentNotification(
        mockClientId,
        mockProjectId,
        bonusPayment._id.toString()
      )
    ).rejects.toThrow('Client bonus payments must not trigger client notifications');

    await expect(
      NotificationService.sendOnboardingNotification(
        mockClientId,
        mockProjectId,
        bonusPayment._id.toString()
      )
    ).rejects.toThrow('Client bonus payments must not trigger client notifications');
  });

  // TEST 16: Unauthorized bonus creation is rejected
  it('16. Unauthorized bonus creation by CLIENT role is rejected with 403 Forbidden', async () => {
    const req = new NextRequest('http://localhost:3000/api/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'CLIENT',
      },
      body: JSON.stringify({
        clientId: mockClientId,
        amount: 5000,
        paymentMethod: 'UPI',
        paymentType: 'CLIENT_BONUS',
      }),
    });

    const res = await postPaymentRoute(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe('FORBIDDEN');
  });

  // TEST 17: Negative or zero bonus amount is rejected
  it('17. Negative or zero bonus amount is rejected with validation error', async () => {
    vi.spyOn(Client, 'findById').mockResolvedValue(mockClient as any);

    await expect(
      PaymentService.recordPayment(
        {
          clientId: mockClientId,
          amount: -500,
          currency: 'INR',
          paymentMethod: 'UPI',
          paymentType: 'CLIENT_BONUS',
        },
        'admin@debuggers.io'
      )
    ).rejects.toThrow('Payment amount must be a valid positive number');

    await expect(
      PaymentService.recordPayment(
        {
          clientId: mockClientId,
          amount: 0,
          currency: 'INR',
          paymentMethod: 'UPI',
          paymentType: 'CLIENT_BONUS',
        },
        'admin@debuggers.io'
      )
    ).rejects.toThrow('Payment amount must be a valid positive number');
  });

  // TEST 18: Audit log records CLIENT_BONUS_RECORDED action without client notification
  it('18. Audit log records CLIENT_BONUS_RECORDED action', async () => {
    const { AuditService } = await import('@/services/audit.service');
    const logSpy = vi.fn().mockResolvedValue(true);
    AuditService.logAction = logSpy;

    vi.spyOn(Client, 'findById').mockResolvedValue(mockClient as any);
    mockFindOneSort();
    vi.spyOn(Payment.prototype, 'save').mockImplementation(function (this: any) {
      this._id = new mongoose.Types.ObjectId();
      return Promise.resolve(this);
    });

    await PaymentService.recordPayment(
      {
        clientId: mockClientId,
        amount: 8000,
        currency: 'INR',
        paymentMethod: 'UPI',
        paymentType: 'CLIENT_BONUS',
        notes: 'Appreciation bonus for rapid bugfix',
      },
      'admin@debuggers.io'
    );

    expect(logSpy).toHaveBeenCalledWith(
      'admin@debuggers.io',
      'CLIENT_BONUS_RECORDED',
      'Payment',
      expect.anything(),
      expect.objectContaining({
        amount: 8000,
        currency: 'INR',
        paymentType: 'CLIENT_BONUS',
        paymentMethod: 'UPI',
      })
    );
  });
});
