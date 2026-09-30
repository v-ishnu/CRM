import mongoose from 'mongoose';
import Hosting, { IHosting, HostingStatus, IHostingWebsite, WebsiteStatus } from '@/models/Hosting';
import Credential from '@/models/Credential';
import Client from '@/models/Client';
import Project from '@/models/Project';
import { encrypt, decrypt } from '@/lib/security/encryption';
import { AuditService } from './audit.service';
import { TelegramService } from './telegram.service';
import { dbConnect } from '@/lib/db/connect';

export class HostingService {
  /**
   * Normalize domain string: removes protocol, www., paths, query params, trailing slashes, port, and lowercases.
   */
  static normalizeDomain(input: string): string {
    if (!input || typeof input !== 'string' || input.trim() === '') {
      throw new Error('Domain is required');
    }
    let cleaned = input.trim().toLowerCase();
    cleaned = cleaned.replace(/^[a-z]+:\/\//, '');
    cleaned = cleaned.replace(/^[^/@]+@/, '');
    cleaned = cleaned.replace(/[/?#].*$/, '');
    cleaned = cleaned.replace(/:\d+$/, '');
    cleaned = cleaned.replace(/^www\./, '');
    cleaned = cleaned.replace(/[./]+$/, '');

    if (!cleaned || cleaned.includes(' ') || !cleaned.includes('.')) {
      throw new Error('Invalid domain format');
    }
    return cleaned;
  }

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
   * Derive website status based on expiry date
   */
  static deriveWebsiteStatus(expiryDate: Date, currentStatus?: string): WebsiteStatus {
    if (currentStatus === 'CANCELLED') return 'CANCELLED';
    if (currentStatus === 'SUSPENDED') return 'SUSPENDED';
    const days = this.calculateDaysRemaining(expiryDate);
    if (days <= 0) return 'EXPIRED';
    if (days <= 30) return 'EXPIRING_SOON';
    return 'ACTIVE';
  }

  /**
   * Normalize websites array for backward compatibility with legacy single-website records
   */
  static normalizeWebsites(hosting: any): any[] {
    if (hosting.websites && Array.isArray(hosting.websites) && hosting.websites.length > 0) {
      return hosting.websites;
    }
    if (hosting.domain) {
      return [
        {
          _id: hosting._id,
          domain: hosting.domain,
          expiryDate: hosting.expiryDate,
          status: hosting.status || 'ACTIVE',
          notes: hosting.notes,
          credentialIds: [],
          createdAt: hosting.createdAt,
          updatedAt: hosting.updatedAt,
        },
      ];
    }
    return [];
  }

  /**
   * Create a new hosting record with encrypted secrets
   */
  static async createHosting(
    data: {
      clientId?: string;
      projectId?: string;
      hostingProvider: string;
      hostingType?: string;
      panelUrl?: string;
      serverHost?: string;
      domain?: string;
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
      websites?: Array<{
        domain: string;
        expiryDate: Date | string;
        status?: WebsiteStatus;
        notes?: string;
      }>;
    },
    actor: string
  ): Promise<IHosting> {
    await dbConnect();

    let resolvedClientId = data.clientId;

    const hasProject = !!(data.projectId && data.projectId !== 'null' && String(data.projectId).trim() !== '');
    if (hasProject) {
      if (!mongoose.Types.ObjectId.isValid(data.projectId!)) {
        throw new Error('Invalid project ID');
      }
      const project = await Project.findById(data.projectId);
      if (!project) {
        throw new Error('Project not found');
      }
      const projectClientId = project.clientId.toString();
      if (resolvedClientId && resolvedClientId.toString() !== projectClientId) {
        throw new Error('Project does not belong to specified client');
      }
      resolvedClientId = projectClientId;
    }

    if (!resolvedClientId) {
      throw new Error('Client is required (must select a valid Project or Client)');
    }

    if (!mongoose.Types.ObjectId.isValid(resolvedClientId)) {
      throw new Error('Invalid client ID');
    }

    const client = await Client.findById(resolvedClientId);
    if (!client) {
      throw new Error('Client not found');
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

    const normalizedDomain = data.domain && data.domain.trim() !== '' ? this.normalizeDomain(data.domain) : '';

    // Encrypt sensitive fields
    const passwordEnc = encrypt(data.password.trim(), 'hosting_password');
    const sshKeyEnc = data.sshKey && data.sshKey.trim() !== '' ? encrypt(data.sshKey.trim(), 'hosting_sshKey') : undefined;
    const apiTokenEnc = data.apiToken && data.apiToken.trim() !== '' ? encrypt(data.apiToken.trim(), 'hosting_apiToken') : undefined;

    const initialStatus = this.deriveStatus(data.expiryDate);

    const initialWebsites: any[] = [];
    if (data.websites && Array.isArray(data.websites) && data.websites.length > 0) {
      for (const w of data.websites) {
        const wDomain = this.normalizeDomain(w.domain);
        if (wDomain) {
          const wExpiry = new Date(w.expiryDate);
          initialWebsites.push({
            _id: new mongoose.Types.ObjectId(),
            domain: wDomain,
            expiryDate: wExpiry,
            status: w.status || this.deriveWebsiteStatus(wExpiry),
            notes: w.notes,
            credentialIds: [],
            notificationsSent: new Map(),
          });
        }
      }
    }
    if (initialWebsites.length === 0 && normalizedDomain) {
      initialWebsites.push({
        _id: new mongoose.Types.ObjectId(),
        domain: normalizedDomain,
        expiryDate: data.expiryDate,
        status: initialStatus,
        notes: data.notes,
        credentialIds: [],
        notificationsSent: new Map(),
      });
    }

    const hosting = await Hosting.create({
      clientId: client._id,
      projectId: hasProject ? new mongoose.Types.ObjectId(data.projectId) : undefined,
      hostingProvider: data.hostingProvider.trim(),
      hostingType: data.hostingType ? data.hostingType.trim() : 'Shared',
      panelUrl: data.panelUrl ? data.panelUrl.trim() : undefined,
      serverHost: data.serverHost ? data.serverHost.trim() : undefined,
      domain: normalizedDomain || '',
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
      websites: initialWebsites,
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
      clientId?: string;
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
      if (data.projectId) {
        const project = await Project.findById(data.projectId);
        if (!project) {
          throw new Error('Project not found');
        }
        hosting.projectId = new mongoose.Types.ObjectId(data.projectId);
        hosting.clientId = project.clientId;
        updatedFields.push('projectId', 'clientId');
      } else {
        hosting.projectId = undefined;
        updatedFields.push('projectId');
      }
    } else if (data.clientId !== undefined) {
      const client = await Client.findById(data.clientId);
      if (!client) {
        throw new Error('Client not found');
      }
      hosting.clientId = client._id;
      updatedFields.push('clientId');
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
   * Add a new website to an existing hosting account
   */
  static async addWebsite(
    hostingId: string,
    data: {
      domain: string;
      expiryDate: Date | string;
      status?: WebsiteStatus;
      notes?: string;
      initialCredential?: {
        service?: string;
        username: string;
        password: string;
        loginUrl?: string;
        additionalInfo?: string;
        credentialType?: string;
      };
    },
    actor: string
  ): Promise<IHosting> {
    await dbConnect();

    const hosting = await Hosting.findById(hostingId);
    if (!hosting) {
      throw new Error('Hosting record not found');
    }

    if (!data.domain || data.domain.trim() === '') {
      throw new Error('Website domain is required');
    }
    if (!data.expiryDate) {
      throw new Error('Website expiry date is required');
    }

    const normalizedDomain = this.normalizeDomain(data.domain);
    if (hosting.websites && hosting.websites.some((w: any) => w.domain === normalizedDomain)) {
      throw new Error(`Website domain ${normalizedDomain} is already registered on this hosting account`);
    }

    const expiry = new Date(data.expiryDate);
    const status = data.status || this.deriveWebsiteStatus(expiry);

    if (!hosting.websites) {
      hosting.websites = [];
    }

    const websiteId = new mongoose.Types.ObjectId();
    const newWebsite: IHostingWebsite = {
      _id: websiteId,
      domain: normalizedDomain,
      expiryDate: expiry,
      status,
      notes: data.notes?.trim() || undefined,
      credentialIds: [],
      notificationsSent: new Map(),
    };

    hosting.websites.push(newWebsite);
    await hosting.save();

    await AuditService.logAction(actor, 'WEBSITE_CREATED', 'Hosting', hosting._id, {
      hostingId: hosting._id.toString(),
      websiteId: websiteId.toString(),
      domain: normalizedDomain,
      expiryDate: expiry,
      status,
      timestamp: new Date(),
    });

    if (
      data.initialCredential &&
      data.initialCredential.username?.trim() &&
      data.initialCredential.password?.trim()
    ) {
      await this.addWebsiteCredential(
        hosting._id.toString(),
        websiteId.toString(),
        {
          service: data.initialCredential.service || 'WordPress Admin',
          username: data.initialCredential.username,
          password: data.initialCredential.password,
          loginUrl: data.initialCredential.loginUrl,
          additionalInfo: data.initialCredential.additionalInfo,
          credentialType: data.initialCredential.credentialType || 'HOSTING',
        },
        actor
      );

      const refreshedHosting = await Hosting.findById(hostingId);
      if (refreshedHosting) {
        return refreshedHosting;
      }
    }

    return hosting;
  }

  /**
   * Update an existing website inside a hosting account
   */
  static async updateWebsite(
    hostingId: string,
    websiteId: string,
    data: Partial<{
      domain: string;
      expiryDate: Date | string;
      status: WebsiteStatus;
      notes: string;
    }>,
    actor: string
  ): Promise<IHosting> {
    await dbConnect();

    const hosting = await Hosting.findById(hostingId);
    if (!hosting) {
      throw new Error('Hosting record not found');
    }

    if (!hosting.websites || hosting.websites.length === 0) {
      throw new Error('Website not found in hosting account');
    }

    const website = hosting.websites.find((w: any) => w._id.toString() === websiteId);
    if (!website) {
      throw new Error('Website not found in hosting account');
    }

    const updatedFields: string[] = [];

    if (data.domain) {
      const normalized = this.normalizeDomain(data.domain);
      website.domain = normalized;
      updatedFields.push('domain');
    }

    if (data.expiryDate) {
      website.expiryDate = new Date(data.expiryDate);
      if (website.status !== 'CANCELLED' && website.status !== 'SUSPENDED') {
        website.status = this.deriveWebsiteStatus(website.expiryDate, website.status);
      }
      updatedFields.push('expiryDate');
    }

    if (data.status) {
      website.status = data.status;
      updatedFields.push('status');
    }

    if (data.notes !== undefined) {
      website.notes = data.notes;
      updatedFields.push('notes');
    }

    await hosting.save();

    await AuditService.logAction(actor, 'WEBSITE_UPDATED', 'Hosting', hosting._id, {
      hostingId: hosting._id.toString(),
      websiteId,
      domain: website.domain,
      updatedFields,
      timestamp: new Date(),
    });

    return hosting;
  }

  /**
   * Delete or deactivate a website inside a hosting account
   */
  static async deleteWebsite(
    hostingId: string,
    websiteId: string,
    actor: string,
    softDelete: boolean = false
  ): Promise<IHosting> {
    await dbConnect();

    const hosting = await Hosting.findById(hostingId);
    if (!hosting) {
      throw new Error('Hosting record not found');
    }

    if (!hosting.websites || hosting.websites.length === 0) {
      throw new Error('Website not found in hosting account');
    }

    const websiteIndex = hosting.websites.findIndex((w: any) => w._id.toString() === websiteId);
    if (websiteIndex === -1) {
      throw new Error('Website not found in hosting account');
    }

    const website = hosting.websites[websiteIndex];

    if (softDelete) {
      website.status = 'SUSPENDED';
    } else {
      hosting.websites.splice(websiteIndex, 1);
      if (website.credentialIds && website.credentialIds.length > 0) {
        await Credential.deleteMany({ _id: { $in: website.credentialIds } });
      }
    }

    await hosting.save();

    await AuditService.logAction(actor, softDelete ? 'WEBSITE_DEACTIVATED' : 'WEBSITE_DELETED', 'Hosting', hosting._id, {
      hostingId: hosting._id.toString(),
      websiteId,
      domain: website.domain,
      softDelete,
      timestamp: new Date(),
    });

    return hosting;
  }

  /**
   * Add a credential to a specific website inside a hosting account
   */
  static async addWebsiteCredential(
    hostingId: string,
    websiteId: string,
    data: {
      service: string;
      username: string;
      password: string;
      loginUrl?: string;
      additionalInfo?: string;
      credentialType?: string;
    },
    actor: string
  ): Promise<any> {
    await dbConnect();

    const hosting = await Hosting.findById(hostingId);
    if (!hosting) {
      throw new Error('Hosting record not found');
    }

    const website = hosting.websites?.find((w: any) => w._id.toString() === websiteId);
    if (!website) {
      throw new Error('Website not found in hosting account');
    }

    const serviceTrimmed = data.service?.trim();
    const usernameTrimmed = data.username?.trim();
    const passwordTrimmed = data.password?.trim();

    if (!serviceTrimmed || !usernameTrimmed || !passwordTrimmed) {
      throw new Error('Service name, username, and password are required');
    }

    const serviceEnc = encrypt(serviceTrimmed, 'service');
    const usernameEnc = encrypt(usernameTrimmed, 'username');
    const passwordEnc = encrypt(passwordTrimmed, 'password');
    const loginUrlEnc = data.loginUrl?.trim() ? encrypt(data.loginUrl.trim(), 'loginUrl') : undefined;
    const additionalInfoEnc = data.additionalInfo?.trim() ? encrypt(data.additionalInfo.trim(), 'additionalInfo') : undefined;

    const credential = await Credential.create({
      clientId: hosting.clientId,
      projectId: hosting.projectId,
      hostingId: hosting._id,
      websiteId: website._id,
      domainId: website._id,
      credentialType: (data.credentialType || 'HOSTING').toUpperCase().trim(),
      source: 'MANUAL',
      service: serviceEnc,
      username: usernameEnc,
      password: passwordEnc,
      loginUrl: loginUrlEnc,
      additionalInfo: additionalInfoEnc,
      version: 1,
    });

    if (!website.credentialIds) {
      website.credentialIds = [];
    }
    website.credentialIds.push(credential._id as any);
    await hosting.save();

    await AuditService.logAction(actor, 'CREDENTIAL_CREATED', 'Credential', credential._id, {
      credentialId: credential._id.toString(),
      hostingId: hosting._id.toString(),
      websiteId,
      domain: website.domain,
      service: serviceTrimmed,
      timestamp: new Date(),
    });

    return {
      _id: credential._id,
      service: serviceTrimmed,
      username: usernameTrimmed,
      loginUrl: data.loginUrl?.trim() || undefined,
      credentialType: credential.credentialType,
    };
  }

  /**
   * Get credentials for a website (masked or revealed)
   */
  static async getWebsiteCredentials(
    hostingId: string,
    websiteId: string,
    actor: string = 'admin',
    reveal: boolean = false
  ): Promise<any[]> {
    await dbConnect();

    const hosting = await Hosting.findById(hostingId);
    if (!hosting) {
      throw new Error('Hosting record not found');
    }

    const website = hosting.websites?.find((w: any) => w._id.toString() === websiteId);
    if (!website) {
      throw new Error('Website not found in hosting account');
    }

    if (!website.credentialIds || website.credentialIds.length === 0) {
      return [];
    }

    const credentials = await Credential.find({
      _id: { $in: website.credentialIds },
      isRevoked: { $ne: true },
    }).lean();

    const result = [];
    for (const c of credentials as any[]) {
      let service = 'Credential';
      let username = '***';
      let password = '••••••••';
      let loginUrl = '';
      let additionalInfo = '';

      try {
        if (c.service) service = decrypt(c.service);
        if (c.username) username = decrypt(c.username);
        if (c.loginUrl) loginUrl = decrypt(c.loginUrl);
        if (c.additionalInfo) additionalInfo = decrypt(c.additionalInfo);
        if (reveal) {
          if (c.password) password = decrypt(c.password);
          await AuditService.logAction(actor, 'CREDENTIAL_REVEALED', 'Credential', c._id, {
            credentialId: c._id.toString(),
            hostingId: hosting._id.toString(),
            websiteId,
            domain: website.domain,
            actor,
            timestamp: new Date(),
          });
        }
      } catch (err: any) {
        console.error('Failed to decrypt credential:', c._id, err.message);
      }

      result.push({
        _id: c._id,
        service,
        username,
        password: reveal ? password : undefined,
        passwordMasked: '••••••••••••',
        loginUrl: loginUrl || undefined,
        additionalInfo: additionalInfo || undefined,
        credentialType: c.credentialType,
        source: c.source,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      });
    }

    return result;
  }

  /**
   * Delete / revoke credential from website
   */
  static async deleteWebsiteCredential(
    hostingId: string,
    websiteId: string,
    credentialId: string,
    actor: string
  ): Promise<boolean> {
    await dbConnect();

    const hosting = await Hosting.findById(hostingId);
    if (!hosting) {
      throw new Error('Hosting record not found');
    }

    const website = hosting.websites?.find((w: any) => w._id.toString() === websiteId);
    if (!website) {
      throw new Error('Website not found in hosting account');
    }

    // Remove from array
    if (website.credentialIds) {
      website.credentialIds = website.credentialIds.filter(
        (id: any) => id.toString() !== credentialId
      );
      await hosting.save();
    }

    // Soft delete Credential
    await Credential.findByIdAndUpdate(credentialId, {
      isRevoked: true,
      deletedAt: new Date(),
      deletedBy: actor,
    });

    await AuditService.logAction(actor, 'CREDENTIAL_REVOKED', 'Credential', credentialId, {
      credentialId,
      hostingId,
      websiteId,
      domain: website.domain,
      timestamp: new Date(),
    });

    return true;
  }

  // Domain aliases for complete terminology interchangeability
  static async addDomain(hostingId: string, data: any, actor: string) {
    return this.addWebsite(hostingId, data, actor);
  }

  static async updateDomain(hostingId: string, domainId: string, data: any, actor: string) {
    return this.updateWebsite(hostingId, domainId, data, actor);
  }

  static async deleteDomain(hostingId: string, domainId: string, actor: string, softDelete: boolean = false) {
    return this.deleteWebsite(hostingId, domainId, actor, softDelete);
  }

  static async getDomainCredentials(hostingId: string, domainId: string, actor: string = 'system', reveal: boolean = false) {
    return this.getWebsiteCredentials(hostingId, domainId, actor, reveal);
  }

  static async addDomainCredential(hostingId: string, domainId: string, data: any, actor: string) {
    return this.addWebsiteCredential(hostingId, domainId, data, actor);
  }

  static async deleteDomainCredential(hostingId: string, domainId: string, credentialId: string, actor: string) {
    return this.deleteWebsiteCredential(hostingId, domainId, credentialId, actor);
  }

  /**
   * Reconcile hosting records and generate dry-run/migration report
   */
  static async reconcileHostingWebsites(options: { dryRun?: boolean } = { dryRun: true }): Promise<{
    dryRun: boolean;
    totalRecords: number;
    alreadyCompatible: number;
    requiringTransformation: number;
    ambiguousOrMissing: number;
    details: Array<{
      hostingId: string;
      domain: string;
      status: string;
      action: 'NOOP_ALREADY_COMPATIBLE' | 'NEEDS_MIGRATION' | 'MIGRATED' | 'MISSING_DATA';
    }>;
  }> {
    await dbConnect();

    const hostings = await Hosting.find({});
    let alreadyCompatible = 0;
    let requiringTransformation = 0;
    let ambiguousOrMissing = 0;
    const details: any[] = [];

    for (const h of hostings) {
      const hasWebsites = h.websites && Array.isArray(h.websites) && h.websites.length > 0;
      if (hasWebsites) {
        alreadyCompatible++;
        details.push({
          hostingId: h._id.toString(),
          domain: h.domain,
          status: 'COMPATIBLE',
          action: 'NOOP_ALREADY_COMPATIBLE',
        });
      } else if (!h.domain || !h.expiryDate) {
        ambiguousOrMissing++;
        details.push({
          hostingId: h._id.toString(),
          domain: h.domain || 'N/A',
          status: 'AMBIGUOUS',
          action: 'MISSING_DATA',
        });
      } else {
        requiringTransformation++;
        if (!options.dryRun) {
          h.websites = [
            {
              _id: new mongoose.Types.ObjectId(),
              domain: this.normalizeDomain(h.domain),
              expiryDate: h.expiryDate,
              status: h.status || 'ACTIVE',
              notes: h.notes,
              credentialIds: [],
              notificationsSent: new Map(),
            } as any,
          ];
          await h.save();
          details.push({
            hostingId: h._id.toString(),
            domain: h.domain,
            status: 'MIGRATED',
            action: 'MIGRATED',
          });
        } else {
          details.push({
            hostingId: h._id.toString(),
            domain: h.domain,
            status: 'NEEDS_TRANSFORMATION',
            action: 'NEEDS_MIGRATION',
          });
        }
      }
    }

    return {
      dryRun: !!options.dryRun,
      totalRecords: hostings.length,
      alreadyCompatible,
      requiringTransformation,
      ambiguousOrMissing,
      details,
    };
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
    const hasNotificationBeenSent = (store: any, key: string): boolean => {
      if (!store) return false;
      if (typeof store.has === 'function') return store.has(key);
      if (Array.isArray(store)) return store.includes(key) || store.includes(Number(key));
      return Boolean(store[key]);
    };

    const markNotificationSent = (target: any, key: string) => {
      if (!target.notificationsSent) {
        target.notificationsSent = new Map();
      }
      if (typeof target.notificationsSent.set === 'function') {
        target.notificationsSent.set(key, new Date());
      } else if (Array.isArray(target.notificationsSent)) {
        target.notificationsSent.push(Number(key));
      } else {
        target.notificationsSent[key] = new Date();
      }
    };

    for (const hosting of hostings) {
      const days = this.calculateDaysRemaining(hosting.expiryDate);
      const client = hosting.clientId as any;
      const project = hosting.projectId as any;

      // Update derived status
      const derivedStatus = this.deriveStatus(hosting.expiryDate, hosting.status);
      if (hosting.status !== derivedStatus) {
        hosting.status = derivedStatus;
      }

      // 1. Check Hosting Account Expiry Thresholds
      for (const threshold of notificationThresholds) {
        const thresholdKey = String(threshold);

        const isMatch =
          threshold === 0
            ? days <= 0
            : days <= threshold && days > (notificationThresholds[notificationThresholds.indexOf(threshold) + 1] ?? -999);

        if (isMatch) {
          const alreadySent = hasNotificationBeenSent(hosting.notificationsSent, thresholdKey);
          if (!alreadySent) {
            let clientSent = false;
            let adminSent = false;

            const formattedDate = new Date(hosting.expiryDate).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            });
            const daysRemainingText = days <= 0 ? 'EXPIRED' : `${days} day${days > 1 ? 's' : ''}`;

            const clientChatId = client?.telegramChatId || client?.telegramUserId;
            if (client && client.telegramConnected && clientChatId) {
              let clientMessage =
                `⚠️ <b>Hosting Expiry Reminder</b>\n\n` +
                `Your hosting for <b>${hosting.domain || project?.name || 'your project'}</b> is expiring soon.\n\n` +
                `<b>Provider:</b> ${hosting.hostingProvider}\n` +
                `<b>Expiry Date:</b> ${formattedDate}\n` +
                `<b>Days Remaining:</b> ${daysRemainingText}\n\n` +
                `Please contact us if you want to renew the hosting service.`;

              try {
                const { MessageTemplateService } = await import('./message-template.service');
                const rendered = await MessageTemplateService.renderTemplate(
                  'CLIENT_HOSTING_EXPIRY',
                  'TELEGRAM',
                  {
                    projectName: hosting.domain || project?.name || 'your project',
                    hostingProvider: hosting.hostingProvider,
                    expiryDate: formattedDate,
                    daysRemaining: daysRemainingText,
                  }
                );
                clientMessage = rendered.body;
              } catch {
                // Safe fallback
              }

              const res = await TelegramService.sendMessageRaw(clientChatId, clientMessage);
              clientSent = !!(res && res.success);
            }

            const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
            if (adminTelegramId) {
              let adminMessage =
                `⚠️ <b>Hosting Expiry Alert</b>\n\n` +
                `<b>Client:</b> ${client ? client.name : 'Unknown'}\n` +
                `<b>Project:</b> ${project ? project.name : 'General'}\n` +
                `<b>Provider:</b> ${hosting.hostingProvider}\n` +
                `<b>Domain:</b> ${hosting.domain}\n` +
                `<b>Expiry:</b> ${formattedDate}\n` +
                `<b>Days Remaining:</b> ${daysRemainingText}\n` +
                `<b>Client Telegram:</b> ${client?.telegramConnected ? 'CONNECTED' : 'NOT CONNECTED'}`;

              try {
                const { MessageTemplateService } = await import('./message-template.service');
                const rendered = await MessageTemplateService.renderTemplate(
                  'ADMIN_HOSTING_EXPIRY_ALERT',
                  'TELEGRAM',
                  {
                    clientName: client ? client.name : 'Unknown',
                    projectName: project ? project.name : 'General',
                    hostingProvider: hosting.hostingProvider,
                    domain: hosting.domain || 'N/A',
                    expiryDate: formattedDate,
                    daysRemaining: daysRemainingText,
                    telegramStatus: client?.telegramConnected ? 'CONNECTED' : 'NOT CONNECTED',
                  }
                );
                adminMessage = rendered.body;
              } catch {
                // Safe fallback
              }

              const res = await TelegramService.sendMessageRaw(adminTelegramId, adminMessage);
              adminSent = !!(res && res.success);
            }

            markNotificationSent(hosting, thresholdKey);

            notificationsSentCount++;
            results.push({
              hostingId: hosting._id.toString(),
              domain: hosting.domain || `${hosting.hostingProvider} Hosting`,
              threshold: thresholdKey,
              clientSent,
              adminSent,
            });

            break;
          }
        }
      }

      // 2. Check Website-Level Expiry Thresholds
      const websitesToCheck = hosting.websites && hosting.websites.length > 0 ? hosting.websites : [];
      for (const website of websitesToCheck) {
        if (website.status === 'CANCELLED' || website.status === 'SUSPENDED') continue;
        const wDays = this.calculateDaysRemaining(website.expiryDate);
        const derivedWStatus = this.deriveWebsiteStatus(website.expiryDate, website.status);
        if (website.status !== derivedWStatus) {
          website.status = derivedWStatus;
        }

        for (const threshold of notificationThresholds) {
          const thresholdKey = String(threshold);
          const isMatch =
            threshold === 0
              ? wDays <= 0
              : wDays <= threshold && wDays > (notificationThresholds[notificationThresholds.indexOf(threshold) + 1] ?? -999);

          if (isMatch) {
            const alreadySent = hasNotificationBeenSent(website.notificationsSent, thresholdKey);
            if (!alreadySent) {
              let clientSent = false;
              let adminSent = false;

              const formattedDate = new Date(website.expiryDate).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              });
              const daysRemainingText = wDays <= 0 ? 'EXPIRED' : `${wDays} day${wDays > 1 ? 's' : ''}`;

              const clientChatId = client?.telegramChatId || client?.telegramUserId;
              if (client && client.telegramConnected && clientChatId) {
                const clientName = client?.name ? `Hello ${client.name},\n\n` : '';
                const clientMessage =
                  `⚠️ <b>Domain Expiry Reminder</b>\n\n` +
                  `${clientName}Your domain is approaching its expiry date.\n\n` +
                  `<b>Domain:</b>\n${website.domain}\n\n` +
                  `<b>Expiry Date:</b>\n${formattedDate}\n\n` +
                  `<b>Hosting:</b>\n${hosting.hostingProvider}${hosting.planName ? ` (${hosting.planName})` : ''}\n\n` +
                  `Please renew the domain before the expiry date.\n\n` +
                  `— Dr. Debuggers`;

                const res = await TelegramService.sendMessageRaw(clientChatId, clientMessage);
                clientSent = !!(res && res.success);
              }

              const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
              if (adminTelegramId) {
                const adminMessage =
                  `⚠️ <b>Domain Expiry Alert</b>\n\n` +
                  `<b>Client:</b> ${client ? client.name : 'Unknown'}\n` +
                  `<b>Project:</b> ${project ? project.name : 'General'}\n` +
                  `<b>Hosting:</b> ${hosting.hostingProvider}${hosting.planName ? ` (${hosting.planName})` : ''}\n` +
                  `<b>Domain:</b> ${website.domain}\n` +
                  `<b>Expiry Date:</b> ${formattedDate}\n` +
                  `<b>Days Remaining:</b> ${daysRemainingText}\n` +
                  `<b>Client Telegram:</b> ${client?.telegramConnected ? 'CONNECTED' : 'NOT CONNECTED'}`;

                const res = await TelegramService.sendMessageRaw(adminTelegramId, adminMessage);
                adminSent = !!(res && res.success);
              }

              markNotificationSent(website, thresholdKey);

              notificationsSentCount++;
              results.push({
                hostingId: hosting._id.toString(),
                domain: `${website.domain} (Website)`,
                threshold: thresholdKey,
                clientSent,
                adminSent,
              });

              break;
            }
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
