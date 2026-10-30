import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeNestedUser } from '../common/sanitize';
import { CreateLeaveDto, CreateLeaveTypeDto } from '../common/dto';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

/**
 * LEAVE RULES (audit fix, documented here and enforced below):
 * - create: end < start rejected; overlapping pending/approved request for
 *   the same user+type rejected; quota is auto-created from the leave type's
 *   default_annual_quota when missing (same policy as UsersService on user
 *   creation), so a first request never fails on a missing quota row.
 * - approve: runs in ONE Prisma transaction, only from status 'pending'
 *   (double-approve rejected), re-checks remaining quota inside the
 *   transaction, and FAILS clearly if no LeaveQuota row exists at approve
 *   time (e.g. deleted after submission) instead of succeeding silently.
 * - reject: allowed from 'pending' (no quota effect) and from 'approved',
 *   in which case used_days is refunded (floored at 0) in the same
 *   transaction. Rejecting an already-rejected request is rejected.
 */
@Injectable()
export class LeaveService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private notifications: NotificationsService,
    private audit: AuditService,
  ) {}

  async createLeave(userId: number, dto: CreateLeaveDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    const start = new Date(dto.start_date);
    const end = new Date(dto.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('start_date and end_date must be valid dates');
    }
    if (end < start) {
      throw new BadRequestException('end_date must not be before start_date');
    }
    const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        user_id: userId,
        leave_type_id: dto.leave_type_id,
        status: { in: ['pending', 'approved'] },
        start_date: { lte: end },
        end_date: { gte: start },
      },
    });
    if (overlapping) {
      throw new BadRequestException('Leave request overlaps an existing pending or approved request');
    }
    // Auto-create quota from the leave type default (documented policy).
    await this.usersService.ensureQuotas(userId, start.getFullYear());
    const quota = await this.prisma.leaveQuota.findUnique({
      where: { user_id_leave_type_id_year: { user_id: userId, leave_type_id: dto.leave_type_id, year: start.getFullYear() } },
    });
    if (!quota) throw new BadRequestException('Leave type not found');
    if (quota.quota_days - quota.used_days < totalDays) {
      throw new BadRequestException('Kuota cuti tidak mencukupi');
    }
    const request = await this.prisma.leaveRequest.create({
      data: {
        user_id: userId,
        leave_type_id: dto.leave_type_id,
        start_date: start,
        end_date: end,
        total_days: totalDays,
        reason: dto.reason,
        status: 'pending',
      },
    });
    await this.audit.log(userId, 'leave.create', 'LeaveRequest', request.id);
    await this.notifications.notifyRole(
      ['admin', 'hr'],
      'Pengajuan cuti baru',
      `${user.name} mengajukan cuti ${totalDays} hari (${dto.start_date} s.d. ${dto.end_date}) dan menunggu persetujuan.`,
    );
    return { success: true, message: 'Leave request submitted', data: request };
  }

  // Leave types had no management endpoint at all (only the seed row):
  // clients were forced to hardcode leave_type_id 1. HR/admin can now
  // list and create types; the mobile form still defaults to id 1 until
  // it gains a type picker (documented in README).
  async listLeaveTypes() {
    const types = await this.prisma.leaveType.findMany({ orderBy: { id: 'asc' } });
    return { success: true, data: types };
  }

  async createLeaveType(dto: CreateLeaveTypeDto, actorId: number) {
    const type = await this.prisma.leaveType.create({
      data: {
        name: dto.name,
        default_annual_quota: dto.default_annual_quota,
        carry_over_allowed: dto.carry_over_allowed ?? false,
      },
    });
    await this.audit.log(actorId, 'leave_type.create', 'LeaveType', type.id, dto.name);
    return { success: true, message: 'Leave type created', data: type };
  }

  async getLeaves(userId: number, page: number) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const leaves = await this.prisma.leaveRequest.findMany({
      where: { user_id: userId },
      orderBy: { start_date: 'desc' },
      take: 20,
      skip: (safePage - 1) * 20,
    });
    return { success: true, data: leaves };
  }

  async getQuota(userId: number, caller: { id: number; role: string }) {
    if (caller.role === 'employee' && caller.id !== userId) {
      throw new ForbiddenException('Employees can only view their own quota');
    }
    const quotas = await this.prisma.leaveQuota.findMany({
      where: { user_id: userId, year: new Date().getFullYear() },
      include: { leave_type: true },
    });
    return { success: true, data: quotas };
  }

  async getPendingLeaves() {
    const pending = await this.prisma.leaveRequest.findMany({
      where: { status: 'pending' },
      include: { user: true, leave_type: true },
    });
    return { success: true, data: pending.map(sanitizeNestedUser) };
  }

  async approveLeave(id: number, approvedBy: number) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.findUnique({ where: { id } });
      if (!request) throw new NotFoundException('Leave request not found');
      if (request.status !== 'pending') {
        throw new BadRequestException(`Leave request is already ${request.status}; only pending requests can be approved`);
      }
      const quota = await tx.leaveQuota.findUnique({
        where: {
          user_id_leave_type_id_year: {
            user_id: request.user_id,
            leave_type_id: request.leave_type_id,
            year: request.start_date.getFullYear(),
          },
        },
      });
      if (!quota) {
        throw new BadRequestException('Leave quota not found for this request; approval failed without deducting quota');
      }
      if (quota.quota_days - quota.used_days < request.total_days) {
        throw new BadRequestException('Kuota cuti tidak mencukupi at approval time');
      }
      await tx.leaveQuota.update({
        where: { id: quota.id },
        data: { used_days: quota.used_days + request.total_days },
      });
      const updated = await tx.leaveRequest.update({
        where: { id },
        data: { status: 'approved', approved_by: approvedBy, approved_at: new Date() },
      });
      return { success: true, data: updated };
    }).then(async (result) => {
      await this.audit.log(approvedBy, 'leave.approve', 'LeaveRequest', id);
      await this.notifications.notify(
        result.data.user_id,
        'Cuti disetujui',
        `Pengajuan cuti Anda (${result.data.total_days} hari) telah disetujui.`,
        'approval',
      );
      return result;
    });
  }

  async rejectLeave(id: number, approvedBy: number) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.findUnique({ where: { id } });
      if (!request) throw new NotFoundException('Leave request not found');
      if (request.status === 'rejected') {
        throw new BadRequestException('Leave request is already rejected');
      }
      if (request.status === 'approved') {
        // Refund the days deducted at approval time (documented policy).
        const quota = await tx.leaveQuota.findUnique({
          where: {
            user_id_leave_type_id_year: {
              user_id: request.user_id,
              leave_type_id: request.leave_type_id,
              year: request.start_date.getFullYear(),
            },
          },
        });
        if (quota) {
          await tx.leaveQuota.update({
            where: { id: quota.id },
            data: { used_days: Math.max(0, quota.used_days - request.total_days) },
          });
        }
      }
      const updated = await tx.leaveRequest.update({
        where: { id },
        data: { status: 'rejected', approved_by: approvedBy, approved_at: new Date() },
      });
      return { success: true, data: updated };
    }).then(async (result) => {
      await this.audit.log(approvedBy, 'leave.reject', 'LeaveRequest', id);
      await this.notifications.notify(
        result.data.user_id,
        'Cuti ditolak',
        'Pengajuan cuti Anda ditolak oleh HR/admin.',
        'approval',
      );
      return result;
    });
  }

  async updateQuota(id: number, quotaDays: number) {
    const updated = await this.prisma.leaveQuota.update({ where: { id }, data: { quota_days: quotaDays } });
    return { success: true, data: updated };
  }
}
