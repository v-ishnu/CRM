import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db/connect';
import Client from '@/models/Client';
import Project from '@/models/Project';
import TeamMember from '@/models/TeamMember';
import Inquiry from '@/models/Inquiry';
import AuditLog from '@/models/AuditLog';
import { TelegramService } from '@/services/telegram.service';
import { InquiryService } from '@/services/inquiry.service';

describe('Public Inquiry & Human Handoff Fallback System', () => {
  let existingClient: any;
  let existingTeamMember: any;
  const adminTelegramId = '8834255899';
  const clientTelegramId = '91919101';
  const teamTelegramId = '92929202';
  const publicUser1TelegramId = '93939303';
  const publicUser2TelegramId = '94949404';

  beforeAll(async () => {
    await dbConnect();
    process.env.ADMIN_TELEGRAM_ID = adminTelegramId;
    process.env.TELEGRAM_BOT_TOKEN = '8848520592:AAG4ADhi5XX0QAJwNus2A0_8woIeOv_dl78';

    // Clean up test users first
    await Client.deleteMany({
      $or: [
        { telegramUserId: { $in: [clientTelegramId, publicUser1TelegramId, publicUser2TelegramId] } },
        { telegramUsername: { $in: ['john_lead', 'sarah_lead', 'acme_client', 'alice_dev'] } },
      ],
    });
    await TeamMember.deleteMany({
      $or: [
        { telegramUserId: { $in: [teamTelegramId] } },
        { telegramUsername: { $in: ['alice_dev'] } },
      ],
    });
    await Inquiry.deleteMany({
      $or: [
        { telegramUserId: { $in: [publicUser1TelegramId, publicUser2TelegramId] } },
        { telegramUsername: { $in: ['john_lead', 'sarah_lead'] } },
      ],
    });

    // 1. Create active CRM Client
    existingClient = await Client.create({
      clientCode: `INQ_CLI_${Date.now()}`,
      name: 'Existing Client Acme',
      email: `acme_client_${Date.now()}@example.com`,
      telegramUserId: clientTelegramId,
      telegramChatId: clientTelegramId,
      telegramUsername: 'acme_client',
      telegramConnected: true,
      onboardingDate: new Date(),
      status: 'ACTIVE',
    });

    // 2. Create active CRM Team Member
    existingTeamMember = await TeamMember.create({
      name: 'Existing Dev Alice',
      email: `alice_dev_${Date.now()}@example.com`,
      role: 'DEVELOPER',
      telegramUserId: teamTelegramId,
      telegramChatId: teamTelegramId,
      telegramUsername: 'alice_dev',
      status: 'ACTIVE',
      permissions: ['VIEW_TASKS', 'MANAGE_TASKS'],
    });
  }, 25000);

  afterAll(async () => {
    await Client.deleteMany({
      $or: [
        { telegramUserId: { $in: [clientTelegramId, publicUser1TelegramId, publicUser2TelegramId] } },
        { telegramUsername: { $in: ['john_lead', 'sarah_lead', 'acme_client', 'alice_dev'] } },
      ],
    });
    await TeamMember.deleteMany({
      $or: [
        { telegramUserId: { $in: [teamTelegramId] } },
        { telegramUsername: { $in: ['alice_dev'] } },
      ],
    });
    await Inquiry.deleteMany({
      $or: [
        { telegramUserId: { $in: [publicUser1TelegramId, publicUser2TelegramId] } },
        { telegramUsername: { $in: ['john_lead', 'sarah_lead'] } },
      ],
    });
  }, 25000);

  // TEST 1: Existing Client sends /myprofile -> routes to Client Router, NOT inquiry
  it('TEST 1: Existing Client sends /myprofile -> routes to Client Router, NOT inquiry', async () => {
    const update = {
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        chat: { id: Number(clientTelegramId) },
        from: { id: Number(clientTelegramId), username: 'acme_client' },
        text: '/myprofile',
      },
    };

    const res = await TelegramService.handleWebhookUpdate(update);
    expect(res?.command).toBe('/myprofile');

    // Confirm no inquiry was created for existing client
    const inq = await Inquiry.findOne({ telegramUserId: clientTelegramId });
    expect(inq).toBeNull();
  });

  // TEST 2: Existing Team Member sends /tasks -> routes to Team Router, NOT inquiry
  it('TEST 2: Existing Team Member sends /tasks -> routes to Team Router, NOT inquiry', async () => {
    const update = {
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        chat: { id: Number(teamTelegramId) },
        from: { id: Number(teamTelegramId), username: 'alice_dev' },
        text: '/tasks',
      },
    };

    const res = await TelegramService.handleWebhookUpdate(update);
    expect(res?.command).toBe('/tasks');

    // Confirm no inquiry was created for existing team member
    const inq = await Inquiry.findOne({ telegramUserId: teamTelegramId });
    expect(inq).toBeNull();
  });

  // TEST 3: Admin sends existing admin command -> routes to Admin Router, NOT inquiry
  it('TEST 3: Admin sends /help -> routes to Admin Router, NOT inquiry', async () => {
    const update = {
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        chat: { id: Number(adminTelegramId) },
        from: { id: Number(adminTelegramId), username: 'admin_user' },
        text: '/help',
      },
    };

    const res = await TelegramService.handleWebhookUpdate(update);
    expect(res?.command).toBe('/help');

    const inq = await Inquiry.findOne({ telegramUserId: adminTelegramId });
    expect(inq).toBeNull();
  });

  // TEST 4: Unknown Telegram user sends /start -> Public Inquiry welcome & keyboard
  it('TEST 4: Completely unknown Telegram user sends /start -> receives Public Inquiry welcome', async () => {
    const update = {
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        chat: { id: Number(publicUser1TelegramId) },
        from: { id: Number(publicUser1TelegramId), username: 'john_lead', first_name: 'John', last_name: 'Doe' },
        text: '/start',
      },
    };

    const res = await TelegramService.handleWebhookUpdate(update);
    expect(res?.command).toBe('/start');
    expect(res?.inquiryMode).toBe('BOT');

    const inq = await Inquiry.findOne({ telegramUserId: publicUser1TelegramId });
    expect(inq).not.toBeNull();
    expect(inq?.inquiryNumber).toMatch(/^INQ-\d{4}-\d{4}$/);
    expect(inq?.conversationMode).toBe('BOT');
    expect(inq?.status).toBe('NEW');

    // Verify audit log
    const log = await AuditLog.findOne({
      action: 'INQUIRY_CREATED',
      entityId: inq!._id.toString(),
    });
    expect(log).not.toBeNull();
  });

  // TEST 5: Unknown user asks simple question -> Bot gives general info, NO CRM client created
  it('TEST 5: Unknown user asks "Do you build websites?" -> Bot provides FAQ answer without creating Client', async () => {
    const update = {
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        chat: { id: Number(publicUser1TelegramId) },
        from: { id: Number(publicUser1TelegramId), username: 'john_lead', first_name: 'John' },
        text: 'Do you build websites?',
      },
    };

    const res = await TelegramService.handleWebhookUpdate(update);
    expect(res?.inquiryMode).toBe('BOT');

    const inq = await Inquiry.findOne({ telegramUserId: publicUser1TelegramId });
    expect(inq?.conversationMode).toBe('BOT');
    expect(inq?.messages.some(m => m.sender === 'BOT' && m.text.includes('Website Development'))).toBe(true);

    // Confirm NO Client record was created
    const clientCheck = await Client.findOne({ telegramUserId: publicUser1TelegramId });
    expect(clientCheck).toBeNull();
  });

  // TEST 6: Unknown user sends complex request -> Human Handoff triggered
  it('TEST 6: Unknown user asks for custom ERP with GST -> triggers Human Handoff', async () => {
    const update = {
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        chat: { id: Number(publicUser1TelegramId) },
        from: { id: Number(publicUser1TelegramId), username: 'john_lead', first_name: 'John' },
        text: 'I need a custom ERP with GST, inventory, vendor management and accounting.',
      },
    };

    const res = await TelegramService.handleWebhookUpdate(update);
    expect(res?.inquiryMode).toBe('HUMAN');

    const inq = await Inquiry.findOne({ telegramUserId: publicUser1TelegramId });
    expect(inq?.conversationMode).toBe('HUMAN');
    expect(inq?.status).toBe('HUMAN_HANDOFF');
    expect(inq?.handoffReason).toBeDefined();

    // Verify audit log
    const handoffLog = await AuditLog.findOne({
      action: 'INQUIRY_HANDOFF',
      entityId: inq!._id.toString(),
    });
    expect(handoffLog).not.toBeNull();
  });

  // TEST 7: Unknown user clicks "👨‍💻 Talk to Human" -> triggers Human Handoff immediately
  it('TEST 7: Unknown user clicks "👨‍💻 Talk to Human" -> triggers Human Handoff', async () => {
    const update = {
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        chat: { id: Number(publicUser2TelegramId) },
        from: { id: Number(publicUser2TelegramId), username: 'sarah_lead', first_name: 'Sarah' },
        text: '👨‍💻 Talk to Human',
      },
    };

    const res = await TelegramService.handleWebhookUpdate(update);
    expect(res?.inquiryMode).toBe('HUMAN');

    const inq = await Inquiry.findOne({ telegramUserId: publicUser2TelegramId });
    expect(inq?.conversationMode).toBe('HUMAN');
    expect(inq?.status).toBe('HUMAN_HANDOFF');
  });

  // TEST 8: Critical Rule: When in HUMAN mode, client sends new message -> stored, NO bot response generated
  it('TEST 8: In HUMAN mode, client sends another message -> stored, forwarded to Admin, NO bot response', async () => {
    const inqBefore = await Inquiry.findOne({ telegramUserId: publicUser1TelegramId });
    const botMessagesCountBefore = inqBefore!.messages.filter(m => m.sender === 'BOT').length;

    const update = {
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        chat: { id: Number(publicUser1TelegramId) },
        from: { id: Number(publicUser1TelegramId), username: 'john_lead' },
        text: 'I also need mobile app integration for delivery drivers.',
      },
    };

    const res = await TelegramService.handleWebhookUpdate(update);
    expect(res?.inquiryMode).toBe('HUMAN');

    const inqAfter = await Inquiry.findOne({ telegramUserId: publicUser1TelegramId });
    const botMessagesCountAfter = inqAfter!.messages.filter(m => m.sender === 'BOT').length;

    // Verify NO new bot message was added
    expect(botMessagesCountAfter).toBe(botMessagesCountBefore);

    // Verify client message was saved
    const lastMsg = inqAfter!.messages[inqAfter!.messages.length - 1];
    expect(lastMsg.sender).toBe('CLIENT');
    expect(lastMsg.text).toBe('I also need mobile app integration for delivery drivers.');

    // Verify audit log
    const clientMsgLog = await AuditLog.findOne({
      action: 'INQUIRY_CLIENT_MESSAGE',
      entityId: inqAfter!._id.toString(),
    });
    expect(clientMsgLog).not.toBeNull();
  });

  // TEST 9: Admin replies from CRM -> delivers Telegram message to lead
  it('TEST 9: Admin replies from CRM Dashboard -> delivers Telegram message to lead', async () => {
    const inq = await Inquiry.findOne({ telegramUserId: publicUser1TelegramId });

    const updated = await InquiryService.sendAdminReply(
      inq!._id.toString(),
      'admin@drdebuggers.com',
      'Administrator Vishnu',
      'Sure John, how many delivery drivers do you have?'
    );

    expect(updated.status).toBe('OPEN');
    const adminMsg = updated.messages.find(m => m.sender === 'ADMIN');
    expect(adminMsg).toBeDefined();
    expect(adminMsg?.text).toBe('Sure John, how many delivery drivers do you have?');

    // Verify audit log
    const adminMsgLog = await AuditLog.findOne({
      action: 'INQUIRY_ADMIN_MESSAGE',
      entityId: inq!._id.toString(),
    });
    expect(adminMsgLog).not.toBeNull();
  });

  // TEST 10: Admin returns inquiry to Bot mode -> bot resumes automated responses
  it('TEST 10: Admin returns inquiry to Bot mode -> bot resumes automated responses', async () => {
    const inq = await Inquiry.findOne({ telegramUserId: publicUser1TelegramId });

    await InquiryService.returnToBot(inq!._id.toString(), 'admin@drdebuggers.com');

    const inqCheck = await Inquiry.findById(inq!._id);
    expect(inqCheck?.conversationMode).toBe('BOT');

    // Verify audit log
    const resumedLog = await AuditLog.findOne({
      action: 'INQUIRY_BOT_RESUMED',
      entityId: inq!._id.toString(),
    });
    expect(resumedLog).not.toBeNull();

    // Now client sends simple question and receives bot response again
    const update = {
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        chat: { id: Number(publicUser1TelegramId) },
        from: { id: Number(publicUser1TelegramId), username: 'john_lead' },
        text: 'Do you offer SEO optimization?',
      },
    };

    const res = await TelegramService.handleWebhookUpdate(update);
    expect(res?.inquiryMode).toBe('BOT');

    const inqAfter = await Inquiry.findById(inq!._id);
    const lastBotMsg = inqAfter!.messages[inqAfter!.messages.length - 1];
    expect(lastBotMsg.sender).toBe('BOT');
    expect(lastBotMsg.text).toContain('Search Engine Optimization');
  });

  // TEST 11: Admin converts inquiry to Client -> Client created, linked, future messages route to Client Router
  it('TEST 11: Admin converts inquiry to Client -> Creates Client and subsequent messages route to Client Router', async () => {
    const inq = await Inquiry.findOne({ telegramUserId: publicUser1TelegramId });

    const result = await InquiryService.convertToClient(
      inq!._id.toString(),
      'admin@drdebuggers.com',
      {
        name: 'John Doe Enterprise',
        email: `john_converted_${Date.now()}@example.com`,
        phone: '+91 9876543210',
        company: 'Doe Enterprises',
      }
    );

    expect(result.client).toBeDefined();
    expect(result.client.clientCode).toMatch(/^CL-/);
    expect(result.client.telegramConnected).toBe(true);
    expect(result.client.telegramUserId).toBe(publicUser1TelegramId);
    expect(result.inquiry.status).toBe('CLOSED');
    expect(result.inquiry.conversationMode).toBe('CLOSED');

    // Verify audit log
    const convertLog = await AuditLog.findOne({
      action: 'INQUIRY_CONVERTED_TO_CLIENT',
      entityId: inq!._id.toString(),
    });
    expect(convertLog).not.toBeNull();

    // Future message from this Telegram user MUST now route to Client Router (NOT inquiry!)
    const update = {
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        chat: { id: Number(publicUser1TelegramId) },
        from: { id: Number(publicUser1TelegramId), username: 'john_lead' },
        text: '/myprofile',
      },
    };

    const res = await TelegramService.handleWebhookUpdate(update);
    expect(res?.command).toBe('/myprofile');

    // Cleanup created client
    await Client.deleteOne({ _id: result.client._id });
  });

  // TEST 12: New message after inquiry closed creates a fresh inquiry session
  it('TEST 12: Sending a message after past inquiry is closed creates a new fresh active inquiry', async () => {
    // Sarah's inquiry is currently HUMAN_HANDOFF. Admin closes it.
    const sarahInq = await Inquiry.findOne({ telegramUserId: publicUser2TelegramId });
    await InquiryService.closeInquiry(sarahInq!._id.toString(), 'admin@drdebuggers.com', 'Done discussing.');

    const closedCheck = await Inquiry.findById(sarahInq!._id);
    expect(closedCheck?.status).toBe('CLOSED');

    // Sarah sends new message
    const update = {
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        chat: { id: Number(publicUser2TelegramId) },
        from: { id: Number(publicUser2TelegramId), username: 'sarah_lead', first_name: 'Sarah' },
        text: 'Hi, I have a new question about mobile apps.',
      },
    };

    const res = await TelegramService.handleWebhookUpdate(update);
    expect(res?.inquiryMode).toBe('BOT');

    // Verify a NEW inquiry was created
    const activeInquiries = await Inquiry.find({
      telegramUserId: publicUser2TelegramId,
      status: { $ne: 'CLOSED' },
    });
    expect(activeInquiries.length).toBe(1);
    expect(activeInquiries[0]._id.toString()).not.toBe(sarahInq!._id.toString());
  });

  // TEST 13: Admin sends media attachment (e.g. PDF document / image)
  it('TEST 13: Admin sends media attachment from CRM Dashboard to inquiry lead', async () => {
    const activeInq = await Inquiry.findOne({
      telegramUserId: publicUser2TelegramId,
      status: { $ne: 'CLOSED' },
    });
    expect(activeInq).toBeDefined();

    const sampleBuffer = Buffer.from('PDF_SAMPLE_TEST_CONTENT');
    const updated = await InquiryService.sendAdminReply(
      activeInq!._id.toString(),
      'admin@drdebuggers.com',
      'Admin Vishnu',
      'Here is the project proposal document.',
      {
        buffer: sampleBuffer,
        fileName: 'proposal.pdf',
        mimeType: 'application/pdf',
        size: sampleBuffer.length,
      }
    );

    expect(updated).toBeDefined();
    const lastMsg = updated.messages[updated.messages.length - 1];
    expect(lastMsg.sender).toBe('ADMIN');
    expect(lastMsg.text).toBe('Here is the project proposal document.');
    expect(lastMsg.attachments).toBeDefined();
    expect(lastMsg.attachments?.length).toBe(1);
    expect(lastMsg.attachments![0].fileName).toBe('proposal.pdf');
    expect(lastMsg.attachments![0].type).toBe('DOCUMENT');
    expect(lastMsg.attachments![0].mimeType).toBe('application/pdf');
  });

  // TEST 14: Client in HUMAN mode sends photo/document attachment
  it('TEST 14: Client in HUMAN mode sends photo/document attachment -> stored in messages', async () => {
    const activeInq = await Inquiry.findOne({
      telegramUserId: publicUser2TelegramId,
      status: { $ne: 'CLOSED' },
    });
    activeInq!.conversationMode = 'HUMAN';
    await activeInq!.save();

    const update = {
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        chat: { id: Number(publicUser2TelegramId) },
        from: { id: Number(publicUser2TelegramId), username: 'sarah_lead', first_name: 'Sarah' },
        caption: 'Look at this design screenshot',
        photo: [
          { file_id: 'photo_thumb_123', file_size: 1024 },
          { file_id: 'photo_highres_456', file_size: 8192 },
        ],
      },
    };

    const res = await TelegramService.handleWebhookUpdate(update);
    expect(res?.inquiryMode).toBe('HUMAN');

    const refreshed = await Inquiry.findById(activeInq!._id);
    const lastMsg = refreshed!.messages[refreshed!.messages.length - 1];
    expect(lastMsg.sender).toBe('CLIENT');
    expect(lastMsg.text).toBe('Look at this design screenshot');
    expect(lastMsg.attachments?.length).toBe(1);
    expect(lastMsg.attachments![0].type).toBe('IMAGE');
    expect(lastMsg.attachments![0].telegramFileId).toBe('photo_highres_456');
  });

  // TEST 15: File size validation (>20MB)
  it('TEST 15: File size validation rejects files exceeding 20MB', async () => {
    const activeInq = await Inquiry.findOne({
      telegramUserId: publicUser2TelegramId,
      status: { $ne: 'CLOSED' },
    });

    const fakeLargeBuffer = Buffer.alloc(10); // Small allocation for test, simulated size
    await expect(
      InquiryService.sendAdminReply(
        activeInq!._id.toString(),
        'admin@drdebuggers.com',
        'Admin Vishnu',
        'Large file test',
        {
          buffer: fakeLargeBuffer,
          fileName: 'massive_video.mp4',
          mimeType: 'video/mp4',
          size: 25 * 1024 * 1024, // 25 MB
        }
      )
    ).rejects.toThrow('File is too large');
  });
});
