import mongoose, { Schema, Document, Model } from 'mongoose';

export type AgreementStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'REVISED';

export interface IAgreementSnapshot {
  projectName: string;
  projectCode: string;
  serviceType: string;
  totalAmount: number;
  currency: string;
  terms: string;
  scope?: string;
  startDate?: Date;
  expectedCompletionDate?: Date;
  clientName: string;
  clientEmail: string;
  createdAt: Date;
}

export interface IAgreementUserIdentity {
  telegramUserId?: string;
  telegramUsername?: string;
  name?: string;
  ipAddress?: string;
}

export interface IAgreement extends Document {
  projectId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  terms: string;
  totalAmount: number;
  currency: string;
  status: AgreementStatus;
  telegramMessageId?: string;
  snapshot: IAgreementSnapshot;
  acceptedAt?: Date;
  acceptedBy?: IAgreementUserIdentity;
  rejectedAt?: Date;
  rejectionReason?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const AgreementSchema = new Schema<IAgreement>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      unique: true,
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    terms: {
      type: String,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      required: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'REVISED'],
      default: 'PENDING_REVIEW',
      required: true,
      index: true,
    },
    telegramMessageId: {
      type: String,
    },
    snapshot: {
      projectName: { type: String, required: true },
      projectCode: { type: String, required: true },
      serviceType: { type: String, required: true },
      totalAmount: { type: Number, required: true },
      currency: { type: String, required: true },
      terms: { type: String, required: true },
      scope: { type: String },
      startDate: { type: Date },
      expectedCompletionDate: { type: Date },
      clientName: { type: String, required: true },
      clientEmail: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    },
    acceptedAt: {
      type: Date,
    },
    acceptedBy: {
      telegramUserId: { type: String },
      telegramUsername: { type: String },
      name: { type: String },
      ipAddress: { type: String },
    },
    rejectedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
    },
    version: {
      type: Number,
      default: 1,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Agreement: Model<IAgreement> =
  mongoose.models.Agreement || mongoose.model<IAgreement>('Agreement', AgreementSchema);

export default Agreement;
