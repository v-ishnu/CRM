import mongoose from 'mongoose';
import TeamMember from '@/models/TeamMember';
import TeamMemberConversation, { ITeamMemberConversation } from '@/models/TeamMemberConversation';
import TeamMemberMessage, { ITeamMemberMessage } from '@/models/TeamMemberMessage';
import User from '@/models/User';
import { TelegramService } from './telegram.service';
import { AuditService } from './audit.service';
import { CacheService } from './cache.service';
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
    adminUser: AdminUserContext
  ): Promise<{ conversation: ITeamMemberConversation; teamMember: any }> {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(teamMemberId)) {
      throw new Error('Invalid team member ID format');
    }

    const member = await TeamMember.findById(teamMemberId);
    if (!member) {
      throw new Error('Team member not found');
    }

    if (member.status === 'DEACTIVATED') {
      throw new Error('Cannot open chat with a deactivated team member');
    }

    const adminObjectId = new mongoose.Types.ObjectId(adminUser.id);
    const memberObjectId = member._id as mongoose.Types.ObjectId;

    // Look for an existing conversation between this team member and admin, or any open conversation
    let conversation = await TeamMemberConversation.findOne({
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

    const member = await TeamMember.findById(teamMemberId);
    if (!member) {
      throw new Error('Team member not found');
    }

    if (member.status === 'DEACTIVATED') {
      throw new Error('Cannot send message to a deactivated team member');
    }

    if (!member.telegramConnected || !member.telegramChatId) {
      throw new Error('Telegram not connected for this team member');
    }

    // Retrieve or create conversation
    const { conversation } = await this.getOrCreateConversation(teamMemberId, adminUser);

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

    // 2. Dispatch via TelegramService
    const formattedTelegramMessage = `💬 <b>Dr. Debuggers Admin (${adminUser.name || 'Admin'}):</b>\n\n${trimmedText}`;
    
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
      await message.save();

      conversation.lastMessageAt = new Date();
      conversation.lastMessageText = trimmedText;
      await conversation.save();

      await AuditService.logAction(
        adminUser.email,
        'TEAM_MEMBER_MESSAGE_SENT',
        'TeamMember',
        member._id.toString(),
        {
          conversationId: conversation._id.toString(),
          messageId: message._id.toString(),
          telegramMessageId: message.telegramMessageId,
        }
      );

      await CacheService.invalidateTeamChatCache(teamMemberId);

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

    // Resolve target conversation:
    // 1. Most recent OPEN conversation
    // 2. Or most recent conversation regardless of status
    let conversation = await TeamMemberConversation.findOne({
      teamMemberId: memberId,
      status: 'OPEN',
    }).sort({ lastMessageAt: -1 });

    if (!conversation) {
      conversation = await TeamMemberConversation.findOne({
        teamMemberId: memberId,
      }).sort({ lastMessageAt: -1 });
    }

    if (!conversation) {
      // Find primary or default admin user to establish explicit conversation ownership
      const defaultAdmin = await User.findOne({ role: 'ADMIN' });
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

      await AuditService.logAction(
        teamMember.email || 'system',
        'TEAM_MEMBER_CHAT_CREATED',
        'TeamMember',
        memberId.toString(),
        {
          conversationId: conversation._id.toString(),
          initiatedBy: 'TEAM_MEMBER_REPLY',
        }
      );
    } else {
      conversation.unreadAdminCount = (conversation.unreadAdminCount || 0) + 1;
      conversation.lastMessageAt = new Date();
      conversation.lastMessageText = trimmedText;
      if (conversation.status === 'CLOSED') {
        conversation.status = 'OPEN';
      }
      await conversation.save();
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
    await incomingMessage.save();

    await AuditService.logAction(
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
    );

    await CacheService.invalidateTeamChatCache(memberId.toString());

    return incomingMessage;
  }

  /**
   * Fetch paginated messages for a conversation
   */
  static async getConversationMessages(
    teamMemberId: string,
    adminUser: AdminUserContext,
    options: { page?: number; limit?: number } = {}
  ): Promise<ConversationMessagesResult> {
    await dbConnect();

    const { conversation, teamMember } = await this.getOrCreateConversation(teamMemberId, adminUser);

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));
    const skip = (page - 1) * limit;

    const total = await TeamMemberMessage.countDocuments({ conversationId: conversation._id });
    const totalPages = Math.ceil(total / limit) || 1;

    // Fetch messages sorted newest first, then reverse to display chronologically
    const rawMessages = await TeamMemberMessage.find({ conversationId: conversation._id })
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

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

    const conversations = await TeamMemberConversation.find({}).lean();
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
