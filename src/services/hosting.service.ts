import mongoose from 'mongoose';
import Hosting, { IHosting, HostingStatus } from '@/models/Hosting';
import Client from '@/models/Client';
import Project from '@/models/Project';
import { encrypt, decrypt } from '@/lib/security/encryption';
import { AuditService } from './audit.service';
import { TelegramService } from './telegram.service';
import { dbConnect } from '@/lib/db/connect';

export class HostingService {
  /**
   * Calculate exact days remaining from current date to expiry date
   */
  static calculateDaysRemaining(expiryDate: Date): number {
    const now = new Date();
    // Normalize to midnight UTC comparison for clean day calculations
    const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const expiry = new Date(expiryDate);
    const expiryMidnight = new Date(Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate()));

    const diffMs = expiryMidnight.getTime() - todayMidnight.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Derive status based on expiry date
   */
  static deriveStatus(expiryDate: Date, currentStatus?: string): HostingStatus {
    if (currentStatus === 'CANCELLED') return 'CANCELLED';
    const days = this.calculateDaysRemaining(expiryDate);
    if (days <= 0) return 'EXPIRED';
    if (days <= 30) return 'EXPIRING_SOON';
    return 'ACTIVE';
  }

  /**
   * Create a new hosting record with encrypted secrets
   */
  static async createHosting(
    data: {
      clientId: string;
      projectId?: string;
      hostingProvider: string;
      hostingType?: string;
      panelUrl?: string;
      serverHost?: string;
      domain: string;
      port?: number | string;
      planName?: string;
      username?: string;
      password: string;
      sshKey?: string;
      apiToken?: string;
      startDate?: Date;
      expiryDate: Date;
      autoRenewal?: boolean;
      notes?: string;
    },
    actor: string
  ): Promise<IHosting> {
    await dbConnect();

    const client = await Client.findById(data.clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    if (data.projectId) {
      const project = await Project.findById(data.projectId);
      if (!project) throw new Error('Project not found');
      if (project.clientId.toString() !== data.clientId.toString()) {
        throw new Error('Project does not belong to specified client');
      }
    }

    if (!data.domain || data.domain.trim() === '') {
      throw new Error('Domain name is required');
    }
    if (!data.hostingProvider || data.hostingProvider.trim() === '') {
      throw new Error('Hosting provider is required');
    }
    if (!data.expiryDate) {
      throw new Error('Expiry date is required');
    }
    if (!data.password || data.password.trim() === '') {
      throw new Error('Hosting password is required');
    }

    // Encrypt sensitive fields
    const passwordEnc = encrypt(data.password.trim(), 'hosting_password');
    const sshKeyEnc = data.sshKey && data.sshKey.trim() !== '' ? encrypt(data.sshKey.trim(), 'hosting_sshKey') : undefined;
    const apiTokenEnc = data.apiToken && data.apiToken.trim() !== '' ? encrypt(data.apiToken.trim(), 'hosting_apiToken') : undefined;

    const initialStatus = this.deriveStatus(data.expiryDate);

    const hosting = await Hosting.create({
      clientId: client._id,
      projectId: data.projectId ? new mongoose.Types.ObjectId(data.projectId) : undefined,
      hostingProvider: data.hostingProvider.trim(),
      hostingType: data.hostingType ? data.hostingType.trim() : 'Shared',
      panelUrl: data.panelUrl ? data.panelUrl.trim() : undefined,
      serverHost: data.serverHost ? data.serverHost.trim() : undefined,
      domain: data.domain.trim(),
      port: data.port,
      planName: data.planName ? data.planName.trim() : undefined,
      username: data.username ? data.username.trim() : undefined,
      password: passwordEnc,
      sshKey: sshKeyEnc,
      apiToken: apiTokenEnc,
      startDate: data.startDate,
      expiryDate: data.expiryDate,
      autoRenewal: !!data.autoRenewal,
      status: initialStatus,
      notes: data.notes,
      notificationsSent: new Map(),
      renewalHistory: [],
    });

    await AuditService.logAction(actor, 'HOSTING_CREATED', 'Hosting', hosting._id, {
      hostingId: hosting._id.toString(),
      clientId: client._id.toString(),
      projectId: data.projectId || null,
      domain: hosting.domain,
      provider: hosting.hostingProvider,
      expiryDate: hosting.expiryDate,
      timestamp: new Date(),
    });

    return hosting;
  }

  /**
   * Update an existing hosting record
   */
  static async updateHosting(
    hostingId: string,
    data: Partial<{
      projectId?: string;
      hostingProvider?: string;
      hostingType?: string;
      panelUrl?: string;
      serverHost?: string;
      domain?: string;
      port?: number | string;
      planName?: string;
      username?: string;
      password?: string;
      sshKey?: string;
      apiToken?: string;
      startDate?: Date;
      expiryDate?: Date;
      autoRenewal?: boolean;
      status?: HostingStatus;
      notes?: string;
    }>,
    actor: string
  ): Promise<IHosting> {
    await dbConnect();

    const hosting = await Hosting.findById(hostingId);
    if (!hosting) {
      throw new Error('Hosting record not found');
    }

    const updatedFields: string[] = [];

    if (data.hostingProvider) {
      hosting.hostingProvider = data.hostingProvider.trim();
      updatedFields.push('hostingProvider');
    }
    if (data.hostingType) {
      hosting.hostingType = data.hostingType.trim();
      updatedFields.push('hostingType');
    }
    if (data.domain) {
      hosting.domain = data.domain.trim();
      updatedFields.push('domain');
    }
    if (data.panelUrl !== undefined) {
      hosting.panelUrl = data.panelUrl.trim() || undefined;
      updatedFields.push('panelUrl');
    }
    if (data.serverHost !== undefined) {
      hosting.serverHost = data.serverHost.trim() || undefined;
      updatedFields.push('serverHost');
    }
    if (data.port !== undefined) {
      hosting.port = data.port;
      updatedFields.push('port');
    }
    if (data.planName !== undefined) {
      hosting.planName = data.planName.trim() || undefined;
      updatedFields.push('planName');
    }
    if (data.username !== undefined) {
      hosting.username = data.username.trim() || undefined;
      updatedFields.push('username');
    }
    if (data.notes !== undefined) {
      hosting.notes = data.notes;
      updatedFields.push('notes');
    }
    if (data.autoRenewal !== undefined) {
      hosting.autoRenewal = data.autoRenewal;
      updatedFields.push('autoRenewal');
    }
    if (data.projectId !== undefined) {
      hosting.projectId = data.projectId ? new mongoose.Types.ObjectId(data.projectId) : undefined;
      updatedFields.push('projectId');
    }

    // Re-encrypt changed secrets
    if (data.password && data.password.trim() !== '') {
      hosting.password = encrypt(data.password.trim(), 'hosting_password');
      updatedFields.push('password');
    }
    if (data.sshKey !== undefined) {
      hosting.sshKey = data.sshKey && data.sshKey.trim() !== '' ? encrypt(data.sshKey.trim(), 'hosting_sshKey') : undefined;
      updatedFields.push('sshKey');
    }
    if (data.apiToken !== undefined) {
      hosting.apiToken = data.apiToken && data.apiToken.trim() !== '' ? encrypt(data.apiToken.trim(), 'hosting_apiToken') : undefined;
      updatedFields.push('apiToken');
    }

    if (data.expiryDate) {
      hosting.expiryDate = data.expiryDate;
      hosting.status = this.deriveStatus(hosting.expiryDate, hosting.status);
      updatedFields.push('expiryDate');
    }

    if (data.status) {
      hosting.status = data.status;
      updatedFields.push('status');
    }

    await hosting.save();

    await AuditService.logAction(actor, 'HOSTING_UPDATED', 'Hosting', hosting._id, {
      hostingId: hosting._id.toString(),
      domain: hosting.domain,
      updatedFields,
      timestamp: new Date(),
    });

    return hosting;
  }

  /**
   * Renew hosting: updates expiry, records renewal history, resets notification cycle, and sets status ACTIVE
   */
  static async renewHosting(
    hostingId: string,
    newExpiryDate: Date,
    actor: string,
    notes?: string
  ): Promise<IHosting> {
    await dbConnect();

    const hosting = await Hosting.findById(hostingId);
    if (!hosting) {
      throw new Error('Hosting record not found');
    }

    const previousExpiryDate = hosting.expiryDate;

    // Push renewal record
    hosting.renewalHistory.push({
      renewedAt: new Date(),
      previousExpiryDate,
      newExpiryDate: new Date(newExpiryDate),
      notes: notes || undefined,
      actor,
    });

    hosting.expiryDate = new Date(newExpiryDate);
    // Reset notification delivery state for new renewal cycle
    hosting.notificationsSent = new Map();
    hosting.status = 'ACTIVE';

    await hosting.save();

    await AuditService.logAction(actor, 'HOSTING_RENEWED', 'Hosting', hosting._id, {
      hostingId: hosting._id.toString(),
      domain: hosting.domain,
      previousExpiryDate,
      newExpiryDate: hosting.expiryDate,
      actor,
      timestamp: new Date(),
    });

    return hosting;
  }

  /**
   * Delete hosting record
   */
  static async deleteHosting(hostingId: string, actor: string): Promise<boolean> {
    await dbConnect();

    const hosting = await Hosting.findById(hostingId);
    if (!hosting) {
      throw new Error('Hosting record not found');
    }

    await Hosting.deleteOne({ _id: hostingId });

    await AuditService.logAction(actor, 'HOSTING_DELETED', 'Hosting', hostingId, {
      hostingId,
      domain: hosting.domain,
      provider: hosting.hostingProvider,
      clientId: hosting.clientId?.toString(),
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * Check all active hosting records and dispatch multi-threshold expiry notifications
   * Prevents duplicate notifications per threshold in the current cycle
   */
  static async checkAndDispatchExpiryNotifications(): Promise<{
    checkedCount: number;
    notificationsSent: number;
    results: Array<{ hostingId: string; domain: string; threshold: string; clientSent: boolean; adminSent: boolean }>;
  }> {
    await dbConnect();

    // Query all hostings that are not cancelled
    const hostings = await Hosting.find({ status: { $ne: 'CANCELLED' } })
      .populate('clientId', 'name email telegramConnected telegramChatId')
      .populate('projectId', 'name projectCode');

    const notificationThresholds = [30, 14, 7, 3, 1, 0];
    let notificationsSentCount = 0;
    const results: Array<{ hostingId: string; domain: string; threshold: string; clientSent: boolean; adminSent: boolean }> = [];

    for (const hosting of hostings) {
      const days = this.calculateDaysRemaining(hosting.expiryDate);
      const client = hosting.clientId as any;
      const project = hosting.projectId as any;

      // Update derived status
      const derivedStatus = this.deriveStatus(hosting.expiryDate, hosting.status);
      if (hosting.status !== derivedStatus) {
        hosting.status = derivedStatus;
      }

      // Check thresholds
      for (const threshold of notificationThresholds) {
        const thresholdKey = String(threshold);

        // Does daysRemaining match this threshold bracket?
        const isMatch =
          threshold === 0
            ? days <= 0
            : days <= threshold && days > (notificationThresholds[notificationThresholds.indexOf(threshold) + 1] ?? -999);

        if (isMatch) {
          // Check if already notified for this threshold in current cycle
          const alreadySent = hosting.notificationsSent && hosting.notificationsSent.has(thresholdKey);
          if (!alreadySent) {
            let clientSent = false;
            let adminSent = false;

            const formattedDate = new Date(hosting.expiryDate).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            });
            const daysRemainingText = days <= 0 ? 'EXPIRED' : `${days} day${days > 1 ? 's' : ''}`;

            // 1. Dispatch Client Telegram Notification (NO SENSITIVE DATA INCLUDED!)
            if (client && client.telegramConnected && client.telegramChatId) {
              const clientMessage =
                `⚠️ <b>Hosting Expiry Reminder</b>\n\n` +
                `Your hosting for <b>${hosting.domain || project?.name || 'your project'}</b> is expiring soon.\n\n` +
                `<b>Provider:</b> ${hosting.hostingProvider}\n` +
                `<b>Expiry Date:</b> ${formattedDate}\n` +
                `<b>Days Remaining:</b> ${daysRemainingText}\n\n` +
                `Please contact us if you want to renew the hosting service.`;

              const res = await TelegramService.sendMessageRaw(client.telegramChatId, clientMessage);
              clientSent = !!(res && res.success);
            }

            // 2. Dispatch Admin Telegram Notification
            const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
            if (adminTelegramId) {
              const adminMessage =
                `⚠️ <b>Hosting Expiry Alert</b>\n\n` +
                `<b>Client:</b> ${client ? client.name : 'Unknown'}\n` +
                `<b>Project:</b> ${project ? project.name : 'General'}\n` +
                `<b>Provider:</b> ${hosting.hostingProvider}\n` +
                `<b>Domain:</b> ${hosting.domain}\n` +
                `<b>Expiry:</b> ${formattedDate}\n` +
                `<b>Days Remaining:</b> ${daysRemainingText}\n` +
                `<b>Client Telegram:</b> ${client?.telegramConnected ? 'CONNECTED' : 'NOT CONNECTED'}`;

              const res = await TelegramService.sendMessageRaw(adminTelegramId, adminMessage);
              adminSent = !!(res && res.success);
            }

            // Record notification delivery to prevent duplicate notifications
            if (!hosting.notificationsSent) {
              hosting.notificationsSent = new Map();
            }
            hosting.notificationsSent.set(thresholdKey, new Date());
            await hosting.save();

            notificationsSentCount++;
            results.push({
              hostingId: hosting._id.toString(),
              domain: hosting.domain,
              threshold: thresholdKey,
              clientSent,
              adminSent,
            });

            // Stop at most urgent threshold for this run
            break;
          }
        }
      }

      await hosting.save();
    }

    return {
      checkedCount: hostings.length,
      notificationsSent: notificationsSentCount,
      results,
    };
  }
}
