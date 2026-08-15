import fs from 'fs';
import path from 'path';
import Client from '@/models/Client';
import Project from '@/models/Project';
import Invoice from '@/models/Invoice';
import Payment from '@/models/Payment';
import { ClientService } from './client.service';
import { PaymentService } from './payment.service';
import { AuditService } from './audit.service';
import { dbConnect } from '@/lib/db/connect';

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
          allowed_updates: ['message'],
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

  /**
   * Configure bot commands in Telegram
   */
  static async setBotCommands(): Promise<boolean> {
    if (!this.isConfigured()) return false;

    const defaultCommands = [
      { command: 'myprofile', description: 'View profile info' },
      { command: 'myproject', description: 'View project details' },
      { command: 'payment', description: 'View payment summary' },
      { command: 'payments', description: 'View payment history' },
      { command: 'invoice', description: 'Get latest invoice PDF' },
      { command: 'invoices', description: 'View invoices history' },
      { command: 'status', description: 'View project progress' },
      { command: 'help', description: 'Show available commands' },
    ];

    const adminCommands = [
      { command: 'clients', description: 'List all clients' },
      { command: 'client', description: 'View client details (specify client code)' },
      { command: 'payments', description: 'List recent payments' },
      { command: 'pending', description: 'List pending invoices' },
      { command: 'invoices', description: 'List recent invoices' },
      { command: 'help', description: 'Show admin help menu' },
    ];

    try {
      // 1. Set default commands for clients/all users
      const r1 = await fetch(`${TELEGRAM_API}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: defaultCommands,
          scope: { type: 'default' },
        }),
      });
      const data1 = await r1.json();

      // 2. Set custom commands for admin if ADMIN_TELEGRAM_ID is configured
      const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
      if (adminTelegramId) {
        const r2 = await fetch(`${TELEGRAM_API}/setMyCommands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commands: adminCommands,
            scope: { type: 'chat', chat_id: Number(adminTelegramId) },
          }),
        });
        await r2.json();
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
  static async sendMessage(chatId: string, text: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('Telegram Bot token is missing. Cannot send message.');
      return false;
    }

    try {
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
      return data.ok === true;
    } catch (error) {
      console.error(`Failed to send Telegram message to ${chatId}:`, error);
      return false;
    }
  }

  /**
   * Send PDF document to a chat
   */
  static async sendDocument(chatId: string, relativeFilePath: string, filename: string, caption?: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('Telegram Bot token is missing. Cannot send document.');
      return false;
    }

    try {
      const fullPath = path.join(process.cwd(), 'public', relativeFilePath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found at: ${fullPath}`);
      }

      const fileBuffer = fs.readFileSync(fullPath);
      const blob = new Blob([fileBuffer], { type: 'application/pdf' });
      
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('document', blob, filename);
      if (caption) {
        formData.append('caption', caption);
      }

      const response = await fetch(`${TELEGRAM_API}/sendDocument`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      return data.ok === true;
    } catch (error) {
      console.error(`Failed to send Telegram document to ${chatId}:`, error);
      return false;
    }
  }

  /**
   * Process updates received via Telegram Webhook
   */
  static async handleWebhookUpdate(update: any): Promise<void> {
    await dbConnect();

    const message = update?.message;
    if (!message || !message.chat || !message.from) return;

    const chatId = message.chat.id.toString();
    const userId = message.from.id.toString();
    const username = message.from.username || '';
    const text = (message.text || '').trim();

    // Check if the user is the Admin
    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
    const isAdmin = adminTelegramId && userId === adminTelegramId;

    if (isAdmin) {
      await this.handleAdminCommand(chatId, text);
      return;
    }

    // Try to find the client associated with this Telegram userId
    let client: any = await Client.findOne({ telegramUserId: userId });

    // Handle Deep Linking connection token
    const isStartCommand = text.startsWith('/start');
    let startToken: string | null = null;
    if (isStartCommand) {
      const parts = text.split(' ');
      if (parts.length > 1) {
        startToken = parts[1].trim();
      }
    }

    if (isStartCommand && startToken) {
      try {
        client = await ClientService.connectTelegram(startToken, {
          telegramUserId: userId,
          telegramUsername: username,
          telegramChatId: chatId,
        });

        await this.sendMessage(
          chatId,
          `<b>🎉 Telegram Successfully Connected!</b>\n\nHello <b>${client.name}</b>, your Telegram profile is now securely linked to your account with client code <b>${client.clientCode}</b>.\n\nYou can use the following commands to interact with your account:\n/myprofile - View Profile\n/myproject - View Project Details\n/payments - View Payment Logs\n/invoices - View Billing History\n/status - Check Development Progress`
        );
        return;
      } catch (error: any) {
        await this.sendMessage(chatId, `<b>❌ Connection Failed</b>\n\n${error.message || 'The token is invalid or has expired.'}`);
        return;
      }
    }

    // If client is not connected
    if (!client) {
      // Look up by username as fallback if connected flag isn't set, or prompt setup
      const clientByUsername = username ? await Client.findOne({ telegramUsername: username }) : null;
      if (clientByUsername && !clientByUsername.telegramConnected) {
        // Link them
        clientByUsername.telegramConnected = true;
        clientByUsername.telegramUserId = userId;
        clientByUsername.telegramChatId = chatId;
        client = await clientByUsername.save();
        await this.sendMessage(chatId, `<b>🎉 Welcome back, ${client.name}!</b>\n\nYour account has been matched. Use /help to see commands.`);
        return;
      }

      await this.sendMessage(
        chatId,
        `<b>👋 Welcome to Dr Debuggers.</b>\n\n` +
        `Your Telegram account is not connected to a client account yet.\n\n` +
        `Please ask the administrator for your secure connection link.\n\n` +
        `<i>Your Telegram User ID:</i> <code>${userId}</code>`
      );
      return;
    }

    // Standard client commands
    await this.handleClientCommand(chatId, client, text);
  }

  /**
   * Handle Client bot commands
   */
  private static async handleClientCommand(chatId: string, client: any, text: string): Promise<void> {
    const cmd = text.toLowerCase().split(' ')[0];

    switch (cmd) {
      case '/start':
      case '/help':
        await this.sendMessage(
          chatId,
          `<b>👋 Hello, ${client.name}!</b>\n\nHere are the available commands:\n/myprofile - View Profile Information\n/myproject - View Project Budgets\n/payments - View Payments List\n/invoices - View Invoices & PDF\n/status - Check Current Phase`
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
          `<b>Address:</b> ${client.address || ''}, ${client.city || ''}, ${client.country || ''}`
        );
        break;

      case '/myproject': {
        const projects = await Project.find({ clientId: client._id });
        if (projects.length === 0) {
          await this.sendMessage(chatId, 'No active projects found for your account.');
          return;
        }

        let msg = '<b>💻 Project Budget Details</b>\n\n';
        for (const p of projects) {
          const balances = await PaymentService.calculateProjectBalances(p._id.toString());
          msg += `<b>Project:</b> ${p.name}\n` +
                 `<b>Service:</b> ${p.serviceType}\n` +
                 `<b>Budget:</b> ${p.currency} ${p.totalAmount.toLocaleString('en-IN')}\n` +
                 `<b>Paid:</b> ${p.currency} ${balances.paidAmount.toLocaleString('en-IN')}\n` +
                 `<b>Outstanding:</b> ${p.currency} ${balances.outstandingAmount.toLocaleString('en-IN')}\n\n`;
        }
        await this.sendMessage(chatId, msg);
        break;
      }

      case '/payment':
      case '/payments': {
        const projects = await Project.find({ clientId: client._id });
        if (projects.length === 0) {
          await this.sendMessage(chatId, 'No projects found.');
          return;
        }

        let msg = '<b>💰 Payment Summary</b>\n\n';
        for (const p of projects) {
          const balances = await PaymentService.calculateProjectBalances(p._id.toString());
          const recentPayments = await Payment.find({ projectId: p._id, status: 'COMPLETED' }).sort({ paymentDate: -1 }).limit(3);

          msg += `<b>Project:</b> ${p.name}\n` +
                 `<b>Total Value:</b> ${p.currency} ${balances.totalAmount.toLocaleString('en-IN')}\n` +
                 `<b>Paid Amount:</b> ${p.currency} ${balances.paidAmount.toLocaleString('en-IN')}\n` +
                 `<b>Remaining:</b> ${p.currency} ${balances.outstandingAmount.toLocaleString('en-IN')}\n\n`;

          if (recentPayments.length > 0) {
            msg += `<i>Recent payments:</i>\n`;
            for (const r of recentPayments) {
              msg += `- ${r.paymentNumber}: ${p.currency} ${r.amount.toLocaleString('en-IN')} (${new Date(r.paymentDate).toLocaleDateString()})\n`;
            }
            msg += '\n';
          }
        }
        await this.sendMessage(chatId, msg);
        break;
      }

      case '/invoice':
      case '/invoices': {
        const invoices = await Invoice.find({ clientId: client._id }).sort({ createdAt: -1 });
        if (invoices.length === 0) {
          await this.sendMessage(chatId, 'No invoices generated yet.');
          return;
        }

        await this.sendMessage(chatId, '<b>📄 Your Invoices</b>\n\nRetrieving your invoices... sending latest PDF...');
        
        // Send latest PDF if exists
        const latestInvoice = invoices[0];
        if (latestInvoice.pdfPath) {
          const filename = `${latestInvoice.invoiceNumber}.pdf`;
          await this.sendDocument(
            chatId,
            latestInvoice.pdfPath,
            filename,
            `Latest Invoice ${latestInvoice.invoiceNumber}\nAmount: ${latestInvoice.currency} ${latestInvoice.total.toLocaleString('en-IN')}\nStatus: ${latestInvoice.status}`
          );
        } else {
          await this.sendMessage(chatId, `Latest Invoice ${latestInvoice.invoiceNumber} cannot be fetched as PDF is missing.`);
        }
        break;
      }

      case '/status': {
        const projects = await Project.find({ clientId: client._id });
        if (projects.length === 0) {
          await this.sendMessage(chatId, 'No active projects.');
          return;
        }

        let msg = '<b>📢 Project Development Status</b>\n\n';
        for (const p of projects) {
          msg += `<b>Project:</b> ${p.name}\n` +
                 `<b>Current Phase:</b> <code>${p.status}</code>\n` +
                 `<b>Start Date:</b> ${p.startDate ? new Date(p.startDate).toLocaleDateString() : 'N/A'}\n` +
                 `<b>Expected Completion:</b> ${p.expectedCompletionDate ? new Date(p.expectedCompletionDate).toLocaleDateString() : 'N/A'}\n\n`;
        }
        await this.sendMessage(chatId, msg);
        break;
      }

      default:
        await this.sendMessage(chatId, 'Unknown command. Use /help to see the available commands.');
    }
  }

  /**
   * Handle Admin bot commands
   */
  private static async handleAdminCommand(chatId: string, text: string): Promise<void> {
    const args = text.split(' ');
    const cmd = args[0].toLowerCase();

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
          `/invoices - Show all invoices`
        );
        break;

      case '/clients': {
        const clients = await Client.find().limit(10).sort({ createdAt: -1 });
        if (clients.length === 0) {
          await this.sendMessage(chatId, 'No clients registered.');
          return;
        }

        let msg = '<b>👥 Client List (Recent 10)</b>\n\n';
        for (const c of clients) {
          msg += `Code: <code>${c.clientCode}</code> | <b>${c.name}</b>\n` +
                 `Status: ${c.status} | Telegram: ${c.telegramConnected ? '✅ Connected' : '❌ Linked'}\n\n`;
        }
        await this.sendMessage(chatId, msg);
        break;
      }

      case '/client': {
        if (args.length < 2) {
          await this.sendMessage(chatId, 'Please specify clientCode: <code>/client CLIENT-CODE</code>');
          return;
        }

        const code = args[1].toUpperCase().trim();
        const c = await Client.findOne({ clientCode: code });
        if (!c) {
          await this.sendMessage(chatId, `Client with code <b>${code}</b> not found.`);
          return;
        }

        // Projects
        const projects = await Project.find({ clientId: c._id });
        let projectsStr = '';
        let totalRevenue = 0;
        let totalPaid = 0;
        
        for (const p of projects) {
          const bal = await PaymentService.calculateProjectBalances(p._id.toString());
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
          `<b>Projects:</b>\n${projectsStr || 'No projects.'}`
        );
        break;
      }

      case '/payments': {
        const payments = await Payment.find().populate('clientId', 'name').sort({ paymentDate: -1 }).limit(10);
        if (payments.length === 0) {
          await this.sendMessage(chatId, 'No payments recorded.');
          return;
        }

        let msg = '<b>💳 Recent Payments (Recent 10)</b>\n\n';
        for (const p of payments) {
          msg += `<b>${p.paymentNumber}</b> | ${(p.clientId as any).name}\n` +
                 `Amount: ${p.currency} ${p.amount.toLocaleString('en-IN')} | Ref: ${p.transactionReference || 'N/A'}\n` +
                 `Date: ${new Date(p.paymentDate).toLocaleDateString()} | Status: ${p.status}\n\n`;
        }
        await this.sendMessage(chatId, msg);
        break;
      }

      case '/pending': {
        const invoices = await Invoice.find({ status: { $ne: 'PAID' } }).populate('clientId', 'name').limit(10);
        if (invoices.length === 0) {
          await this.sendMessage(chatId, 'No outstanding invoices.');
          return;
        }

        let msg = '<b>⚠️ Pending Invoices</b>\n\n';
        for (const inv of invoices) {
          msg += `<b>${inv.invoiceNumber}</b> | ${(inv.clientId as any).name}\n` +
                 `Total: ${inv.currency} ${inv.total.toLocaleString('en-IN')} | Due: ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'}\n` +
                 `Status: ${inv.status}\n\n`;
        }
        await this.sendMessage(chatId, msg);
        break;
      }

      case '/invoices': {
        const invoices = await Invoice.find().populate('clientId', 'name').sort({ createdAt: -1 }).limit(10);
        if (invoices.length === 0) {
          await this.sendMessage(chatId, 'No invoices generated.');
          return;
        }

        let msg = '<b>📄 Recent Invoices (Recent 10)</b>\n\n';
        for (const inv of invoices) {
          msg += `<b>${inv.invoiceNumber}</b> | ${(inv.clientId as any).name}\n` +
                 `Total: ${inv.currency} ${inv.total.toLocaleString('en-IN')} | Date: ${new Date(inv.invoiceDate).toLocaleDateString()}\n` +
                 `Status: ${inv.status}\n\n`;
        }
        await this.sendMessage(chatId, msg);
        break;
      }

      default:
        await this.sendMessage(chatId, 'Unknown command. Use /admin to view the menu.');
    }
  }
}
