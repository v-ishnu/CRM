import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDataRequest extends Document {
  requestId: string; // REQ-YYYY-XXXX
  clientId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  type: 'GENERAL' | 'CREDENTIAL' | 'IMAGE' | 'DOCUMENT' | 'TEXT' | 'CUSTOM';
  title: string;
  message: string;
  credentialType?: 'HOSTING' | 'DOMAIN' | 'WORDPRESS' | 'FTP' | 'SFTP' | 'CPANEL' | 'DATABASE' | 'EMAIL' | 'CLOUD' | 'GITHUB' | 'OTHER';
  requiredFields: string[];
  status: 'PENDING' | 'SENT' | 'OPENED' | 'RECEIVED' | 'PARTIALLY_RECEIVED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  telegramMessageId?: string;
  telegramDeliveryStatus: 'PENDING' | 'SENT' | 'FAILED';
  expiresAt?: Date;
  autoDeleteDays?: number;
  createdAt: Date;
  updatedAt: Date;
}

const DataRequestSchema = new Schema<IDataRequest>(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    type: {
      type: String,
      enum: ['GENERAL', 'CREDENTIAL', 'IMAGE', 'DOCUMENT', 'TEXT', 'CUSTOM'],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    credentialType: {
      type: String,
      enum: ['HOSTING', 'DOMAIN', 'WORDPRESS', 'FTP', 'SFTP', 'CPANEL', 'DATABASE', 'EMAIL', 'CLOUD', 'GITHUB', 'OTHER'],
    },
    requiredFields: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'OPENED', 'RECEIVED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED', 'EXPIRED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    telegramMessageId: {
      type: String,
    },
    telegramDeliveryStatus: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED'],
      default: 'PENDING',
      required: true,
    },
    expiresAt: {
      type: Date,
    },
    autoDeleteDays: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

const DataRequest: Model<IDataRequest> = mongoose.models.DataRequest || mongoose.model<IDataRequest>('DataRequest', DataRequestSchema);

export default DataRequest;
