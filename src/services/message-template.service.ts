import mongoose from 'mongoose';
import MessageTemplate, { IMessageTemplate, TemplateRecipientType, TemplateChannel } from '@/models/MessageTemplate';
import { DEFAULT_MESSAGE_TEMPLATES, DefaultTemplateDefinition } from '@/lib/templates/default-templates';
import { escapeHtml, sanitizeTelegramHtml, sanitizeChatHtml, stripHtml } from '@/lib/templates/rich-text';
import { CacheService } from './cache.service';
import { AuditService } from './audit.service';
import { dbConnect } from '@/lib/db/connect';

export interface RenderResult {
  text: string;
  body: string;
  subject?: string;
  channel: TemplateChannel;
  renderedViaFallback?: boolean;
}

export class MessageTemplateService {
  /**
   * Return default system templates list
   */
  static getDefaultTemplates(): DefaultTemplateDefinition[] {
    return DEFAULT_MESSAGE_TEMPLATES;
  }

  /**
   * Return default template definition for a specific key
   */
  static getDefaultTemplateByKey(key: string): DefaultTemplateDefinition | undefined {
    return DEFAULT_MESSAGE_TEMPLATES.find((t) => t.key === key.toUpperCase().trim());
  }

  /**
   * Seed / Ensure all default system templates exist in database
   */
  static async seedDefaultTemplates(actor: string = 'system'): Promise<number> {
    await dbConnect();
    let seededCount = 0;

    for (const def of DEFAULT_MESSAGE_TEMPLATES) {
      const existing = await MessageTemplate.findOne({ key: def.key });
      if (!existing) {
        await MessageTemplate.create({
          key: def.key,
          name: def.name,
          description: def.description,
          recipientType: def.recipientType,
          channel: def.channel,
          subject: def.subject,
          body: def.body,
          enabled: true,
          variables: def.variables,
          isSystem: true,
          version: 1,
          updatedBy: actor,
        });
        seededCount++;
      }
    }

    return seededCount;
  }

  /**
   * List templates with optional filters
   */
  static async getTemplates(filter: {
    recipientType?: TemplateRecipientType;
    channel?: TemplateChannel;
    search?: string;
  } = {}): Promise<IMessageTemplate[]> {
    await dbConnect();
    await this.seedDefaultTemplates();

    const query: any = {};
    if (filter.recipientType) {
      query.recipientType = filter.recipientType;
    }
    if (filter.channel) {
      query.channel = filter.channel;
    }
    if (filter.search && filter.search.trim()) {
      const regex = { $regex: filter.search.trim(), $options: 'i' };
      query.$or = [{ name: regex }, { key: regex }, { description: regex }];
    }

    return MessageTemplate.find(query).sort({ recipientType: 1, name: 1 }).lean();
  }

  /**
   * Get single template by ID
   */
  static async getTemplateById(id: string): Promise<IMessageTemplate> {
    await dbConnect();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid template ID');
    }
    const template = await MessageTemplate.findById(id);
    if (!template) {
      throw new Error('Template not found');
    }
    return template;
  }

  /**
   * Get template by key with cache-aside
   */
  static async getTemplateByKey(key: string): Promise<IMessageTemplate | null> {
    await dbConnect();
    const upperKey = key.toUpperCase().trim();
    const cacheKey = `msg_template:${upperKey}`;

    try {
      const cached = await CacheService.get<any>(cacheKey);
      if (cached) return cached;
    } catch {
      // Ignore cache lookup failure
    }

    const template = await MessageTemplate.findOne({ key: upperKey }).lean();
    if (template) {
      try {
        await CacheService.set(cacheKey, template, 300);
      } catch {
        // Ignore cache set failure
      }
    }
    return template as any;
  }

  /**
   * Validate that all {{variable}} tags in body are authorized for this template.
   * Explicitly blocks sensitive fields like passwords, secrets, private tokens.
   */
  static validateVariables(templateKey: string, body: string): { valid: boolean; unauthorizedVars: string[] } {
    const defaultDef = this.getDefaultTemplateByKey(templateKey);
    const allowedNames = new Set(defaultDef ? defaultDef.variables.map((v) => v.name) : []);

    // Prohibited keywords that must NEVER be used as template variables
    const blacklistedTerms = [
      'password',
      'pass',
      'secret',
      'authtag',
      'iv',
      'ciphertext',
      'privatetoken',
      'telegramtoken',
      'apikey',
      'api_key',
      'privatekey',
      'token',
      'salt',
      'hash',
      'bankaccount',
      'ifsc',
      'upi',
    ];

    const tagRegex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    const unauthorizedVars: string[] = [];
    let match;

    while ((match = tagRegex.exec(body)) !== null) {
      const varName = match[1];
      const lower = varName.toLowerCase();

      // Check blacklist
      const isBlacklisted = blacklistedTerms.some((term) => lower.includes(term));
      if (isBlacklisted) {
        unauthorizedVars.push(varName);
        continue;
      }

      // Check allowed schema if default is known
      if (allowedNames.size > 0 && !allowedNames.has(varName)) {
        unauthorizedVars.push(varName);
      }
    }

    return {
      valid: unauthorizedVars.length === 0,
      unauthorizedVars,
    };
  }

  /**
   * Update template content & settings
   */
  static async updateTemplate(
    id: string,
    data: {
      name?: string;
      description?: string;
      subject?: string;
      body?: string;
      enabled?: boolean;
    },
    actor: string = 'Admin'
  ): Promise<IMessageTemplate> {
    await dbConnect();
    const template = await this.getTemplateById(id);

    if (data.body !== undefined) {
      const trimmedBody = data.body.trim();
      if (!trimmedBody) {
        throw new Error('Template body cannot be empty');
      }

      // Validate variables
      const { valid, unauthorizedVars } = this.validateVariables(template.key, trimmedBody);
      if (!valid) {
        throw new Error(
          `Template contains invalid or unauthorized variables: ${unauthorizedVars.join(', ')}`
        );
      }

      template.body = trimmedBody;
    }

    if (data.name !== undefined) template.name = data.name.trim();
    if (data.description !== undefined) template.description = data.description.trim();
    if (data.subject !== undefined) template.subject = data.subject?.trim();
    if (data.enabled !== undefined) template.enabled = Boolean(data.enabled);

    template.version = (template.version || 1) + 1;
    template.updatedBy = actor;

    await template.save();

    // Invalidate Redis cache
    try {
      await CacheService.del(`msg_template:${template.key}`);
    } catch {
      // Ignore cache error
    }

    await AuditService.log({
      actor,
      action: 'TEMPLATE_UPDATED',
      entityType: 'MessageTemplate',
      entityId: template._id,
      metadata: {
        key: template.key,
        version: template.version,
        enabled: template.enabled,
      },
    });

    return template;
  }

  /**
   * Reset template to its system default
   */
  static async resetTemplate(id: string, actor: string = 'Admin'): Promise<IMessageTemplate> {
    await dbConnect();
    const template = await this.getTemplateById(id);
    const defaultDef = this.getDefaultTemplateByKey(template.key);

    if (!defaultDef) {
      throw new Error(`No system default definition found for template ${template.key}`);
    }

    template.name = defaultDef.name;
    template.description = defaultDef.description;
    template.body = defaultDef.body;
    template.subject = defaultDef.subject;
    template.enabled = true;
    template.variables = defaultDef.variables;
    template.version = (template.version || 1) + 1;
    template.updatedBy = actor;

    await template.save();

    try {
      await CacheService.del(`msg_template:${template.key}`);
    } catch {
      // Ignore cache error
    }

    await AuditService.log({
      actor,
      action: 'TEMPLATE_RESET_TO_DEFAULT',
      entityType: 'MessageTemplate',
      entityId: template._id,
      metadata: {
        key: template.key,
        version: template.version,
      },
    });

    return template;
  }

  /**
   * Render template by key with robust fallback behavior.
   * If custom template is disabled or fails, falls back to default definition.
   * Dynamic variables are escaped according to target channel.
   * Missing variables gracefully fall back to empty string or safe fallback.
   */
  static async renderTemplate(
    templateKey: string,
    arg2?: TemplateChannel | Record<string, any>,
    arg3?: TemplateChannel | Record<string, any>
  ): Promise<RenderResult> {
    const key = templateKey.toUpperCase().trim();
    let variables: Record<string, any> = {};
    let targetChannel: TemplateChannel | undefined = undefined;

    if (typeof arg2 === 'string') {
      targetChannel = arg2 as TemplateChannel;
      if (arg3 && typeof arg3 === 'object') {
        variables = arg3 as Record<string, any>;
      }
    } else if (arg2 && typeof arg2 === 'object') {
      variables = arg2;
      if (typeof arg3 === 'string') {
        targetChannel = arg3 as TemplateChannel;
      }
    }

    let template: { body: string; subject?: string; enabled?: boolean; channel?: TemplateChannel } | null = null;
    let isFallback = false;

    try {
      template = await this.getTemplateByKey(key);
    } catch (err) {
      console.warn(`[TEMPLATE_ENGINE] Database fetch failed for ${key}, falling back to system default:`, err);
    }

    const defaultDef = this.getDefaultTemplateByKey(key);

    // If template not found or disabled, use system default
    if (!template || template.enabled === false) {
      if (defaultDef) {
        template = defaultDef;
        isFallback = true;
      } else {
        // Last resort generic text
        const fallbackText = `Notification: ${key}`;
        return {
          text: fallbackText,
          body: fallbackText,
          channel: targetChannel || 'TELEGRAM',
          renderedViaFallback: true,
        };
      }
    }

    const effectiveChannel: TemplateChannel = targetChannel || template.channel || 'TELEGRAM';

    try {
      const renderedText = this.interpolate(template.body, variables, effectiveChannel);
      let renderedSubject: string | undefined = undefined;

      if (template.subject) {
        renderedSubject = this.interpolate(template.subject, variables, 'WEB_PUSH');
      }

      return {
        text: renderedText,
        body: renderedText,
        subject: renderedSubject,
        channel: effectiveChannel,
        renderedViaFallback: isFallback,
      };
    } catch (renderError) {
      console.error(`[TEMPLATE_ENGINE] Interpolation failed for ${key}:`, renderError);
      // Fall back to default template if custom template failed
      if (defaultDef && !isFallback) {
        try {
          const fallbackText = this.interpolate(defaultDef.body, variables, effectiveChannel);
          return {
            text: fallbackText,
            body: fallbackText,
            subject: defaultDef.subject,
            channel: effectiveChannel,
            renderedViaFallback: true,
          };
        } catch {
          // Ignore secondary error
        }
      }

      const safeText = defaultDef ? defaultDef.body : `Notification: ${key}`;
      return {
        text: safeText,
        body: safeText,
        channel: effectiveChannel,
        renderedViaFallback: true,
      };
    }
  }

  /**
   * Internal string interpolation engine with channel-specific escaping
   */
  public static interpolate(
    body: string,
    variables: Record<string, any>,
    channel: TemplateChannel
  ): string {
    const isTelegram = channel === 'TELEGRAM';
    const isWebPush = channel === 'WEB_PUSH';

    const result = body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, varName) => {
      let val = variables[varName];

      if (val === undefined || val === null) {
        if (varName === 'messageText' && variables['messageContent'] !== undefined) {
          val = variables['messageContent'];
        } else if (varName === 'messageContent' && variables['messageText'] !== undefined) {
          val = variables['messageText'];
        } else if (varName === 'messageSnippet' && variables['messageText'] !== undefined) {
          val = variables['messageText'];
        } else if (varName === 'messageText' && variables['messageSnippet'] !== undefined) {
          val = variables['messageSnippet'];
        }
      }

      // Missing variable fallback: safe empty string, never undefined or null
      if (val === undefined || val === null) {
        return '';
      }

      const stringVal = typeof val === 'object' ? JSON.stringify(val) : String(val);

      if (isTelegram) {
        // For Telegram: escape HTML entities in dynamic variables so values like A&B <test> don't break markup
        return escapeHtml(stringVal);
      } else if (isWebPush) {
        // For Push: strip HTML tags
        return stripHtml(stringVal);
      }

      // For CRM/Chat: HTML escape dynamic content to prevent XSS
      return escapeHtml(stringVal);
    });

    if (isTelegram) {
      return sanitizeTelegramHtml(result);
    } else if (isWebPush) {
      return stripHtml(result);
    } else {
      return sanitizeChatHtml(result);
    }
  }

  /**
   * Preview a template across channels with sample mock data
   */
  static async previewTemplate(
    templateKey: string,
    customBody?: string,
    customSubject?: string,
    customVars: Record<string, any> = {}
  ): Promise<{
    telegram: string;
    chat: string;
    webPush: { title: string; body: string };
  }> {
    const defaultDef = this.getDefaultTemplateByKey(templateKey);
    const mockVars: Record<string, any> = {};

    // Build mock variables from registered samples
    if (defaultDef && defaultDef.variables) {
      for (const v of defaultDef.variables) {
        mockVars[v.name] = v.sampleValue || `[${v.name}]`;
      }
    }

    // Merge custom vars
    const effectiveVars = { ...mockVars, ...customVars };

    const bodyToRender = customBody || (defaultDef ? defaultDef.body : '');
    const subjectToRender = customSubject || (defaultDef ? defaultDef.subject : '') || 'Notification';

    const telegram = this.interpolate(bodyToRender, effectiveVars, 'TELEGRAM');
    const chat = this.interpolate(bodyToRender, effectiveVars, 'CHAT');
    const pushBody = this.interpolate(bodyToRender, effectiveVars, 'WEB_PUSH');
    const pushTitle = this.interpolate(subjectToRender, effectiveVars, 'WEB_PUSH');

    return {
      telegram,
      chat,
      webPush: {
        title: pushTitle,
        body: pushBody,
      },
    };
  }
}
