import mongoose, { Schema, Document, Model } from 'mongoose';

export type BroadcastDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'NOT_CONNECTED' | 'SKIPPED';
export type BroadcastStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIALLY_FAILED' | 'FAILED';

export interface IBroadcastDelivery {
  _id?: mongoose.Types.ObjectId;
  teamMemberId: mongoose.Types.ObjectId;
  teamMemberName: string;
  teamMemberEmail?: string;
  conversationId?: mongoose.Types.ObjectId;
  messageId?: mongoose.Types.ObjectId;
  telegramChatId?: string;
  telegramMessageId?: string;
  status: BroadcastDeliveryStatus;
  error?: string;
  sentAt?: Date;
}

export interface ITeamMemberBroadcast extends Document {
  adminId: mongoose.Types.ObjectId;
  adminName: string;
  message: string;
  targetMode: 'ALL_CONNECTED' | 'SELECTED';
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  notConnectedCount: number;
  status: BroadcastStatus;
  idempotencyKey?: string;
  deliveries: IBroadcastDelivery[];
  createdAt: Date;
  updatedAt: Date;
}

const BroadcastDeliverySchema = new Schema<IBroadcastDelivery>(
  {
    teamMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'TeamMember',
      required: true,
      index: true,
    },
    teamMemberName: {
      type: String,
      required: true,
      trim: true,
    },
    teamMemberEmail: {
      type: String,
      trim: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'TeamMemberConversation',
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'TeamMemberMessage',
    },
    telegramChatId: {
      type: String,
      trim: true,
    },
    telegramMessageId: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED', 'NOT_CONNECTED', 'SKIPPED'],
      default: 'PENDING',
      required: true,
    },
    error: {
      type: String,
      trim: true,
    },
    sentAt: {
      type: Date,
    },
  },
  { _id: true }
);

const TeamMemberBroadcastSchema = new Schema<ITeamMemberBroadcast>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    adminName: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    targetMode: {
      type: String,
      enum: ['ALL_CONNECTED', 'SELECTED'],
      default: 'SELECTED',
      required: true,
    },
    recipientCount: {
      type: Number,
      required: true,
      default: 0,
    },
    sentCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    notConnectedCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    deliveries: [BroadcastDeliverySchema],
  },
  {
    timestamps: true,
  }
);

TeamMemberBroadcastSchema.index({ adminId: 1, createdAt: -1 });

const TeamMemberBroadcast: Model<ITeamMemberBroadcast> =
  mongoose.models.TeamMemberBroadcast ||
  mongoose.model<ITeamMemberBroadcast>('TeamMemberBroadcast', TeamMemberBroadcastSchema);

export default TeamMemberBroadcast;
