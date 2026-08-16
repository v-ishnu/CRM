import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInquiryMessage {
  sender: 'CLIENT' | 'BOT' | 'ADMIN' | 'SYSTEM';
  text: string;
  timestamp: Date;
  adminEmail?: string;
  adminName?: string;
}

export interface IInquiry extends Document {
  inquiryNumber: string;
  telegramUserId: string;
  telegramUsername?: string;
  telegramChatId: string;
  name?: string;
  service?: string;
  message?: string;
  messages: IInquiryMessage[];
  conversationMode: 'BOT' | 'HUMAN' | 'CLOSED';
  status: 'NEW' | 'OPEN' | 'HUMAN_HANDOFF' | 'CLOSED';
  assignedAdminId?: mongoose.Types.ObjectId;
  assignedAdminName?: string;
  handoffReason?: string;
  convertedToClientId?: mongoose.Types.ObjectId;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InquiryMessageSchema = new Schema<IInquiryMessage>(
  {
    sender: {
      type: String,
      enum: ['CLIENT', 'BOT', 'ADMIN', 'SYSTEM'],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    adminEmail: {
      type: String,
      trim: true,
    },
    adminName: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const InquirySchema = new Schema<IInquiry>(
  {
    inquiryNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    telegramUserId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    telegramUsername: {
      type: String,
      trim: true,
    },
    telegramChatId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    service: {
      type: String,
      trim: true,
      default: 'General',
    },
    message: {
      type: String,
      trim: true,
    },
    messages: {
      type: [InquiryMessageSchema],
      default: [],
    },
    conversationMode: {
      type: String,
      enum: ['BOT', 'HUMAN', 'CLOSED'],
      default: 'BOT',
      index: true,
    },
    status: {
      type: String,
      enum: ['NEW', 'OPEN', 'HUMAN_HANDOFF', 'CLOSED'],
      default: 'NEW',
      index: true,
    },
    assignedAdminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedAdminName: {
      type: String,
      trim: true,
    },
    handoffReason: {
      type: String,
      trim: true,
    },
    convertedToClientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Method to generate next unique inquiry code
InquirySchema.statics.generateInquiryNumber = async function (): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `INQ-${currentYear}-`;
  
  const lastInquiry = await this.findOne({
    inquiryNumber: new RegExp(`^${prefix}`),
  })
    .sort({ inquiryNumber: -1 })
    .lean();

  let nextSequence = 1;
  if (lastInquiry && lastInquiry.inquiryNumber) {
    const parts = lastInquiry.inquiryNumber.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextSequence = parsed + 1;
      }
    }
  }

  const paddedSeq = String(nextSequence).padStart(4, '0');
  return `${prefix}${paddedSeq}`;
};

export interface IInquiryModel extends Model<IInquiry> {
  generateInquiryNumber(): Promise<string>;
}

const Inquiry: IInquiryModel =
  (mongoose.models.Inquiry as IInquiryModel) ||
  mongoose.model<IInquiry, IInquiryModel>('Inquiry', InquirySchema);

export default Inquiry;
