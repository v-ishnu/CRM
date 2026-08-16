import mongoose, { Schema, Document, Model } from 'mongoose';

export type TeamPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'PAYPAL' | 'OTHER';
export type TeamPaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED';
export type TeamPaymentNotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'NONE';

export interface ITeamPayment extends Document {
  paymentNumber: string;
  teamMemberId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  taskId?: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  paymentDate: Date;
  paymentMethod: TeamPaymentMethod;
  reference?: string;
  description?: string;
  status: TeamPaymentStatus;
  notificationStatus: TeamPaymentNotificationStatus;
  notificationError?: string;
  notifiedEvents: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const TeamPaymentSchema = new Schema<ITeamPayment>(
  {
    paymentNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    teamMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'TeamMember',
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Payment amount must be greater than zero'],
    },
    currency: {
      type: String,
      default: 'INR',
      required: true,
      uppercase: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'BANK_TRANSFER', 'UPI', 'PAYPAL', 'OTHER'],
      default: 'UPI',
      required: true,
    },
    reference: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'CANCELLED'],
      default: 'PAID',
      required: true,
      index: true,
    },
    notificationStatus: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED', 'NONE'],
      default: 'NONE',
      required: true,
    },
    notificationError: {
      type: String,
    },
    notifiedEvents: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const TeamPayment: Model<ITeamPayment> =
  mongoose.models.TeamPayment || mongoose.model<ITeamPayment>('TeamPayment', TeamPaymentSchema);

export default TeamPayment;
