import mongoose from 'mongoose';
import TeamMember, { ITeamMember } from '@/models/TeamMember';
import TeamMemberConversation, { ITeamMemberConversation } from '@/models/TeamMemberConversation';
import TeamMemberMessage, { ITeamMemberMessage } from '@/models/TeamMemberMessage';
import TeamMemberBroadcast, {
  ITeamMemberBroadcast,
  IBroadcastDelivery,
  BroadcastStatus,
} from '@/models/TeamMemberBroadcast';
import { TelegramService } from './telegram.service';
import { AuditService } from './audit.service';
import { CacheService } from './cache.service';
import { TeamChatService, AdminUserContext } from './team-chat.service';
import { dbConnect } from '@/lib/db/connect';

export interface SendBroadcastOptions {
  message: string;
  targetMode: 'ALL_CONNECTED' | 'SELECTED';
  recipientIds?: string[];
  idempotencyKey?: string;
  adminUser: AdminUserContext;
}

export interface BroadcastSummaryResult {
  broadcast: ITeamMemberBroadcast;
  duplicate?: boolean;
}

function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Worker pool executing items with a strict concurrency ceiling and small delay
 */
async function runWithControlledConcurrency<T>(
  items: T[],
  limit: number,
  workerFn: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const safeLimit = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        await workerFn(items[idx]);
      } catch (err: any) {
        console.error('[BROADCAST] Worker error:', err.message);
      }
      // Small throttle pause (25ms) to prevent Telegram API flood
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  const workers = Array.from({ length: safeLimit }, () => worker());
  await Promise.all(workers);
}

export class TeamBroadcastService {
  private static readonly CONCURRENCY_LIMIT = 5;

  /**
   * Execute or retrieve a team member broadcast
   */
  static async sendBroadcast(options: SendBroadcastOptions): Promise<BroadcastSummaryResult> {
    await dbConnect();

    const { message, targetMode, recipientIds, idempotencyKey, adminUser } = options;

    if (adminUser.role !== 'ADMIN') {
      throw new Error('Unauthorized: Admin access required');
    }

    const trimmedMessage = message?.trim();
    if (!trimmedMessage) {
      throw new Error('Broadcast message cannot be empty');
    }

    if (trimmedMessage.length > 4000) {
      throw new Error('Broadcast message exceeds maximum allowed length of 4000 characters');
    }

    // 1. Idempotency Check
    if (idempotencyKey) {
      const cacheKey = `crm:broadcast:idempotency:${idempotencyKey}`;
      const cachedBroadcastId = await CacheService.get<string>(cacheKey);
      if (cachedBroadcastId && mongoose.Types.ObjectId.isValid(cachedBroadcastId)) {
        const existing = await TeamMemberBroadcast.findById(cachedBroadcastId);
        if (existing) {
          return { broadcast: existing, duplicate: true };
        }
      }

      const existingByMongo = await TeamMemberBroadcast.findOne({ idempotencyKey });
      if (existingByMongo) {
        return { broadcast: existingByMongo, duplicate: true };
      }
    }

    // 2. Resolve Candidate Recipients
    let candidates: any[] = [];
    if (targetMode === 'ALL_CONNECTED') {
      candidates = await TeamMember.find({
        status: { $ne: 'DEACTIVATED' },
        telegramConnected: true,
        telegramChatId: { $exists: true, $ne: '' },
      }).select('_id name email designation role status telegramConnected telegramChatId');
    } else {
      if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
        throw new Error('At least one recipient must be selected');
      }

      const validIds = recipientIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      if (validIds.length === 0) {
        throw new Error('No valid recipient IDs provided');
      }

      candidates = await TeamMember.find({
        _id: { $in: validIds },
        status: { $ne: 'DEACTIVATED' },
      }).select('_id name email designation role status telegramConnected telegramChatId');
    }

    if (candidates.length === 0) {
      throw new Error(
        targetMode === 'ALL_CONNECTED'
          ? 'No active team members with linked Telegram accounts found'
          : 'None of the selected team members could be found or are eligible'
      );
    }

    // 3. Initialize Deliveries
    const deliveries: IBroadcastDelivery[] = candidates.map((member) => {
      if (member.status === 'DEACTIVATED') {
        return {
          teamMemberId: member._id as mongoose.Types.ObjectId,
          teamMemberName: member.name,
          teamMemberEmail: member.email,
          telegramChatId: member.telegramChatId || undefined,
          status: 'SKIPPED',
          error: 'Team member deactivated or deleted',
        };
      }
      const isConnected = !!(member.telegramConnected && member.telegramChatId);
      return {
        teamMemberId: member._id as mongoose.Types.ObjectId,
        teamMemberName: member.name,
        teamMemberEmail: member.email,
        telegramChatId: member.telegramChatId || undefined,
        status: isConnected ? 'PENDING' : 'NOT_CONNECTED',
        error: isConnected ? undefined : 'Telegram account is not connected',
      };
    });

    const notConnectedInitial = deliveries.filter((d) => d.status === 'NOT_CONNECTED').length;

    const broadcast = new TeamMemberBroadcast({
      adminId: new mongoose.Types.ObjectId(adminUser.id),
      adminName: adminUser.name || 'Admin',
      message: trimmedMessage,
      targetMode,
      recipientCount: deliveries.length,
      sentCount: 0,
      failedCount: 0,
      notConnectedCount: notConnectedInitial,
      status: 'PROCESSING',
      idempotencyKey,
      deliveries,
    });
    await broadcast.save();

    // Cache idempotency key for 1 hour
    if (idempotencyKey) {
      await CacheService.set(`crm:broadcast:idempotency:${idempotencyKey}`, broadcast._id.toString(), 3600);
    }

    // 4. Dispatch Individual Messages with Controlled Concurrency
    const eligibleIndices = deliveries
      .map((d, idx) => ({ delivery: d, index: idx }))
      .filter((item) => item.delivery.status === 'PENDING');

    const formattedTelegramMessage = `📢 <b>Announcement (${escapeTelegramHtml(adminUser.name || 'Admin')}):</b>\n\n${escapeTelegramHtml(trimmedMessage)}`;

    await runWithControlledConcurrency(
      eligibleIndices,
      this.CONCURRENCY_LIMIT,
      async ({ index }) => {
        const delivery = broadcast.deliveries[index];
        const member = candidates.find((c) => c._id.toString() === delivery.teamMemberId.toString());
        if (!member || member.status === 'DEACTIVATED') {
          delivery.status = 'SKIPPED';
          delivery.error = 'Team member deactivated or deleted';
          return;
        }

        if (!member.telegramConnected || !member.telegramChatId) {
          delivery.status = 'NOT_CONNECTED';
          delivery.error = 'Telegram account not connected';
          return;
        }

        try {
          // Individual isolated conversation for this Team Member
          const { conversation } = await TeamChatService.getOrCreateConversation(
            member._id.toString(),
            adminUser,
            member
          );

          if (conversation.status === 'CLOSED') {
            conversation.status = 'OPEN';
          }

          // Individual message record in this conversation
          const messageDoc = new TeamMemberMessage({
            conversationId: conversation._id,
            teamMemberId: member._id,
            senderType: 'ADMIN',
            senderId: adminUser.id,
            senderName: adminUser.name || 'Admin',
            channel: 'CRM',
            text: trimmedMessage,
            status: 'SENT',
            sentAt: new Date(),
          });
          await messageDoc.save();

          // Dispatch through TelegramService
          const sendResult = await TelegramService.sendMessageRaw(
            member.telegramChatId,
            formattedTelegramMessage
          );

          if (sendResult.success) {
            messageDoc.status = 'DELIVERED';
            if (sendResult.messageId) {
              messageDoc.telegramMessageId = String(sendResult.messageId);
            }
            messageDoc.deliveredAt = new Date();

            conversation.lastMessageAt = new Date();
            conversation.lastMessageText = trimmedMessage;

            await Promise.all([messageDoc.save(), conversation.save()]);

            delivery.status = 'SENT';
            delivery.telegramMessageId = sendResult.messageId ? String(sendResult.messageId) : undefined;
            delivery.conversationId = conversation._id;
            delivery.messageId = messageDoc._id;
            delivery.sentAt = new Date();
          } else {
            messageDoc.status = 'FAILED';
            await messageDoc.save();

            delivery.status = 'FAILED';
            delivery.error = sendResult.error || 'Failed to deliver Telegram message';
            delivery.conversationId = conversation._id;
            delivery.messageId = messageDoc._id;
          }
        } catch (err: any) {
          delivery.status = 'FAILED';
          delivery.error = err.message || 'Unexpected delivery failure';
        }
      }
    );

    // 5. Finalize Statistics & Status
    const sentCount = broadcast.deliveries.filter((d) => d.status === 'SENT').length;
    const failedCount = broadcast.deliveries.filter((d) => d.status === 'FAILED').length;
    const notConnectedCount = broadcast.deliveries.filter((d) => d.status === 'NOT_CONNECTED').length;

    let finalStatus: BroadcastStatus = 'COMPLETED';
    if (failedCount > 0 && sentCount > 0) {
      finalStatus = 'PARTIALLY_FAILED';
    } else if (failedCount > 0 && sentCount === 0) {
      finalStatus = 'FAILED';
    } else if (sentCount === 0 && notConnectedCount > 0) {
      finalStatus = 'COMPLETED';
    }

    broadcast.sentCount = sentCount;
    broadcast.failedCount = failedCount;
    broadcast.notConnectedCount = notConnectedCount;
    broadcast.status = finalStatus;
    await broadcast.save();

    // 6. Record Audit Log (safe metadata only, message content treated securely)
    await AuditService.logAction(
      adminUser.email,
      'TEAM_MEMBER_BROADCAST_CREATED' as any,
      'TeamMember',
      broadcast._id.toString(),
      {
        broadcastId: broadcast._id.toString(),
        targetMode,
        recipientCount: broadcast.recipientCount,
        sentCount,
        failedCount,
        notConnectedCount,
        status: finalStatus,
      }
    );

    return { broadcast };
  }

  /**
   * Retry failed recipients from a prior broadcast without resending to already sent members
   */
  static async retryFailed(
    broadcastId: string,
    adminUser: AdminUserContext
  ): Promise<{ broadcast: ITeamMemberBroadcast; retriedCount: number; newlySent: number }> {
    await dbConnect();

    if (adminUser.role !== 'ADMIN') {
      throw new Error('Unauthorized: Admin access required');
    }

    if (!mongoose.Types.ObjectId.isValid(broadcastId)) {
      throw new Error('Invalid broadcast ID format');
    }

    const broadcast = await TeamMemberBroadcast.findById(broadcastId);
    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    // Only target deliveries with FAILED status
    const failedIndices = broadcast.deliveries
      .map((d, idx) => ({ delivery: d, index: idx }))
      .filter((item) => item.delivery.status === 'FAILED');

    if (failedIndices.length === 0) {
      return { broadcast, retriedCount: 0, newlySent: 0 };
    }

    const memberIds = failedIndices.map((i) => i.delivery.teamMemberId);
    const members = await TeamMember.find({ _id: { $in: memberIds } }).select(
      '_id name email role designation status telegramConnected telegramChatId'
    );

    const formattedTelegramMessage = `📢 <b>Announcement (${escapeTelegramHtml(adminUser.name || 'Admin')}):</b>\n\n${escapeTelegramHtml(broadcast.message)}`;

    let newlySent = 0;

    await runWithControlledConcurrency(
      failedIndices,
      this.CONCURRENCY_LIMIT,
      async ({ index }) => {
        const delivery = broadcast.deliveries[index];
        const member = members.find((m) => m._id.toString() === delivery.teamMemberId.toString());

        if (!member || member.status === 'DEACTIVATED') {
          delivery.status = 'SKIPPED';
          delivery.error = 'Team member deactivated or deleted';
          return;
        }

        if (!member.telegramConnected || !member.telegramChatId) {
          delivery.status = 'NOT_CONNECTED';
          delivery.error = 'Telegram account not connected';
          return;
        }

        try {
          const { conversation } = await TeamChatService.getOrCreateConversation(
            member._id.toString(),
            adminUser,
            member
          );

          if (conversation.status === 'CLOSED') {
            conversation.status = 'OPEN';
          }

          const messageDoc = new TeamMemberMessage({
            conversationId: conversation._id,
            teamMemberId: member._id,
            senderType: 'ADMIN',
            senderId: adminUser.id,
            senderName: adminUser.name || 'Admin',
            channel: 'CRM',
            text: broadcast.message,
            status: 'SENT',
            sentAt: new Date(),
          });
          await messageDoc.save();

          const sendResult = await TelegramService.sendMessageRaw(
            member.telegramChatId,
            formattedTelegramMessage
          );

          if (sendResult.success) {
            messageDoc.status = 'DELIVERED';
            if (sendResult.messageId) {
              messageDoc.telegramMessageId = String(sendResult.messageId);
            }
            messageDoc.deliveredAt = new Date();

            conversation.lastMessageAt = new Date();
            conversation.lastMessageText = broadcast.message;

            await Promise.all([messageDoc.save(), conversation.save()]);

            delivery.status = 'SENT';
            delivery.telegramMessageId = sendResult.messageId ? String(sendResult.messageId) : undefined;
            delivery.conversationId = conversation._id;
            delivery.messageId = messageDoc._id;
            delivery.sentAt = new Date();
            delivery.error = undefined;
            newlySent++;
          } else {
            messageDoc.status = 'FAILED';
            await messageDoc.save();

            delivery.status = 'FAILED';
            delivery.error = sendResult.error || 'Retry delivery failed';
            delivery.conversationId = conversation._id;
            delivery.messageId = messageDoc._id;
          }
        } catch (err: any) {
          delivery.status = 'FAILED';
          delivery.error = err.message || 'Retry delivery error';
        }
      }
    );

    // Recalculate summary metrics
    const sentCount = broadcast.deliveries.filter((d) => d.status === 'SENT').length;
    const failedCount = broadcast.deliveries.filter((d) => d.status === 'FAILED').length;
    const notConnectedCount = broadcast.deliveries.filter((d) => d.status === 'NOT_CONNECTED').length;

    let finalStatus: BroadcastStatus = 'COMPLETED';
    if (failedCount > 0 && sentCount > 0) {
      finalStatus = 'PARTIALLY_FAILED';
    } else if (failedCount > 0 && sentCount === 0) {
      finalStatus = 'FAILED';
    }

    broadcast.sentCount = sentCount;
    broadcast.failedCount = failedCount;
    broadcast.notConnectedCount = notConnectedCount;
    broadcast.status = finalStatus;
    await broadcast.save();

    await AuditService.logAction(
      adminUser.email,
      'TEAM_MEMBER_BROADCAST_RETRY' as any,
      'TeamMember',
      broadcast._id.toString(),
      {
        broadcastId: broadcast._id.toString(),
        retriedCount: failedIndices.length,
        newlySent,
        sentCount,
        failedCount,
        status: finalStatus,
      }
    );

    return { broadcast, retriedCount: failedIndices.length, newlySent };
  }

  /**
   * Fetch recent broadcasts list for an Admin
   */
  static async getBroadcasts(
    adminUser: AdminUserContext,
    options: { limit?: number; page?: number } = {}
  ): Promise<{ broadcasts: ITeamMemberBroadcast[]; total: number }> {
    await dbConnect();

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(options.limit) || 10));
    const skip = (page - 1) * limit;

    if (adminUser.role !== 'ADMIN') {
      throw new Error('Unauthorized: Admin access required');
    }

    const query: any = {};

    const [total, broadcasts] = await Promise.all([
      TeamMemberBroadcast.countDocuments(query),
      TeamMemberBroadcast.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return { broadcasts: broadcasts as any, total };
  }

  /**
   * Fetch specific broadcast by ID
   */
  static async getBroadcastById(
    broadcastId: string,
    adminUser: AdminUserContext
  ): Promise<ITeamMemberBroadcast | null> {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(broadcastId)) {
      throw new Error('Invalid broadcast ID format');
    }

    const broadcast = await TeamMemberBroadcast.findById(broadcastId);
    if (!broadcast) return null;

    if (adminUser.role !== 'ADMIN') {
      throw new Error('Unauthorized to access this broadcast');
    }

    return broadcast;
  }
}
