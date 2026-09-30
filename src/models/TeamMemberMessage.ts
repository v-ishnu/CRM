import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITeamMemberAttachment {
  type: 'IMAGE' | 'FILE';
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  url?: string;
  telegramFileId?: string;
  createdAt?: Date;
}

export interface ITeamMemberMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  teamMemberId: mongoose.Types.ObjectId;
  senderType: 'ADMIN' | 'TEAM_MEMBER';
  senderId: string;
  senderName?: string;
  channel: 'CRM' | 'TELEGRAM';
  telegramMessageId?: string;
  text: string;
  attachments?: ITeamMemberAttachment[];
  messageType?: 'TEXT' | 'IMAGE' | 'FILE';
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'READ';
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TeamMemberMessageSchema = new Schema<ITeamMemberMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'TeamMemberConversation',
      required: true,
      index: true,
    },
    teamMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'TeamMember',
      required: true,
      index: true,
    },
    senderType: {
      type: String,
      enum: ['ADMIN', 'TEAM_MEMBER'],
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
      trim: true,
    },
    senderName: {
      type: String,
      trim: true,
    },
    channel: {
      type: String,
      enum: ['CRM', 'TELEGRAM'],
      default: 'CRM',
      required: true,
    },
    telegramMessageId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    text: {
      type: String,
      default: '',
      trim: true,
    },
    attachments: [
      {
        type: {
          type: String,
          enum: ['IMAGE', 'FILE'],
          required: true,
        },
        originalName: { type: String, required: true },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true },
        storagePath: { type: String, required: true },
        url: { type: String },
        telegramFileId: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    messageType: {
      type: String,
      enum: ['TEXT', 'IMAGE', 'FILE'],
      default: 'TEXT',
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: String,
    },
    status: {
      type: String,
      enum: ['SENT', 'DELIVERED', 'FAILED', 'READ'],
      default: 'SENT',
      required: true,
      index: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    deliveredAt: {
      type: Date,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast message pagination and status filtering
TeamMemberMessageSchema.index({ conversationId: 1, sentAt: -1 });
TeamMemberMessageSchema.index({ conversationId: 1, status: 1 });

const TeamMemberMessage: Model<ITeamMemberMessage> =
  mongoose.models.TeamMemberMessage ||
  mongoose.model<ITeamMemberMessage>('TeamMemberMessage', TeamMemberMessageSchema);

export default TeamMemberMessage;
