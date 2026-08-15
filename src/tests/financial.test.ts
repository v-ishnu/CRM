import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/developer-crm-test';

import Client from '@/models/Client';
import Project from '@/models/Project';
import Payment from '@/models/Payment';
import Invoice from '@/models/Invoice';
import Notification from '@/models/Notification';
import { ClientService } from '@/services/client.service';
import { ProjectService } from '@/services/project.service';
import { PaymentService } from '@/services/payment.service';
import { InvoiceService } from '@/services/invoice.service';
import { NotificationService } from '@/services/notification.service';
import { signJWT, verifyJWT } from '@/lib/auth/jwt';

describe('Developer CRM System Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
  });

  afterAll(async () => {
    // Clean up all test files created under prefix
    await Client.deleteMany({ clientCode: /^TEST-CL-/ });
    await Project.deleteMany({ projectCode: /^TEST-PR-/ });
    await Payment.deleteMany({ paymentNumber: /^PAY-TEST-/ });
    await Invoice.deleteMany({ invoiceNumber: /^INV-TEST-/ });
    await Notification.deleteMany({ message: /TEST_MESSAGE/ });
    await mongoose.connection.close();
  });

  describe('Client Management', () => {
    it('should create a client successfully and log audit', async () => {
      const code = `TEST-CL-0001`;
      await Client.deleteOne({ clientCode: code });

      const client = await ClientService.createClient(
        {
          clientCode: code,
          name: 'Test Client Rahul',
          email: 'test_rahul@example.com',
          status: 'ACTIVE',
        },
        'test_admin'
      );

      expect(client).toBeDefined();
      expect(client.clientCode).toBe(code);
      expect(client.telegramConnected).toBe(false);
    });

    it('should prevent creating duplicate client codes', async () => {
      const code = `TEST-CL-0001`;
      await expect(
        ClientService.createClient(
          {
            clientCode: code,
            name: 'Another Client',
            email: 'another@example.com',
          },
          'test_admin'
        )
      ).rejects.toThrow();
    });
  });

  describe('Project Management', () => {
    it('should create a project linked to a client', async () => {
      const client = await Client.findOne({ clientCode: 'TEST-CL-0001' });
      const pCode = `TEST-PR-0001`;
      await Project.deleteOne({ projectCode: pCode });

      const project = await ProjectService.createProject(
        {
          projectCode: pCode,
          clientId: client!._id,
          name: 'Website Dev',
          serviceType: 'WEBSITE',
          totalAmount: 50000,
          currency: 'INR',
          status: 'PLANNED',
        },
        'test_admin'
      );

      expect(project).toBeDefined();
      expect(project.projectCode).toBe(pCode);
      expect(project.totalAmount).toBe(50000);
    });
  });

  describe('Financial Calculations (Critical Requirement)', () => {
    it('Given Project = 50,000, Payment 1 = 25,000, Payment 2 = 10,000, it must return Paid = 35,000 and Outstanding = 15,000', async () => {
      const client = await Client.findOne({ clientCode: 'TEST-CL-0001' });
      const project = await Project.findOne({ projectCode: 'TEST-PR-0001' });

      // Clean up past payments for this test project
      await Payment.deleteMany({ projectId: project!._id });

      // Record first payment: 25,000
      const pay1 = new Payment({
        paymentNumber: 'PAY-TEST-0001',
        clientId: client!._id,
        projectId: project!._id,
        amount: 25000,
        currency: 'INR',
        paymentMethod: 'UPI',
        paymentDate: new Date(),
        status: 'COMPLETED',
      });
      await pay1.save();

      // Record second payment: 10,000
      const pay2 = new Payment({
        paymentNumber: 'PAY-TEST-0002',
        clientId: client!._id,
        projectId: project!._id,
        amount: 10000,
        currency: 'INR',
        paymentMethod: 'CASH',
        paymentDate: new Date(),
        status: 'COMPLETED',
      });
      await pay2.save();

      // Recalculate balances
      const balances = await PaymentService.calculateProjectBalances(project!._id.toString());

      expect(balances.totalAmount).toBe(50000);
      expect(balances.paidAmount).toBe(35000); // 25,000 + 10,000 = 35,000
      expect(balances.outstandingAmount).toBe(15000); // 50,000 - 35,0500 = 15,000
    });

    it('should prevent payment recording that makes total paid > project total', async () => {
      const client = await Client.findOne({ clientCode: 'TEST-CL-0001' });
      const project = await Project.findOne({ projectCode: 'TEST-PR-0001' });

      // Outstanding balance is currently 15,000. Try to record 20,000 payment.
      await expect(
        PaymentService.recordPayment(
          {
            clientId: client!._id,
            projectId: project!._id,
            amount: 20000,
            paymentMethod: 'BANK_TRANSFER',
          },
          'test_admin'
        )
      ).rejects.toThrow();
    });

    it('should prevent negative payment amounts', async () => {
      const client = await Client.findOne({ clientCode: 'TEST-CL-0001' });
      const project = await Project.findOne({ projectCode: 'TEST-PR-0001' });

      await expect(
        PaymentService.recordPayment(
          {
            clientId: client!._id,
            projectId: project!._id,
            amount: -5000,
            paymentMethod: 'BANK_TRANSFER',
          },
          'test_admin'
        )
      ).rejects.toThrow();
    });
  });

  describe('Telegram Client Linking Flow', () => {
    it('should generate connection token, link user, and invalidate token on success', async () => {
      const client = await Client.findOne({ clientCode: 'TEST-CL-0001' });
      
      const link = await ClientService.generateTelegramLink(client!._id.toString(), 'test_admin');
      expect(link).toContain('https://t.me/');
      
      const updatedClient = await Client.findById(client!._id);
      const token = updatedClient!.telegramConnectionToken;
      expect(token).toBeDefined();
      expect(updatedClient!.telegramConnectionTokenExpiresAt).toBeDefined();

      // Simulate webhook connecting telegram profile
      const connectedClient = await ClientService.connectTelegram(token!, {
        telegramUserId: '999888777',
        telegramUsername: 'test_tg_username',
        telegramChatId: '999888777',
      });

      expect(connectedClient.telegramConnected).toBe(true);
      expect(connectedClient.telegramUserId).toBe('999888777');
      expect(connectedClient.telegramUsername).toBe('test_tg_username');
      expect(connectedClient.telegramConnectionToken).toBeUndefined(); // Invalidated
    });

    it('should throw error on invalid/expired connection tokens', async () => {
      await expect(
        ClientService.connectTelegram('INVALID_TOKEN_TEST', {
          telegramUserId: '123',
          telegramChatId: '123',
        })
      ).rejects.toThrow();
    });
  });

  describe('Authentication Security Checks', () => {
    it('should sign and verify secure JWT sessions correctly', async () => {
      const payload = {
        id: 'user_123',
        email: 'security@example.com',
        role: 'ADMIN',
        name: 'Secured Admin',
      };

      const token = await signJWT(payload);
      expect(token).toBeDefined();

      const decoded = await verifyJWT(token);
      expect(decoded).toBeDefined();
      expect(decoded!.email).toBe(payload.email);
      expect(decoded!.role).toBe(payload.role);
    });

    it('should return null when verifying invalid JWT session signatures', async () => {
      const decoded = await verifyJWT('invalid.jwt.signature');
      expect(decoded).toBeNull();
    });
  });

  describe('Telegram Notification Failure Handling', () => {
    it('should log notification as FAILED in database when telegram sender returns false', async () => {
      // Create a test client with mock disconnected Telegram
      const mockClient = new Client({
        clientCode: 'TEST-CL-FAIL',
        name: 'Mock Fail Client',
        email: 'fail@example.com',
        telegramConnected: false, // Disconnected to force fail
      });
      await mockClient.save();

      // Trigger onboarding text compilation and dispatch
      const notification = await NotificationService.sendDirectNotification(
        mockClient._id.toString(),
        'CLIENT_ONBOARDED',
        'TEST_MESSAGE_FAILED_DELIVERY'
      );

      expect(notification.status).toBe('FAILED');
      expect(notification.error).toContain('Client Telegram is not connected');

      await Client.deleteOne({ _id: mockClient._id });
      await Notification.deleteOne({ _id: notification._id });
    });
  });
});
