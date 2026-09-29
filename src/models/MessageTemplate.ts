import mongoose, { Schema, Document, Model } from 'mongoose';

export type TemplateRecipientType = 'TEAM_MEMBER' | 'CLIENT' | 'ADMIN';
export type TemplateChannel = 'TELEGRAM' | 'CRM' | 'CHAT' | 'WEB_PUSH' | 'EMAIL';

export interface ITemplateVariable {
  name: string;
  description: string;
  sampleValue?: string;
}

export interface IMessageTemplate extends Document {
  key: string;
  name: string;
  description: string;
  recipientType: TemplateRecipientType;
  channel: TemplateChannel;
  subject?: string;
  body: string;
  enabled: boolean;
  variables: ITemplateVariable[];
  isSystem: boolean;
  version: number;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateVariableSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    sampleValue: { type: String, trim: true },
  },
  { _id: false }
);

const MessageTemplateSchema = new Schema<IMessageTemplate>(
  {
    key: {
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
    description: {
      type: String,
      required: true,
      trim: true,
    },
    recipientType: {
      type: String,
      enum: ['TEAM_MEMBER', 'CLIENT', 'ADMIN'],
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['TELEGRAM', 'CRM', 'CHAT', 'WEB_PUSH', 'EMAIL'],
      default: 'TELEGRAM',
      required: true,
      index: true,
    },
    subject: {
      type: String,
      trim: true,
    },
    body: {
      type: String,
      required: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    variables: {
      type: [TemplateVariableSchema],
      default: [],
    },
    isSystem: {
      type: Boolean,
      default: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    updatedBy: {
      type: String,
      default: 'system',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const MessageTemplate: Model<IMessageTemplate> =
  mongoose.models.MessageTemplate ||
  mongoose.model<IMessageTemplate>('MessageTemplate', MessageTemplateSchema);

export default MessageTemplate;
