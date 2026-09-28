import webpush from 'web-push';
import mongoose from 'mongoose';
import PushSubscription, { IPushSubscription } from '@/models/PushSubscription';
import { dbConnect } from '@/lib/db/connect';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    url?: string;
    teamMemberId?: string;
    conversationId?: string;
    [key: string]: any;
  };
}

export interface ClientSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}

export class PushNotificationService {
  private static vapidConfigured = false;

  /**
   * Ensure web-push VAPID details are set once server-side
   */
  static configureVapid(): boolean {
    if (this.vapidConfigured) return true;

    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@drdebuggers.com';
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      console.warn('[PUSH] VAPID keys not configured in environment.');
      return false;
    }

    try {
      webpush.setVapidDetails(subject, publicKey.trim(), privateKey.trim());
      this.vapidConfigured = true;
      return true;
    } catch (err: any) {
      console.error('[PUSH] Failed to configure VAPID details:', err.message);
      return false;
    }
  }

  /**
   * Return the public VAPID key for browser registration
   */
  static getPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY || null;
  }

  /**
   * Save or update a browser push subscription for an Admin
   */
  static async saveSubscription(
    adminId: string,
    sub: ClientSubscriptionInput
  ): Promise<IPushSubscription> {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      throw new Error('Invalid admin ID format');
    }

    if (!sub || !sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      throw new Error('Invalid PushSubscription payload: endpoint and keys required');
    }

    const adminObjectId = new mongoose.Types.ObjectId(adminId);

    const record = await PushSubscription.findOneAndUpdate(
      { endpoint: sub.endpoint.trim() },
      {
        $set: {
          adminId: adminObjectId,
          endpoint: sub.endpoint.trim(),
          keys: {
            p256dh: sub.keys.p256dh.trim(),
            auth: sub.keys.auth.trim(),
          },
          userAgent: sub.userAgent || undefined,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`[PUSH] Push subscription saved for admin: ${adminId}`);
    return record;
  }

  /**
   * Unsubscribe a browser endpoint
   */
  static async unsubscribe(adminId: string, endpoint: string): Promise<boolean> {
    await dbConnect();
    const result = await PushSubscription.deleteOne({
      adminId: new mongoose.Types.ObjectId(adminId),
      endpoint: endpoint.trim(),
    });
    return result.deletedCount > 0;
  }

  /**
   * Check if an admin has any active push subscriptions
   */
  static async hasSubscription(adminId: string): Promise<boolean> {
    await dbConnect();
    if (!mongoose.Types.ObjectId.isValid(adminId)) return false;
    const exists = await PushSubscription.exists({
      adminId: new mongoose.Types.ObjectId(adminId),
    });
    return !!exists;
  }

  /**
   * Send Web Push notification to the specific Admin who owns the conversation
   * (NO broadcast to unrelated admins!)
   */
  static async sendPushToAdmin(
    adminId: string,
    payload: PushNotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    try {
      await dbConnect();

      if (!this.configureVapid()) {
        console.warn('[PUSH] Push skipped: VAPID details not initialized.');
        return { sent: 0, failed: 0 };
      }

      if (!mongoose.Types.ObjectId.isValid(adminId)) {
        console.warn(`[PUSH] Invalid adminId format: ${adminId}`);
        return { sent: 0, failed: 0 };
      }

      console.log(`[PUSH] admin resolved: ${adminId}`);

      const subscriptions = await PushSubscription.find({
        adminId: new mongoose.Types.ObjectId(adminId),
      });

      console.log(`[PUSH] subscriptions found: ${subscriptions.length}`);

      if (subscriptions.length === 0) {
        return { sent: 0, failed: 0 };
      }

      const stringifiedPayload = JSON.stringify({
        title: payload.title || 'Dr. Debuggers CRM',
        body: payload.body || 'New message from team member',
        icon: payload.icon || '/globe.svg',
        badge: payload.badge || '/globe.svg',
        data: payload.data || {},
      });

      let sentCount = 0;
      let failedCount = 0;

      // Deliver to all active subscriptions of this Admin
      await Promise.all(
        subscriptions.map(async (sub) => {
          try {
            console.log('[PUSH] sending notification');
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.keys.p256dh,
                  auth: sub.keys.auth,
                },
              },
              stringifiedPayload,
              {
                TTL: 60 * 60 * 24, // 24 hours
                urgency: 'high',
              }
            );

            console.log('[PUSH] notification sent');
            sentCount++;
          } catch (err: any) {
            failedCount++;
            const statusCode = err.statusCode || err.status;
            console.warn(`[PUSH] Push delivery failed (Status: ${statusCode}):`, err.message);

            // If subscription is 404 (Not Found) or 410 (Gone / Expired), remove it automatically
            if (statusCode === 404 || statusCode === 410 || err.message?.includes('expired')) {
              console.log(`[PUSH] Pruning expired subscription: ${sub._id}`);
              await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
            }
          }
        })
      );

      return { sent: sentCount, failed: failedCount };
    } catch (err: any) {
      console.error('[PUSH] Unexpected error in sendPushToAdmin:', err.message);
      return { sent: 0, failed: 0 };
    }
  }
}
