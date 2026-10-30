import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Refresh-token cleanup. Rotation and logout now DELETE the old row
 * (see auth.service.ts) instead of merely revoking it, so accumulation
 * cannot come from the normal flow. This interval covers the leftovers:
 * tokens that expired without ever being rotated/logged out, and any
 * legacy revoked rows from before this change. Runs hourly while the
 * server runs; the timer is unref'd so it never keeps tests or a
 * shutdown hanging.
 */
@Injectable()
export class TokenCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenCleanupService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private prisma: PrismaService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.cleanup().catch((err: unknown) => {
        this.logger.error(`Refresh-token cleanup failed: ${(err as Error)?.message ?? err}`);
      });
    }, 60 * 60 * 1000);
    this.timer.unref?.();
    // Clean once at boot too, so a long-dead server's leftovers do not
    // wait up to an hour after restart.
    void this.cleanup().catch(() => undefined);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async cleanup(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { OR: [{ expires_at: { lt: new Date() } }, { revoked: true }] },
    });
    if (result.count > 0) {
      this.logger.log(`Refresh-token cleanup removed ${result.count} expired/revoked row(s)`);
    }
    return result.count;
  }
}
