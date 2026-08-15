import fs from 'fs';
import path from 'path';
import Client from '@/models/Client';
import Project from '@/models/Project';
import Invoice from '@/models/Invoice';
import Payment from '@/models/Payment';
import { ClientService } from './client.service';
import { PaymentService } from './payment.service';
import { AuditService } from './audit.service';
import { StorageService } from './storage.service';
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
  static async sendMessage(chatId: string, text: string, timings?: any): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('Telegram Bot token is missing. Cannot send message.');
      return false;
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
      }
      return data.ok === true;
    } catch (error) {
      console.error(`Failed to send Telegram message to ${chatId}:`, error);
      return false;
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

    const message = update?.message;
    if (!message || !message.chat || !message.from) return;

    const chatId = message.chat.id.toString();
    const userId = message.from.id.toString();
    const username = message.from.username || '';
    const text = (message.text || '').trim();

    // Safe structured logging of incoming command/message
    if (text.startsWith('/')) {
      const commandName = text.split(' ')[0];
      console.log(`TELEGRAM_COMMAND_RECEIVED\ncommand=${commandName}\ntelegramUserId=${userId}\nchatId=${chatId}`);
    }

    // Check if the user is the Admin
    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
    const isAdmin = adminTelegramId && userId === adminTelegramId;

    if (isAdmin) {
      const handlerStart = performance.now();
      await this.handleAdminCommand(chatId, text, timings);
      const handlerTime = performance.now() - handlerStart;
      timings.handler = Math.max(0, Math.round(handlerTime - timings.databaseQuery - timings.telegramAPI));
      
      const total = Math.round(performance.now() - startTotal);
      console.log(`TELEGRAM_PERF\ncommand=${text.split(' ')[0]}\nclientLookup=${timings.clientLookup}ms\ndatabaseQuery=${timings.databaseQuery}ms\nhandler=${timings.handler}ms\ntelegramAPI=${timings.telegramAPI}ms\ntotal=${total}ms`);
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

    // Try to find the client associated with this Telegram userId
    const lookupStart = performance.now();
    let client: any = await Client.findOne({ telegramUserId: userId })
      .select('clientCode name company email phone address city country telegramUserId telegramChatId telegramConnected')
      .lean();
    timings.clientLookup = Math.round(performance.now() - lookupStart);

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
        const handlerStart = performance.now();
        const dbStart = performance.now();
        client = await ClientService.connectTelegram(startToken, {
          telegramUserId: userId,
          telegramUsername: username,
          telegramChatId: chatId,
        });
        timings.databaseQuery += Math.round(performance.now() - dbStart);

        await this.sendMessage(
          chatId,
          `<b>🎉 Telegram Successfully Connected!</b>\n\nHello <b>${client.name}</b>, your Telegram profile is now securely linked to your account with client code <b>${client.clientCode}</b>.\n\nYou can use the following commands to interact with your account:\n/myprofile - View Profile\n/myproject - View Project Details\n/payments - View Payment Logs\n/invoices - View Billing History\n/status - Check Development Progress`,
          timings
        );
        
        const handlerTime = performance.now() - handlerStart;
        timings.handler = Math.max(0, Math.round(handlerTime - timings.databaseQuery - timings.telegramAPI));
        
        const total = Math.round(performance.now() - startTotal);
        console.log(`TELEGRAM_PERF\ncommand=${text.split(' ')[0]}\nclientLookup=${timings.clientLookup}ms\ndatabaseQuery=${timings.databaseQuery}ms\nhandler=${timings.handler}ms\ntelegramAPI=${timings.telegramAPI}ms\ntotal=${total}ms`);
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
        console.log(`TELEGRAM_PERF\ncommand=${text.split(' ')[0]}\nclientLookup=${timings.clientLookup}ms\ndatabaseQuery=${timings.databaseQuery}ms\nhandler=${timings.handler}ms\ntelegramAPI=${timings.telegramAPI}ms\ntotal=${total}ms`);
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

    // If client is not connected
    if (!client) {
      const handlerStart = performance.now();
      // Look up by username as fallback if connected flag isn't set, or prompt setup
      const dbStart = performance.now();
      const clientByUsername = username ? await Client.findOne({ telegramUsername: username }) : null;
      timings.databaseQuery += Math.round(performance.now() - dbStart);
      
      if (clientByUsername && !clientByUsername.telegramConnected) {
        // Link them
        clientByUsername.telegramConnected = true;
        clientByUsername.telegramUserId = userId;
        clientByUsername.telegramChatId = chatId;
        
        const dbStart2 = performance.now();
        client = await clientByUsername.save();
        timings.databaseQuery += Math.round(performance.now() - dbStart2);
        
        await this.sendMessage(chatId, `<b>🎉 Welcome back, ${client.name}!</b>\n\nYour account has been matched. Use /help to see commands.`, timings);
        
        const handlerTime = performance.now() - handlerStart;
        timings.handler = Math.max(0, Math.round(handlerTime - timings.databaseQuery - timings.telegramAPI));
        
        const total = Math.round(performance.now() - startTotal);
        console.log(`TELEGRAM_PERF\ncommand=${text.split(' ')[0]}\nclientLookup=${timings.clientLookup}ms\ndatabaseQuery=${timings.databaseQuery}ms\nhandler=${timings.handler}ms\ntelegramAPI=${timings.telegramAPI}ms\ntotal=${total}ms`);
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

      await this.sendMessage(
        chatId,
        `<b>👋 Welcome to Dr Debuggers.</b>\n\n` +
        `Your Telegram account is not connected to a client account yet.\n\n` +
        `Please ask the administrator for your secure connection link.\n\n` +
        `<i>Your Telegram User ID:</i> <code>${userId}</code>`,
        timings
      );
      
      const handlerTime = performance.now() - handlerStart;
      timings.handler = Math.max(0, Math.round(handlerTime - timings.databaseQuery - timings.telegramAPI));
      
      const total = Math.round(performance.now() - startTotal);
      console.log(`TELEGRAM_PERF\ncommand=${text.split(' ')[0]}\nclientLookup=${timings.clientLookup}ms\ndatabaseQuery=${timings.databaseQuery}ms\nhandler=${timings.handler}ms\ntelegramAPI=${timings.telegramAPI}ms\ntotal=${total}ms`);
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

    // Standard client commands
    const handlerStart = performance.now();
    await this.handleClientCommand(chatId, client, text, timings);
    const handlerTime = performance.now() - handlerStart;
    timings.handler = Math.max(0, Math.round(handlerTime - timings.databaseQuery - timings.telegramAPI));
    
    const total = Math.round(performance.now() - startTotal);
    console.log(`TELEGRAM_PERF\ncommand=${text.split(' ')[0]}\nclientLookup=${timings.clientLookup}ms\ndatabaseQuery=${timings.databaseQuery}ms\nhandler=${timings.handler}ms\ntelegramAPI=${timings.telegramAPI}ms\ntotal=${total}ms`);
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

  /**
   * Handle Client bot commands
   */
  private static async handleClientCommand(
    chatId: string,
    client: any,
    text: string,
    timings?: { telegramAPI: number; databaseQuery: number }
  ): Promise<void> {
    let cmd = text.toLowerCase().split(' ')[0];
    if (cmd.includes('@')) {
      cmd = cmd.split('@')[0];
    }

    switch (cmd) {
      case '/start':
      case '/help':
        await this.sendMessage(
          chatId,
          `<b>👋 Hello, ${client.name}!</b>\n\nHere are the available commands:\n/myprofile - View Profile Information\n/myproject - View Project Budgets\n/payments - View Payments List\n/invoices - View Invoices & PDF\n/status - Check Current Phase`,
          timings
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

      case '/myproject': {
        const dbStart = performance.now();
        const projects = await Project.find({ clientId: client._id })
          .select('name serviceType totalAmount currency status')
          .lean();
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart);
        }

        if (projects.length === 0) {
          await this.sendMessage(chatId, 'No active projects found for your account.', timings);
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
                 `<b>Service:</b> ${p.serviceType}\n` +
                 `<b>Budget:</b> ${currencySymbol}${p.totalAmount.toLocaleString('en-IN')}\n` +
                 `<b>Paid:</b> ${currencySymbol}${paidAmount.toLocaleString('en-IN')}\n` +
                 `<b>Outstanding:</b> ${currencySymbol}${outstandingAmount.toLocaleString('en-IN')}\n\n`;
        }
        await this.sendMessage(chatId, msg, timings);
        break;
      }

      case '/payment':
      case '/payments': {
        const dbStart = performance.now();
        const projects = await Project.find({ clientId: client._id })
          .select('name totalAmount currency')
          .lean();
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart);
        }

        if (projects.length === 0) {
          await this.sendMessage(chatId, 'No projects found.', timings);
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

          msg += `<b>Project:</b>\n${p.name}\n\n` +
                 `<b>Total:</b>\n${currencySymbol}${p.totalAmount.toLocaleString('en-IN')}\n\n` +
                 `<b>Paid:</b>\n${currencySymbol}${paidAmount.toLocaleString('en-IN')}\n\n` +
                 `<b>Outstanding:</b>\n${currencySymbol}${outstandingAmount.toLocaleString('en-IN')}\n\n`;

          if (payments.length > 0) {
            msg += `<b>Transactions:</b>\n\n`;
            let idx = 1;
            for (const r of payments) {
              const pType = r.paymentType || 'INSTALLMENT';
              msg += `${idx}. ${currencySymbol}${r.amount.toLocaleString('en-IN')}\n` +
                     `   ${pType}\n` +
                     `   ${r.paymentMethod}\n` +
                     `   ${r.paymentNumber}\n\n`;
              idx++;
            }
          } else {
            msg += `No payments recorded yet.\n\n`;
          }
          msg += `--------------------------------\n\n`;
        }
        await this.sendMessage(chatId, msg, timings);
        break;
      }

      case '/invoices': {
        const dbStart = performance.now();
        const invoices = await Invoice.find({ clientId: client._id })
          .select('invoiceNumber total status invoiceDate currency')
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
          msg += `<b>Invoice:</b> ${inv.invoiceNumber}\n` +
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
        const dbStart = performance.now();
        const projects = await Project.find({ clientId: client._id })
          .select('name totalAmount currency status')
          .lean();
        if (timings) {
          timings.databaseQuery += Math.round(performance.now() - dbStart);
        }

        if (projects.length === 0) {
          await this.sendMessage(chatId, 'No active projects.', timings);
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

          msg += `📊 <b>Project Status</b>\n\n` +
                 `${p.name}\n\n` +
                 `<b>Budget:</b>\n` +
                 `${currencySymbol}${p.totalAmount.toLocaleString('en-IN')}\n\n` +
                 `<b>Paid:</b>\n` +
                 `${currencySymbol}${paidAmount.toLocaleString('en-IN')}\n\n` +
                 `<b>Outstanding:</b>\n` +
                 `${currencySymbol}${outstandingAmount.toLocaleString('en-IN')}\n\n` +
                 `<b>Development:</b>\n` +
                 `<code>${p.status}</code>\n\n` +
                 `<b>Payment:</b>\n` +
                 `<code>${paymentStatus}</code>\n\n` +
                 `--------------------------------\n\n`;
        }
        await this.sendMessage(chatId, msg, timings);
        break;
      }

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
}
