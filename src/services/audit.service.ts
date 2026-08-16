import AuditLog, { IAuditLog } from '@/models/AuditLog';
import { dbConnect } from '@/lib/db/connect';

export class AuditService {
  static async logAction(
    actor: string,
    action: IAuditLog['action'],
    entityType: IAuditLog['entityType'],
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
