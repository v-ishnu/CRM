import Notification, { INotification } from '@/models/Notification';
import Client from '@/models/Client';
import Project from '@/models/Project';
import Invoice from '@/models/Invoice';
import Payment from '@/models/Payment';
import { TelegramService } from './telegram.service';
import { PaymentService } from './payment.service';
import { AuditService } from './audit.service';
import { dbConnect } from '@/lib/db/connect';

export class NotificationService {
  /**
   * Send a welcome onboarding message via Telegram and log it
   */
  static async sendOnboardingNotification(
    clientId: string,
    projectId: string,
    paymentId?: string,
    invoiceId?: string
  ): Promise<INotification> {
    await dbConnect();

    const client = await Client.findById(clientId);
    if (!client) throw new Error('Client not found');

    const project = await Project.findById(projectId);
    if (!project) throw new Error('Project not found');

    let paymentInfoText = 'No advance payment recorded.';
    let balanceText = `Remaining Balance:\n${project.currency} ${project.totalAmount.toLocaleString('en-IN')}`;

    if (paymentId) {
      const payment = await Payment.findById(paymentId);
      if (payment) {
        const balances = await PaymentService.calculateProjectBalances(projectId);
        const advancePercentage = Math.round((payment.amount / project.totalAmount) * 100);
        paymentInfoText = `Advance Payment Received:\n${project.currency} ${payment.amount.toLocaleString('en-IN')}\n\nPayment:\n${advancePercentage}% Advance`;
        balanceText = `Remaining Balance:\n${project.currency} ${balances.outstandingAmount.toLocaleString('en-IN')}`;
      }
    }

    let invoiceNoText = 'N/A';
    if (invoiceId) {
      const invoice = await Invoice.findById(invoiceId);
      if (invoice) {
        invoiceNoText = invoice.invoiceNumber;
      }
    }

    const messageText = 
      `<b>🎉 Welcome!</b>\n\n` +
      `Hello ${client.name},\n\n` +
      `Thank you for choosing us for your <b>${project.name}</b> project.\n\n` +
      `<b>Project:</b>\n${project.name}\n\n` +
      `<b>Total Project Amount:</b>\n${project.currency} ${project.totalAmount.toLocaleString('en-IN')}\n\n` +
      `${paymentInfoText}\n\n` +
      `${balanceText}\n\n` +
      `<b>Invoice:</b>\n${invoiceNoText}\n\n` +
      `<b>Onboarding Date:</b>\n${new Date(client.onboardingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}\n\n` +
      `Your project has been successfully onboarded.\n\n` +
      `Thank you.`;

    const notification = new Notification({
      clientId: client._id,
      type: 'CLIENT_ONBOARDED',
      channel: 'TELEGRAM',
      message: messageText,
      status: 'PENDING',
    });

    const savedNotification = await notification.save();

    // Trigger Telegram Dispatch
    await this.dispatchTelegramNotification(savedNotification, client);

    // Send PDF Invoice document if available
    if (invoiceId && client.telegramConnected && client.telegramChatId) {
      const invoice = await Invoice.findById(invoiceId);
      if (invoice && invoice.pdfPath) {
        const filename = `${invoice.invoiceNumber}.pdf`;
        await TelegramService.sendDocument(
          client.telegramChatId,
          invoice.pdfPath,
          filename,
          `Here is your onboarding invoice: ${invoice.invoiceNumber}`
        );
      }
    }

    return savedNotification;
  }

  /**
   * Send payment confirmation notification
   */
  static async sendPaymentNotification(
    clientId: string,
    projectId: string,
    paymentId: string
  ): Promise<INotification> {
    await dbConnect();

    const client = await Client.findById(clientId);
    if (!client) throw new Error('Client not found');

    const project = await Project.findById(projectId);
    if (!project) throw new Error('Project not found');

    const payment = await Payment.findById(paymentId);
    if (!payment) throw new Error('Payment not found');

    const balances = await PaymentService.calculateProjectBalances(projectId);

    const messageText = 
      `<b>💳 Payment Received</b>\n\n` +
      `Hello ${client.name},\n\n` +
      `We have received your payment.\n\n` +
      `<b>Project:</b>\n${project.name}\n\n` +
      `<b>Payment Received:</b>\n${project.currency} ${payment.amount.toLocaleString('en-IN')}\n\n` +
      `<b>Total Project Amount:</b>\n${project.currency} ${balances.totalAmount.toLocaleString('en-IN')}\n\n` +
      `<b>Total Paid:</b>\n${project.currency} ${balances.paidAmount.toLocaleString('en-IN')}\n\n` +
      `<b>Remaining:</b>\n${project.currency} ${balances.outstandingAmount.toLocaleString('en-IN')}\n\n` +
      `<b>Payment Reference:</b>\n${payment.paymentNumber}\n\n` +
      `Thank you.`;

    const notification = new Notification({
      clientId: client._id,
      type: 'PAYMENT_RECEIVED',
      channel: 'TELEGRAM',
      message: messageText,
      status: 'PENDING',
    });

    const savedNotification = await notification.save();

    await this.dispatchTelegramNotification(savedNotification, client);

    return savedNotification;
  }

  /**
   * Send project status update notification
   */
  static async sendProjectStatusNotification(
    clientId: string,
    projectId: string,
    newStatus: string
  ): Promise<INotification> {
    await dbConnect();

    const client = await Client.findById(clientId);
    if (!client) throw new Error('Client not found');

    const project = await Project.findById(projectId);
    if (!project) throw new Error('Project not found');

    const messageText = 
      `<b>📢 Project Update</b>\n\n` +
      `Your <b>${project.name}</b> project has moved to:\n\n` +
      `<b>${newStatus}</b>\n\n` +
      `We are currently reviewing the completed implementation.\n\n` +
      `You will be notified about the next stage.`;

    const notification = new Notification({
      clientId: client._id,
      type: 'PROJECT_STATUS_CHANGED',
      channel: 'TELEGRAM',
      message: messageText,
      status: 'PENDING',
    });

    const savedNotification = await notification.save();

    await this.dispatchTelegramNotification(savedNotification, client);

    return savedNotification;
  }

  /**
   * Send direct text notification
   */
  static async sendDirectNotification(
    clientId: string,
    type: INotification['type'],
    message: string
  ): Promise<INotification> {
    await dbConnect();

    const client = await Client.findById(clientId);
    if (!client) throw new Error('Client not found');

    const notification = new Notification({
      clientId: client._id,
      type,
      channel: 'TELEGRAM',
      message,
      status: 'PENDING',
    });

    const savedNotification = await notification.save();

    await this.dispatchTelegramNotification(savedNotification, client);

    return savedNotification;
  }

  /**
   * Helper to perform actual dispatch and handle failures gracefully
   */
  private static async dispatchTelegramNotification(notification: INotification, client: any): Promise<boolean> {
    if (!client.telegramConnected || !client.telegramChatId) {
      notification.status = 'FAILED';
      notification.error = 'Client Telegram is not connected.';
      await notification.save();
      return false;
    }

    const success = await TelegramService.sendMessage(client.telegramChatId, notification.message);
    
    if (success) {
      notification.status = 'SENT';
      notification.sentAt = new Date();
      notification.error = undefined;
    } else {
      notification.status = 'FAILED';
      notification.error = 'Telegram API returned false or failed during request.';
    }

    await notification.save();

    if (success) {
      await AuditService.logAction('system', 'TELEGRAM_SENT', 'Notification', notification._id, {
        type: notification.type,
        clientId: client._id,
      });
    }

    return success;
  }

  /**
   * Retry a failed notification
   */
  static async retryNotification(notificationId: string, actor: string): Promise<boolean> {
    await dbConnect();

    const notification = await Notification.findById(notificationId);
    if (!notification) throw new Error('Notification not found');

    const client = await Client.findById(notification.clientId);
    if (!client) throw new Error('Client not found');

    const success = await this.dispatchTelegramNotification(notification, client);
    
    await AuditService.logAction(actor, 'CLIENT_UPDATED', 'Notification', notification._id, {
      info: 'Retried Telegram notification sending',
      success,
    });

    return success;
  }
}
