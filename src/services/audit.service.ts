import AuditLog from '@/models/AuditLog';
import { dbConnect } from '@/lib/db/connect';

export class AuditService {
  static async logAction(
    actor: string,
    action: 'CLIENT_CREATED' | 'CLIENT_UPDATED' | 'PROJECT_CREATED' | 'PAYMENT_CREATED' | 'PAYMENT_UPDATED' | 'INVOICE_CREATED' | 'INVOICE_SENT' | 'TELEGRAM_SENT' | 'PROJECT_STATUS_CHANGED',
    entityType: 'Client' | 'Project' | 'Payment' | 'Invoice' | 'Notification' | 'Auth',
    entityId?: any,
    metadata?: Record<string, any>
  ) {
    try {
      await dbConnect();
      
      const log = new AuditLog({
        actor,
        action,
        entityType,
        entityId,
        metadata,
        timestamp: new Date(),
      });
      
      await log.save();
    } catch (error) {
      // Don't fail the primary transaction if logging fails, but log it to server console
      console.error('Failed to write audit log:', error);
    }
  }
}
