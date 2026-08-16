import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAuditLog extends Document {
  actor: string;
  action: 
    | 'CLIENT_CREATED' 
    | 'CLIENT_UPDATED' 
    | 'CLIENT_DELETED' 
    | 'PROJECT_CREATED' 
    | 'PAYMENT_CREATED' 
    | 'PAYMENT_UPDATED' 
    | 'INVOICE_CREATED' 
    | 'INVOICE_SENT' 
    | 'TELEGRAM_SENT' 
    | 'PROJECT_STATUS_CHANGED'
    | 'CREDENTIAL_REQUEST_CREATED'
    | 'CREDENTIAL_REQUEST_SENT'
    | 'CREDENTIAL_RECEIVED'
    | 'CREDENTIAL_VIEWED'
    | 'CREDENTIAL_REVEALED'
    | 'CREDENTIAL_COPIED'
    | 'CREDENTIAL_DELETED'
    | 'DATA_REQUEST_CREATED'
    | 'DATA_REQUEST_SENT'
    | 'DATA_REQUEST_RECEIVED'
    | 'DATA_REQUEST_DELETED';
  entityType: 'Client' | 'Project' | 'Payment' | 'Invoice' | 'Notification' | 'Auth' | 'DataRequest' | 'RequestResponse' | 'Credential';
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
        'CLIENT_DELETED',
        'PROJECT_CREATED',
        'PAYMENT_CREATED',
        'PAYMENT_UPDATED',
        'INVOICE_CREATED',
        'INVOICE_SENT',
        'TELEGRAM_SENT',
        'PROJECT_STATUS_CHANGED',
        'CREDENTIAL_REQUEST_CREATED',
        'CREDENTIAL_REQUEST_SENT',
        'CREDENTIAL_RECEIVED',
        'CREDENTIAL_VIEWED',
        'CREDENTIAL_REVEALED',
        'CREDENTIAL_COPIED',
        'CREDENTIAL_DELETED',
        'DATA_REQUEST_CREATED',
        'DATA_REQUEST_SENT',
        'DATA_REQUEST_RECEIVED',
        'DATA_REQUEST_DELETED',
      ],
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ['Client', 'Project', 'Payment', 'Invoice', 'Notification', 'Auth', 'DataRequest', 'RequestResponse', 'Credential'],
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
