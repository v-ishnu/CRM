import fs from 'fs';
import path from 'path';
import Client from '@/models/Client';
import Project from '@/models/Project';
import Invoice from '@/models/Invoice';
import Payment from '@/models/Payment';
import DataRequest from '@/models/DataRequest';
import Credential from '@/models/Credential';
import RequestResponse from '@/models/RequestResponse';
import TeamMember from '@/models/TeamMember';
import Task from '@/models/Task';
import TeamPayment from '@/models/TeamPayment';
import User from '@/models/User';
import { ClientService } from './client.service';
import { PaymentService } from './payment.service';
import { AuditService } from './audit.service';
import { StorageService } from './storage.service';
import { TeamMemberService } from './team-member.service';
import { TaskService } from './task.service';
import { dbConnect } from '@/lib/db/connect';

export type TelegramIdentityType = 'ADMIN' | 'TEAM_MEMBER' | 'CLIENT' | 'CONFLICT' | 'UNLINKED';

export interface TelegramIdentity {
  type: TelegramIdentityType;
  user?: any;
  teamMember?: any;
  client?: any;
}

declare global {
  // eslint-disable-next-line no-var
  var activeClientRequests: Record<string, string> | undefined;
  // eslint-disable-next-line no-var
  var processedTelegramUpdates: Set<number> | undefined;
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export class TelegramService {
  /**
   * Helper to verify if the bot is configured
   */
  static isConfigured(): boolean {
    return !!BOT_TOKEN;
  }

  /**
   * Set the webhook URL for Telegram Bot
   */
  static async setWebhook(appUrl: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    
    let webhookUrl = appUrl.trim();
    if (webhookUrl.endsWith('/api/telegram/webhook')) {
      // already has suffix
    } else {
      if (webhookUrl.endsWith('/')) {
        webhookUrl = webhookUrl.slice(0, -1);
      }
      webhookUrl = `${webhookUrl}/api/telegram/webhook`;
    }
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET || 'secret';
    
    try {
      const response = await fetch(`${TELEGRAM_API}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: secretToken,
          allowed_updates: ['message', 'callback_query'],
        }),
      });
      
      const data = await response.json();
      if (data.ok === true) {
        await this.setBotCommands();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to set Telegram Webhook:', error);
      return false;
    }
  }

  /**
   * Get Webhook Info from Telegram API
   */
  static async getWebhookInfo(): Promise<any> {
    if (!this.isConfigured()) return null;
    try {
      const response = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
      const data = await response.json();
      return data.ok === true ? data.result : null;
    } catch (error) {
      console.error('Failed to get Telegram Webhook Info:', error);
      return null;
    }
  }

  private static syncedChatScopes = new Map<string, string>();

  /**
   * Universal command definitions by role
   */
  static readonly DEFAULT_COMMANDS = [
    { command: 'start', description: 'Start the bot or connect account' },
    { command: 'help', description: 'Show available commands & help' },
  ];

  static readonly TEAM_MEMBER_COMMANDS = [
    { command: 'tasks', description: 'View assigned tasks' },
    { command: 'mypayments', description: 'View payment history' },
    { command: 'myprojects', description: 'View assigned projects' },
    { command: 'myprofile', description: 'View profile info' },
    { command: 'help', description: 'Show team member commands' },
    { command: 'start', description: 'Start team bot session' },
  ];

  static readonly CLIENT_COMMANDS = [
    { command: 'myprofile', description: 'View profile info' },
    { command: 'myproject', description: 'View project details' },
    { command: 'payments', description: 'View payment history' },
    { command: 'invoices', description: 'View invoices history' },
    { command: 'status', description: 'View project progress' },
    { command: 'help', description: 'Show available commands' },
    { command: 'start', description: 'Start client bot session' },
  ];

  static readonly ADMIN_COMMANDS = [
    { command: 'admin', description: 'Show admin dashboard menu' },
    { command: 'clients', description: 'List all clients' },
    { command: 'client', description: 'View client details' },
    { command: 'payments', description: 'List recent payments' },
    { command: 'pending', description: 'List pending invoices' },
    { command: 'invoices', description: 'List recent invoices' },
    { command: 'help', description: 'Show admin help menu' },
    { command: 'start', description: 'Start admin bot session' },
  ];

  /**
   * Synchronize chat-specific commands for a given chat and role.
   * Ensures Telegram's native command autocomplete dropdown strictly reflects the user's role.
   * Uses an in-memory cache to prevent redundant Telegram API calls on every request.
   */
  static async syncChatCommands(
    chatId: string | number,
    role: 'ADMIN' | 'TEAM_MEMBER' | 'CLIENT' | 'UNLINKED' | 'CONFLICT',
    force: boolean = false
  ): Promise<boolean> {
    if (!this.isConfigured() || !chatId) return false;
    const strChatId = String(chatId);
    const numChatId = Number(chatId);
    if (isNaN(numChatId)) return false;

    if (!force && this.syncedChatScopes.get(strChatId) === role) {
      return true;
    }

    let commands = this.DEFAULT_COMMANDS;
    if (role === 'ADMIN') commands = this.ADMIN_COMMANDS;
    else if (role === 'TEAM_MEMBER') commands = this.TEAM_MEMBER_COMMANDS;
    else if (role === 'CLIENT') commands = this.CLIENT_COMMANDS;
    else if (role === 'UNLINKED' || role === 'CONFLICT') commands = this.DEFAULT_COMMANDS;

    try {
      const res = await fetch(`${TELEGRAM_API}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands,
          scope: { type: 'chat', chat_id: numChatId },
        }),
      });
      const data = await res.json();
      if (data.ok === true) {
        this.syncedChatScopes.set(strChatId, role);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Failed to sync chat commands for chat ${chatId}:`, err);
      return false;
    }
  }

  /**
   * Configure bot commands in Telegram
   * 1. Sets safe default commands globally (start & help only)
   * 2. Sets custom commands for admin if ADMIN_TELEGRAM_ID is configured
   * 3. Pre-populates chat scopes for all active team members and clients
   */
  static async setBotCommands(): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      // 1. Set safe universal default commands globally
      const r1 = await fetch(`${TELEGRAM_API}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: this.DEFAULT_COMMANDS,
          scope: { type: 'default' },
        }),
      });
      const data1 = await r1.json();

      // 2. Set custom commands for admin if configured
      const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
      if (adminTelegramId) {
        await this.syncChatCommands(adminTelegramId, 'ADMIN', true);
      }

      // 3. Pre-populate active team members and clients if database is available
      try {
        await dbConnect();
        const activeMembers = await TeamMember.find({ status: 'ACTIVE', telegramChatId: { $exists: true, $ne: '' } }).select('telegramChatId').lean();
        for (const m of activeMembers) {
          if (m.telegramChatId) {
            await this.syncChatCommands(m.telegramChatId, 'TEAM_MEMBER', true);
          }
        }

        const activeClients = await Client.find({ telegramConnected: true, telegramChatId: { $exists: true, $ne: '' } }).select('telegramChatId').lean();
        for (const c of activeClients) {
          if (c.telegramChatId) {
            await this.syncChatCommands(c.telegramChatId, 'CLIENT', true);
          }
        }
      } catch (dbErr) {
        console.warn('Could not batch pre-sync chat scopes from database:', dbErr);
      }

      return data1.ok === true;
    } catch (error) {
      console.error('Failed to set Telegram commands:', error);
      return false;
    }
  }

  /**
   * Send text message to a chat
   */
  static async sendMessage(chatId: string, text: string, timings?: any): Promise<boolean> {
    const res = await this.sendMessageWithResult(chatId, text, timings);
    return res.ok;
  }

  /**
   * Send text message to a chat and return message ID
   */
  static async sendMessageWithResult(chatId: string, text: string, timings?: any): Promise<{ ok: boolean; messageId?: string }> {
    if (!this.isConfigured()) {
      console.warn('Telegram Bot token is missing. Cannot send message.');
      return { ok: false };
    }

    try {
      const apiStart = performance.now();
      if (timings) {
        if (!timings.T3) timings.T3 = apiStart;
        if (!timings.apiCalls) timings.apiCalls = [];
        timings.apiCalls.push('sendMessage');
      }

      const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML',
        }),
      });

      const data = await response.json();
      const apiEnd = performance.now();
      const apiDuration = Math.round(apiEnd - apiStart);
      console.log(`TELEGRAM_API_DURATION: ${apiDuration} ms`);

      if (timings) {
        timings.telegramAPI += apiDuration;
        timings.T4 = apiEnd;
      }
      if (data.ok !== true) {
        console.error(`Telegram sendMessage failed for chat ${chatId}:`, data);
        return { ok: false };
      }
      const messageId = data.result?.message_id ? String(data.result.message_id) : undefined;
      return { ok: true, messageId };
    } catch (error) {
      console.error(`Failed to send Telegram message to ${chatId}:`, error);
      return { ok: false };
    }
  }

  /**
   * Send text message with raw options (including inline keyboard) and full result
   */
  static async sendMessageRaw(
    chatId: string,
    text: string,
    options: { reply_markup?: any; parse_mode?: string } = {}
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Telegram bot token is not configured' };
    }

    try {
      const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options.parse_mode || 'HTML',
          reply_markup: options.reply_markup,
        }),
      });

      const data = await response.json();
      if (data.ok === true) {
        return { success: true, messageId: data.result?.message_id };
      }
      return { success: false, error: data.description || 'Failed to deliver Telegram message' };
    } catch (err: any) {
      console.error('sendMessageRaw error:', err);
      return { success: false, error: err.message || 'Network error' };
    }
  }

  /**
   * Send media (Photo, Document, Video, Audio) to a Telegram chat using multipart/form-data
   */
  static async sendMediaRaw(
    chatId: string,
    type: 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'AUDIO',
    file: Buffer | string,
    fileName: string,
    mimeType: string,
    caption?: string,
    options: { reply_markup?: any; parse_mode?: string } = {}
  ): Promise<{ success: boolean; messageId?: number; fileId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Telegram bot token is not configured' };
    }

    let endpoint = 'sendDocument';
    let fieldKey = 'document';
    if (type === 'IMAGE') {
      endpoint = 'sendPhoto';
      fieldKey = 'photo';
    } else if (type === 'VIDEO') {
      endpoint = 'sendVideo';
      fieldKey = 'video';
    } else if (type === 'AUDIO') {
      endpoint = 'sendAudio';
      fieldKey = 'audio';
    }

    try {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      if (caption) {
        formData.append('caption', caption);
        formData.append('parse_mode', options.parse_mode || 'HTML');
      }
      if (options.reply_markup) {
        formData.append(
          'reply_markup',
          typeof options.reply_markup === 'string'
            ? options.reply_markup
            : JSON.stringify(options.reply_markup)
        );
      }

      if (Buffer.isBuffer(file)) {
        const blob = new Blob([file as any], { type: mimeType || 'application/octet-stream' });
        formData.append(fieldKey, blob, fileName || 'file');
      } else if (typeof file === 'string') {
        formData.append(fieldKey, file);
      }

      const response = await fetch(`${TELEGRAM_API}/${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.ok === true) {
        let fileId: string | undefined;
        if (type === 'IMAGE' && Array.isArray(data.result?.photo) && data.result.photo.length > 0) {
          fileId = data.result.photo[data.result.photo.length - 1].file_id;
        } else if (type === 'DOCUMENT' && data.result?.document) {
          fileId = data.result.document.file_id;
        } else if (type === 'VIDEO' && data.result?.video) {
          fileId = data.result.video.file_id;
        } else if (type === 'AUDIO' && data.result?.audio) {
          fileId = data.result.audio.file_id;
        }

        return { success: true, messageId: data.result?.message_id, fileId };
      }

      return { success: false, error: data.description || `Failed to send Telegram ${type.toLowerCase()}` };
    } catch (err: any) {
      console.error(`sendMediaRaw (${type}) error:`, err);
      return { success: false, error: err.message || 'Network error' };
    }
  }

  /**
   * Answer a Telegram callback query to clear button loading state and optionally show a toast/alert
   */
  static async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
    showAlert: boolean = false
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text || undefined,
          show_alert: showAlert,
        }),
      });
      const data = await res.json();
      return data.ok === true;
    } catch (err) {
      console.error('answerCallbackQuery error:', err);
      return false;
    }
  }

  /**
   * Edit text and reply markup of an existing Telegram message
   */
  static async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    options: { reply_markup?: any; parse_mode?: string } = {}
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const response = await fetch(`${TELEGRAM_API}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: options.parse_mode || 'HTML',
          reply_markup: options.reply_markup,
        }),
      });
      const data = await response.json();
      return !!data.ok;
    } catch (error) {
      console.error('Failed to edit Telegram message text:', error);
      return false;
    }
  }

  /**
   * Edit only the inline keyboard markup of an existing message
   */
  static async editMessageReplyMarkup(
    chatId: string | number,
    messageId: number,
    replyMarkup?: any
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const response = await fetch(`${TELEGRAM_API}/editMessageReplyMarkup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup || { inline_keyboard: [] },
        }),
      });
      const data = await response.json();
      return !!data.ok;
    } catch (error) {
      console.error('Failed to edit Telegram reply markup:', error);
      return false;
    }
  }

  /**
   * Reply keyboard for Client role
   */
  static getClientReplyKeyboard() {
    return {
      keyboard: [
        [{ text: '📊 Profile' }, { text: '📁 Projects' }],
        [{ text: '💰 Payments' }, { text: '🧾 Invoices' }],
        [{ text: '📈 Status' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    };
  }

  /**
   * Reply keyboard for Team Member role
   */
  static getTeamMemberReplyKeyboard() {
    return {
      keyboard: [
        [{ text: '📋 My Tasks' }, { text: '💰 My Payments' }],
        [{ text: '📁 My Projects' }, { text: '👤 My Profile' }],
        [{ text: '❓ Help' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    };
  }

  /**
   * Centralized Telegram identity resolver.
   * Priority: ADMIN -> Conflict Detection -> TEAM_MEMBER -> CLIENT -> UNLINKED
   */
  static async resolveTelegramIdentity(
    telegramUserId: string,
    chatId?: string
  ): Promise<TelegramIdentity> {
    await dbConnect();
    const strUserId = String(telegramUserId);
    const strChatId = chatId ? String(chatId) : undefined;

    // 1. Admin Verification
    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
    if (adminTelegramId && (strUserId === String(adminTelegramId) || strChatId === String(adminTelegramId))) {
      return { type: 'ADMIN', user: { telegramUserId: strUserId, role: 'ADMIN' } };
    }

    // Also check User model for Admin with matching Telegram ID
    const adminUser = await User.findOne({
      role: 'ADMIN',
      $or: [
        { email: 'admin@drdebuggers.com' }, // Default admin fallback
      ],
    }).lean();

    // 2. Lookup TeamMember & Client concurrently
    const [teamMember, client] = await Promise.all([
      TeamMember.findOne({
        $or: [
          { telegramUserId: strUserId },
          ...(strChatId ? [{ telegramChatId: strChatId }] : []),
        ],
      }).lean(),
      Client.findOne({
        telegramConnected: true,
        $or: [
          { telegramUserId: strUserId },
          ...(strChatId ? [{ telegramChatId: strChatId }] : []),
        ],
      }).lean(),
    ]);

    // 3. Conflict Detection: Account linked as both TeamMember and Client
    if (teamMember && client) {
      return { type: 'CONFLICT', teamMember, client, user: adminUser };
    }

    // 4. Team Member
    if (teamMember) {
      return { type: 'TEAM_MEMBER', teamMember };
    }

    // 5. Client
    if (client) {
      return { type: 'CLIENT', client };
    }

    // 6. Unlinked
    return { type: 'UNLINKED' };
  }

  /**
   * Send notification when a new task is assigned to a team member
   */
  static async sendTaskAssignedNotification(
    task: any,
    project: any,
    teamMember: any,
    assignedBy: string = 'Admin'
  ): Promise<boolean> {
    const targetChatId = teamMember.telegramUserId || teamMember.telegramChatId;
    if (!targetChatId) {
      console.warn(`[TASK_NOTIFICATION] Team member ${teamMember.name} (${teamMember._id}) does not have a linked Telegram User ID or Chat ID.`);
      return false;
    }

    const priorityIcons: Record<string, string> = {
      LOW: '🟢',
      MEDIUM: '🟡',
      HIGH: '🔴',
      URGENT: '🚨',
    };
    const icon = priorityIcons[task.priority] || '🟡';
    const dueDateStr = task.dueDate
      ? new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'No due date';

    const text = `🆕 <b>New Task Assigned</b>\n\n` +
      `<b>Project:</b>\n${project.name || 'Project'}\n\n` +
      `<b>Project Code:</b>\n<code>${project.projectCode || 'N/A'}</code>\n\n` +
      `<b>Task:</b>\n${task.title}\n\n` +
      `<b>Task ID:</b>\n<code>${task.taskCode}</code>\n\n` +
      `<b>Priority:</b>\n${icon} ${task.priority}\n\n` +
      `<b>Status:</b>\n<code>${task.status}</code>\n\n` +
      `<b>Due:</b>\n${dueDateStr}\n\n` +
      `<b>Description:</b>\n${task.description || 'No detailed description.'}\n\n` +
      `<b>Assigned by:</b>\n${assignedBy}`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '⚡ Start Working', callback_data: `team_task:start:${task._id}` },
          { text: '✅ Mark as Done', callback_data: `team_task:done:${task._id}` },
        ],
        [
          { text: '📋 View Details', callback_data: `team_task:details:${task._id}` },
          { text: '🔐 Credentials', callback_data: `team_task:credentials:${task._id}` },
        ],
      ],
    };

    const res = await this.sendMessageRaw(String(targetChatId), text, { reply_markup: inlineKeyboard });
    return res.success;
  }

  /**
   * Send status transition notification to admin
   */
  static async sendTaskStatusNotificationToAdmin(task: any, oldStatus: string, newStatus: string, changedBy: string): Promise<boolean> {
    const adminChatId = process.env.ADMIN_TELEGRAM_ID;
    if (!adminChatId) return false;

    const text = `🔔 <b>Task Status Updated</b>\n\n` +
      `<b>Task:</b> ${task.title} (<code>${task.taskCode}</code>)\n` +
      `<b>Status:</b> <code>${oldStatus}</code> ➔ <b>${newStatus}</b>\n` +
      `<b>Updated by:</b> ${changedBy}`;

    const res = await this.sendMessageRaw(String(adminChatId), text);
    return res.success;
  }

  /**
   * Send notification to a team member when a team payment is recorded, marked paid, or cancelled
   */
  static async sendTeamPaymentNotification(
    payment: any,
    teamMember: any,
    project: any,
    task?: any,
    eventType: 'PAID' | 'CANCELLED' = 'PAID'
  ): Promise<boolean> {
    if (!teamMember.telegramChatId) return false;

    const dateStr = payment.paymentDate
      ? new Date(payment.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    let text = '';
    if (eventType === 'CANCELLED') {
      text = `⚠️ <b>Payment Cancelled</b>\n\n` +
        `Hello <b>${teamMember.name}</b>,\n` +
        `Payment <code>${payment.paymentNumber}</code> for <b>₹${payment.amount.toLocaleString('en-IN')}</b> ` +
        `(Project: <b>${project.name}</b>) has been marked as <b>CANCELLED</b>.`;
    } else {
      text = `💰 <b>Payment Received</b>\n\n` +
        `Hello <b>${teamMember.name}</b>,\n` +
        `A payment has been recorded for your work.\n\n` +
        `<b>Project:</b> ${project.name} (<code>${project.projectCode}</code>)\n` +
        (task ? `<b>Task:</b> ${task.title} (<code>${task.taskCode}</code>)\n` : '') +
        `<b>Amount:</b> <b>₹${payment.amount.toLocaleString('en-IN')}</b>\n` +
        `<b>Payment Method:</b> ${payment.paymentMethod}\n` +
        `<b>Payment Date:</b> ${dateStr}\n` +
        (payment.reference ? `<b>Reference:</b> <code>${payment.reference}</code>\n` : '') +
        `<b>Status:</b> <b>PAID</b>\n\n` +
        `Thank you for your contributions!`;
    }

    const res = await this.sendMessageRaw(teamMember.telegramChatId, text);
    return res.success;
  }

  /**
   * Handle incoming callback queries from inline keyboards
   */
  static async handleCallbackQuery(
    cb: any,
    timings?: any
  ): Promise<{ action: string; success: boolean }> {
    const cbId = cb.id;
    const fromUserId = String(cb.from?.id);
    const cbData = (cb.data || '').trim();
    const message = cb.message;
    const cbChatId = String(message?.chat?.id || fromUserId);
    const messageId = message?.message_id;

    console.log(`[TELEGRAM_CALLBACK_RECEIVED]\ncallbackId=${cbId}\nuserId=${fromUserId}\ndata=${cbData}`);

    try {
      // Resolve user identity
      const identity = await this.resolveTelegramIdentity(fromUserId, cbChatId);

      if (
        cbData.startsWith('team_task:') ||
        cbData.startsWith('task_prog:') ||
        cbData.startsWith('task_done:')
      ) {
        return await this.handleTeamTaskCallback(
          cbId,
          fromUserId,
          cbChatId,
          messageId,
          cbData,
          identity,
          message,
          timings
        );
      }

      if (cbData.startsWith('inq:take:') || cbData.startsWith('inq:close:')) {
        const { InquiryService } = await import('./inquiry.service');
        if (cbData.startsWith('inq:take:')) {
          const inqId = cbData.replace('inq:take:', '');
          await this.answerCallbackQuery(cbId, 'Inquiry taken.');
          await InquiryService.takeInquiry(inqId, fromUserId, 'Admin', 'admin@drdebuggers.com');
          await this.sendMessageRaw(cbChatId, `✅ <b>Inquiry Assigned</b>\nYou have taken inquiry.`);
          return { action: 'inquiry_take', success: true };
        } else if (cbData.startsWith('inq:close:')) {
          const inqId = cbData.replace('inq:close:', '');
          await this.answerCallbackQuery(cbId, 'Inquiry closed.');
          await InquiryService.closeInquiry(inqId, 'admin');
          await this.sendMessageRaw(cbChatId, `✅ <b>Inquiry Closed</b>\nInquiry has been closed.`);
          return { action: 'inquiry_close', success: true };
        }
      }

      await this.answerCallbackQuery(cbId, 'Action received.');
      return { action: cbData, success: true };
    } catch (err: any) {
      console.error('handleCallbackQuery uncaught error:', err);
      await this.answerCallbackQuery(cbId, 'An error occurred while processing action.', true);
      return { action: cbData, success: false };
    }
  }

  /**
   * Handle Team Task action buttons
   */
  private static async handleTeamTaskCallback(
    cbId: string,
    fromUserId: string,
    chatId: string,
    messageId: number | undefined,
    cbData: string,
    identity: TelegramIdentity,
    message: any,
    timings?: any
  ): Promise<{ action: string; success: boolean }> {
    let action = 'unknown';
    let taskId = '';

    if (cbData.startsWith('team_task:start:')) {
      action = 'start';
      taskId = cbData.replace('team_task:start:', '');
    } else if (cbData.startsWith('task_prog:')) {
      action = 'start';
      taskId = cbData.replace('task_prog:', '');
    } else if (cbData.startsWith('team_task:done:')) {
      action = 'complete';
      taskId = cbData.replace('team_task:done:', '');
    } else if (cbData.startsWith('team_task:complete:')) {
      action = 'complete';
      taskId = cbData.replace('team_task:complete:', '');
    } else if (cbData.startsWith('task_done:')) {
      action = 'complete';
      taskId = cbData.replace('task_done:', '');
    } else if (cbData.startsWith('team_task:details:')) {
      action = 'details';
      taskId = cbData.replace('team_task:details:', '');
    } else if (cbData.startsWith('team_task:credentials:')) {
      action = 'credentials';
      taskId = cbData.replace('team_task:credentials:', '');
    }

    // Validate task ID format
    const mongoose = (await import('mongoose')).default;
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      await this.answerCallbackQuery(cbId, '❌ Invalid task reference.', true);
      return { action, success: false };
    }

    // 1. Role Authorization
    if (identity.type !== 'TEAM_MEMBER' && identity.type !== 'ADMIN') {
      await this.answerCallbackQuery(cbId, '❌ You are not authorized to access this task.', true);
      await this.sendMessageRaw(chatId, '❌ <b>You are not authorized to access this task.</b>');
      await AuditService.logAction(
        fromUserId,
        'TASK_ACTION_DENIED',
        'Task',
        taskId,
        { reason: 'UNAUTHORIZED_ROLE', telegramUserId: fromUserId, action }
      );
      return { action, success: false };
    }

    if (identity.type === 'TEAM_MEMBER' && identity.teamMember.status !== 'ACTIVE') {
      await this.answerCallbackQuery(cbId, '❌ Your team member account is inactive.', true);
      await this.sendMessageRaw(chatId, '❌ <b>Your team member account is inactive.</b> Please contact the administrator.');
      await AuditService.logAction(
        identity.teamMember.email || fromUserId,
        'TASK_ACTION_DENIED',
        'Task',
        taskId,
        { reason: `INACTIVE_ACCOUNT_STATUS_${identity.teamMember.status}`, telegramUserId: fromUserId, action }
      );
      return { action, success: false };
    }

    // 2. Load Task
    await dbConnect();
    const task = await Task.findById(taskId).populate('projectId', 'name projectCode currency');
    if (!task) {
      await this.answerCallbackQuery(cbId, 'Task not found.', true);
      await this.sendMessageRaw(chatId, '❌ <b>Task not found.</b>');
      return { action, success: false };
    }

    // 3. Assignee Authorization (Team members can only execute actions on their own assigned tasks)
    if (identity.type === 'TEAM_MEMBER') {
      const isAssigned = task.assignedTo?.toString() === identity.teamMember._id.toString();
      if (!isAssigned) {
        await this.answerCallbackQuery(cbId, '❌ You are not authorized to access this task.', true);
        await this.sendMessageRaw(chatId, '❌ <b>You are not authorized to access this task.</b>');
        await AuditService.logAction(
          identity.teamMember.email,
          'TASK_ACTION_DENIED',
          'Task',
          task._id.toString(),
          {
            taskCode: task.taskCode,
            assignedTo: task.assignedTo?.toString(),
            attemptedBy: identity.teamMember._id.toString(),
            telegramUserId: fromUserId,
            action,
            reason: 'NOT_ASSIGNED_TO_TASK',
          }
        );
        return { action, success: false };
      }
    }

    const memberName = identity.teamMember?.name || 'Administrator';
    const memberEmail = identity.teamMember?.email || 'admin';
    const memberId = identity.teamMember?._id || 'admin';
    const pName = (task.projectId as any)?.name || 'Project';
    const pCode = (task.projectId as any)?.projectCode || '';

    // Structured callback logging (Part 19)
    console.log(`[Telegram Callback]\ntelegramUserId: ${fromUserId}\ncallback: ${cbData}\ntaskId: ${taskId}\nrole: ${identity.type}\nauthorization: GRANTED\nresult: PROCESSING`);

    // Log callback action
    await AuditService.logAction(
      memberEmail,
      'TEAM_MEMBER_CALLBACK_ACTION',
      'Task',
      task._id.toString(),
      { action, taskCode: task.taskCode, telegramUserId: fromUserId }
    );

    // 4. Action Execution
    switch (action) {
      case 'start': {
        await this.answerCallbackQuery(cbId, 'Starting task...');

        if (task.status === 'IN_PROGRESS') {
          await this.sendMessageRaw(chatId, 'ℹ️ <b>This task is already in progress.</b>');
          return { action, success: true };
        }
        if (task.status === 'COMPLETED') {
          await this.sendMessageRaw(chatId, 'ℹ️ <b>This task has already been completed.</b>');
          return { action, success: false };
        }
        if (task.status === 'CANCELLED') {
          await this.sendMessageRaw(chatId, '⚠️ <b>This task is cancelled.</b>');
          return { action, success: false };
        }

        task.status = 'IN_PROGRESS';
        await task.save();

        await AuditService.logAction(
          memberEmail,
          'TASK_STARTED',
          'Task',
          task._id.toString(),
          {
            taskId: task._id,
            taskCode: task.taskCode,
            projectId: task.projectId?._id || task.projectId,
            clientId: task.clientId,
            teamMemberId: memberId,
            telegramUserId: fromUserId,
            timestamp: new Date(),
          }
        );

        const priorityIcon = task.priority === 'URGENT' ? '🚨' : (task.priority === 'HIGH' ? '🔴' : (task.priority === 'MEDIUM' ? '🟡' : '🟢'));
        const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No due date';

        const updatedText = `🆕 <b>Task Assigned</b>\n\n` +
          `<b>Project:</b>\n${pName}\n\n` +
          `<b>Task:</b>\n${task.title}\n\n` +
          `<b>Task ID:</b>\n<code>${task.taskCode}</code>\n\n` +
          `<b>Status:</b>\n🟡 <code>IN_PROGRESS</code>\n\n` +
          `<b>Priority:</b>\n${priorityIcon} ${task.priority}\n\n` +
          `<b>Due:</b>\n${dueStr}\n\n` +
          `<b>Description:</b>\n${task.description || 'No detailed description.'}\n\n` +
          `<i>⚡ Started by ${memberName}</i>`;

        const updatedButtons = [
          [
            { text: '📋 View Details', callback_data: `team_task:details:${task._id}` },
            { text: '🔐 Credentials', callback_data: `team_task:credentials:${task._id}` },
          ],
          [
            { text: '✅ Mark as Done', callback_data: `team_task:done:${task._id}` },
          ],
        ];

        if (messageId) {
          await this.editMessageText(chatId, messageId, updatedText, {
            reply_markup: { inline_keyboard: updatedButtons },
          });
        } else {
          await this.sendMessageRaw(chatId, updatedText, { reply_markup: { inline_keyboard: updatedButtons } });
        }
        return { action, success: true };
      }

      case 'complete': {
        await this.answerCallbackQuery(cbId, 'Completing task...');

        if (task.status === 'COMPLETED') {
          await this.sendMessageRaw(chatId, 'ℹ️ <b>This task has already been completed.</b>');
          return { action, success: true };
        }
        if (task.status === 'CANCELLED') {
          await this.sendMessageRaw(chatId, '⚠️ <b>This task is cancelled.</b>');
          return { action, success: false };
        }

        task.status = 'COMPLETED';
        task.completedAt = new Date();
        await task.save();

        await AuditService.logAction(
          memberEmail,
          'TASK_COMPLETED',
          'Task',
          task._id.toString(),
          {
            taskId: task._id,
            taskCode: task.taskCode,
            projectId: task.projectId?._id || task.projectId,
            clientId: task.clientId,
            teamMemberId: memberId,
            telegramUserId: fromUserId,
            timestamp: new Date(),
            completedAt: task.completedAt,
          }
        );

        const updatedText = `✅ <b>Task Completed</b>\n\n` +
          `<b>Project:</b>\n${pName} (<code>${pCode}</code>)\n\n` +
          `<b>Task:</b>\n${task.title}\n\n` +
          `<b>Task ID:</b>\n<code>${task.taskCode}</code>\n\n` +
          `<b>Completed by:</b>\n${memberName}\n\n` +
          `<b>Status:</b>\n<code>COMPLETED</code>\n\n` +
          `<b>Completed At:</b>\n${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

        const updatedButtons = [
          [
            { text: '📋 View Details', callback_data: `team_task:details:${task._id}` },
            { text: '🔐 Credentials', callback_data: `team_task:credentials:${task._id}` },
          ],
        ];

        if (messageId) {
          await this.editMessageText(chatId, messageId, updatedText, {
            reply_markup: { inline_keyboard: updatedButtons },
          });
        } else {
          await this.sendMessageRaw(chatId, updatedText, { reply_markup: { inline_keyboard: updatedButtons } });
        }

        // Notify Admin of completed task
        const adminChatId = process.env.ADMIN_TELEGRAM_ID;
        if (adminChatId) {
          await this.sendMessageRaw(
            adminChatId,
            `✅ <b>Task Completed by Team Member</b>\n\n` +
            `<b>Team Member:</b> ${memberName}\n` +
            `<b>Task:</b> ${task.title} (<code>${task.taskCode}</code>)\n` +
            `<b>Project:</b> ${pName} (<code>${pCode}</code>)\n` +
            `<b>Status:</b> <b>COMPLETED</b>`
          );
        }
        return { action, success: true };
      }

      case 'details': {
        await this.answerCallbackQuery(cbId, 'Loading task details...');
        const priorityIcon = task.priority === 'URGENT' ? '🚨' : (task.priority === 'HIGH' ? '🔴' : (task.priority === 'MEDIUM' ? '🟡' : '🟢'));
        const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No due date';

        await AuditService.logAction(
          memberEmail,
          'TASK_VIEWED',
          'Task',
          task._id.toString(),
          { taskCode: task.taskCode, telegramUserId: fromUserId }
        );

        const detailsMsg = `📋 <b>Task Details</b>\n\n` +
          `<b>Project:</b>\n${pName} (<code>${pCode}</code>)\n\n` +
          `<b>Task:</b>\n${task.title}\n\n` +
          `<b>Task ID:</b>\n<code>${task.taskCode}</code>\n\n` +
          `<b>Priority:</b>\n${priorityIcon} ${task.priority}\n\n` +
          `<b>Status:</b>\n<code>${task.status}</code>\n\n` +
          `<b>Due:</b>\n${dueStr}\n\n` +
          `<b>Description:</b>\n${task.description || 'No description provided.'}\n\n` +
          `<b>Assigned To:</b>\n${memberName}`;

        const buttons: any[] = [];
        if (task.status === 'TODO') {
          buttons.push([
            { text: '⚡ Start Working', callback_data: `team_task:start:${task._id}` },
            { text: '✅ Mark as Done', callback_data: `team_task:done:${task._id}` },
          ]);
        } else if (task.status === 'IN_PROGRESS') {
          buttons.push([{ text: '✅ Mark as Done', callback_data: `team_task:done:${task._id}` }]);
        }
        buttons.push([{ text: '🔐 Credentials', callback_data: `team_task:credentials:${task._id}` }]);

        await this.sendMessageRaw(chatId, detailsMsg, {
          reply_markup: { inline_keyboard: buttons },
        });
        return { action, success: true };
      }

      case 'credentials': {
        await this.answerCallbackQuery(cbId, 'Checking credential access...');

        if (!identity.teamMember?.permissions?.includes('VIEW_CREDENTIALS') && identity.type !== 'ADMIN') {
          await this.sendMessageRaw(chatId, '❌ <b>You are not authorized to access these credentials.</b>');
          await AuditService.logAction(
            memberEmail,
            'TASK_ACTION_DENIED',
            'Task',
            task._id.toString(),
            { reason: 'NO_VIEW_CREDENTIALS_PERMISSION', telegramUserId: fromUserId }
          );
          return { action, success: false };
        }

        if (task.credentialAccessRevoked) {
          await this.sendMessageRaw(chatId, '🔐 <b>Credentials</b>\n\nCredential access for this task has been revoked.');
          return { action, success: false };
        }

        if (!task.requiredCredentialIds || task.requiredCredentialIds.length === 0) {
          await this.sendMessageRaw(chatId, '🔐 <b>Credentials</b>\n\nNo credentials are required for this task.');
          return { action, success: true };
        }

        try {
          const { CredentialSharingService } = await import('./credential-sharing.service');
          await CredentialSharingService.shareTaskCredentials(task._id.toString(), memberEmail);

          await AuditService.logAction(
            memberEmail,
            'TASK_CREDENTIALS_VIEWED',
            'Task',
            task._id.toString(),
            { taskCode: task.taskCode, telegramUserId: fromUserId, requiredCredentialCount: task.requiredCredentialIds.length }
          );

          return { action, success: true };
        } catch (err: any) {
          console.error('Task credential retrieval failed:', err);
          await this.sendMessageRaw(chatId, '❌ <b>Credentials could not be retrieved securely.</b>');
          return { action, success: false };
        }
      }

      default:
        await this.answerCallbackQuery(cbId, 'Unknown task action.', true);
        return { action, success: false };
    }
  }

  /**
   * Handle Team Member Telegram Messages (Commands & Reply Keyboard buttons)
   */
  private static async handleTeamMemberCommand(
    chatId: string,
    text: string,
    teamMember: any,
    timings?: any
  ): Promise<void> {
    const raw = text.trim();
    let cmd = raw.toLowerCase().split(' ')[0];
    if (cmd.includes('@')) cmd = cmd.split('@')[0];

    // Normalize reply keyboard button text
    if (raw === '📋 My Tasks' || raw === 'My Tasks') cmd = '/tasks';
    else if (raw === '💰 My Payments' || raw === 'My Payments') cmd = '/mypayments';
    else if (raw === '📁 My Projects' || raw === 'My Projects') cmd = '/myprojects';
    else if (raw === '👤 My Profile' || raw === 'My Profile') cmd = '/myprofile';
    else if (raw === '❓ Help' || raw === 'Help') cmd = '/help';

    // Log team command
    await AuditService.logAction(
      teamMember.email,
      'TEAM_MEMBER_COMMAND',
      'TeamMember',
      teamMember._id.toString(),
      { command: cmd, rawText: raw }
    );

    switch (cmd) {
      case '/start':
      case '/help':
        await this.sendMessageRaw(
          chatId,
          `<b>👋 Welcome, ${teamMember.name}!</b>\n\n` +
          `You are connected as a <b>Team Member</b>.\n\n` +
          `<b>Your Role:</b> <code>${teamMember.role}</code>\n` +
          `<b>Status:</b> <code>${teamMember.status}</code>\n\n` +
          `<b>Available commands:</b>\n` +
          `/tasks - View your assigned tasks\n` +
          `/mypayments - View your compensation & payment history\n` +
          `/myprojects - View projects you are assigned to\n` +
          `/myprofile - View your profile details\n` +
          `/help - Show this guide`,
          { reply_markup: this.getTeamMemberReplyKeyboard() }
        );
        break;

      case '/tasks':
      case '/mytasks': {
        const dbStart = performance.now();
        const tasks = await Task.find({
          assignedTo: teamMember._id,
          status: { $nin: ['CANCELLED'] },
        })
          .populate('projectId', 'name projectCode')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();
        if (timings) timings.databaseQuery += Math.round(performance.now() - dbStart);

        if (tasks.length === 0) {
          await this.sendMessageRaw(
            chatId,
            `📋 <b>Your Assigned Tasks</b>\n\nYou currently have no active tasks assigned. Great job!`,
            { reply_markup: this.getTeamMemberReplyKeyboard() }
          );
          return;
        }

        const priorityIcons: Record<string, string> = {
          LOW: '🟢',
          MEDIUM: '🟡',
          HIGH: '🔴',
          URGENT: '🚨',
        };

        let msg = `📋 <b>Your Assigned Tasks (${tasks.length})</b>\n\n`;
        for (let i = 0; i < tasks.length; i++) {
          const t: any = tasks[i];
          const icon = priorityIcons[t.priority] || '🟡';
          const pName = t.projectId?.name || 'Project';
          const dueStr = t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No date';
          msg += `<b>${i + 1}. ${t.title}</b>\n` +
                 `   <i>${pName}</i> (<code>${t.taskCode}</code>)\n` +
                 `   ${icon} <b>${t.priority}</b> | Status: <code>${t.status}</code> | Due: ${dueStr}\n\n`;
        }

        // Inline keyboard for active tasks (up to 4)
        const activeTasks = tasks.slice(0, 4);
        const keyboardRows: any[] = [];

        for (const t of activeTasks) {
          const row: any[] = [];
          if (t.status === 'TODO') {
            row.push({ text: `⚡ Start: ${t.taskCode}`, callback_data: `team_task:start:${t._id}` });
            row.push({ text: `✅ Done`, callback_data: `team_task:complete:${t._id}` });
          } else if (t.status === 'IN_PROGRESS') {
            row.push({ text: `✅ Mark Done: ${t.taskCode}`, callback_data: `team_task:complete:${t._id}` });
          }
          row.push({ text: `📋 Details`, callback_data: `team_task:details:${t._id}` });
          if (t.requiredCredentialIds && t.requiredCredentialIds.length > 0 && !t.credentialAccessRevoked) {
            row.push({ text: `🔐 Creds`, callback_data: `team_task:credentials:${t._id}` });
          }
          keyboardRows.push(row);
        }

        await this.sendMessageRaw(chatId, msg, {
          reply_markup: { inline_keyboard: keyboardRows },
        });
        break;
      }

      case '/myprojects':
      case '/projects': {
        const dbStart = performance.now();
        const projects = await Project.find({
          teamMemberIds: teamMember._id,
        })
          .select('name projectCode serviceType status totalAmount currency')
          .lean();
        if (timings) timings.databaseQuery += Math.round(performance.now() - dbStart);

        if (projects.length === 0) {
          await this.sendMessageRaw(
            chatId,
            `📁 <b>Your Projects</b>\n\nYou are not currently assigned to any projects.`,
            { reply_markup: this.getTeamMemberReplyKeyboard() }
          );
          return;
        }

        let msg = `📁 <b>Your Assigned Projects (${projects.length})</b>\n\n`;
        for (let i = 0; i < projects.length; i++) {
          const p: any = projects[i];
          const activeTasksCount = await Task.countDocuments({
            projectId: p._id,
            assignedTo: teamMember._id,
            status: { $in: ['TODO', 'IN_PROGRESS'] },
          });

          msg += `<b>${i + 1}. ${p.name}</b>\n` +
                 `   <b>Code:</b> <code>${p.projectCode}</code> | <b>Type:</b> ${p.serviceType}\n` +
                 `   <b>Status:</b> <code>${p.status}</code> | <b>Active Tasks:</b> ${activeTasksCount}\n\n`;
        }

        await this.sendMessageRaw(chatId, msg, { reply_markup: this.getTeamMemberReplyKeyboard() });
        break;
      }

      case '/mypayments': {
        const dbStart = performance.now();
        const payments = await TeamPayment.find({
          teamMemberId: teamMember._id,
        })
          .populate('projectId', 'name projectCode')
          .populate('taskId', 'title taskCode')
          .sort({ paymentDate: -1, createdAt: -1 })
          .limit(10)
          .lean();
        if (timings) timings.databaseQuery += Math.round(performance.now() - dbStart);

        let totalPaid = 0;
        let totalPending = 0;
        for (const p of payments) {
          if (p.status === 'PAID') totalPaid += p.amount;
          else if (p.status === 'PENDING') totalPending += p.amount;
        }

        if (payments.length === 0) {
          await this.sendMessageRaw(
            chatId,
            `💰 <b>Your Payments</b>\n\nNo payment records found yet for your account.`,
            { reply_markup: this.getTeamMemberReplyKeyboard() }
          );
          return;
        }

        let msg = `💰 <b>Your Payments Summary</b>\n\n` +
          `<b>Paid:</b> ₹${totalPaid.toLocaleString('en-IN')}\n` +
          `<b>Pending:</b> ₹${totalPending.toLocaleString('en-IN')}\n` +
          `<b>Total:</b> ₹${(totalPaid + totalPending).toLocaleString('en-IN')}\n\n` +
          `<b>Recent Payments (${payments.length}):</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n`;

        for (let i = 0; i < payments.length; i++) {
          const p: any = payments[i];
          const pName = p.projectId?.name || 'Project';
          const tName = p.taskId?.title ? ` - ${p.taskId.title}` : '';
          const statusIcon = p.status === 'PAID' ? '✅' : (p.status === 'PENDING' ? '⏳' : '❌');
          const dateStr = p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
          msg += `<b>${i + 1}. ₹${p.amount.toLocaleString('en-IN')}</b> • ${statusIcon} <code>${p.status}</code>\n` +
                 `   <i>${pName}${tName}</i>\n` +
                 `   Date: ${dateStr} | Ref: <code>${p.paymentNumber}</code>\n\n`;
        }

        await this.sendMessageRaw(chatId, msg, { reply_markup: this.getTeamMemberReplyKeyboard() });
        break;
      }

      case '/myprofile':
      case '/profile': {
        const perms = teamMember.permissions && teamMember.permissions.length > 0
          ? teamMember.permissions.join(', ')
          : 'Standard Access';

        const msg = `👤 <b>Team Member Profile</b>\n\n` +
          `<b>Name:</b> ${teamMember.name}\n` +
          `<b>Email:</b> ${teamMember.email}\n` +
          `<b>Phone:</b> ${teamMember.phone || 'N/A'}\n` +
          `<b>Role:</b> <code>${teamMember.role}</code>\n` +
          `<b>Status:</b> <code>${teamMember.status}</code>\n` +
          `<b>Telegram:</b> Connected ✅\n` +
          `<b>Permissions:</b> ${perms}`;

        await this.sendMessageRaw(chatId, msg, { reply_markup: this.getTeamMemberReplyKeyboard() });
        break;
      }

      case '/myproject':
      case '/project':
      case '/payment':
      case '/payments':
      case '/invoice':
      case '/invoices':
      case '/status':
        await AuditService.logAction(
          teamMember.email,
          'TEAM_MEMBER_COMMAND_DENIED',
          'TeamMember',
          teamMember._id.toString(),
          { command: cmd, rawText: raw, reason: 'CLIENT_COMMAND_BLOCKED_FOR_TEAM_MEMBER' }
        );
        await this.sendMessageRaw(
          chatId,
          `ℹ️ <b>This command is not available for team members.</b>\n\n` +
          `Use /help to see your available commands:\n` +
          `• 📋 /tasks - View assigned tasks\n` +
          `• 💰 /mypayments - View payment history\n` +
          `• 📁 /myprojects - View assigned projects\n` +
          `• 👤 /myprofile - View profile\n` +
          `• ❓ /help - Help menu`,
          { reply_markup: this.getTeamMemberReplyKeyboard() }
        );
        break;

      default:
        await this.sendMessageRaw(
          chatId,
          `Unknown team command. Use /tasks to view your assigned tasks, /mypayments for payments, /myprojects for assigned projects, or /help for guidance.`,
          { reply_markup: this.getTeamMemberReplyKeyboard() }
        );
        break;
    }
  }

  /**
   * Send PDF document to a chat
   */
  static async sendDocument(
    chatId: string,
    relativeFilePath: string,
    filename: string,
    caption?: string,
    timings?: any
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('Telegram Bot token is missing. Cannot send document.');
      return false;
    }

    try {
      let fileBuffer: Buffer;

      // Check if relativeFilePath is a dynamic API route instead of a local disk file
      if (relativeFilePath.startsWith('/api/invoices/')) {
        const parts = relativeFilePath.split('/');
        const invoiceId = parts[3]; // /api/invoices/[id]/pdf
        
        const dbStart = performance.now();
        await dbConnect();
        const invoice = await Invoice.findById(invoiceId);
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart);
        }

        if (!invoice || !invoice.pdfStoragePath) {
          throw new Error(`Invoice or storage path not found for: ${relativeFilePath}`);
        }
        
        fileBuffer = await StorageService.getInvoicePDF(invoice.pdfStoragePath);
      } else {
        // Fallback to filesystem (e.g. for legacy files, local testing or standard attachments)
        const fullPath = path.join(process.cwd(), 'public', relativeFilePath);
        if (!fs.existsSync(fullPath)) {
          // If filesystem fallback fails, check if we can resolve it via MongoDB to support virtual test paths
          const filenameOnly = path.basename(relativeFilePath);
          const invoiceNumber = filenameOnly.replace('.pdf', '');
          
          const dbStart = performance.now();
          await dbConnect();
          const invoice = await Invoice.findOne({ invoiceNumber });
          if (timings) {
            timings.databaseQuery += Math.round(performance.now() - dbStart);
          }

          if (invoice && invoice.pdfStoragePath) {
            fileBuffer = await StorageService.getInvoicePDF(invoice.pdfStoragePath);
          } else {
            throw new Error(`File not found at: ${fullPath} and could not be resolved from storage.`);
          }
        } else {
          fileBuffer = fs.readFileSync(fullPath);
        }
      }

      const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' });
      
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('document', blob, filename);
      if (caption) {
        formData.append('caption', caption);
      }

      const apiStart = performance.now();
      if (timings) {
        if (!timings.T3) timings.T3 = apiStart;
        if (!timings.apiCalls) timings.apiCalls = [];
        timings.apiCalls.push('sendDocument');
      }

      const response = await fetch(`${TELEGRAM_API}/sendDocument`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      const apiEnd = performance.now();
      const apiDuration = Math.round(apiEnd - apiStart);
      console.log(`TELEGRAM_API_DURATION: ${apiDuration} ms`);

      if (timings) {
        timings.telegramAPI += apiDuration;
        timings.T4 = apiEnd;
      }
      if (data.ok !== true) {
        console.error(`Telegram sendDocument failed for chat ${chatId}:`, data);
      }
      return data.ok === true;
    } catch (error) {
      console.error(`Failed to send Telegram document to ${chatId}:`, error);
      return false;
    }
  }

  /**
   * Process updates received via Telegram Webhook
   */
  static async handleWebhookUpdate(update: any, T1?: number): Promise<any> {
    const t1Start = T1 || performance.now();
    const startTotal = performance.now();
    const timings: any = {
      clientLookup: 0,
      databaseQuery: 0,
      telegramAPI: 0,
      handler: 0,
      T1: t1Start,
      T2: 0,
      T3: 0,
      T4: 0,
      T5: 0,
      apiCalls: [],
    };

    const dbConnStart = performance.now();
    await dbConnect();
    timings.databaseQuery += Math.round(performance.now() - dbConnStart);

    // Idempotency: Prevent duplicate processing of retried Telegram webhook updates
    const updateId = update?.update_id;
    if (updateId) {
      global.processedTelegramUpdates = global.processedTelegramUpdates || new Set<number>();
      if (global.processedTelegramUpdates.has(updateId)) {
        console.log(`[DEDUPLICATION] Telegram update ${updateId} already processed. Skipping.`);
        return {
          command: 'duplicate',
          clientLookup: 0,
          databaseQuery: 0,
          handler: 0,
          telegramAPI: 0,
          total: 0,
          startTotal,
          timings,
        };
      }
      global.processedTelegramUpdates.add(updateId);
      if (global.processedTelegramUpdates.size > 1000) {
        const first = global.processedTelegramUpdates.values().next().value;
        if (first !== undefined) global.processedTelegramUpdates.delete(first);
      }
    }

    // 1. Handle interactive Inline Keyboard callbacks (e.g. from /tasks)
    if (update?.callback_query) {
      const cbResult = await this.handleCallbackQuery(update.callback_query, timings);
      return {
        command: 'callback',
        action: cbResult.action,
        clientLookup: 0,
        databaseQuery: timings.databaseQuery,
        handler: timings.handler,
        telegramAPI: timings.telegramAPI,
        total: Math.round(performance.now() - startTotal),
        startTotal,
        timings,
      };
    }

    const message = update?.message || update?.edited_message;
    if (!message || !message.chat || !message.from) return;

    const chatId = String(message.chat.id);
    const userId = String(message.from.id);
    const username = message.from.username || '';
    const text = (message.text || message.caption || '').trim();
    const isCommand = text.startsWith('/');
    let messageType: 'text' | 'photo' | 'document' | 'video' | 'audio' = 'text';
    let rawAttachment: any = null;
    if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
      messageType = 'photo';
      rawAttachment = message.photo[message.photo.length - 1];
    } else if (message.document) {
      messageType = 'document';
      rawAttachment = message.document;
    } else if (message.video) {
      messageType = 'video';
      rawAttachment = message.video;
    } else if (message.audio || message.voice) {
      messageType = 'audio';
      rawAttachment = message.audio || message.voice;
    }

    // Safe structured logging of incoming command/message
    if (isCommand) {
      const commandName = text.split(' ')[0];
      console.log(`TELEGRAM_COMMAND_RECEIVED\ncommand=${commandName}\ntelegramUserId=${userId}\nchatId=${chatId}`);
    }

    // Handle Deep Linking connection token (both Team and Client)
    const isStartCommand = text.startsWith('/start');
    let startToken: string | null = null;
    if (isStartCommand) {
      const parts = text.split(' ');
      if (parts.length > 1) {
        startToken = parts[1].trim();
      }
    }

    if (isStartCommand && startToken) {
      if (startToken.startsWith('TEAM_')) {
        // Team member connection flow
        try {
          const handlerStart = performance.now();
          const dbStart = performance.now();
          const member = await TeamMemberService.connectTelegram(startToken, {
            telegramUserId: userId,
            telegramUsername: username,
            telegramChatId: chatId,
          });
          timings.databaseQuery += Math.round(performance.now() - dbStart);

          // Synchronize team member chat command scope
          await this.syncChatCommands(chatId, 'TEAM_MEMBER', true);

          await this.sendMessageRaw(
            chatId,
            `<b>🎉 Telegram Successfully Connected!</b>\n\nHello <b>${member.name}</b>, your Telegram profile is now securely linked to your team account as <b>${member.role}</b>.\n\nYou can use:\n/tasks - View your assigned tasks\n/help - Show help menu`,
            { reply_markup: this.getTeamMemberReplyKeyboard() }
          );

          const handlerTime = performance.now() - handlerStart;
          timings.handler = Math.max(0, Math.round(handlerTime - timings.databaseQuery - timings.telegramAPI));
          const total = Math.round(performance.now() - startTotal);
          return {
            command: text.split(' ')[0],
            clientLookup: timings.clientLookup,
            databaseQuery: timings.databaseQuery,
            handler: timings.handler,
            telegramAPI: timings.telegramAPI,
            total,
            startTotal,
            timings,
          };
        } catch (error: any) {
          const handlerStart = performance.now();
          await this.sendMessage(chatId, `<b>❌ Team Connection Failed</b>\n\n${error.message || 'The token is invalid or has expired.'}`, timings);
          const handlerTime = performance.now() - handlerStart;
          timings.handler = Math.max(0, Math.round(handlerTime - timings.databaseQuery - timings.telegramAPI));
          const total = Math.round(performance.now() - startTotal);
          return {
            command: text.split(' ')[0],
            clientLookup: timings.clientLookup,
            databaseQuery: timings.databaseQuery,
            handler: timings.handler,
            telegramAPI: timings.telegramAPI,
            total,
            startTotal,
            timings,
          };
        }
      } else {
        // Client connection flow
        try {
          const handlerStart = performance.now();
          const dbStart = performance.now();
          const connectedClient = await ClientService.connectTelegram(startToken, {
            telegramUserId: userId,
            telegramUsername: username,
            telegramChatId: chatId,
          });
          timings.databaseQuery += Math.round(performance.now() - dbStart);

          // Synchronize client chat command scope
          await this.syncChatCommands(chatId, 'CLIENT', true);

          await this.sendMessageRaw(
            chatId,
            `<b>🎉 Telegram Successfully Connected!</b>\n\nHello <b>${connectedClient.name}</b>, your Telegram profile is now securely linked to your account with client code <b>${connectedClient.clientCode}</b>.\n\nYou can use the following commands to interact with your account:\n/myprofile - View Profile\n/myproject - View Project Details\n/payments - View Payment Logs\n/invoices - View Billing History\n/status - Check Development Progress`,
            { reply_markup: this.getClientReplyKeyboard() }
          );
          
          const handlerTime = performance.now() - handlerStart;
          timings.handler = Math.max(0, Math.round(handlerTime - timings.databaseQuery - timings.telegramAPI));
          
          const total = Math.round(performance.now() - startTotal);
          return {
            command: text.split(' ')[0],
            clientLookup: timings.clientLookup,
            databaseQuery: timings.databaseQuery,
            handler: timings.handler,
            telegramAPI: timings.telegramAPI,
            total,
            startTotal,
            timings,
          };
        } catch (error: any) {
          const handlerStart = performance.now();
          await this.sendMessage(chatId, `<b>❌ Connection Failed</b>\n\n${error.message || 'The token is invalid or has expired.'}`, timings);
          const handlerTime = performance.now() - handlerStart;
          timings.handler = Math.max(0, Math.round(handlerTime - timings.databaseQuery - timings.telegramAPI));
          
          const total = Math.round(performance.now() - startTotal);
          return {
            command: text.split(' ')[0],
            clientLookup: timings.clientLookup,
            databaseQuery: timings.databaseQuery,
            handler: timings.handler,
            telegramAPI: timings.telegramAPI,
            total,
            startTotal,
            timings,
          };
        }
      }
    }

    // Centralized Identity Resolution
    const lookupStart = performance.now();
    const identity = await this.resolveTelegramIdentity(userId, chatId);
    timings.clientLookup = Math.round(performance.now() - lookupStart);

    // Sync role-based Telegram autocomplete command dropdown
    if (chatId) {
      await this.syncChatCommands(chatId, identity.type);
    }

    // 1. Conflict Check
    if (identity.type === 'CONFLICT') {
      await AuditService.logAction(
        userId,
        'TELEGRAM_ROLE_CONFLICT',
        'Auth',
        undefined,
        { telegramUserId: userId, chatId, teamMemberId: identity.teamMember?._id, clientId: identity.client?._id }
      );
      await AuditService.logAction(
        userId,
        'TELEGRAM_ACCOUNT_CONFLICT',
        'Auth',
        undefined,
        { telegramUserId: userId, chatId, teamMemberId: identity.teamMember?._id, clientId: identity.client?._id }
      );

      await this.sendMessage(
        chatId,
        `⚠️ <b>Account Link Conflict</b>\n\nYour Telegram account is linked to multiple account types (Client & Team Member). Please contact the administrator to resolve your account configuration.\n\n<i>Your Telegram User ID:</i> <code>${userId}</code>`,
        timings
      );
      return { command: 'conflict', total: Math.round(performance.now() - startTotal) };
    }

    // 2. Admin Router
    if (identity.type === 'ADMIN') {
      const handlerStart = performance.now();
      await this.handleAdminCommand(chatId, text, timings);
      const handlerTime = performance.now() - handlerStart;
      timings.handler = Math.max(0, Math.round(handlerTime - timings.databaseQuery - timings.telegramAPI));
      const total = Math.round(performance.now() - startTotal);
      return {
        command: text.split(' ')[0],
        clientLookup: timings.clientLookup,
        databaseQuery: timings.databaseQuery,
        handler: timings.handler,
        telegramAPI: timings.telegramAPI,
        total,
        startTotal,
        timings,
      };
    }

    // 3. Team Member Router
    if (identity.type === 'TEAM_MEMBER') {
      const teamMember = identity.teamMember;
      if (teamMember.status === 'DEACTIVATED') {
        await this.sendMessage(chatId, '❌ <b>Account Deactivated</b>\n\nYour team member account is deactivated. Please contact an administrator.', timings);
        return { command: 'deactivated', total: Math.round(performance.now() - startTotal) };
      }

      const handlerStart = performance.now();
      await this.handleTeamMemberCommand(chatId, text, teamMember, timings);
      const handlerTime = performance.now() - handlerStart;
      timings.handler = Math.max(0, Math.round(handlerTime - timings.databaseQuery - timings.telegramAPI));
      const total = Math.round(performance.now() - startTotal);

      const raw = text.trim();
      let cmdName = isCommand ? text.split(' ')[0] : 'text';
      if (raw === '📋 My Tasks' || raw === 'My Tasks') cmdName = '/tasks';
      else if (raw === '💰 My Payments' || raw === 'My Payments') cmdName = '/mypayments';
      else if (raw === '📁 My Projects' || raw === 'My Projects') cmdName = '/myprojects';
      else if (raw === '👤 My Profile' || raw === 'My Profile') cmdName = '/myprofile';
      else if (raw === '❓ Help' || raw === 'Help') cmdName = '/help';

      return {
        command: cmdName,
        clientLookup: timings.clientLookup,
        databaseQuery: timings.databaseQuery,
        handler: timings.handler,
        telegramAPI: timings.telegramAPI,
        total,
        startTotal,
        timings,
      };
    }

    // 4. Client Router
    if (identity.type === 'CLIENT') {
      const client = identity.client;
      const rawText = text.trim();
      const isClientReplyButton = [
        '📊 Profile', 'Profile',
        '📁 Projects', 'Projects',
        '💰 Payments', 'Payments',
        '🧾 Invoices', 'Invoices',
        '📈 Status', 'Status',
      ].includes(rawText);

      const handlerStart = performance.now();
      let targetRequest: any = null;
      let pending: any[] = [];

      if (!isCommand && !isClientReplyButton) {
        const dbStart = performance.now();

        // 0. In-memory active selection
        if (!targetRequest && global.activeClientRequests && global.activeClientRequests[chatId]) {
          const activeReqId = global.activeClientRequests[chatId];
          targetRequest = await DataRequest.findOne({
            clientId: client._id,
            requestId: activeReqId,
          });
        }

        // 1. Reply-To original request message support
        if (!targetRequest && message.reply_to_message?.message_id) {
          const replyMsgId = String(message.reply_to_message.message_id);
          targetRequest = await DataRequest.findOne({
            clientId: client._id,
            telegramMessageId: replyMsgId,
          });
        }

        // 2. Explicit Request ID in text
        if (!targetRequest && text) {
          const reqIdMatch = text.match(/REQ-\d{4}-\d{4}/i);
          if (reqIdMatch) {
            const matchedId = reqIdMatch[0].toUpperCase();
            targetRequest = await DataRequest.findOne({
              clientId: client._id,
              requestId: matchedId,
            });
          }
        }

        // Query all active requests for this client
        pending = await DataRequest.find({
          clientId: client._id,
          status: { $in: ['PENDING', 'SENT', 'OPENED'] },
        }).sort({ createdAt: -1 });

        timings.databaseQuery += Math.round(performance.now() - dbStart);

        // Intelligent match based on incoming message type
        if (!targetRequest && pending.length > 0) {
          const isCredentialFormat = text.includes(':') && (
            /service/i.test(text) || /user/i.test(text) || /pass/i.test(text)
          );

          if (isCredentialFormat) {
            targetRequest = pending.find(r => r.type === 'CREDENTIAL') || pending[0];
          } else if (message.photo) {
            targetRequest = pending.find(r => r.type === 'IMAGE') || pending[0];
          } else if (message.document) {
            targetRequest = pending.find(r => r.type === 'DOCUMENT') || pending[0];
          } else {
            targetRequest = pending[0];
          }
        }
      }

      const routerPath = (isCommand || isClientReplyButton) ? 'command' : (targetRequest ? 'request-response' : 'fallback');

      console.log(`[REQUEST_DEBUG]\nupdateId=${updateId || 'null'}\ntelegramUserId=${userId}\nchatId=${chatId}\nmessageType=${messageType}\nisCommand=${isCommand}\ncommand=${isCommand ? text.split(' ')[0] : 'null'}\nclientFound=${!!client}\nclientId=${client?._id ? String(client._id) : 'null'}\nactiveRequestFound=${!!targetRequest}\nactiveRequestId=${targetRequest?.requestId || 'null'}\nrouterPath=${routerPath}`);

      if (isCommand || isClientReplyButton) {
        await this.handleClientCommand(chatId, client, text, timings);
      } else if (targetRequest) {
        await this.handleClientResponse(chatId, client, message, targetRequest, pending, timings);
      } else {
        await this.sendMessageRaw(
          chatId,
          `<b>👋 Welcome to Dr Debuggers.</b>\n\nYou do not have any pending requests to respond to. Type /help to see available commands.`,
          { reply_markup: this.getClientReplyKeyboard() }
        );
      }

      const handlerTime = performance.now() - handlerStart;
      timings.handler = Math.max(0, Math.round(handlerTime - timings.databaseQuery - timings.telegramAPI));
      const total = Math.round(performance.now() - startTotal);

      let clientCmdName = isCommand ? text.split(' ')[0] : 'response';
      if (rawText === '📊 Profile' || rawText === 'Profile') clientCmdName = '/myprofile';
      else if (rawText === '📁 Projects' || rawText === 'Projects') clientCmdName = '/myproject';
      else if (rawText === '💰 Payments' || rawText === 'Payments') clientCmdName = '/payments';
      else if (rawText === '🧾 Invoices' || rawText === 'Invoices') clientCmdName = '/invoices';
      else if (rawText === '📈 Status' || rawText === 'Status') clientCmdName = '/status';

      return {
        command: clientCmdName,
        clientLookup: timings.clientLookup,
        databaseQuery: timings.databaseQuery,
        handler: timings.handler,
        telegramAPI: timings.telegramAPI,
        total,
        startTotal,
        timings,
      };
    }

    // 5. Unlinked User / Public Inquiry Flow
    const handlerStart = performance.now();
    const dbStart = performance.now();
    const clientByUsername = username ? await Client.findOne({ telegramUsername: username }) : null;
    timings.databaseQuery += Math.round(performance.now() - dbStart);

    if (clientByUsername && !clientByUsername.telegramConnected) {
      clientByUsername.telegramConnected = true;
      clientByUsername.telegramUserId = userId;
      clientByUsername.telegramChatId = chatId;
      await clientByUsername.save();

      await this.sendMessageRaw(
        chatId,
        `<b>🎉 Welcome back, ${clientByUsername.name}!</b>\n\nYour account has been matched. Use /help to see commands.`,
        { reply_markup: this.getClientReplyKeyboard() }
      );

      const handlerTime = performance.now() - handlerStart;
      timings.handler = Math.max(0, Math.round(handlerTime - timings.databaseQuery - timings.telegramAPI));
      const total = Math.round(performance.now() - startTotal);
      return {
        command: text.split(' ')[0],
        clientLookup: timings.clientLookup,
        databaseQuery: timings.databaseQuery,
        handler: timings.handler,
        telegramAPI: timings.telegramAPI,
        total,
        startTotal,
        timings,
      };
    }

    const { InquiryService } = await import('./inquiry.service');
    const fullName = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ') || username;
    const inqResult = await InquiryService.handlePublicMessage(
      userId,
      chatId,
      username,
      fullName,
      text,
      messageType,
      rawAttachment
    );

    const handlerTime = performance.now() - handlerStart;
    timings.handler = Math.max(0, Math.round(handlerTime - timings.databaseQuery - timings.telegramAPI));
    const total = Math.round(performance.now() - startTotal);

    return {
      command: isCommand ? text.split(' ')[0] : 'inquiry',
      inquiryMode: inqResult.mode,
      clientLookup: timings.clientLookup,
      databaseQuery: timings.databaseQuery,
      handler: timings.handler,
      telegramAPI: timings.telegramAPI,
      total,
      startTotal,
      timings,
    };
  }

  /**
   * Handle Client bot commands
   */
  private static async handleClientCommand(
    chatId: string,
    client: any,
    text: string,
    timings?: { telegramAPI: number; databaseQuery: number }
  ): Promise<void> {
    const raw = text.trim();
    let cmd = raw.toLowerCase().split(' ')[0];
    if (cmd.includes('@')) {
      cmd = cmd.split('@')[0];
    }

    // Normalize reply keyboard button text
    if (raw === '📊 Profile' || raw === 'Profile') cmd = '/myprofile';
    else if (raw === '📁 Projects' || raw === 'Projects') cmd = '/myproject';
    else if (raw === '💰 Payments' || raw === 'Payments') cmd = '/payments';
    else if (raw === '🧾 Invoices' || raw === 'Invoices') cmd = '/invoices';
    else if (raw === '📈 Status' || raw === 'Status') cmd = '/status';

    switch (cmd) {
      case '/start':
      case '/help':
        await this.sendMessageRaw(
          chatId,
          `<b>👋 Hello, ${client.name}!</b>\n\nHere are the available commands:\n/myprofile - View Profile Information\n/myproject - View Project Budgets\n/payments - View Payments List\n/invoices - View Invoices & PDF\n/status - Check Current Phase`,
          { reply_markup: this.getClientReplyKeyboard() }
        );
        break;

      case '/myprofile':
        await this.sendMessage(
          chatId,
          `<b>👤 Client Profile</b>\n\n` +
          `<b>Client Code:</b> ${client.clientCode}\n` +
          `<b>Name:</b> ${client.name}\n` +
          `<b>Company:</b> ${client.company || 'N/A'}\n` +
          `<b>Email:</b> ${client.email}\n` +
          `<b>Phone:</b> ${client.phone || 'N/A'}\n` +
          `<b>Address:</b> ${client.address || ''}, ${client.city || ''}, ${client.country || ''}`,
          timings
        );
        break;

      case '/project':
      case '/projects':
      case '/myproject': {
        const parts = text.split(' ').filter(Boolean);
        const specificCode = parts.length > 1 ? parts[1].trim().toUpperCase() : null;

        const dbStart = performance.now();
        const projectQuery: any = { clientId: client._id };
        if (specificCode) {
          projectQuery.projectCode = specificCode;
        }

        const projects = await Project.find(projectQuery)
          .select('projectCode name serviceType totalAmount currency status startDate expectedCompletionDate')
          .lean();
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart);
        }

        if (projects.length === 0) {
          if (specificCode) {
            await this.sendMessage(chatId, `Project <code>${specificCode}</code> not found or access denied.`, timings);
          } else {
            await this.sendMessage(chatId, 'No active projects found for your account.', timings);
          }
          return;
        }

        const dbStart2 = performance.now();
        const projectsWithBalances = await Promise.all(
          projects.map(async (p) => {
            const payments = await Payment.find({ projectId: p._id, status: 'COMPLETED' })
              .select('amount')
              .lean();
            const paidAmount = payments.reduce((sum, pay) => sum + pay.amount, 0);
            const outstandingAmount = Math.max(0, p.totalAmount - paidAmount);
            return {
              project: p,
              paidAmount,
              outstandingAmount,
            };
          })
        );
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart2);
        }

        let msg = '<b>💻 Project Budget Details</b>\n\n';
        for (const item of projectsWithBalances) {
          const { project: p, paidAmount, outstandingAmount } = item;
          const currencySymbol = p.currency === 'INR' ? '₹' : (p.currency === 'USD' ? '$' : p.currency);
          msg += `<b>Project:</b> ${p.name}\n` +
                 `<b>Code:</b> <code>${p.projectCode}</code>\n` +
                 `<b>Service:</b> ${p.serviceType}\n` +
                 `<b>Status:</b> <code>${p.status}</code>\n` +
                 `<b>Budget:</b> ${currencySymbol}${p.totalAmount.toLocaleString('en-IN')}\n` +
                 `<b>Paid:</b> ${currencySymbol}${paidAmount.toLocaleString('en-IN')}\n` +
                 `<b>Outstanding:</b> ${currencySymbol}${outstandingAmount.toLocaleString('en-IN')}\n\n`;
        }

        if (projectsWithBalances.length > 1 && !specificCode) {
          msg += `<i>Tip: Use <code>/project &lt;projectCode&gt;</code> to view a specific project.</i>`;
        }

        await this.sendMessage(chatId, msg, timings);
        break;
      }

      case '/payment':
      case '/payments': {
        const parts = text.split(' ').filter(Boolean);
        const specificCode = parts.length > 1 ? parts[1].trim().toUpperCase() : null;

        const dbStart = performance.now();
        const projectQuery: any = { clientId: client._id };
        if (specificCode) {
          projectQuery.projectCode = specificCode;
        }

        const projects = await Project.find(projectQuery)
          .select('projectCode name totalAmount currency')
          .lean();
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart);
        }

        if (projects.length === 0) {
          if (specificCode) {
            await this.sendMessage(chatId, `Project <code>${specificCode}</code> not found or access denied.`, timings);
          } else {
            await this.sendMessage(chatId, 'No projects found.', timings);
          }
          return;
        }

        const dbStart2 = performance.now();
        const projectsWithPayments = await Promise.all(
          projects.map(async (p) => {
            const payments = await Payment.find({ projectId: p._id, status: 'COMPLETED' })
              .select('amount paymentType paymentMethod paymentNumber paymentDate')
              .sort({ paymentDate: -1 })
              .lean();
            return {
              project: p,
              payments,
            };
          })
        );
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart2);
        }

        let msg = '<b>💳 Payment History</b>\n\n';
        for (const item of projectsWithPayments) {
          const { project: p, payments } = item;
          const paidAmount = payments.reduce((sum, r) => sum + r.amount, 0);
          const outstandingAmount = Math.max(0, p.totalAmount - paidAmount);
          const currencySymbol = p.currency === 'INR' ? '₹' : (p.currency === 'USD' ? '$' : p.currency);

          msg += `<b>Project:</b> ${p.name} (<code>${p.projectCode}</code>)\n` +
                 `<b>Total:</b> ${currencySymbol}${p.totalAmount.toLocaleString('en-IN')}\n` +
                 `<b>Paid:</b> ${currencySymbol}${paidAmount.toLocaleString('en-IN')}\n` +
                 `<b>Outstanding:</b> ${currencySymbol}${outstandingAmount.toLocaleString('en-IN')}\n\n`;

          if (payments.length > 0) {
            msg += `<b>Transactions:</b>\n`;
            let idx = 1;
            for (const r of payments) {
              const pType = r.paymentType || 'INSTALLMENT';
              msg += `${idx}. ${currencySymbol}${r.amount.toLocaleString('en-IN')} - ${pType} via ${r.paymentMethod} (${r.paymentNumber})\n`;
              idx++;
            }
          } else {
            msg += `No payments recorded yet for this project.\n`;
          }
          msg += `\n--------------------------------\n\n`;
        }

        if (projectsWithPayments.length > 1 && !specificCode) {
          msg += `<i>Tip: Use <code>/payments &lt;projectCode&gt;</code> to view transactions for a single project.</i>`;
        }

        await this.sendMessage(chatId, msg, timings);
        break;
      }

      case '/invoices': {
        const dbStart = performance.now();
        const invoices = await Invoice.find({ clientId: client._id })
          .populate('projectId', 'projectCode name')
          .select('invoiceNumber projectId total status invoiceDate currency')
          .sort({ createdAt: -1 })
          .lean();
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart);
        }

        if (invoices.length === 0) {
          await this.sendMessage(chatId, 'No invoices generated yet.', timings);
          return;
        }

        let msg = '<b>📄 Your Invoices</b>\n\n';
        for (const inv of invoices) {
          const currencySymbol = inv.currency === 'INR' ? '₹' : (inv.currency === 'USD' ? '$' : inv.currency);
          const projName = (inv.projectId as any)?.name ? ` (${(inv.projectId as any).name})` : '';
          msg += `<b>Invoice:</b> ${inv.invoiceNumber}${projName}\n` +
                 `<b>Amount:</b> ${currencySymbol}${inv.total.toLocaleString('en-IN')}\n` +
                 `<b>Status:</b> <code>${inv.status}</code>\n` +
                 `<b>Date:</b> ${new Date(inv.invoiceDate).toLocaleDateString()}\n` +
                 `To download PDF, send:\n<code>/invoice ${inv.invoiceNumber}</code>\n\n` +
                 `--------------------------------\n\n`;
        }
        await this.sendMessage(chatId, msg, timings);
        break;
      }

      case '/invoice': {
        const parts = text.split(' ');
        if (parts.length < 2) {
          await this.sendMessage(chatId, 'Please specify the invoice number, e.g., <code>/invoice INV-2026-0001</code>', timings);
          return;
        }
        const invoiceNumber = parts[1].trim().toUpperCase();

        const dbStart = performance.now();
        const invoice = await Invoice.findOne({ invoiceNumber, clientId: client._id })
          .select('invoiceNumber total status pdfPath currency')
          .lean();
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart);
        }

        if (!invoice) {
          await this.sendMessage(chatId, `Invoice <b>${invoiceNumber}</b> not found or access denied.`, timings);
          return;
        }

        await this.sendMessage(chatId, `Sending PDF for Invoice <b>${invoiceNumber}</b>...`, timings);

        if (invoice.pdfPath) {
          const filename = `${invoice.invoiceNumber}.pdf`;
          const currencySymbol = invoice.currency === 'INR' ? '₹' : (invoice.currency === 'USD' ? '$' : invoice.currency);
          await this.sendDocument(
            chatId,
            invoice.pdfPath,
            filename,
            `Invoice ${invoice.invoiceNumber}\nAmount: ${currencySymbol}${invoice.total.toLocaleString('en-IN')}\nStatus: ${invoice.status}`,
            timings
          );
        } else {
          await this.sendMessage(chatId, `PDF for Invoice ${invoice.invoiceNumber} is not generated yet.`, timings);
        }
        break;
      }

      case '/status': {
        const parts = text.split(' ').filter(Boolean);
        const specificCode = parts.length > 1 ? parts[1].trim().toUpperCase() : null;

        const dbStart = performance.now();
        const projectQuery: any = { clientId: client._id };
        if (specificCode) {
          projectQuery.projectCode = specificCode;
        }

        const projects = await Project.find(projectQuery)
          .select('projectCode name totalAmount currency status')
          .lean();
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart);
        }

        if (projects.length === 0) {
          if (specificCode) {
            await this.sendMessage(chatId, `Project <code>${specificCode}</code> not found or access denied.`, timings);
          } else {
            await this.sendMessage(chatId, 'No active projects.', timings);
          }
          return;
        }

        const dbStart2 = performance.now();
        const projectsWithStatus = await Promise.all(
          projects.map(async (p) => {
            const payments = await Payment.find({ projectId: p._id, status: 'COMPLETED' })
              .select('amount')
              .lean();
            const paidAmount = payments.reduce((sum, pay) => sum + pay.amount, 0);
            const outstandingAmount = Math.max(0, p.totalAmount - paidAmount);
            return {
              project: p,
              paidAmount,
              outstandingAmount,
            };
          })
        );
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart2);
        }

        let msg = '';
        for (const item of projectsWithStatus) {
          const { project: p, paidAmount, outstandingAmount } = item;
          let paymentStatus = 'UNPAID';
          if (paidAmount >= p.totalAmount) {
            paymentStatus = 'PAID';
          } else if (paidAmount > 0) {
            paymentStatus = 'PARTIALLY_PAID';
          }

          const currencySymbol = p.currency === 'INR' ? '₹' : (p.currency === 'USD' ? '$' : p.currency);

          msg += `📊 <b>Project Status: ${p.name}</b>\n` +
                 `<b>Code:</b> <code>${p.projectCode}</code>\n\n` +
                 `<b>Budget:</b> ${currencySymbol}${p.totalAmount.toLocaleString('en-IN')}\n` +
                 `<b>Paid:</b> ${currencySymbol}${paidAmount.toLocaleString('en-IN')}\n` +
                 `<b>Outstanding:</b> ${currencySymbol}${outstandingAmount.toLocaleString('en-IN')}\n\n` +
                 `<b>Development:</b> <code>${p.status}</code>\n` +
                 `<b>Payment:</b> <code>${paymentStatus}</code>\n\n` +
                 `--------------------------------\n\n`;
        }

        if (projectsWithStatus.length > 1 && !specificCode) {
          msg += `<i>Tip: Use <code>/status &lt;projectCode&gt;</code> to check status of a specific project.</i>`;
        }

        await this.sendMessage(chatId, msg, timings);
        break;
      }

      case '/requests': {
        const dbStart = performance.now();
        const pending = await DataRequest.find({
          clientId: client._id,
          status: { $in: ['PENDING', 'SENT'] },
        }).sort({ createdAt: 1 });
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart);
        }

        if (pending.length === 0) {
          await this.sendMessage(chatId, '📋 You have no pending information requests at this time.', timings);
        } else {
          let msg = '📋 <b>Your Pending Requests</b>\n\n';
          pending.forEach((req, idx) => {
            msg += `${idx + 1}. <b>${req.title}</b> (${req.type})\n` +
              `Request ID: <code>${req.requestId}</code>\n` +
              `Instruction: ${req.message}\n\n`;
          });
          msg += `To respond to a request, you can reply directly, or if you have multiple, type <code>/request [number]</code> (e.g. <code>/request 1</code>) to select it.`;
          await this.sendMessage(chatId, msg, timings);
        }
        break;
      }

      case '/request': {
        const parts = text.split(' ');
        const index = parts.length > 1 ? parseInt(parts[1], 10) - 1 : -1;
        
        const dbStart = performance.now();
        const pending = await DataRequest.find({
          clientId: client._id,
          status: { $in: ['PENDING', 'SENT'] },
        }).sort({ createdAt: 1 });
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart);
        }

        if (index >= 0 && index < pending.length) {
          const selected = pending[index];
          
          // Set active request in global memory
          global.activeClientRequests = global.activeClientRequests || {};
          global.activeClientRequests[chatId] = selected.requestId;

          let formatBlock = '';
          if (selected.type === 'CREDENTIAL') {
            const fields = selected.requiredFields && selected.requiredFields.length > 0
              ? selected.requiredFields
              : ['Service', 'Username', 'Password', 'Login URL'];
            formatBlock = `\n\nPlease reply using this exact format:\n\n<code>\n${fields.map(f => `${f}:`).join('\n')}\n</code>`;
          }

          await this.sendMessage(
            chatId,
            `🎯 <b>Active Request Selected: ${selected.title}</b>\n\n` +
            `Message: ${selected.message}` +
            `${formatBlock}\n\n` +
            `Please send your response now.`,
            timings
          );
        } else {
          await this.sendMessage(chatId, `❌ Invalid request selection. Type /requests to see the list.`, timings);
        }
        break;
      }

      case '/tasks':
      case '/mytasks':
      case '/mypayments':
      case '/myprojects':
        await this.sendMessageRaw(
          chatId,
          `ℹ️ <b>Unknown command.</b>\n\nUse /help to see your available commands.`,
          { reply_markup: this.getClientReplyKeyboard() }
        );
        break;

      default:
        await this.sendMessage(chatId, 'Unknown command. Use /help to see the available commands.', timings);
    }
  }

  /**
   * Handle Admin bot commands
   */
  private static async handleAdminCommand(
    chatId: string,
    text: string,
    timings?: { telegramAPI: number; databaseQuery: number }
  ): Promise<void> {
    const args = text.split(' ');
    let cmd = args[0].toLowerCase();
    if (cmd.includes('@')) {
      cmd = cmd.split('@')[0];
    }

    switch (cmd) {
      case '/start':
      case '/admin':
      case '/help':
        await this.sendMessage(
          chatId,
          `<b>🛠️ Admin Terminal Menu</b>\n\n` +
          `/clients - Show all clients\n` +
          `/client &lt;clientCode&gt; - Show client profile details\n` +
          `/payments - Show recent payments\n` +
          `/pending - Show pending/unpaid invoices\n` +
          `/invoices - Show all invoices`,
          timings
        );
        break;

      case '/clients': {
        const dbStart = performance.now();
        const clients = await Client.find().limit(10).sort({ createdAt: -1 });
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart);
        }

        if (clients.length === 0) {
          await this.sendMessage(chatId, 'No clients registered.', timings);
          return;
        }

        let msg = '<b>👥 Client List (Recent 10)</b>\n\n';
        for (const c of clients) {
          msg += `Code: <code>${c.clientCode}</code> | <b>${c.name}</b>\n` +
                 `Status: ${c.status} | Telegram: ${c.telegramConnected ? '✅ Connected' : '❌ Linked'}\n\n`;
        }
        await this.sendMessage(chatId, msg, timings);
        break;
      }

      case '/client': {
        if (args.length < 2) {
          await this.sendMessage(chatId, 'Please specify clientCode: <code>/client CLIENT-CODE</code>', timings);
          return;
        }

        const code = args[1].toUpperCase().trim();
        const dbStart = performance.now();
        const c = await Client.findOne({ clientCode: code });
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart);
        }

        if (!c) {
          await this.sendMessage(chatId, `Client with code <b>${code}</b> not found.`, timings);
          return;
        }

        // Projects
        const dbStart2 = performance.now();
        const projects = await Project.find({ clientId: c._id });
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart2);
        }

        let projectsStr = '';
        let totalRevenue = 0;
        let totalPaid = 0;
        
        for (const p of projects) {
          const dbStart3 = performance.now();
          const bal = await PaymentService.calculateProjectBalances(p._id.toString());
          if (timings) {
            timings.databaseQuery += Math.round(performance.now() - dbStart3);
          }

          totalRevenue += p.totalAmount;
          totalPaid += bal.paidAmount;
          projectsStr += `- ${p.name} (${p.status}): ${p.currency} ${p.totalAmount.toLocaleString('en-IN')}\n`;
        }

        const outstanding = totalRevenue - totalPaid;

        await this.sendMessage(
          chatId,
          `<b>👤 Client Profile: ${c.name}</b>\n` +
          `<b>Code:</b> <code>${c.clientCode}</code>\n` +
          `<b>Email:</b> ${c.email}\n` +
          `<b>Phone:</b> ${c.phone || 'N/A'}\n` +
          `<b>Status:</b> ${c.status}\n` +
          `<b>Telegram Connect:</b> ${c.telegramConnected ? '✅ Yes' : '❌ No'}\n\n` +
          `<b>💼 Financial Metrics:</b>\n` +
          `- Total Project Value: Rs. ${totalRevenue.toLocaleString('en-IN')}\n` +
          `- Total Paid: Rs. ${totalPaid.toLocaleString('en-IN')}\n` +
          `- Outstanding Balance: Rs. ${outstanding.toLocaleString('en-IN')}\n\n` +
          `<b>Projects:</b>\n${projectsStr || 'No projects.'}`,
          timings
        );
        break;
      }

      case '/payments': {
        const dbStart = performance.now();
        const payments = await Payment.find().populate('clientId', 'name').sort({ paymentDate: -1 }).limit(10);
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart);
        }

        if (payments.length === 0) {
          await this.sendMessage(chatId, 'No payments recorded.', timings);
          return;
        }

        let msg = '<b>💳 Recent Payments (Recent 10)</b>\n\n';
        for (const p of payments) {
          msg += `<b>${p.paymentNumber}</b> | ${(p.clientId as any).name}\n` +
                 `Amount: ${p.currency} ${p.amount.toLocaleString('en-IN')} | Ref: ${p.transactionReference || 'N/A'}\n` +
                 `Date: ${new Date(p.paymentDate).toLocaleDateString()} | Status: ${p.status}\n\n`;
        }
        await this.sendMessage(chatId, msg, timings);
        break;
      }

      case '/pending': {
        const dbStart = performance.now();
        const invoices = await Invoice.find({ status: { $ne: 'PAID' } }).populate('clientId', 'name').limit(10);
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart);
        }

        if (invoices.length === 0) {
          await this.sendMessage(chatId, 'No outstanding invoices.', timings);
          return;
        }

        let msg = '<b>⚠️ Pending Invoices</b>\n\n';
        for (const inv of invoices) {
          msg += `<b>${inv.invoiceNumber}</b> | ${(inv.clientId as any).name}\n` +
                 `Total: ${inv.currency} ${inv.total.toLocaleString('en-IN')} | Due: ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'}\n` +
                 `Status: ${inv.status}\n\n`;
        }
        await this.sendMessage(chatId, msg, timings);
        break;
      }

      case '/invoices': {
        const dbStart = performance.now();
        const invoices = await Invoice.find().populate('clientId', 'name').sort({ createdAt: -1 }).limit(10);
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart);
        }

        if (invoices.length === 0) {
          await this.sendMessage(chatId, 'No invoices generated.', timings);
          return;
        }

        let msg = '<b>📄 Recent Invoices (Recent 10)</b>\n\n';
        for (const inv of invoices) {
          msg += `<b>${inv.invoiceNumber}</b> | ${(inv.clientId as any).name}\n` +
                 `Total: ${inv.currency} ${inv.total.toLocaleString('en-IN')} | Date: ${new Date(inv.invoiceDate).toLocaleDateString()}\n` +
                 `Status: ${inv.status}\n\n`;
        }
        await this.sendMessage(chatId, msg, timings);
        break;
      }

      default:
        await this.sendMessage(chatId, 'Unknown command. Use /admin to view the menu.', timings);
    }
  }

  /**
   * Handle incoming non-command client responses
   */
  private static async handleClientResponse(
    chatId: string,
    client: any,
    message: any,
    targetRequest: any,
    pending: any[],
    timings?: any
  ): Promise<void> {
    const text = (message.text || '').trim();

    if (!targetRequest) {
      if (pending.length === 0) {
        await this.sendMessage(chatId, '👋 You do not have any pending requests to respond to. Type /help to see available commands.', timings);
        return;
      }
      // Prompt user to select if there are multiple and none explicitly targeted
      let msg = `📋 <b>You have multiple pending requests</b>\n\nPlease select which request you are responding to:\n\n`;
      pending.forEach((req, idx) => {
        msg += `${idx + 1}. <b>${req.title}</b> (Type <code>/request ${idx + 1}</code> to respond)\n`;
      });
      await this.sendMessage(chatId, msg, timings);
      return;
    }

    // Check if request is expired
    if (targetRequest.expiresAt && new Date() > targetRequest.expiresAt) {
      const dbStart = performance.now();
      targetRequest.status = 'EXPIRED';
      await targetRequest.save();
      if (timings) {
        timings.databaseQuery += Math.round(performance.now() - dbStart);
      }
      await this.sendMessage(chatId, `⚠️ This request (<b>${targetRequest.title}</b>) has expired. Please contact the administrator.`, timings);
      return;
    }

    // Now process the response according to the request type!
    try {
      if (targetRequest.type === 'CREDENTIAL') {
        // Robust case-insensitive parsing of field lines
        const lines = text.split('\n');
        const parsedFields: Record<string, string> = {};
        for (const line of lines) {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            const rawKey = line.slice(0, colonIdx).trim().toLowerCase();
            const val = line.slice(colonIdx + 1).trim();
            if (val) {
              parsedFields[rawKey] = val;
              parsedFields[rawKey.replace(/[\s_\-]+/g, '')] = val;
            }
          }
        }

        // Normalize field values
        const serviceInput = (
          parsedFields['service'] ||
          parsedFields['servicename'] ||
          parsedFields['service_name'] ||
          parsedFields['platform'] ||
          parsedFields['host'] ||
          targetRequest.credentialType ||
          targetRequest.title ||
          'General Service'
        ).trim();

        const usernameInput = (
          parsedFields['username'] ||
          parsedFields['user'] ||
          parsedFields['user_name'] ||
          parsedFields['email'] ||
          parsedFields['login'] ||
          parsedFields['account'] ||
          parsedFields['id'] ||
          ''
        ).trim();

        const passwordInput = (
          parsedFields['password'] ||
          parsedFields['pass'] ||
          parsedFields['pwd'] ||
          parsedFields['secret'] ||
          parsedFields['key'] ||
          parsedFields['token'] ||
          ''
        ).trim();

        const loginUrlInput = (
          parsedFields['login url'] ||
          parsedFields['loginurl'] ||
          parsedFields['url'] ||
          parsedFields['link'] ||
          parsedFields['host'] ||
          parsedFields['domain'] ||
          parsedFields['website'] ||
          ''
        ).trim();

        const additionalInfoInput = (
          parsedFields['additional info'] ||
          parsedFields['additionalinfo'] ||
          parsedFields['notes'] ||
          parsedFields['note'] ||
          parsedFields['info'] ||
          parsedFields['port'] ||
          parsedFields['database'] ||
          parsedFields['db'] ||
          ''
        ).trim();

        // Check required fields
        const missingFields: string[] = [];
        if (!serviceInput) missingFields.push('Service');
        if (!usernameInput) missingFields.push('Username');
        if (!passwordInput) missingFields.push('Password');

        if (missingFields.length > 0) {
          const fieldLabel = missingFields.length === 1 ? 'The following field is missing:' : 'The following fields are missing:';
          const missingFormatted = missingFields.map((f: string) => `<b>${f}</b>`).join('\n');
          const reqFormat = ['Service', 'Username', 'Password', 'Login URL'];
          await this.sendMessage(
            chatId,
            `❌ <b>Credential submission incomplete</b>\n\n` +
            `${fieldLabel}\n\n` +
            `${missingFormatted}\n\n` +
            `Please reply using this format:\n\n` +
            `<code>\n${reqFormat.map((f: string) => `${f}:`).join('\n')}\n</code>`,
            timings
          );
          return;
        }

        // Encrypt the fields using authenticated encryption
        const { encrypt } = await import('@/lib/security/encryption');
        
        let serviceEnc, usernameEnc, passwordEnc, loginUrlEnc, additionalInfoEnc;
        try {
          serviceEnc = encrypt(serviceInput, 'service');
          usernameEnc = encrypt(usernameInput, 'username');
          passwordEnc = encrypt(passwordInput, 'password');
          loginUrlEnc = loginUrlInput ? encrypt(loginUrlInput, 'loginUrl') : undefined;
          additionalInfoEnc = additionalInfoInput ? encrypt(additionalInfoInput, 'additionalInfo') : undefined;

          // Strict validation of encrypted blocks
          if (!serviceEnc?.ciphertext || !serviceEnc?.iv || !serviceEnc?.authTag) {
            throw new Error('Encryption validation failed for field: service');
          }
          if (!usernameEnc?.ciphertext || !usernameEnc?.iv || !usernameEnc?.authTag) {
            throw new Error('Encryption validation failed for field: username');
          }
          if (!passwordEnc?.ciphertext || !passwordEnc?.iv || !passwordEnc?.authTag) {
            throw new Error('Encryption validation failed for field: password');
          }
        } catch (encErr) {
          console.error('[CREDENTIAL_ERROR] Encryption failure during client response processing for request', targetRequest.requestId);
          await this.sendMessage(
            chatId,
            `❌ <b>We couldn't securely save your credentials. Please try again.</b>`,
            timings
          );
          return;
        }

        const dbStart2 = performance.now();
        // Prevent duplicate creation if webhook update is repeated
        let cred = await Credential.findOne({ requestId: targetRequest._id });
        if (!cred) {
          cred = await Credential.create({
            requestId: targetRequest._id,
            clientId: client._id,
            projectId: targetRequest.projectId,
            service: serviceEnc,
            username: usernameEnc,
            password: passwordEnc,
            loginUrl: loginUrlEnc || undefined,
            additionalInfo: additionalInfoEnc || undefined,
          });
        }

        // Update Request status
        targetRequest.status = 'RECEIVED';
        await targetRequest.save();
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart2);
        }

        // Clear active selection session
        global.activeClientRequests = global.activeClientRequests || {};
        delete global.activeClientRequests[chatId];

        // Audit Log (never includes plaintext passwords or usernames)
        await AuditService.logAction(
          client.email,
          'CREDENTIAL_RECEIVED',
          'Credential',
          targetRequest._id.toString(),
          {
            requestId: targetRequest.requestId,
            clientId: client._id.toString(),
            projectId: targetRequest.projectId?.toString() || '',
            telegramUserId: client.telegramUserId,
            timestamp: new Date(),
          }
        );

        console.log(`[REQUEST_DEBUG]\nprocessingResult=success\nrequestId=${targetRequest.requestId}\nstatus=RECEIVED`);

        await this.sendMessage(
          chatId,
          `✅ <b>Credentials received successfully</b>\n\n` +
          `Request ID:\n` +
          `${targetRequest.requestId}\n\n` +
          `The requested information has been securely recorded.`,
          timings
        );

        // Security: Attempt to delete the Telegram message containing the raw plaintext secrets
        try {
          const token = process.env.TELEGRAM_BOT_TOKEN;
          const apiStart = performance.now();
          const res = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: message.message_id,
            }),
          });
          const data = await res.json();
          if (timings) {
            timings.telegramAPI += Math.round(performance.now() - apiStart);
          }
          console.log(`Telegram message deletion status: ${data.ok}`);
        } catch (delErr) {
          console.error('Failed to delete Telegram plaintext message:', delErr);
        }

      } else if (targetRequest.type === 'IMAGE' || targetRequest.type === 'DOCUMENT') {
        let fileId = '';
        let telegramFileName = '';
        
        if (targetRequest.type === 'IMAGE' && message.photo) {
          const photo = message.photo[message.photo.length - 1];
          fileId = photo.file_id;
          telegramFileName = `photo_${fileId}.jpg`;
        } else if (targetRequest.type === 'DOCUMENT' && message.document) {
          fileId = message.document.file_id;
          telegramFileName = message.document.file_name || `document_${fileId}`;
        } else if (message.document) {
          fileId = message.document.file_id;
          telegramFileName = message.document.file_name || `file_${fileId}`;
        } else {
          await this.sendMessage(chatId, `❌ Please send an attachment (photo/document) to respond to this request.`, timings);
          return;
        }

        // Retrieve file metadata and buffer from Telegram CDN
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const apiStart1 = performance.now();
        const resFile = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
        const dataFile = await resFile.json();
        if (timings) {
          timings.telegramAPI += Math.round(performance.now() - apiStart1);
        }

        if (!dataFile.ok) {
          throw new Error('Telegram file metadata lookup failed');
        }

        const telegramPath = dataFile.result.file_path;
        const apiStart2 = performance.now();
        const resBuffer = await fetch(`https://api.telegram.org/file/bot${token}/${telegramPath}`);
        const arrayBuffer = await resBuffer.arrayBuffer();
        if (timings) {
          timings.telegramAPI += Math.round(performance.now() - apiStart2);
        }
        
        const buffer = Buffer.from(arrayBuffer);
        const fileExtension = path.extname(telegramFileName) || '.dat';
        const uniqueFileName = `${targetRequest.requestId}_${Date.now()}${fileExtension}`;
        const supabasePath = `requests/${targetRequest.requestId}/${uniqueFileName}`;
        
        // Resolve content-type
        let contentType = 'application/octet-stream';
        if (fileExtension === '.pdf') contentType = 'application/pdf';
        else if (fileExtension === '.png') contentType = 'image/png';
        else if (fileExtension === '.jpg' || fileExtension === '.jpeg') contentType = 'image/jpeg';
        else if (fileExtension === '.zip') contentType = 'application/zip';

        // Upload to Supabase Storage
        await StorageService.uploadFile(buffer, supabasePath, contentType);

        const dbStart3 = performance.now();
        await RequestResponse.create({
          requestId: targetRequest._id,
          clientId: client._id,
          projectId: targetRequest.projectId,
          files: [{
            fileName: telegramFileName,
            mimeType: contentType,
            size: buffer.length,
            storagePath: supabasePath,
            telegramFileId: fileId,
            uploadedAt: new Date(),
          }],
        });

        targetRequest.status = 'COMPLETED';
        await targetRequest.save();
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart3);
        }

        global.activeClientRequests = global.activeClientRequests || {};
        delete global.activeClientRequests[chatId];

        // Audit Log
        await AuditService.logAction(
          client.email,
          'DATA_REQUEST_RECEIVED',
          'RequestResponse',
          targetRequest._id.toString(),
          {
            requestId: targetRequest.requestId,
            clientId: client._id.toString(),
            title: targetRequest.title,
          }
        );

        await this.sendMessage(
          chatId,
          `✅ <b>File received successfully.</b>\n\nRequest <code>${targetRequest.requestId}</code> has been completed.`,
          timings
        );

      } else {
        // TEXT or CUSTOM responses
        if (!text) {
          await this.sendMessage(chatId, `❌ Please reply with a text message to respond to this request.`, timings);
          return;
        }

        const dbStart4 = performance.now();
        await RequestResponse.create({
          requestId: targetRequest._id,
          clientId: client._id,
          projectId: targetRequest.projectId,
          responseText: text,
        });

        targetRequest.status = 'COMPLETED';
        await targetRequest.save();
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart4);
        }

        global.activeClientRequests = global.activeClientRequests || {};
        delete global.activeClientRequests[chatId];

        // Audit Log
        await AuditService.logAction(
          client.email,
          'DATA_REQUEST_RECEIVED',
          'RequestResponse',
          targetRequest._id.toString(),
          {
            requestId: targetRequest.requestId,
            clientId: client._id.toString(),
            title: targetRequest.title,
          }
        );

        await this.sendMessage(
          chatId,
          `✅ <b>Response recorded successfully.</b>\n\nRequest <code>${targetRequest.requestId}</code> has been completed.`,
          timings
        );
      }
    } catch (err: any) {
      console.error('Failed to process client response:', err);
      await this.sendMessage(chatId, `❌ An error occurred while processing your response. Please try again later.`, timings);
    }
  }
}
