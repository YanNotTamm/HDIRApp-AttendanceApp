import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Roles('admin', 'hr')
  @Get()
  async list(@Query('limit') limit: string) {
    return this.auditService.list(parseInt(limit, 10) || 50);
  }
}
