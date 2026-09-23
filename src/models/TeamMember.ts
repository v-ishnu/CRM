import mongoose, { Schema, Document, Model } from 'mongoose';

export type TeamRole = 'ADMIN' | 'MANAGER' | 'DEVELOPER' | 'DESIGNER' | 'SEO' | 'OTHER';

export type TeamPermission = 
  | 'VIEW_CREDENTIALS'
  | 'REQUEST_CREDENTIALS'
  | 'MANAGE_TASKS'
  | 'VIEW_PROJECT'
  | 'VIEW_CLIENT'
  | 'MANAGE_PROJECT'
  | 'VIEW_TASKS';

export interface IBankDetails {
  accountHolderName?: string;
  accountNumberEncrypted?: {
    ciphertext: string;
    iv: string;
    authTag: string;
  };
  ifscEncrypted?: {
    ciphertext: string;
    iv: string;
    authTag: string;
  };
  bankName?: string;
  upiIdEncrypted?: {
    ciphertext: string;
    iv: string;
    authTag: string;
  };
  accountNumberMasked?: string;
  ifscMasked?: string;
  upiIdMasked?: string;
  isComplete: boolean;
  updatedAt?: Date;
}

export interface ITeamMember extends Document {
  name: string;
  email: string;
  phone?: string;
  role: TeamRole;
  telegramUserId?: string;
  telegramUsername?: string;
  telegramChatId?: string;
  telegramConnected: boolean;
  telegramConnectionToken?: string;
  telegramTokenExpiresAt?: Date;
  status: 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED';
  permissions: TeamPermission[];
  isPrimaryAdmin?: boolean;
  bankDetails?: IBankDetails;
  createdAt: Date;
  updatedAt: Date;
}

const TeamMemberSchema = new Schema<ITeamMember>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['ADMIN', 'MANAGER', 'DEVELOPER', 'DESIGNER', 'SEO', 'OTHER'],
      default: 'DEVELOPER',
      required: true,
    },
    telegramUserId: {
      type: String,
      trim: true,
      index: true,
    },
    telegramUsername: {
      type: String,
      trim: true,
    },
    telegramChatId: {
      type: String,
      trim: true,
    },
    telegramConnected: {
      type: Boolean,
      default: false,
      index: true,
    },
    telegramConnectionToken: {
      type: String,
      index: true,
    },
    telegramTokenExpiresAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'DEACTIVATED'],
      default: 'ACTIVE',
      required: true,
      index: true,
    },
    permissions: {
      type: [String],
      default: ['VIEW_PROJECT', 'VIEW_TASKS'],
      required: true,
    },
    isPrimaryAdmin: {
      type: Boolean,
      default: false,
    },
    bankDetails: {
      accountHolderName: { type: String, trim: true },
      accountNumberEncrypted: {
        ciphertext: { type: String },
        iv: { type: String },
        authTag: { type: String },
      },
      ifscEncrypted: {
        ciphertext: { type: String },
        iv: { type: String },
        authTag: { type: String },
      },
      bankName: { type: String, trim: true },
      upiIdEncrypted: {
        ciphertext: { type: String },
        iv: { type: String },
        authTag: { type: String },
      },
      accountNumberMasked: { type: String },
      ifscMasked: { type: String },
      upiIdMasked: { type: String },
      isComplete: { type: Boolean, default: false },
      updatedAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

const TeamMember: Model<ITeamMember> = 
  mongoose.models.TeamMember || mongoose.model<ITeamMember>('TeamMember', TeamMemberSchema);

export default TeamMember;
