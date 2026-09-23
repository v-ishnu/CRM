import mongoose, { Schema, Document, Model } from 'mongoose';
import { IEncryptedField } from './Credential';

const EncryptedFieldSchema = new Schema(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
  },
  { _id: false }
);

export type HostingStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'CANCELLED';

export interface IHostingRenewalRecord {
  renewedAt: Date;
  previousExpiryDate: Date;
  newExpiryDate: Date;
  notes?: string;
  actor: string;
}

export interface IHosting extends Document {
  clientId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  hostingProvider: string;
  hostingType: string;
  panelUrl?: string;
  serverHost?: string;
  domain: string;
  port?: number | string;
  planName?: string;
  username?: string;
  password: IEncryptedField;
  sshKey?: IEncryptedField;
  apiToken?: IEncryptedField;
  startDate?: Date;
  expiryDate: Date;
  autoRenewal: boolean;
  status: HostingStatus;
  notes?: string;
  notificationsSent: Map<string, Date>;
  renewalHistory: IHostingRenewalRecord[];
  createdAt: Date;
  updatedAt: Date;
}

const HostingRenewalSchema = new Schema<IHostingRenewalRecord>(
  {
    renewedAt: { type: Date, default: Date.now, required: true },
    previousExpiryDate: { type: Date, required: true },
    newExpiryDate: { type: Date, required: true },
    notes: { type: String },
    actor: { type: String, required: true },
  },
  { _id: false }
);

const HostingSchema = new Schema<IHosting>(
  {
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
    hostingProvider: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    hostingType: {
      type: String,
      default: 'Shared',
      trim: true,
    },
    panelUrl: {
      type: String,
      trim: true,
    },
    serverHost: {
      type: String,
      trim: true,
    },
    domain: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    port: {
      type: Schema.Types.Mixed,
    },
    planName: {
      type: String,
      trim: true,
    },
    username: {
      type: String,
      trim: true,
    },
    password: {
      type: EncryptedFieldSchema,
      required: true,
    },
    sshKey: {
      type: EncryptedFieldSchema,
    },
    apiToken: {
      type: EncryptedFieldSchema,
    },
    startDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
      required: true,
      index: true,
    },
    autoRenewal: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'CANCELLED'],
      default: 'ACTIVE',
      required: true,
      index: true,
    },
    notes: {
      type: String,
    },
    notificationsSent: {
      type: Map,
      of: Date,
      default: () => new Map(),
    },
    renewalHistory: {
      type: [HostingRenewalSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Hosting: Model<IHosting> =
  mongoose.models.Hosting || mongoose.model<IHosting>('Hosting', HostingSchema);

export default Hosting;
