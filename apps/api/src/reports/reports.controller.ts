import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';
import type { CurrentUserData } from '../auth/decorators';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('attendance')
  async attendance(
    @CurrentUser() user: CurrentUserData,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('userId') userId: string | undefined,
  ) {
    return this.reportsService.getAttendance(user, {
      from,
      to,
      userId: userId ? parseInt(userId, 10) : undefined,
    });
  }

  @Get('attendance/export')
  async export(
    @CurrentUser() user: CurrentUserData,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('userId') userId: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.reportsService.exportAttendanceCsv(user, {
      from,
      to,
      userId: userId ? parseInt(userId, 10) : undefined,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.csv"');
    res.send(csv);
  }
}
