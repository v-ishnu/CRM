import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAuditLog extends Document {
  actor: string;
  action: 'CLIENT_CREATED' | 'CLIENT_UPDATED' | 'PROJECT_CREATED' | 'PAYMENT_CREATED' | 'PAYMENT_UPDATED' | 'INVOICE_CREATED' | 'INVOICE_SENT' | 'TELEGRAM_SENT' | 'PROJECT_STATUS_CHANGED';
  entityType: 'Client' | 'Project' | 'Payment' | 'Invoice' | 'Notification' | 'Auth';
  entityId?: mongoose.Types.ObjectId | string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actor: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        'CLIENT_CREATED',
        'CLIENT_UPDATED',
        'PROJECT_CREATED',
        'PAYMENT_CREATED',
        'PAYMENT_UPDATED',
        'INVOICE_CREATED',
        'INVOICE_SENT',
        'TELEGRAM_SENT',
        'PROJECT_STATUS_CHANGED',
      ],
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ['Client', 'Project', 'Payment', 'Invoice', 'Notification', 'Auth'],
      required: true,
      index: true,
    },
    entityId: {
      type: Schema.Types.Mixed, // Can be ObjectId or string
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
  },
  {
    // Custom timestamp field, so we don't need Mongoose timestamps block
    timestamps: false,
  }
);

const AuditLog: Model<IAuditLog> = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
