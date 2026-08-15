import crypto from 'crypto';
import Client, { IClient } from '@/models/Client';
import { AuditService } from './audit.service';
import { dbConnect } from '@/lib/db/connect';

export class ClientService {
  /**
   * Create a new client with a unique client code
   */
  static async createClient(clientData: Partial<IClient>, actor: string): Promise<IClient> {
    await dbConnect();

    const code = clientData.clientCode?.toUpperCase().trim();
    if (!code) {
      throw new Error('Client code is required');
    }

    const existingClient = await Client.findOne({ clientCode: code });
    if (existingClient) {
      throw new Error(`Client with code "${code}" already exists`);
    }

    const client = new Client({
      ...clientData,
      clientCode: code,
      status: clientData.status || 'LEAD',
    });

    const savedClient = await client.save();
    
    await AuditService.logAction(actor, 'CLIENT_CREATED', 'Client', savedClient._id, {
      name: savedClient.name,
      code: savedClient.clientCode,
    });

    return savedClient;
  }

  /**
   * Search, filter, and paginate clients
   */
  static async queryClients(params: {
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) {
    await dbConnect();

    const { search, status, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 10 } = params;
    const query: Record<string, any> = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { company: searchRegex },
        { clientCode: searchRegex },
        { telegramUsername: searchRegex },
      ];
    }

    const skip = (page - 1) * limit;
    const total = await Client.countDocuments(query);
    const clients = await Client.find(query)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(limit);

    return {
      clients,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Generate connection token & link for Telegram connect
   */
  static async generateTelegramLink(clientId: string, actor: string): Promise<string> {
    await dbConnect();

    const client = await Client.findById(clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

    client.telegramConnectionToken = token;
    client.telegramConnectionTokenExpiresAt = expiresAt;
    await client.save();

    await AuditService.logAction(actor, 'CLIENT_UPDATED', 'Client', client._id, {
      info: 'Generated Telegram linking token',
    });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'DeveloperBot';
    return `https://t.me/${botUsername}?start=${token}`;
  }

  /**
   * Connect a Telegram account using a secure token
   */
  static async connectTelegram(token: string, telegramInfo: {
    telegramUserId: string;
    telegramUsername?: string;
    telegramChatId: string;
  }): Promise<IClient> {
    await dbConnect();

    const client = await Client.findOne({
      telegramConnectionToken: token,
      telegramConnectionTokenExpiresAt: { $gt: new Date() },
    });

    if (!client) {
      throw new Error('Invalid or expired Telegram connection token');
    }

    // Verify no other client has this telegramUserId
    const existingWithId = await Client.findOne({ telegramUserId: telegramInfo.telegramUserId });
    if (existingWithId && existingWithId._id.toString() !== client._id.toString()) {
      throw new Error('This Telegram account is already associated with another client');
    }

    client.telegramConnected = true;
    client.telegramUserId = telegramInfo.telegramUserId;
    client.telegramUsername = telegramInfo.telegramUsername || '';
    client.telegramChatId = telegramInfo.telegramChatId;
    
    // Invalidate token
    client.telegramConnectionToken = undefined;
    client.telegramConnectionTokenExpiresAt = undefined;

    const updatedClient = await client.save();

    await AuditService.logAction('telegram_webhook', 'CLIENT_UPDATED', 'Client', updatedClient._id, {
      info: 'Telegram account linked',
      telegramUserId: telegramInfo.telegramUserId,
      telegramUsername: telegramInfo.telegramUsername,
    });

    return updatedClient;
  }
}
