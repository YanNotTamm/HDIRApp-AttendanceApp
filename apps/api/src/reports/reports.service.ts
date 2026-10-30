import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildDailySummary, toCsv, parseWorkTime } from './summary';

export interface ReportQuery {
  from?: string;
  to?: string;
  userId?: number;
}

/**
 * Attendance reports + CSV export. Previously there was no reporting at
 * all: the dashboard could only show live aggregates. This endpoint
 * returns real per-user-per-day rows from the attendance table (with
 * late/overtime derived per the documented env-level work-hours policy
 * in summary.ts), and /export returns the same rows as CSV.
 * Employees may only see their own rows; HR/admin may filter by user.
 */
@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private workHours(): { start: number; end: number } {
    return {
      start: parseWorkTime(process.env.WORK_START_TIME, '08:00'),
      end: parseWorkTime(process.env.WORK_END_TIME, '17:00'),
    };
  }

  private parseRange(query: ReportQuery): { from: Date; to: Date } {
    const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      throw new BadRequestException('from/to must be valid dates (YYYY-MM-DD) with to >= from');
    }
    return { from, to };
  }

  async getAttendance(caller: { id: number; role: string }, query: ReportQuery) {
    const targetUserId = this.resolveTarget(caller, query.userId);
    const { from, to } = this.parseRange(query);
    const rows = await this.prisma.attendance.findMany({
      where: {
        ...(targetUserId !== null ? { user_id: targetUserId } : {}),
        timestamp: { gte: from, lte: to },
      },
      orderBy: { timestamp: 'asc' },
    });
    const { start, end } = this.workHours();
    const daily = buildDailySummary(rows, start, end);
    return {
      success: true,
      data: daily,
      meta: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        work_start: process.env.WORK_START_TIME ?? '08:00',
        work_end: process.env.WORK_END_TIME ?? '17:00',
        scope_user_id: targetUserId,
      },
    };
  }

  async exportAttendanceCsv(caller: { id: number; role: string }, query: ReportQuery): Promise<string> {
    const report = await this.getAttendance(caller, query);
    return toCsv(report.data);
  }

  private resolveTarget(caller: { id: number; role: string }, requested?: number): number | null {
    const isHrOrAdmin = caller.role === 'admin' || caller.role === 'hr';
    if (requested !== undefined) {
      if (!isHrOrAdmin && requested !== caller.id) {
        throw new ForbiddenException('Employees can only view their own report');
      }
      return requested;
    }
    return isHrOrAdmin ? null : caller.id;
  }
}
