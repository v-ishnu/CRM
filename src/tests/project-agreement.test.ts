import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import Agreement from '@/models/Agreement';
import Project from '@/models/Project';
import Client from '@/models/Client';
import { AgreementService } from '@/services/agreement.service';
import { TelegramService } from '@/services/telegram.service';
import { AuditService } from '@/services/audit.service';

// Mock dependencies
vi.mock('@/lib/db/connect', () => ({
  dbConnect: vi.fn().mockResolvedValue(null),
  default: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/telegram.service', () => ({
  TelegramService: {
    sendMessageRaw: vi.fn().mockResolvedValue({ success: true, messageId: 9999 }),
    sendMessage: vi.fn().mockResolvedValue(true),
    answerCallbackQuery: vi.fn().mockResolvedValue(true),
    getAdminChatId: vi.fn().mockReturnValue('123456789'),
  },
}));

vi.mock('@/services/audit.service', () => ({
  AuditService: {
    logAction: vi.fn().mockResolvedValue(true),
  },
}));

describe('Project Agreement Workflow Tests', () => {
  const mockClientId = new mongoose.Types.ObjectId().toString();
  const mockProjectId = new mongoose.Types.ObjectId().toString();
  const mockAgreementId = new mongoose.Types.ObjectId().toString();

  const mockClient = {
    _id: mockClientId,
    name: 'Acme Corp',
    email: 'acme@example.com',
    telegramConnected: true,
    telegramChatId: '987654321',
    telegramUserId: 'tg_user_123',
  };

  const mockProject = {
    _id: mockProjectId,
    name: 'CRM Redesign',
    projectCode: 'PR-2026-001',
    clientId: mockClientId,
    serviceType: 'WEB_DEVELOPMENT',
    totalAmount: 150000,
    currency: 'INR',
    status: 'NOT_STARTED',
    scope: 'Full stack Next.js app',
    terms: '',
    agreementId: undefined as any,
    save: vi.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Agreement Creation and Terms Dispatch', () => {
    it('should throw an error if agreement terms are empty', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
      vi.spyOn(Client, 'findById').mockResolvedValue(mockClient as any);

      await expect(
        AgreementService.createAgreement(mockProjectId, '   ', 'admin')
      ).rejects.toThrow(/terms cannot be empty/);
    });

    it('should create agreement snapshot, transition project to PENDING_AGREEMENT, and dispatch Telegram terms', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
      vi.spyOn(Client, 'findById').mockResolvedValue(mockClient as any);
      vi.spyOn(Agreement, 'findOne').mockResolvedValue(null);

      const mockCreatedAgreement = {
        _id: mockAgreementId,
        projectId: mockProjectId,
        clientId: mockClientId,
        terms: 'Payment 50% upfront, 50% on completion.',
        totalAmount: 150000,
        currency: 'INR',
        status: 'PENDING_REVIEW',
        version: 1,
        snapshot: {
          projectName: mockProject.name,
          projectCode: mockProject.projectCode,
          serviceType: mockProject.serviceType,
          totalAmount: 150000,
          currency: 'INR',
          terms: 'Payment 50% upfront, 50% on completion.',
          scope: mockProject.scope,
          clientName: mockClient.name,
          clientEmail: mockClient.email,
        },
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Agreement, 'create').mockResolvedValue(mockCreatedAgreement as any);

      const result = await AgreementService.createAgreement(
        mockProjectId,
        'Payment 50% upfront, 50% on completion.',
        'admin'
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('PENDING_REVIEW');
      expect(mockProject.status).toBe('PENDING_AGREEMENT');
      expect(mockProject.save).toHaveBeenCalled();

      // Verify Telegram interactive message was sent with accept/reject buttons
      expect(TelegramService.sendMessageRaw).toHaveBeenCalledWith(
        mockClient.telegramChatId,
        expect.stringContaining('Project Agreement & Terms'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: expect.stringContaining('Accept Terms'),
                  callback_data: `agree:accept:${mockAgreementId}`,
                }),
                expect.objectContaining({
                  text: expect.stringContaining('Decline'),
                  callback_data: `agree:reject:${mockAgreementId}`,
                }),
              ]),
            ]),
          }),
        })
      );

      // Verify audit logged
      expect(AuditService.logAction).toHaveBeenCalledWith(
        'admin',
        'AGREEMENT_CREATED',
        'Agreement',
        mockAgreementId,
        expect.any(Object)
      );
    });
  });

  describe('Interactive Telegram Callback Query Handling', () => {
    it('should reject callback from unauthorized Telegram user ID', async () => {
      const mockAgreement = {
        _id: mockAgreementId,
        clientId: mockClientId,
        projectId: mockProjectId,
        status: 'PENDING_REVIEW',
        save: vi.fn(),
      };

      vi.spyOn(Agreement, 'findById').mockResolvedValue(mockAgreement as any);
      vi.spyOn(Client, 'findById').mockResolvedValue(mockClient as any);

      const result = await AgreementService.handleAgreementCallback(
        'cb_123',
        'attacker_user_456', // Unauthorized ID
        'chat_999',
        `agree:accept:${mockAgreementId}`
      );

      expect(result.success).toBe(false);
      expect(result.action).toBe('agreement_unauthorized');
      expect(TelegramService.answerCallbackQuery).toHaveBeenCalledWith(
        'cb_123',
        expect.stringContaining('Unauthorized'),
        true
      );
      expect(AuditService.logAction).toHaveBeenCalledWith(
        'attacker_user_456',
        'TASK_ACTION_DENIED',
        'Agreement',
        mockAgreement._id,
        expect.any(Object)
      );
    });

    it('should process acceptance from authorized client and transition project to ACTIVE', async () => {
      const mockAgreement = {
        _id: mockAgreementId,
        clientId: mockClientId,
        projectId: mockProjectId,
        status: 'PENDING_REVIEW',
        acceptedAt: undefined as any,
        acceptedBy: undefined as any,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Agreement, 'findById').mockResolvedValue(mockAgreement as any);
      vi.spyOn(Client, 'findById').mockResolvedValue(mockClient as any);
      vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);

      const result = await AgreementService.handleAgreementCallback(
        'cb_789',
        mockClient.telegramUserId, // Authorized client
        mockClient.telegramChatId,
        `agree:accept:${mockAgreementId}`
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('agreement_accepted');
      expect(mockAgreement.status).toBe('ACCEPTED');
      expect(mockAgreement.acceptedAt).toBeDefined();
      expect(mockAgreement.acceptedBy.telegramUserId).toBe(mockClient.telegramUserId);
      expect(mockAgreement.save).toHaveBeenCalled();

      // Project state must be set to ACTIVE
      expect(mockProject.status).toBe('ACTIVE');
      expect(mockProject.save).toHaveBeenCalled();

      // Telegram notification to client and admin
      expect(TelegramService.answerCallbackQuery).toHaveBeenCalledWith(
        'cb_789',
        expect.stringContaining('Agreement accepted')
      );
    });

    it('should process rejection from authorized client', async () => {
      const mockAgreement = {
        _id: mockAgreementId,
        clientId: mockClientId,
        projectId: mockProjectId,
        status: 'PENDING_REVIEW',
        rejectedAt: undefined as any,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Agreement, 'findById').mockResolvedValue(mockAgreement as any);
      vi.spyOn(Client, 'findById').mockResolvedValue(mockClient as any);
      vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);

      const result = await AgreementService.handleAgreementCallback(
        'cb_999',
        mockClient.telegramUserId,
        mockClient.telegramChatId,
        `agree:reject:${mockAgreementId}`
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('agreement_rejected');
      expect(mockAgreement.status).toBe('REJECTED');
      expect(mockAgreement.rejectedAt).toBeDefined();
      expect(mockAgreement.save).toHaveBeenCalled();

      // Project status should NOT be transitioned to ACTIVE
      expect(mockProject.status).not.toBe('ACTIVE');
    });
  });
});
