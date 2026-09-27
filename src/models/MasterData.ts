import 'server-only';
import mongoose, { Schema, Document, Model } from 'mongoose';
import { MasterDataType, MASTER_DATA_TYPES } from '@/types/master-data';

export type { MasterDataType };
export { MASTER_DATA_TYPES };

export interface IMasterData extends Document {
  type: MasterDataType;
  key: string;
  label: string;
  description?: string;
  parentId?: mongoose.Types.ObjectId;
  sortOrder: number;
  isActive: boolean;
  isSystemDefault: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const MasterDataSchema = new Schema<IMasterData>(
  {
    type: {
      type: String,
      enum: MASTER_DATA_TYPES,
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'MasterData',
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isSystemDefault: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index on type + key to prevent duplicate keys within the same type
MasterDataSchema.index({ type: 1, key: 1 }, { unique: true });

// Compound query index for active lists sorted by sortOrder
MasterDataSchema.index({ type: 1, isActive: 1, sortOrder: 1 });

const MasterData: Model<IMasterData> =
  mongoose.models.MasterData || mongoose.model<IMasterData>('MasterData', MasterDataSchema);

export default MasterData;
