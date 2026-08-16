import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { dbConnect } from '@/lib/db/connect';
import Client from '@/models/Client';
import Project from '@/models/Project';
import Payment from '@/models/Payment';
import Invoice from '@/models/Invoice';
import { ClientService } from '@/services/client.service';
import { ProjectService } from '@/services/project.service';
import { PaymentService } from '@/services/payment.service';
import { InvoiceService } from '@/services/invoice.service';
import { TelegramService } from '@/services/telegram.service';

describe('Multiple Projects per Client & Secure Client Codes', () => {
  beforeAll(async () => {
    await dbConnect();
    // Clean up test data
    await Client.deleteMany({ email: /^test-multi-/ });
  });

  afterAll(async () => {
    await Client.deleteMany({ email: /^test-multi-/ });
  });

  describe('1. Secure Random Client Code Generation', () => {
    it('should generate secure client code matching CL-[A-Z0-9]{8}', () => {
      const code = ClientService.generateSecureClientCode();
      expect(code).toMatch(/^CL-[A-Z0-9]{8}$/);
    });

    it('should generate unique random client codes for multiple creations', async () => {
      const client1 = await ClientService.createClient({
        name: 'Multi Client 1',
        email: 'test-multi-1@example.com',
      }, 'test-suite');

      const client2 = await ClientService.createClient({
        name: 'Multi Client 2',
        email: 'test-multi-2@example.com',
      }, 'test-suite');

      expect(client1.clientCode).toMatch(/^CL-[A-Z0-9]{8}$/);
      expect(client2.clientCode).toMatch(/^CL-[A-Z0-9]{8}$/);
      expect(client1.clientCode).not.toBe(client2.clientCode);

      // Clean up
      await Client.deleteMany({ _id: { $in: [client1._id, client2._id] } });
    });
  });

  describe('2. Multiple Projects per Client & Financial Aggregation', () => {
    it('should allow one client to have multiple projects and aggregate financials', async () => {
      // 1. Create client
      const client = await ClientService.createClient({
        name: 'Enterprise Client',
        email: 'test-multi-ent@example.com',
      }, 'test-suite');

      // 2. Create Project A (Budget: 50,000)
      const projectA = await ProjectService.createProject({
        clientId: client._id,
        name: 'Website Redesign',
        serviceType: 'WEBSITE',
        totalAmount: 50000,
        currency: 'INR',
        status: 'IN_PROGRESS',
      }, 'test-suite');

      // 3. Create Project B (Budget: 100,000)
      const projectB = await ProjectService.createProject({
        clientId: client._id,
        name: 'Mobile App Development',
        serviceType: 'MOBILE_APPLICATION',
        totalAmount: 100000,
        currency: 'INR',
        status: 'IN_PROGRESS',
      }, 'test-suite');

      expect(projectA.clientId.toString()).toBe(client._id.toString());
      expect(projectB.clientId.toString()).toBe(client._id.toString());
      expect(projectA.projectCode).toBeDefined();
      expect(projectB.projectCode).toBeDefined();

      // 4. Record Payment for Project A (20,000)
      const paymentA = await PaymentService.recordPayment({
        clientId: client._id,
        projectId: projectA._id,
        amount: 20000,
        paymentMethod: 'UPI',
        paymentType: 'ADVANCE',
      }, 'test-suite');

      // 5. Record Payment for Project B (60,000)
      const paymentB = await PaymentService.recordPayment({
        clientId: client._id,
        projectId: projectB._id,
        amount: 60000,
        paymentMethod: 'BANK_TRANSFER',
        paymentType: 'ADVANCE',
      }, 'test-suite');

      // Check balances per project
      const balanceA = await PaymentService.calculateProjectBalances(projectA._id.toString());
      expect(balanceA.totalAmount).toBe(50000);
      expect(balanceA.paidAmount).toBe(20000);
      expect(balanceA.outstandingAmount).toBe(30000);

      const balanceB = await PaymentService.calculateProjectBalances(projectB._id.toString());
      expect(balanceB.totalAmount).toBe(100000);
      expect(balanceB.paidAmount).toBe(60000);
      expect(balanceB.outstandingAmount).toBe(40000);

      // Verify cross-project payment isolation (Payment on Project A cannot exceed Project A balance)
      await expect(
        PaymentService.recordPayment({
          clientId: client._id,
          projectId: projectA._id,
          amount: 35000, // exceeds Project A's 30,000 outstanding
          paymentMethod: 'UPI',
        }, 'test-suite')
      ).rejects.toThrow(/Payment exceeds outstanding balance/);

      // Verify Client query returns both projects
      const clientProjects = await Project.find({ clientId: client._id });
      expect(clientProjects.length).toBe(2);

      // Clean up Project A
      await ProjectService.deleteProject(projectA._id.toString(), 'test-suite');

      // Project B and Client should still exist
      const remainingProjects = await Project.find({ clientId: client._id });
      expect(remainingProjects.length).toBe(1);
      expect(remainingProjects[0]._id.toString()).toBe(projectB._id.toString());

      const clientStillExists = await Client.findById(client._id);
      expect(clientStillExists).not.toBeNull();

      // Clean up
      await ProjectService.deleteProject(projectB._id.toString(), 'test-suite');
      await Client.deleteOne({ _id: client._id });
    }, 30000);
  });
});
