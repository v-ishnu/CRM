import 'server-only';
import mongoose from 'mongoose';
import MasterData, { IMasterData, MasterDataType, MASTER_DATA_TYPES } from '@/models/MasterData';
import { dbConnect } from '@/lib/db/connect';
import { AuditService } from './audit.service';
import { CacheService } from './cache.service';

export interface CreateMasterDataDTO {
  type: MasterDataType;
  key: string;
  label: string;
  description?: string;
  parentId?: string | mongoose.Types.ObjectId;
  sortOrder?: number;
  isActive?: boolean;
  isSystemDefault?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateMasterDataDTO {
  label?: string;
  description?: string;
  parentId?: string | mongoose.Types.ObjectId | null;
  sortOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export class MasterDataService {
  /**
   * Normalize an internal key (e.g. "Hostinger Cloud" -> "hostinger_cloud")
   */
  static normalizeKey(key: string): string {
    return key
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  /**
   * Query MasterData items with optional filtering and Redis cache-aside
   */
  static async queryItems(params: {
    type?: MasterDataType;
    parentId?: string;
    includeInactive?: boolean;
  }): Promise<IMasterData[]> {
    await dbConnect();

    const { type, parentId, includeInactive = false } = params;

    if (type && !MASTER_DATA_TYPES.includes(type)) {
      throw new Error(`Invalid master data type: "${type}"`);
    }

    // Cache-aside: only cache standard queries when no specific parent filter
    const cacheKey = type && !parentId
      ? CacheService.masterDataKey(type, includeInactive ? 'all' : 'active')
      : null;

    if (cacheKey) {
      const cached = await CacheService.get<IMasterData[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const query: Record<string, any> = {};

    if (type) {
      query.type = type;
    }

    if (parentId) {
      query.parentId = parentId;
    }

    if (!includeInactive) {
      query.isActive = true;
    }

    const items = await MasterData.find(query)
      .populate('parentId', 'label key type')
      .sort({ sortOrder: 1, label: 1 })
      .lean();

    if (cacheKey) {
      await CacheService.set(cacheKey, items, CacheService.DEFAULT_TTL);
    }

    return items;
  }

  /**
   * Get a single MasterData item by ID
   */
  static async getItemById(id: string): Promise<IMasterData | null> {
    await dbConnect();
    return MasterData.findById(id).populate('parentId', 'label key type');
  }

  /**
   * Create a new MasterData item
   */
  static async createItem(data: CreateMasterDataDTO, actor: string = 'admin'): Promise<IMasterData> {
    await dbConnect();

    if (!MASTER_DATA_TYPES.includes(data.type)) {
      throw new Error(`Invalid master data type: "${data.type}"`);
    }

    if (!data.label || !data.label.trim()) {
      throw new Error('Label is required');
    }

    const normalizedKey = this.normalizeKey(data.key || data.label);
    if (!normalizedKey) {
      throw new Error('A valid unique key is required');
    }

    // Verify key uniqueness within the same type
    const existing = await MasterData.findOne({ type: data.type, key: normalizedKey });
    if (existing) {
      throw new Error(`An item with key "${normalizedKey}" already exists for type "${data.type}"`);
    }

    // If parentId provided, verify it exists and matches relationship rules
    if (data.type === 'SERVICE') {
      if (!data.parentId) {
        throw new Error('Valid parent category of type SERVICE_CATEGORY is required for a SERVICE');
      }
      const parent = await MasterData.findById(data.parentId);
      if (!parent || parent.type !== 'SERVICE_CATEGORY') {
        throw new Error('Valid parent category of type SERVICE_CATEGORY is required for a SERVICE');
      }
    } else if (data.parentId) {
      const parent = await MasterData.findById(data.parentId);
      if (!parent) {
        throw new Error('Parent master data item not found');
      }
    }

    const saved = await MasterData.create({
      type: data.type,
      key: normalizedKey,
      label: data.label.trim(),
      description: data.description?.trim(),
      parentId: data.parentId || undefined,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive !== undefined ? data.isActive : true,
      isSystemDefault: !!data.isSystemDefault,
      metadata: data.metadata || {},
    });

    await AuditService.logAction(actor, 'MASTER_DATA_CREATED', 'MasterData', saved._id, {
      type: saved.type,
      key: saved.key,
      label: saved.label,
    });

    await CacheService.invalidateMasterDataCache(saved.type);

    return saved;
  }

  /**
   * Update an existing MasterData item
   */
  static async updateItem(id: string, data: UpdateMasterDataDTO, actor: string): Promise<IMasterData> {
    await dbConnect();

    const item = await MasterData.findById(id);
    if (!item) {
      throw new Error('Master data item not found');
    }

    const updatedFields: string[] = [];

    if (data.label !== undefined) {
      if (!data.label.trim()) {
        throw new Error('Label cannot be empty');
      }
      item.label = data.label.trim();
      updatedFields.push('label');
    }

    if (data.description !== undefined) {
      item.description = data.description ? data.description.trim() : undefined;
      updatedFields.push('description');
    }

    if (data.parentId !== undefined) {
      if (data.parentId) {
        const parent = await MasterData.findById(data.parentId);
        if (!parent) throw new Error('Parent master data item not found');
        if (item.type === 'SERVICE' && parent.type !== 'SERVICE_CATEGORY') {
          throw new Error('Parent of a SERVICE must be a SERVICE_CATEGORY');
        }
        item.parentId = parent._id as any;
      } else {
        item.parentId = undefined;
      }
      updatedFields.push('parentId');
    }

    if (data.sortOrder !== undefined) {
      item.sortOrder = Number(data.sortOrder) || 0;
      updatedFields.push('sortOrder');
    }

    if (data.isActive !== undefined) {
      item.isActive = !!data.isActive;
      updatedFields.push('isActive');
    }

    if (data.metadata !== undefined) {
      item.metadata = data.metadata;
      updatedFields.push('metadata');
    }

    const saved = await item.save();

    await AuditService.logAction(actor, 'MASTER_DATA_UPDATED', 'MasterData', saved._id, {
      type: saved.type,
      key: saved.key,
      updatedFields,
    });

    await CacheService.invalidateMasterDataCache(saved.type);

    return saved;
  }

  /**
   * Check total reference count across database collections for safe deletion
   */
  static async countReferences(item: IMasterData): Promise<number> {
    await dbConnect();

    let total = 0;
    const keyRegex = new RegExp(`^${item.key}$|^${item.label}$`, 'i');

    switch (item.type) {
      case 'HOSTING_PROVIDER': {
        const Hosting = (await import('@/models/Hosting')).default;
        total += await Hosting.countDocuments({ hostingProvider: keyRegex });
        break;
      }
      case 'HOSTING_TYPE': {
        const Hosting = (await import('@/models/Hosting')).default;
        total += await Hosting.countDocuments({ hostingType: keyRegex });
        break;
      }
      case 'SERVICE_CATEGORY': {
        // Referenced as parent by services
        total += await MasterData.countDocuments({ parentId: item._id });
        break;
      }
      case 'SERVICE': {
        const Project = (await import('@/models/Project')).default;
        total += await Project.countDocuments({ serviceType: keyRegex });
        break;
      }
      case 'CREDENTIAL_TYPE': {
        const Credential = (await import('@/models/Credential')).default;
        total += await Credential.countDocuments({ credentialType: keyRegex });
        break;
      }
      case 'PAYMENT_METHOD': {
        const Payment = (await import('@/models/Payment')).default;
        const TeamPayment = (await import('@/models/TeamPayment')).default;
        total += await Payment.countDocuments({ paymentMethod: keyRegex });
        total += await TeamPayment.countDocuments({ paymentMethod: keyRegex });
        break;
      }
      case 'PAYMENT_TYPE': {
        const Payment = (await import('@/models/Payment')).default;
        total += await Payment.countDocuments({ paymentType: keyRegex });
        break;
      }
      case 'TEAM_DESIGNATION': {
        const TeamMember = (await import('@/models/TeamMember')).default;
        total += await TeamMember.countDocuments({
          $or: [{ designation: keyRegex }, { role: keyRegex }],
        });
        break;
      }
      default:
        break;
    }

    return total;
  }

  /**
   * Safely delete an unreferenced MasterData item.
   * Hard-fails if item is a system default or is referenced by existing database records.
   */
  static async deleteItem(id: string, actor: string = 'admin'): Promise<{ success: boolean; label: string }> {
    await dbConnect();

    const item = await MasterData.findById(id);
    if (!item) {
      throw new Error('Master data item not found');
    }

    if (item.isSystemDefault) {
      throw new Error('System default master data cannot be deleted. Deactivate it instead.');
    }

    const refCount = await this.countReferences(item);
    if (refCount > 0) {
      throw new Error(
        `Cannot delete "${item.label}" because it is referenced in ${refCount} existing record(s). Deactivate it instead.`
      );
    }

    const type = item.type;
    const label = item.label;

    await MasterData.deleteOne({ _id: id });

    await AuditService.logAction(actor, 'MASTER_DATA_DELETED', 'MasterData', id, {
      type,
      key: item.key,
      label,
    });

    await CacheService.invalidateMasterDataCache(type);

    return { success: true, label };
  }
}
