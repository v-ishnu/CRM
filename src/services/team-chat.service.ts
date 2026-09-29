import mongoose from 'mongoose';
import TeamMember from '@/models/TeamMember';
import TeamMemberConversation, { ITeamMemberConversation } from '@/models/TeamMemberConversation';
import TeamMemberMessage, { ITeamMemberMessage } from '@/models/TeamMemberMessage';
import User from '@/models/User';
import { TelegramService } from './telegram.service';
import { AuditService } from './audit.service';
import { CacheService } from './cache.service';
import { PushNotificationService } from './push-notification.service';
import { dbConnect } from '@/lib/db/connect';

export interface AdminUserContext {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface SendMessageOptions {
  teamMemberId: string;
  text: string;
  adminUser: AdminUserContext;
}

export interface ConversationMessagesResult {
  conversation: ITeamMemberConversation;
  teamMember: {
    _id: string;
    name: string;
    email: string;
    designation?: string;
    role: string;
    telegramConnected: boolean;
    telegramUsername?: string;
  };
  messages: ITeamMemberMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class TeamChatService {
  /**
   * Get or initialize an Admin <-> Team Member conversation
   */
  static async getOrCreateConversation(
    teamMemberId: string,
    adminUser: AdminUserContext,
    preloadedMember?: any
  ): Promise<{ conversation: ITeamMemberConversation; teamMember: any }> {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(teamMemberId)) {
      throw new Error('Invalid team member ID format');
    }

    // Reuse preloaded member if available to avoid duplicate database round-trip
    let member = preloadedMember;
    if (!member) {
      member = await TeamMember.findById(teamMemberId).select(
        '_id name email designation role telegramConnected telegramUsername telegramChatId status'
      );
    }

    if (!member) {
      throw new Error('Team member not found');
    }

    if (member.status === 'DEACTIVATED') {
      throw new Error('Cannot open chat with a deactivated team member');
    }

    const adminObjectId = new mongoose.Types.ObjectId(adminUser.id);
    const memberObjectId = member._id as mongoose.Types.ObjectId;
    const memberIdStr = memberObjectId.toString();

    // Check Redis routing cache first
    const convCacheKey = CacheService.teamChatConvKey(memberIdStr, adminUser.id);
    let conversation: ITeamMemberConversation | null = null;
    const cachedConvId = await CacheService.get<string>(convCacheKey);

    if (cachedConvId && mongoose.Types.ObjectId.isValid(cachedConvId)) {
      conversation = await TeamMemberConversation.findById(cachedConvId);
    }

    if (!conversation) {
      // Look for an existing conversation between this team member and admin, or any open conversation
      conversation = await TeamMemberConversation.findOne({
        teamMemberId: memberObjectId,
        adminId: adminObjectId,
      });

      if (!conversation) {
        // Check if there is an open conversation owned by another admin or create a new dedicated one
        conversation = await TeamMemberConversation.findOne({
          teamMemberId: memberObjectId,
          status: 'OPEN',
        });
      }

      if (!conversation) {
        conversation = new TeamMemberConversation({
          adminId: adminObjectId,
          teamMemberId: memberObjectId,
          type: 'TEAM_MEMBER',
          status: 'OPEN',
          lastMessageAt: new Date(),
          unreadAdminCount: 0,
          unreadTeamMemberCount: 0,
        });
        await conversation.save();

        await AuditService.logAction(
          adminUser.email,
          'TEAM_MEMBER_CHAT_CREATED',
          'TeamMember',
          memberObjectId.toString(),
          {
            conversationId: conversation._id.toString(),
            adminId: adminUser.id,
            teamMemberName: member.name,
          }
        );
      }

      // Populate Redis routing cache with 10-minute TTL
      await CacheService.set(convCacheKey, conversation._id.toString(), 600);
    }

    return {
      conversation,
      teamMember: {
        _id: member._id.toString(),
        name: member.name,
        email: member.email,
        designation: member.designation,
        role: member.role,
        telegramConnected: member.telegramConnected,
        telegramUsername: member.telegramUsername,
        telegramChatId: member.telegramChatId,
      },
    };
  }

  /**
   * Admin sends a message to the Team Member
   */
  static async sendMessageFromAdmin(
    params: SendMessageOptions
  ): Promise<{ success: boolean; message: ITeamMemberMessage; conversation: ITeamMemberConversation }> {
    await dbConnect();

    const { teamMemberId, text, adminUser } = params;

    const trimmedText = text?.trim();
    if (!trimmedText) {
      throw new Error('Message text cannot be empty');
    }

    if (!mongoose.Types.ObjectId.isValid(teamMemberId)) {
      throw new Error('Invalid team member ID format');
    }

    // Single query with projected fields (excluding heavy encrypted bank details)
    const member = await TeamMember.findById(teamMemberId).select(
      '_id name email role designation telegramConnected telegramChatId status'
    );
    if (!member) {
      throw new Error('Team member not found');
    }

    if (member.status === 'DEACTIVATED') {
      throw new Error('Cannot send message to a deactivated team member');
    }

    if (!member.telegramConnected || !member.telegramChatId) {
      throw new Error('Telegram not connected for this team member');
    }

    // Retrieve or create conversation, passing already-loaded member
    const { conversation } = await this.getOrCreateConversation(teamMemberId, adminUser, member);

    // If conversation was closed, automatically reopen
    if (conversation.status === 'CLOSED') {
      conversation.status = 'OPEN';
    }

    // 1. Create message record with initial SENT status
    const message = new TeamMemberMessage({
      conversationId: conversation._id,
      teamMemberId: member._id,
      senderType: 'ADMIN',
      senderId: adminUser.id,
      senderName: adminUser.name || 'Admin',
      channel: 'CRM',
      text: trimmedText,
      status: 'SENT',
      sentAt: new Date(),
    });
    await message.save();

    // 2. Dispatch via TelegramService directly to chatId
    let formattedTelegramMessage = `⌯⌲<b>Dr. Debuggers (${adminUser.name || 'Admin'}):</b>\n\n${trimmedText}`;
    try {
      const { MessageTemplateService } = await import('./message-template.service');
      const rendered = await MessageTemplateService.renderTemplate(
        'TEAM_MEMBER_CHAT_MESSAGE',
        'TELEGRAM',
        {
          adminName: adminUser.name || 'Admin',
          messageText: trimmedText,
          teamMemberName: member.name,
        }
      );
      formattedTelegramMessage = rendered.body;
    } catch {
      // Safe fallback to default string
    }

    let sendResult: { success: boolean; messageId?: number; error?: string };
    try {
      sendResult = await TelegramService.sendMessageRaw(member.telegramChatId, formattedTelegramMessage);
    } catch (err: any) {
      sendResult = { success: false, error: err.message || 'Telegram dispatch failed' };
    }

    if (sendResult.success) {
      message.status = 'DELIVERED';
      if (sendResult.messageId) {
        message.telegramMessageId = String(sendResult.messageId);
      }
      message.deliveredAt = new Date();

      conversation.lastMessageAt = new Date();
      conversation.lastMessageText = trimmedText;

      // Parallelize MongoDB updates across independent collections
      await Promise.all([message.save(), conversation.save()]);

      // Parallelize secondary tasks concurrently
      await Promise.all([
        AuditService.logAction(
          adminUser.email,
          'TEAM_MEMBER_MESSAGE_SENT',
          'TeamMember',
          member._id.toString(),
          {
            conversationId: conversation._id.toString(),
            messageId: message._id.toString(),
            telegramMessageId: message.telegramMessageId,
          }
        ),
        CacheService.invalidateTeamChatCache(teamMemberId),
      ]);

      return { success: true, message, conversation };
    } else {
      // Dispatch failed
      message.status = 'FAILED';
      await message.save();

      await AuditService.logAction(
        adminUser.email,
        'TEAM_MEMBER_MESSAGE_FAILED',
        'TeamMember',
        member._id.toString(),
        {
          conversationId: conversation._id.toString(),
          messageId: message._id.toString(),
          error: sendResult.error,
        }
      );

      throw new Error(sendResult.error || 'Failed to deliver message via Telegram');
    }
  }

  /**
   * Handle incoming reply from Team Member via Telegram webhook
   */
  static async handleIncomingTeamMemberMessage(
    teamMember: any,
    text: string,
    telegramMessageId?: string | number
  ): Promise<ITeamMemberMessage> {
    await dbConnect();

    const trimmedText = text?.trim();
    if (!trimmedText) {
      throw new Error('Message text cannot be empty');
    }

    if (teamMember.status === 'DEACTIVATED') {
      throw new Error('Incoming message ignored: team member is deactivated');
    }

    const memberId = teamMember._id as mongoose.Types.ObjectId;

    // Deduplication guard: Prevent duplicate chat message persistence if Telegram retries webhook update
    if (telegramMessageId) {
      const existingMessage = await TeamMemberMessage.findOne({
        telegramMessageId: String(telegramMessageId),
        teamMemberId: memberId,
      });
      if (existingMessage) {
        console.log(`[DEDUPLICATION] Team chat message with telegramMessageId ${telegramMessageId} already exists. Skipping.`);
        return existingMessage;
      }
    }

    // Resolve target conversation using a single query sorting OPEN ('O') before CLOSED ('C')
    let conversation = await TeamMemberConversation.findOne({
      teamMemberId: memberId,
    }).sort({ status: -1, lastMessageAt: -1 });

    if (!conversation) {
      // Find primary admin with projection
      const defaultAdmin = await User.findOne({ role: 'ADMIN' }).select('_id').lean();
      const adminId = defaultAdmin ? (defaultAdmin._id as mongoose.Types.ObjectId) : memberId;

      conversation = new TeamMemberConversation({
        adminId,
        teamMemberId: memberId,
        type: 'TEAM_MEMBER',
        status: 'OPEN',
        lastMessageAt: new Date(),
        lastMessageText: trimmedText,
        unreadAdminCount: 1,
        unreadTeamMemberCount: 0,
      });
      await conversation.save();

      AuditService.logAction(
        teamMember.email || 'system',
        'TEAM_MEMBER_CHAT_CREATED',
        'TeamMember',
        memberId.toString(),
        {
          conversationId: conversation._id.toString(),
          initiatedBy: 'TEAM_MEMBER_REPLY',
        }
      ).catch(() => { });
    } else {
      conversation.unreadAdminCount = (conversation.unreadAdminCount || 0) + 1;
      conversation.lastMessageAt = new Date();
      conversation.lastMessageText = trimmedText;
      if (conversation.status === 'CLOSED') {
        conversation.status = 'OPEN';
      }
    }

    // Persist incoming message
    const incomingMessage = new TeamMemberMessage({
      conversationId: conversation._id,
      teamMemberId: memberId,
      senderType: 'TEAM_MEMBER',
      senderId: memberId.toString(),
      senderName: teamMember.name,
      channel: 'TELEGRAM',
      telegramMessageId: telegramMessageId ? String(telegramMessageId) : undefined,
      text: trimmedText,
      status: 'DELIVERED',
      sentAt: new Date(),
      deliveredAt: new Date(),
    });

    // Parallelize conversation metadata update and message persistence
    await Promise.all([conversation.save(), incomingMessage.save()]);

    // Non-blocking Chrome Web Push notification to the specific conversation's Admin owner
    const targetAdminId = conversation.adminId ? conversation.adminId.toString() : null;
    if (targetAdminId) {
      console.log(`[PUSH] incoming team member message for admin: ${targetAdminId}`);
      let pushTitle = `💬 ${teamMember.name}`;
      let pushBody = trimmedText.length > 80 ? trimmedText.slice(0, 77) + '...' : trimmedText;

      try {
        const { MessageTemplateService } = await import('./message-template.service');
        const defaultDef = MessageTemplateService.getDefaultTemplateByKey('ADMIN_TEAM_MESSAGE_PUSH');
        if (defaultDef) {
          const interpolatedBody = MessageTemplateService.interpolate(
            defaultDef.body,
            { teamMemberName: teamMember.name, messageText: trimmedText },
            'WEB_PUSH'
          );
          if (interpolatedBody) pushBody = interpolatedBody;
          if (defaultDef.subject) {
            pushTitle = MessageTemplateService.interpolate(
              defaultDef.subject,
              { teamMemberName: teamMember.name, messageText: trimmedText },
              'WEB_PUSH'
            );
          }
        }
      } catch {
        // Safe fallback
      }

      PushNotificationService.sendPushToAdmin(targetAdminId, {
        title: pushTitle,
        body: pushBody,
        icon: '/globe.svg',
        badge: '/globe.svg',
        data: {
          url: `/dashboard/team/${memberId.toString()}?tab=chat&conversationId=${conversation._id.toString()}`,
          teamMemberId: memberId.toString(),
          conversationId: conversation._id.toString(),
        },
      }).catch((err: any) => {
        console.error('[PUSH] Web Push dispatch failed non-blockingly:', err.message);
      });
    }

    // Parallelize secondary tasks
    await Promise.all([
      AuditService.logAction(
        teamMember.email,
        'TEAM_MEMBER_COMMAND',
        'TeamMember',
        memberId.toString(),
        {
          command: 'chat_reply',
          conversationId: conversation._id.toString(),
          messageId: incomingMessage._id.toString(),
          telegramMessageId: incomingMessage.telegramMessageId,
        }
      ),
      CacheService.invalidateTeamChatCache(memberId.toString()),
    ]);

    return incomingMessage;
  }

  /**
   * Fast incremental fetch for messages newer than a given ISO timestamp
   */
  static async getIncrementalMessages(
    teamMemberId: string,
    afterIsoDate: string
  ): Promise<{ messages: ITeamMemberMessage[]; unreadAdminCount?: number; lastMessageAt?: Date }> {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(teamMemberId)) {
      throw new Error('Invalid team member ID format');
    }

    const afterDate = new Date(afterIsoDate);
    if (isNaN(afterDate.getTime())) {
      throw new Error('Invalid after timestamp');
    }

    const memberObjectId = new mongoose.Types.ObjectId(teamMemberId);

    // Concurrently fetch newly arrived messages and latest conversation metadata
    const [messages, conversation] = await Promise.all([
      TeamMemberMessage.find({
        teamMemberId: memberObjectId,
        sentAt: { $gt: afterDate },
      })
        .sort({ sentAt: 1 })
        .limit(100)
        .lean(),
      TeamMemberConversation.findOne({
        teamMemberId: memberObjectId,
      })
        .select('unreadAdminCount lastMessageAt status')
        .lean(),
    ]);

    return {
      messages: messages as any,
      unreadAdminCount: conversation?.unreadAdminCount || 0,
      lastMessageAt: conversation?.lastMessageAt,
    };
  }

  /**
   * Fetch paginated messages for a conversation
   */
  static async getConversationMessages(
    teamMemberId: string,
    adminUser: AdminUserContext,
    options: { page?: number; limit?: number; conversationId?: string } = {}
  ): Promise<ConversationMessagesResult> {
    await dbConnect();

    const { teamMember } = await this.getOrCreateConversation(teamMemberId, adminUser);

    let conversation: ITeamMemberConversation | null = null;
    if (options.conversationId && mongoose.Types.ObjectId.isValid(options.conversationId)) {
      // Find the specific conversation and verify that it matches this team member
      conversation = await TeamMemberConversation.findOne({
        _id: new mongoose.Types.ObjectId(options.conversationId),
        teamMemberId: new mongoose.Types.ObjectId(teamMemberId),
      });
    }

    if (!conversation) {
      const convResult = await this.getOrCreateConversation(teamMemberId, adminUser);
      conversation = convResult.conversation;
    }

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));
    const skip = (page - 1) * limit;

    // Parallelize message count and messages fetch
    const [total, rawMessages] = await Promise.all([
      TeamMemberMessage.countDocuments({ conversationId: conversation._id }),
      TeamMemberMessage.find({ conversationId: conversation._id })
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    const messages = rawMessages.reverse();

    return {
      conversation,
      teamMember,
      messages: messages as any,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Mark all unread messages as read
   */
  static async markConversationAsRead(
    teamMemberId: string,
    adminUser: AdminUserContext
  ): Promise<{ success: boolean; readCount: number }> {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(teamMemberId)) {
      throw new Error('Invalid team member ID format');
    }

    const conversation = await TeamMemberConversation.findOne({
      teamMemberId: new mongoose.Types.ObjectId(teamMemberId),
    });

    if (!conversation) {
      return { success: true, readCount: 0 };
    }

    const result = await TeamMemberMessage.updateMany(
      {
        conversationId: conversation._id,
        senderType: 'TEAM_MEMBER',
        status: { $in: ['SENT', 'DELIVERED'] },
      },
      {
        $set: {
          status: 'READ',
          readAt: new Date(),
        },
      }
    );

    conversation.unreadAdminCount = 0;
    await conversation.save();

    await CacheService.invalidateTeamChatCache(teamMemberId);

    return { success: true, readCount: result.modifiedCount || 0 };
  }

  /**
   * Toggle or set conversation status (OPEN / CLOSED)
   */
  static async setConversationStatus(
    teamMemberId: string,
    status: 'OPEN' | 'CLOSED',
    adminUser: AdminUserContext
  ): Promise<ITeamMemberConversation> {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(teamMemberId)) {
      throw new Error('Invalid team member ID format');
    }

    const { conversation } = await this.getOrCreateConversation(teamMemberId, adminUser);
    conversation.status = status;
    await conversation.save();

    return conversation;
  }

  /**
   * Get chat metadata for all team members (unread counts, last message, status)
   */
  static async getTeamChatSummary(): Promise<Record<string, { unreadCount: number; lastMessageText?: string; lastMessageAt?: Date; status: string }>> {
    await dbConnect();

    const conversations = await TeamMemberConversation.find({})
      .select('teamMemberId unreadAdminCount lastMessageText lastMessageAt status')
      .lean();
    const summary: Record<string, { unreadCount: number; lastMessageText?: string; lastMessageAt?: Date; status: string }> = {};

    for (const c of conversations) {
      const memberIdStr = c.teamMemberId.toString();
      summary[memberIdStr] = {
        unreadCount: c.unreadAdminCount || 0,
        lastMessageText: c.lastMessageText,
        lastMessageAt: c.lastMessageAt,
        status: c.status,
      };
    }

    return summary;
  }
}
