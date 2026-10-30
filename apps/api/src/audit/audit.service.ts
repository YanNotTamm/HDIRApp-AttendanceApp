import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * AuditLog: the model existed in the schema since the audit baseline but
 * NOTHING ever wrote to it — every business event was unaudited. This
 * service is now called from user/office/leave/attendance/face/device
 * actions (see those services). Writes are best-effort: a failed audit
 * write is logged to the server console but never blocks the business
 * operation it describes (an attendance must not fail because its audit
 * row failed). That trade-off is documented in README.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(actorId: number | null, action: string, entity: string, entityId: number | null, meta?: string): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actor_id: actorId ?? 0,
          action,
          entity,
          entity_id: entityId ?? 0,
          meta: meta ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`Audit write failed (${action} ${entity} ${entityId}): ${(err as Error)?.message ?? err}`);
    }
  }

  async list(limit: number): Promise<unknown> {
    const safe = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 50;
    const rows = await this.prisma.auditLog.findMany({ orderBy: { created_at: 'desc' }, take: safe });
    return { success: true, data: rows };
  }
}
