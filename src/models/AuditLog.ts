import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAuditLog extends Document {
  actor: string;
  action: 
    | 'CLIENT_CREATED' 
    | 'CLIENT_UPDATED' 
    | 'CLIENT_DELETED' 
    | 'PROJECT_CREATED' 
    | 'PROJECT_UPDATED'
    | 'PROJECT_DELETED'
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
    | 'DATA_REQUEST_DELETED'
    | 'TEAM_MEMBER_CREATED'
    | 'TEAM_MEMBER_UPDATED'
    | 'TEAM_MEMBER_DEACTIVATED'
    | 'TEAM_MEMBER_DELETED'
    | 'TEAM_MEMBER_CONNECTED_TELEGRAM'
    | 'PROJECT_TEAM_UPDATED'
    | 'PROJECT_TEAM_MEMBER_ADDED'
    | 'PROJECT_TEAM_MEMBER_REMOVED'
    | 'TASK_CREATED'
    | 'TASK_UPDATED'
    | 'TASK_STATUS_CHANGED'
    | 'TASK_DELETED'
    | 'CREDENTIAL_SHARED'
    | 'CREDENTIAL_SHARE_FAILED'
    | 'CREDENTIAL_ACCESSED'
    | 'TASK_CREDENTIAL_ACCESS_GRANTED'
    | 'TASK_CREDENTIAL_SHARED'
    | 'TASK_CREDENTIAL_ACCESSED'
    | 'TASK_CREDENTIAL_REVOKED'
    | 'TASK_STARTED'
    | 'TASK_COMPLETED'
    | 'TASK_ACTION_DENIED'
    | 'TEAM_MEMBER_COMMAND'
    | 'TEAM_MEMBER_CALLBACK_ACTION'
    | 'TELEGRAM_ACCOUNT_CONFLICT'
    | 'TEAM_PAYMENT_CREATED'
    | 'TEAM_PAYMENT_UPDATED'
    | 'TEAM_PAYMENT_MARKED_PAID'
    | 'TEAM_PAYMENT_CANCELLED'
    | 'TEAM_PAYMENT_NOTIFICATION_RETRY';
  entityType: 'Client' | 'Project' | 'Payment' | 'Invoice' | 'Notification' | 'Auth' | 'DataRequest' | 'RequestResponse' | 'Credential' | 'TeamMember' | 'Task' | 'TeamPayment';
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
        'PROJECT_UPDATED',
        'PROJECT_DELETED',
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
        'TEAM_MEMBER_CREATED',
        'TEAM_MEMBER_UPDATED',
        'TEAM_MEMBER_DEACTIVATED',
        'TEAM_MEMBER_DELETED',
        'TEAM_MEMBER_CONNECTED_TELEGRAM',
        'PROJECT_TEAM_UPDATED',
        'PROJECT_TEAM_MEMBER_ADDED',
        'PROJECT_TEAM_MEMBER_REMOVED',
        'TASK_CREATED',
        'TASK_UPDATED',
        'TASK_STATUS_CHANGED',
        'TASK_DELETED',
        'CREDENTIAL_SHARED',
        'CREDENTIAL_SHARE_FAILED',
        'CREDENTIAL_ACCESSED',
        'TASK_CREDENTIAL_ACCESS_GRANTED',
        'TASK_CREDENTIAL_SHARED',
        'TASK_CREDENTIAL_ACCESSED',
        'TASK_CREDENTIAL_REVOKED',
        'TASK_STARTED',
        'TASK_COMPLETED',
        'TASK_ACTION_DENIED',
        'TEAM_MEMBER_COMMAND',
        'TEAM_MEMBER_CALLBACK_ACTION',
        'TELEGRAM_ACCOUNT_CONFLICT',
        'TEAM_PAYMENT_CREATED',
        'TEAM_PAYMENT_UPDATED',
        'TEAM_PAYMENT_MARKED_PAID',
        'TEAM_PAYMENT_CANCELLED',
        'TEAM_PAYMENT_NOTIFICATION_RETRY',
      ],
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ['Client', 'Project', 'Payment', 'Invoice', 'Notification', 'Auth', 'DataRequest', 'RequestResponse', 'Credential', 'TeamMember', 'Task', 'TeamPayment'],
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
