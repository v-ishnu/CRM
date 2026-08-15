import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INotification extends Document {
  clientId: mongoose.Types.ObjectId;
  type: 'CLIENT_ONBOARDED' | 'PAYMENT_RECEIVED' | 'INVOICE_CREATED' | 'INVOICE_SENT' | 'PAYMENT_REMINDER' | 'PROJECT_STATUS_CHANGED';
  channel: 'TELEGRAM' | 'EMAIL';
  message: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  error?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['CLIENT_ONBOARDED', 'PAYMENT_RECEIVED', 'INVOICE_CREATED', 'INVOICE_SENT', 'PAYMENT_REMINDER', 'PROJECT_STATUS_CHANGED'],
      required: true,
    },
    channel: {
      type: String,
      enum: ['TELEGRAM', 'EMAIL'],
      default: 'TELEGRAM',
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    error: {
      type: String,
    },
    sentAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const Notification: Model<INotification> = mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
