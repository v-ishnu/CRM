import { dbConnect } from '@/lib/db/connect';
import Inquiry, { IInquiry } from '@/models/Inquiry';
import Client from '@/models/Client';
import { TelegramService } from '@/services/telegram.service';
import { AuditService } from '@/services/audit.service';
import { ClientService } from '@/services/client.service';

export class InquiryService {
  /**
   * Get public inquiry reply keyboard
   */
  static getPublicReplyKeyboard() {
    return {
      keyboard: [
        [{ text: '🌐 Web Development' }, { text: '📱 App Development' }],
        [{ text: '🔍 SEO' }, { text: '✍️ Content' }],
        [{ text: '🤖 AI & Automation' }, { text: '☁️ Cloud / VPS' }],
        [{ text: '👨‍💻 Talk to Human' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    };
  }

  /**
   * Find active (non-closed) inquiry or create a new one
   */
  static async findOrCreateActiveInquiry(
    telegramUserId: string,
    metadata: {
      telegramUsername?: string;
      telegramChatId: string;
      name?: string;
      initialMessage?: string;
    }
  ): Promise<IInquiry> {
    await dbConnect();

    let inquiry = await Inquiry.findOne({
      telegramUserId: String(telegramUserId),
      status: { $ne: 'CLOSED' },
    });

    if (!inquiry) {
      const inquiryNumber = await (Inquiry as any).generateInquiryNumber();
      inquiry = await Inquiry.create({
        inquiryNumber,
        telegramUserId: String(telegramUserId),
        telegramUsername: metadata.telegramUsername,
        telegramChatId: String(metadata.telegramChatId),
        name: metadata.name,
        message: metadata.initialMessage,
        conversationMode: 'BOT',
        status: 'NEW',
        lastMessageAt: new Date(),
        messages: metadata.initialMessage
          ? [
              {
                sender: 'CLIENT',
                text: metadata.initialMessage,
                timestamp: new Date(),
              },
            ]
          : [],
      });

      await AuditService.logAction(
        metadata.telegramUsername || telegramUserId,
        'INQUIRY_CREATED',
        'Inquiry',
        inquiry._id.toString(),
        {
          inquiryNumber,
          telegramUserId,
          telegramUsername: metadata.telegramUsername,
          name: metadata.name,
        }
      );
    } else {
      // Update metadata if changed
      let changed = false;
      if (metadata.telegramUsername && inquiry.telegramUsername !== metadata.telegramUsername) {
        inquiry.telegramUsername = metadata.telegramUsername;
        changed = true;
      }
      if (metadata.name && !inquiry.name) {
        inquiry.name = metadata.name;
        changed = true;
      }
      if (changed) {
        await inquiry.save();
      }
    }

    return inquiry;
  }

  /**
   * Check whether an incoming public message requests human handoff or contains complex project/sales requirements
   */
  static isHumanHandoffRequired(text: string): { required: boolean; reason?: string } {
    const raw = (text || '').trim().toLowerCase();

    // 1. Explicit human request
    if (
      raw.includes('talk to human') ||
      raw.includes('talk to developer') ||
      raw.includes('talk to someone') ||
      raw.includes('human') ||
      raw.includes('sales') ||
      raw.includes('call me') ||
      raw.includes('phone') ||
      raw.includes('speak to agent') ||
      raw.includes('customer support')
    ) {
      return { required: true, reason: 'User explicitly requested human assistance.' };
    }

    // 2. Pricing, quotation, and discounts
    if (
      raw.includes('quotation') ||
      raw.includes('quote') ||
      raw.includes('final price') ||
      raw.includes('pricing') ||
      raw.includes('exact cost') ||
      raw.includes('how much will') ||
      raw.includes('how much for') ||
      raw.includes('discount') ||
      raw.includes('negotiat')
    ) {
      return { required: true, reason: 'Pricing, quotation, or discount discussion.' };
    }

    // 3. Complex custom software / architecture / enterprise specs
    if (
      raw.includes('e-commerce') ||
      raw.includes('ecommerce') ||
      raw.includes('erp') ||
      raw.includes('gst') ||
      raw.includes('inventory') ||
      raw.includes('accounting') ||
      raw.includes('vendor management') ||
      raw.includes('multi-vendor') ||
      raw.includes('api integration') ||
      raw.includes('custom platform') ||
      raw.includes('crm development')
    ) {
      return { required: true, reason: 'Complex business requirements or custom architecture.' };
    }

    return { required: false };
  }

  /**
   * Handle an incoming message from an unlinked public Telegram user
   */
  static async handlePublicMessage(
    telegramUserId: string,
    chatId: string,
    username: string,
    name: string,
    text: string,
    messageType: 'text' | 'photo' | 'document' = 'text'
  ): Promise<{ responseSent: boolean; mode: string }> {
    await dbConnect();

    const trimmedText = text.trim();
    const isStartCommand = trimmedText === '/start' || trimmedText.startsWith('/start ');

    const inquiry = await this.findOrCreateActiveInquiry(telegramUserId, {
      telegramUsername: username,
      telegramChatId: chatId,
      name,
      initialMessage: isStartCommand ? undefined : trimmedText,
    });

    // =========================================================================
    // CRITICAL RULE: When conversationMode is HUMAN, NEVER call bot AI handler.
    // Store message, notify admin, and do NOT send automated response.
    // =========================================================================
    if (inquiry.conversationMode === 'HUMAN') {
      inquiry.messages.push({
        sender: 'CLIENT',
        text: trimmedText || `[Sent ${messageType}]`,
        timestamp: new Date(),
      });
      inquiry.lastMessageAt = new Date();
      await inquiry.save();

      await AuditService.logAction(
        username || telegramUserId,
        'INQUIRY_CLIENT_MESSAGE',
        'Inquiry',
        inquiry._id.toString(),
        {
          inquiryNumber: inquiry.inquiryNumber,
          telegramUserId,
          messageType,
        }
      );

      // Notify Admin of lead message
      const adminChatId = process.env.ADMIN_TELEGRAM_ID;
      if (adminChatId) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://telegram.vishnucode.com';
        await TelegramService.sendMessageRaw(
          adminChatId,
          `💬 <b>New Message from Lead</b> (<code>${inquiry.inquiryNumber}</code>)\n\n` +
          `<b>Lead:</b> ${inquiry.name || 'Anonymous'} (@${username || 'N/A'})\n` +
          `<b>Telegram ID:</b> <code>${telegramUserId}</code>\n\n` +
          `<i>"${trimmedText || `[Sent ${messageType}]`}"</i>`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '💬 Open in CRM', url: `${appUrl}/dashboard/inquiries/${inquiry._id}` },
                  { text: '❌ Close', callback_data: `inq:close:${inquiry._id}` },
                ],
              ],
            },
          }
        );
      }

      return { responseSent: false, mode: 'HUMAN' };
    }

    // =========================================================================
    // In BOT Mode:
    // =========================================================================
    if (isStartCommand) {
      const welcomeText =
        `👋 <b>Welcome to Dr Debuggers!</b>\n\n` +
        `I can help you with general information about our services.\n\n` +
        `<b>What are you looking for?</b>\n\n` +
        `Examples:\n` +
        `🌐 Website Development\n` +
        `📱 Mobile App Development\n` +
        `🔍 SEO\n` +
        `✍️ Content\n` +
        `🤖 AI / Automation\n` +
        `☁️ Cloud / VPS\n` +
        `💻 Custom Software\n\n` +
        `You can also describe your requirement directly.`;

      inquiry.messages.push({
        sender: 'BOT',
        text: welcomeText,
        timestamp: new Date(),
      });
      inquiry.lastMessageAt = new Date();
      await inquiry.save();

      await TelegramService.sendMessageRaw(chatId, welcomeText, {
        reply_markup: this.getPublicReplyKeyboard(),
      });

      return { responseSent: true, mode: 'BOT' };
    }

    // Record incoming client message
    inquiry.messages.push({
      sender: 'CLIENT',
      text: trimmedText || `[Sent ${messageType}]`,
      timestamp: new Date(),
    });

    // Check if human handoff is required
    const handoffCheck = this.isHumanHandoffRequired(trimmedText);

    if (handoffCheck.required) {
      inquiry.conversationMode = 'HUMAN';
      inquiry.status = 'HUMAN_HANDOFF';
      inquiry.handoffReason = handoffCheck.reason;

      const handoffMessage =
        `👨‍💻 <b>Connecting You With Our Team</b>\n\n` +
        `Your requirement needs to be discussed with our team.\n\n` +
        `I've forwarded your inquiry to an administrator.\n\n` +
        `<b>Inquiry ID:</b>\n<code>${inquiry.inquiryNumber}</code>\n\n` +
        `Please continue sending your requirements here.\n\n` +
        `A team member will respond shortly.`;

      inquiry.messages.push({
        sender: 'SYSTEM',
        text: `Human handoff triggered: ${handoffCheck.reason}`,
        timestamp: new Date(),
      });
      inquiry.messages.push({
        sender: 'BOT',
        text: handoffMessage,
        timestamp: new Date(),
      });
      inquiry.lastMessageAt = new Date();
      await inquiry.save();

      await AuditService.logAction(
        username || telegramUserId,
        'INQUIRY_HANDOFF',
        'Inquiry',
        inquiry._id.toString(),
        {
          inquiryNumber: inquiry.inquiryNumber,
          telegramUserId,
          reason: handoffCheck.reason,
        }
      );

      // Send handoff notice to public user
      await TelegramService.sendMessageRaw(chatId, handoffMessage, {
        reply_markup: this.getPublicReplyKeyboard(),
      });

      // Notify admin immediately
      const adminChatId = process.env.ADMIN_TELEGRAM_ID;
      if (adminChatId) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://telegram.vishnucode.com';
        const adminNotification =
          `🚨 <b>New Website Inquiry</b>\n\n` +
          `<b>Inquiry:</b> <code>${inquiry.inquiryNumber}</code>\n` +
          `<b>Telegram User:</b> @${username || 'N/A'}\n` +
          `<b>Telegram ID:</b> <code>${telegramUserId}</code>\n` +
          (name ? `<b>Name:</b> ${name}\n` : '') +
          `\n<b>Requirement:</b>\n` +
          `<i>"${trimmedText}"</i>\n\n` +
          `<b>Status:</b> 🟠 HUMAN HANDOFF`;

        await TelegramService.sendMessageRaw(adminChatId, adminNotification, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💬 Open Inquiry', url: `${appUrl}/dashboard/inquiries/${inquiry._id}` },
                { text: '👤 Take Inquiry', callback_data: `inq:take:${inquiry._id}` },
              ],
              [
                { text: '❌ Close Inquiry', callback_data: `inq:close:${inquiry._id}` },
              ],
            ],
          },
        });
      }

      return { responseSent: true, mode: 'HUMAN' };
    }

    // Informational Bot Answers for General Questions
    const botResponse = this.generateBotAnswer(trimmedText);

    inquiry.messages.push({
      sender: 'BOT',
      text: botResponse,
      timestamp: new Date(),
    });
    inquiry.lastMessageAt = new Date();
    await inquiry.save();

    await TelegramService.sendMessageRaw(chatId, botResponse, {
      reply_markup: this.getPublicReplyKeyboard(),
    });

    return { responseSent: true, mode: 'BOT' };
  }

  /**
   * Generate simple informational responses for FAQ / general questions
   */
  private static generateBotAnswer(text: string): string {
    const raw = text.toLowerCase();

    if (raw.includes('website') || raw.includes('web development') || raw.includes('web design')) {
      if (raw.includes('how long') || raw.includes('time') || raw.includes('duration')) {
        return '⏱️ <b>Website Timelines:</b>\nA typical business website may take around 1–3 weeks depending on features and scope.';
      }
      return '🌐 <b>Website Development:</b>\nYes! We build high-performance business websites, web applications, landing pages, and responsive portals using Next.js, React, Node.js, and modern tech stacks.';
    }

    if (raw.includes('app') || raw.includes('mobile') || raw.includes('android') || raw.includes('ios')) {
      return '📱 <b>Mobile App Development:</b>\nWe engineer native and cross-platform mobile apps for iOS and Android using React Native, Flutter, and scalable cloud backends.';
    }

    if (raw.includes('seo') || raw.includes('search engine')) {
      return '🔍 <b>Search Engine Optimization (SEO):</b>\nWe provide technical SEO, on-page optimization, content strategy, speed optimization, and search rankings improvement for websites.';
    }

    if (raw.includes('content') || raw.includes('copywriting')) {
      return '✍️ <b>Content Writing:</b>\nWe offer professional technical copywriting, landing page messaging, SEO blog articles, and documentation.';
    }

    if (raw.includes('ai') || raw.includes('automation') || raw.includes('bot')) {
      return '🤖 <b>AI & Automation:</b>\nWe build custom Telegram bots, workflow automations, AI integrations with LLMs, and business process automation.';
    }

    if (raw.includes('cloud') || raw.includes('vps') || raw.includes('hosting') || raw.includes('server')) {
      return '☁️ <b>Cloud / VPS Infrastructure:</b>\nWe setup, manage, and optimize cloud infrastructure on AWS, Google Cloud, DigitalOcean, VPS servers, and database configurations.';
    }

    return '👋 <b>Dr. Debuggers Services:</b>\n\nWe provide full-stack software development, web applications, mobile apps, Telegram bots, and cloud infrastructure.\n\nFeel free to describe your requirement or click <b>👨‍💻 Talk to Human</b> to speak with our team.';
  }

  /**
   * Admin sends reply to lead from the CRM Dashboard
   */
  static async sendAdminReply(
    inquiryId: string,
    adminEmail: string,
    adminName: string,
    messageText: string
  ): Promise<IInquiry> {
    await dbConnect();

    const inquiry = await Inquiry.findById(inquiryId);
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }

    const trimmed = messageText.trim();
    if (!trimmed) {
      throw new Error('Message text cannot be empty');
    }

    inquiry.messages.push({
      sender: 'ADMIN',
      text: trimmed,
      timestamp: new Date(),
      adminEmail,
      adminName,
    });

    if (inquiry.status === 'NEW' || inquiry.status === 'HUMAN_HANDOFF') {
      inquiry.status = 'OPEN';
    }
    inquiry.lastMessageAt = new Date();
    await inquiry.save();

    // Deliver reply to client via Telegram
    const telegramMessage = `👨‍💻 <b>Dr. Debuggers Team:</b>\n\n${trimmed}`;
    await TelegramService.sendMessageRaw(inquiry.telegramChatId, telegramMessage);

    await AuditService.logAction(
      adminEmail,
      'INQUIRY_ADMIN_MESSAGE',
      'Inquiry',
      inquiry._id.toString(),
      {
        inquiryNumber: inquiry.inquiryNumber,
        telegramUserId: inquiry.telegramUserId,
        adminName,
      }
    );

    return inquiry;
  }

  /**
   * Assign inquiry to an admin
   */
  static async takeInquiry(
    inquiryId: string,
    adminId: string,
    adminName: string,
    adminEmail: string
  ): Promise<IInquiry> {
    await dbConnect();

    const inquiry = await Inquiry.findById(inquiryId);
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }

    inquiry.assignedAdminId = adminId as any;
    inquiry.assignedAdminName = adminName;
    if (inquiry.status === 'NEW' || inquiry.status === 'HUMAN_HANDOFF') {
      inquiry.status = 'OPEN';
    }
    inquiry.messages.push({
      sender: 'SYSTEM',
      text: `Inquiry assigned to ${adminName}.`,
      timestamp: new Date(),
      adminEmail,
      adminName,
    });
    await inquiry.save();

    await AuditService.logAction(
      adminEmail,
      'INQUIRY_ASSIGNED',
      'Inquiry',
      inquiry._id.toString(),
      {
        inquiryNumber: inquiry.inquiryNumber,
        assignedAdminId: adminId,
        assignedAdminName: adminName,
      }
    );

    return inquiry;
  }

  /**
   * Return inquiry to automated BOT mode
   */
  static async returnToBot(inquiryId: string, actor: string = 'admin'): Promise<IInquiry> {
    await dbConnect();

    const inquiry = await Inquiry.findById(inquiryId);
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }

    inquiry.conversationMode = 'BOT';
    if (inquiry.status === 'HUMAN_HANDOFF') {
      inquiry.status = 'OPEN';
    }
    inquiry.messages.push({
      sender: 'SYSTEM',
      text: 'Conversation returned to Automated Bot mode.',
      timestamp: new Date(),
      adminEmail: actor,
    });
    await inquiry.save();

    // Send Telegram notice to client
    await TelegramService.sendMessageRaw(
      inquiry.telegramChatId,
      `🤖 <b>Automated Assistant Resumed</b>\n\nHow else can we help you today?`,
      { reply_markup: this.getPublicReplyKeyboard() }
    );

    await AuditService.logAction(
      actor,
      'INQUIRY_BOT_RESUMED',
      'Inquiry',
      inquiry._id.toString(),
      {
        inquiryNumber: inquiry.inquiryNumber,
        telegramUserId: inquiry.telegramUserId,
      }
    );

    return inquiry;
  }

  /**
   * Close inquiry
   */
  static async closeInquiry(
    inquiryId: string,
    actor: string = 'admin',
    closingNote?: string
  ): Promise<IInquiry> {
    await dbConnect();

    const inquiry = await Inquiry.findById(inquiryId);
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }

    inquiry.status = 'CLOSED';
    inquiry.conversationMode = 'CLOSED';
    inquiry.messages.push({
      sender: 'SYSTEM',
      text: closingNote || 'Inquiry closed by administrator.',
      timestamp: new Date(),
      adminEmail: actor,
    });
    await inquiry.save();

    // Send closing message to client
    await TelegramService.sendMessageRaw(
      inquiry.telegramChatId,
      `Thank you for contacting Dr Debuggers. If you need anything else, feel free to message us again.`
    );

    await AuditService.logAction(
      actor,
      'INQUIRY_CLOSED',
      'Inquiry',
      inquiry._id.toString(),
      {
        inquiryNumber: inquiry.inquiryNumber,
        telegramUserId: inquiry.telegramUserId,
        closingNote,
      }
    );

    return inquiry;
  }

  /**
   * Convert Inquiry to CRM Client
   */
  static async convertToClient(
    inquiryId: string,
    actor: string = 'admin',
    clientData: {
      name: string;
      email: string;
      phone?: string;
      company?: string;
      notes?: string;
    }
  ): Promise<{ inquiry: IInquiry; client: any }> {
    await dbConnect();

    const inquiry = await Inquiry.findById(inquiryId);
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }

    // Check if client with this Telegram ID or Email already exists
    let existingClient = await Client.findOne({
      $or: [
        { telegramUserId: inquiry.telegramUserId },
        { email: clientData.email.toLowerCase().trim() },
      ],
    });

    let client: any;
    if (existingClient) {
      existingClient.telegramConnected = true;
      existingClient.telegramUserId = inquiry.telegramUserId;
      existingClient.telegramUsername = inquiry.telegramUsername;
      existingClient.telegramChatId = inquiry.telegramChatId;
      if (clientData.name) existingClient.name = clientData.name;
      if (clientData.phone) existingClient.phone = clientData.phone;
      if (clientData.company) existingClient.company = clientData.company;
      await existingClient.save();
      client = existingClient;
    } else {
      // Create new client via ClientService
      client = await ClientService.createClient(
        {
          name: clientData.name || inquiry.name || 'New Client',
          email: clientData.email.toLowerCase().trim(),
          phone: clientData.phone,
          company: clientData.company,
          notes: clientData.notes || `Converted from Inquiry ${inquiry.inquiryNumber}`,
        },
        actor
      );

      // Link Telegram account
      client.telegramConnected = true;
      client.telegramUserId = inquiry.telegramUserId;
      client.telegramUsername = inquiry.telegramUsername;
      client.telegramChatId = inquiry.telegramChatId;
      await client.save();
    }

    // Close inquiry & mark converted
    inquiry.convertedToClientId = client._id;
    inquiry.status = 'CLOSED';
    inquiry.conversationMode = 'CLOSED';
    inquiry.messages.push({
      sender: 'SYSTEM',
      text: `Converted to CRM Client: ${client.name} (${client.clientCode}).`,
      timestamp: new Date(),
      adminEmail: actor,
    });
    await inquiry.save();

    // Sync client chat commands
    await TelegramService.syncChatCommands(inquiry.telegramChatId, 'CLIENT', true);

    // Notify client of CRM conversion
    await TelegramService.sendMessageRaw(
      inquiry.telegramChatId,
      `🎉 <b>Welcome to Dr Debuggers Client Portal!</b>\n\n` +
      `Your account has been set up with client code <b>${client.clientCode}</b>.\n\n` +
      `You can now use:\n` +
      `/myprofile - View Profile\n` +
      `/myproject - View Project Details\n` +
      `/payments - View Payment Logs\n` +
      `/invoices - View Billing History\n` +
      `/status - Check Development Progress`,
      { reply_markup: TelegramService.getClientReplyKeyboard() }
    );

    await AuditService.logAction(
      actor,
      'INQUIRY_CONVERTED_TO_CLIENT',
      'Inquiry',
      inquiry._id.toString(),
      {
        inquiryNumber: inquiry.inquiryNumber,
        clientId: client._id.toString(),
        clientCode: client.clientCode,
        telegramUserId: inquiry.telegramUserId,
      }
    );

    return { inquiry, client };
  }
}
