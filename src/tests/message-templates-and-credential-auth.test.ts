import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import TeamMember from '@/models/TeamMember';
import Task from '@/models/Task';
import Project from '@/models/Project';
import Credential from '@/models/Credential';
import MessageTemplate from '@/models/MessageTemplate';
import { TeamMemberService } from '@/services/team-member.service';
import { CredentialSharingService } from '@/services/credential-sharing.service';
import { TelegramService } from '@/services/telegram.service';
import { MessageTemplateService } from '@/services/message-template.service';
import {
  escapeHtml,
  sanitizeTelegramHtml,
  sanitizeChatHtml,
  convertMarkdownToTelegramHtml,
  stripHtml,
} from '@/lib/templates/rich-text';
import { encrypt } from '@/lib/security/encryption';

// Mock DB connect to guarantee ZERO real database queries during tests
vi.mock('@/lib/db/connect', () => ({
  dbConnect: vi.fn().mockResolvedValue(null),
  default: vi.fn().mockResolvedValue(null),
}));

// Mock TelegramService raw sending so NO real network requests are dispatched
vi.mock('@/services/telegram.service', () => ({
  TelegramService: {
    sendMessageRaw: vi.fn().mockResolvedValue({ success: true, messageId: 9999 }),
    sendMessage: vi.fn().mockResolvedValue(true),
    sendDocument: vi.fn().mockResolvedValue(true),
    resolveTelegramIdentity: vi.fn(),
  },
}));

// Mock AuditService
vi.mock('@/services/audit.service', () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(true),
    logAction: vi.fn().mockResolvedValue(true),
  },
}));

// Mock CacheService
vi.mock('@/services/cache.service', () => ({
  CacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(true),
    invalidateTeamChatCache: vi.fn().mockResolvedValue(true),
  },
}));

function mockQuery(val: any) {
  const q: any = {
    select: vi.fn().mockReturnThis(),
    populate: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    lean: vi.fn().mockReturnValue(val),
    exec: vi.fn().mockResolvedValue(val),
    then: (resolve: any) => Promise.resolve(val).then(resolve),
  };
  return q;
}

describe('PART 1: Team Member Credential Authorization Chain & Security Audit', () => {
  const mockProjectId = new mongoose.Types.ObjectId().toString();
  const mockMemberId = new mongoose.Types.ObjectId().toString();
  const mockUnauthorizedMemberId = new mongoose.Types.ObjectId().toString();
  const mockTaskId = new mongoose.Types.ObjectId().toString();
  const mockWpCredId = new mongoose.Types.ObjectId().toString();

  const encryptedPassword = encrypt('Pass123!Secure', 'password');
  const encryptedUsername = encrypt('dev_admin', 'username');
  const encryptedService = encrypt('WordPress CMS', 'service');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(MessageTemplate, 'findOne').mockReturnValue(mockQuery(null));
    vi.spyOn(MessageTemplate, 'find').mockReturnValue(mockQuery([]));
  });

  describe('Root Cause 1: TeamMemberService.hasPermission & isAuthorizedForCredentialType', () => {
    it('hasPermission should grant access when member has VIEW_CREDENTIALS permission', () => {
      const authorizedMember: any = {
        _id: mockMemberId,
        name: 'Authorized Dev',
        permissions: ['VIEW_CREDENTIALS', 'VIEW_TASKS'],
        role: 'DEVELOPER',
      };
      expect(TeamMemberService.hasPermission(authorizedMember, 'VIEW_CREDENTIALS')).toBe(true);
    });

    it('hasPermission should deny access when member lacks VIEW_CREDENTIALS permission', () => {
      const unauthorizedMember: any = {
        _id: mockUnauthorizedMemberId,
        name: 'Unauthorized Member',
        permissions: ['VIEW_TASKS'],
        role: 'DEVELOPER',
      };
      expect(TeamMemberService.hasPermission(unauthorizedMember, 'VIEW_CREDENTIALS')).toBe(false);
    });

    it('isAuthorizedForCredentialType should allow all types when allowedCredentialTypes is empty array', () => {
      // Per CRM instruction: "Leave empty to allow all types"
      const memberEmptyTypes: any = {
        _id: mockMemberId,
        permissions: ['VIEW_CREDENTIALS'],
        allowedCredentialTypes: [],
      };
      expect(TeamMemberService.isAuthorizedForCredentialType(memberEmptyTypes, 'WORDPRESS')).toBe(true);
      expect(TeamMemberService.isAuthorizedForCredentialType(memberEmptyTypes, 'DATABASE')).toBe(true);
      expect(TeamMemberService.isAuthorizedForCredentialType(memberEmptyTypes, 'CPANEL')).toBe(true);
    });

    it('isAuthorizedForCredentialType should enforce explicit type filtering when list is non-empty', () => {
      const memberRestrictedTypes: any = {
        _id: mockMemberId,
        permissions: ['VIEW_CREDENTIALS'],
        allowedCredentialTypes: ['WORDPRESS', 'DATABASE'],
      };
      expect(TeamMemberService.isAuthorizedForCredentialType(memberRestrictedTypes, 'WORDPRESS')).toBe(true);
      expect(TeamMemberService.isAuthorizedForCredentialType(memberRestrictedTypes, 'DATABASE')).toBe(true);
      expect(TeamMemberService.isAuthorizedForCredentialType(memberRestrictedTypes, 'CPANEL')).toBe(false);
    });
  });

  describe('Root Cause 2 & 3: CredentialSharingService.shareTaskCredentials authorization chain', () => {
    const mockTask = {
      _id: mockTaskId,
      taskCode: 'TSK-101',
      title: 'Fix Authentication Flow',
      projectId: mockProjectId,
      assignedTo: mockMemberId,
      requiredCredentialIds: [mockWpCredId],
      status: 'IN_PROGRESS',
    };

    const mockProject = {
      _id: mockProjectId,
      name: 'Alpha Redesign',
      projectCode: 'PRJ-ALPHA',
      teamMemberIds: [mockMemberId, mockUnauthorizedMemberId],
    };

    const mockCredential = {
      _id: mockWpCredId,
      projectId: mockProjectId,
      title: 'WordPress Admin',
      service: encryptedService,
      username: encryptedUsername,
      password: encryptedPassword,
      credentialType: 'WORDPRESS',
      status: 'ACTIVE',
    };

    it('should successfully share credentials with authorized team member assigned to task', async () => {
      const authorizedMember = {
        _id: mockMemberId,
        name: 'Alice Developer',
        email: 'alice@drdebuggers.com',
        permissions: ['VIEW_CREDENTIALS', 'VIEW_TASKS'],
        allowedCredentialTypes: [],
        telegramConnected: true,
        telegramChatId: '12345678',
        status: 'ACTIVE',
      };

      vi.spyOn(Task, 'findById').mockReturnValue(mockQuery(mockTask));
      vi.spyOn(Project, 'findById').mockReturnValue(mockQuery(mockProject));
      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockQuery(authorizedMember));
      vi.spyOn(Credential, 'find').mockReturnValue(mockQuery([mockCredential]));

      const result = await CredentialSharingService.shareTaskCredentials(
        mockTaskId,
        'alice@drdebuggers.com',
        { chatId: '12345678' }
      );

      expect(result.success).toBe(true);
      expect(result.sharedCount).toBe(1);
      expect(TelegramService.sendMessageRaw).toHaveBeenCalledTimes(1);
    });

    it('should reject credential access when team member lacks VIEW_CREDENTIALS permission', async () => {
      const unauthorizedMember = {
        _id: mockUnauthorizedMemberId,
        name: 'Bob Intern',
        email: 'bob@drdebuggers.com',
        permissions: ['VIEW_TASKS'], // Missing VIEW_CREDENTIALS
        allowedCredentialTypes: [],
        telegramConnected: true,
        telegramChatId: '87654321',
        status: 'ACTIVE',
      };

      const taskAssignedToBob = {
        ...mockTask,
        assignedTo: mockUnauthorizedMemberId,
      };

      vi.spyOn(Task, 'findById').mockReturnValue(mockQuery(taskAssignedToBob));
      vi.spyOn(Project, 'findById').mockReturnValue(mockQuery(mockProject));
      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockQuery(unauthorizedMember));
      vi.spyOn(Credential, 'find').mockReturnValue(mockQuery([mockCredential]));

      await expect(
        CredentialSharingService.shareTaskCredentials(
          mockTaskId,
          'bob@drdebuggers.com',
          { chatId: '87654321' }
        )
      ).rejects.toThrow(/does not have VIEW_CREDENTIALS permission/i);
    });

    it('should reject credential access when task has no assigned team member', async () => {
      const unassignedTask = {
        ...mockTask,
        assignedTo: null,
      };

      vi.spyOn(Task, 'findById').mockReturnValue(mockQuery(unassignedTask));

      await expect(
        CredentialSharingService.shareTaskCredentials(mockTaskId, 'alice@drdebuggers.com')
      ).rejects.toThrow(/Task has no assigned team member/i);
    });

    it('should reject credential access when team member account is deactivated', async () => {
      const deactivatedMember = {
        _id: mockMemberId,
        name: 'Deactivated Dev',
        email: 'alice@drdebuggers.com',
        permissions: ['VIEW_CREDENTIALS'],
        allowedCredentialTypes: [],
        status: 'DEACTIVATED',
      };

      vi.spyOn(Task, 'findById').mockReturnValue(mockQuery(mockTask));
      vi.spyOn(Project, 'findById').mockReturnValue(mockQuery(mockProject));
      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockQuery(deactivatedMember));

      await expect(
        CredentialSharingService.shareTaskCredentials(mockTaskId, 'alice@drdebuggers.com')
      ).rejects.toThrow(/is not active/i);
    });

    it('should reject credential access when required credential does not belong to project', async () => {
      const member = {
        _id: mockMemberId,
        name: 'Alice Developer',
        email: 'alice@drdebuggers.com',
        permissions: ['VIEW_CREDENTIALS'],
        allowedCredentialTypes: [],
        telegramConnected: true,
        telegramChatId: '12345678',
        status: 'ACTIVE',
      };

      vi.spyOn(Task, 'findById').mockReturnValue(mockQuery(mockTask));
      vi.spyOn(Project, 'findById').mockReturnValue(mockQuery(mockProject));
      vi.spyOn(TeamMember, 'findById').mockReturnValue(mockQuery(member));
      // Credential query for matching project returns empty array
      vi.spyOn(Credential, 'find').mockReturnValue(mockQuery([]));

      await expect(
        CredentialSharingService.shareTaskCredentials(mockTaskId, 'alice@drdebuggers.com')
      ).rejects.toThrow(/None of the required credentials for this task were found/i);
    });
  });
});

describe('PART 2: Universal Message Template System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(MessageTemplate, 'findOne').mockReturnValue(mockQuery(null));
    vi.spyOn(MessageTemplate, 'find').mockReturnValue(mockQuery([]));
  });

  describe('Default Catalog & System Templates', () => {
    it('should include all required system templates across channels', () => {
      const defaultTemplates = MessageTemplateService.getDefaultTemplates();
      expect(defaultTemplates.length).toBeGreaterThanOrEqual(14);

      const keys = defaultTemplates.map((t) => t.key);
      expect(keys).toContain('TEAM_MEMBER_TASK_ASSIGNED');
      expect(keys).toContain('TEAM_MEMBER_TASK_CREDENTIALS');
      expect(keys).toContain('TEAM_MEMBER_CHAT_MESSAGE');
      expect(keys).toContain('TEAM_MEMBER_PAYMENT_RECEIVED');
      expect(keys).toContain('CLIENT_ONBOARDED');
      expect(keys).toContain('CLIENT_PAYMENT_RECEIVED');
      expect(keys).toContain('CLIENT_HOSTING_EXPIRY');
      expect(keys).toContain('ADMIN_TEAM_MESSAGE_PUSH');
      expect(keys).toContain('ADMIN_TASK_STATUS_UPDATED');
      expect(keys).toContain('ADMIN_HOSTING_EXPIRY_ALERT');
    });

    it('should retrieve default template by key correctly', () => {
      const t = MessageTemplateService.getDefaultTemplateByKey('TEAM_MEMBER_TASK_ASSIGNED');
      expect(t).toBeDefined();
      expect(t?.recipientType).toBe('TEAM_MEMBER');
      expect(t?.channel).toBe('TELEGRAM');
      expect(t?.variables.length).toBeGreaterThan(0);
    });
  });

  describe('Variable Security & Secret Prevention', () => {
    it('should strictly reject template bodies containing sensitive keywords like password or secret', () => {
      const resultPassword = MessageTemplateService.validateVariables(
        'TEAM_MEMBER_TASK_ASSIGNED',
        'Hello {{teamMemberName}}, here is your {{password}}'
      );
      expect(resultPassword.valid).toBe(false);
      expect(resultPassword.unauthorizedVars).toContain('password');

      const resultSecret = MessageTemplateService.validateVariables(
        'TEAM_MEMBER_TASK_ASSIGNED',
        'Security alert: {{api_secret}} leaked'
      );
      expect(resultSecret.valid).toBe(false);
      expect(resultSecret.unauthorizedVars).toContain('api_secret');

      const resultBank = MessageTemplateService.validateVariables(
        'TEAM_MEMBER_TASK_ASSIGNED',
        'Payment details: {{bank_account}}'
      );
      expect(resultBank.valid).toBe(false);
      expect(resultBank.unauthorizedVars).toContain('bank_account');
    });

    it('should accept authorized template variables declared in schema', () => {
      const result = MessageTemplateService.validateVariables(
        'TEAM_MEMBER_TASK_ASSIGNED',
        'Hello {{taskTitle}}, you have a new task for {{projectName}}.'
      );
      expect(result.valid).toBe(true);
      expect(result.unauthorizedVars).toHaveLength(0);
    });
  });

  describe('Resilient Rendering & Safe Variable Interpolation', () => {
    it('should safely interpolate variables into template', async () => {
      const rendered = await MessageTemplateService.renderTemplate(
        'TEAM_MEMBER_TASK_ASSIGNED',
        'TELEGRAM',
        {
          projectName: 'CRM Engine',
          projectCode: 'CRM-01',
          taskTitle: 'Audit Auth Flow',
          taskCode: 'TSK-99',
          priority: 'HIGH',
          status: 'IN_PROGRESS',
          dueDate: '30 Sep 2026',
          description: 'Ensure strict verification',
          assignedBy: 'Admin',
        }
      );

      expect(rendered.text).toContain('CRM Engine');
      expect(rendered.text).toContain('TSK-99');
      expect(rendered.text).toContain('Audit Auth Flow');
      expect(rendered.body).toBe(rendered.text);
      expect(rendered.channel).toBe('TELEGRAM');
    });

    it('should fallback missing optional variables to empty string and NEVER output undefined or null', async () => {
      const rendered = await MessageTemplateService.renderTemplate(
        'TEAM_MEMBER_TASK_ASSIGNED',
        'TELEGRAM',
        {
          taskTitle: 'Quick Bugfix',
          // Omit other variables
        }
      );

      expect(rendered.text).not.toContain('undefined');
      expect(rendered.text).not.toContain('null');
      expect(rendered.text).not.toContain('[object Object]');
    });

    it('should gracefully fallback to system default when database template is disabled or not found', async () => {
      vi.spyOn(MessageTemplate, 'findOne').mockReturnValue(mockQuery(null));

      const rendered = await MessageTemplateService.renderTemplate(
        'CLIENT_PAYMENT_RECEIVED',
        'TELEGRAM',
        {
          clientName: 'Acme Corp',
          amount: '₹50,000',
          projectName: 'ERP Suite',
          projectTotal: '₹1,00,000',
          paidAmount: '₹50,000',
          outstandingAmount: '₹50,000',
          paymentStatus: 'PARTIALLY PAID',
          paymentNumber: 'PAY-001',
        }
      );

      expect(rendered.renderedViaFallback).toBe(true);
      expect(rendered.text).toContain('Acme Corp');
      expect(rendered.text).toContain('₹50,000');
    });

    it('should support flexible parameter ordering: (key, channel, vars) and (key, vars, channel)', async () => {
      const res1 = await MessageTemplateService.renderTemplate(
        'TEAM_MEMBER_CHAT_MESSAGE',
        'TELEGRAM',
        { adminName: 'Admin', messageText: 'Hello from order 1' }
      );

      const res2 = await MessageTemplateService.renderTemplate(
        'TEAM_MEMBER_CHAT_MESSAGE',
        { adminName: 'Admin', messageText: 'Hello from order 2' },
        'TELEGRAM'
      );

      expect(res1.text).toContain('Hello from order 1');
      expect(res2.text).toContain('Hello from order 2');
    });
  });

  describe('Rich Text Sanitization & Channel Rules', () => {
    it('escapeHtml should convert dangerous HTML special characters to HTML entities', () => {
      const input = 'Fix <script>alert("hacked")</script> & check "data" < 10';
      const escaped = escapeHtml(input);
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
      expect(escaped).toContain('&amp;');
      expect(escaped).toContain('&quot;');
    });

    it('sanitizeTelegramHtml should balance unclosed tags to prevent Telegram 400 Bad Request', () => {
      const unclosed = '<b>Bold text with <i>nested unclosed italic';
      const balanced = sanitizeTelegramHtml(unclosed);
      expect(balanced).toBe('<b>Bold text with <i>nested unclosed italic</i></b>');
    });

    it('sanitizeTelegramHtml should strip unsupported HTML tags like script, img, div', () => {
      const htmlWithDiv = '<div><script>alert(1)</script><b>Valid Telegram Tag</b><img src="x" /></div>';
      const clean = sanitizeTelegramHtml(htmlWithDiv);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('<div>');
      expect(clean).not.toContain('<img');
      expect(clean).toContain('<b>Valid Telegram Tag</b>');
    });

    it('sanitizeChatHtml should prevent XSS in CRM Chat while preserving styling tags', () => {
      const maliciousChat = '<p>Normal text</p><script>alert(1)</script><a href="javascript:steal()">Click</a>';
      const sanitized = sanitizeChatHtml(maliciousChat);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toContain('<p>Normal text</p>');
    });

    it('convertMarkdownToTelegramHtml should convert markdown bold, italic, monospace, and links', () => {
      const md = 'Hello **world**, this is *italic* and `code` with [link](https://example.com)';
      const converted = convertMarkdownToTelegramHtml(md);
      expect(converted).toContain('<b>world</b>');
      expect(converted).toContain('<i>italic</i>');
      expect(converted).toContain('<code>code</code>');
      expect(converted).toContain('<a href="https://example.com">link</a>');
    });

    it('stripHtml should cleanly remove all tags for plain text and web push bodies', () => {
      const rich = '<b>Title</b>: <i>Description</i> with <a href="#">link</a>';
      expect(stripHtml(rich)).toBe('Title: Description with link');
    });
  });

  describe('Live Preview API Support', () => {
    it('previewTemplate should generate multi-channel preview objects', async () => {
      const preview = await MessageTemplateService.previewTemplate(
        'TEAM_MEMBER_TASK_ASSIGNED',
        'Hello, new task {{taskTitle}} for {{projectName}}'
      );
      expect(preview.telegram).toContain('Hello');
      expect(preview.chat).toBeDefined();
      expect(preview.webPush).toBeDefined();
      expect(preview.webPush.body).toBeDefined();
    });
  });
});
