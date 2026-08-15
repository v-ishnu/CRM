import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClient extends Document {
  clientCode: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  telegramUserId?: string;
  telegramUsername?: string;
  telegramChatId?: string;
  telegramConnected: boolean;
  telegramConnectionToken?: string;
  telegramConnectionTokenExpiresAt?: Date;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  onboardingDate: Date;
  status: 'LEAD' | 'ONBOARDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema = new Schema<IClient>(
  {
    clientCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    telegramUserId: {
      type: String,
    },
    telegramUsername: {
      type: String,
      index: true,
      sparse: true,
    },
    telegramChatId: {
      type: String,
    },
    telegramConnected: {
      type: Boolean,
      default: false,
      required: true,
    },
    telegramConnectionToken: {
      type: String,
      index: true,
      sparse: true,
    },
    telegramConnectionTokenExpiresAt: {
      type: Date,
    },
    address: {
      type: String,
    },
    city: {
      type: String,
    },
    state: {
      type: String,
    },
    country: {
      type: String,
    },
    onboardingDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    status: {
      type: String,
      enum: ['LEAD', 'ONBOARDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
      default: 'LEAD',
      required: true,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound constraints or extra indices if needed
// E.g. to ensure that we don't link the same telegram account twice
ClientSchema.index({ telegramUserId: 1 }, { unique: true, sparse: true });

const Client: Model<IClient> = mongoose.models.Client || mongoose.model<IClient>('Client', ClientSchema);

export default Client;
