import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { validateCoordinates, haversineMeters, todayBounds } from '../common/coordinates';
import { saveSelfiePhoto } from '../common/photo';
import { sanitizeNestedUser } from '../common/sanitize';
import { CheckInDto, CheckOutDto } from '../common/dto';
import { FaceService } from '../face/face.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

/**
 * ATTENDANCE RULES (audit fix, documented here and enforced below):
 * - Location is mandatory and strictly validated. There is no location-less
 *   mode: null/NaN/out-of-range coordinates are rejected with 400 and are
 *   never stored as normal/approved.
 * - One check-in per user per calendar day. A second check-in the same day
 *   is rejected even if the user already checked out (stricter and simpler
 *   to audit than "one open session"; a second shift is not modelled).
 * - Check-out requires a check-in on the same day, and only one check-out
 *   per day. Check-out without check-in is rejected with 400.
 * - mode/status come from server-side Haversine distance vs the user's
 *   office radius: inside -> normal/approved, outside -> remote/pending and
 *   a reason is REQUIRED for both check-in and check-out (the old code only
 *   required it for check-in).
 * - FACE VERIFICATION IS NOW MANDATORY FOR CHECK-IN: the selfie is
 *   verified against the server-extracted enrolled descriptor BEFORE any
 *   record is created. No enrolled face -> 400 telling the user to
 *   enroll first. Mismatch -> 400 and NO record. On match, the record's
 *   face_match_score holds the REAL euclidean distance (lower = closer,
 *   match iff <= 0.6) and the response reports face_verified: true.
 *   Check-out verifies too when a selfie is supplied; without a selfie
 *   it proceeds on GPS only (documented asymmetry: check-in is the
 *   identity gate, check-out only closes the day).
 */
@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private faceService: FaceService,
    private notifications: NotificationsService,
    private audit: AuditService,
  ) {}

  private async loadUserWithOffice(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { office: true } });
    if (!user) throw new BadRequestException('User not found');
    if (!user.office) throw new BadRequestException('User office not configured');
    return user;
  }

  async checkIn(userId: number, dto: CheckInDto) {
    const { latitude, longitude } = validateCoordinates(dto.latitude, dto.longitude);
    const user = await this.loadUserWithOffice(userId);
    const office = user.office!;
    const { start, end } = todayBounds();
    const existingIn = await this.prisma.attendance.findFirst({
      where: { user_id: userId, check_type: 'in', timestamp: { gte: start, lte: end } },
    });
    if (existingIn) {
      throw new BadRequestException('Already checked in today; only one check-in per day is allowed');
    }
    // Face gate runs BEFORE the record is created, so a failed
    // verification can never leave a half-created attendance behind.
    // A missing selfie is a face failure too: check-in without a photo
    // cannot be verified, so it is rejected outright.
    if (!dto.selfiePhoto) {
      throw new BadRequestException('Foto selfie wajib untuk check-in: wajah harus diverifikasi sebelum absen dicatat');
    }
    const face = await this.faceService.verifyForCheckIn(userId, dto.selfiePhoto);
    const distance = haversineMeters(latitude, longitude, office.latitude, office.longitude);
    const isRemote = distance > office.radius_meters;
    if (isRemote && !dto.reason) {
      throw new BadRequestException('Reason is required for remote attendance (out of range)');
    }
    const attendance = await this.prisma.attendance.create({
      data: {
        user_id: user.id,
        check_type: 'in',
        timestamp: new Date(),
        latitude,
        longitude,
        distance_meters: distance,
        photo_url: saveSelfiePhoto(dto.selfiePhoto, userId),
        status: isRemote ? 'pending' : 'approved',
        mode: isRemote ? 'remote' : 'normal',
        reason: dto.reason ?? null,
        face_match_score: face.distance,
      },
    });
    if (isRemote) {
      await this.notifications.notifyRole(
        ['admin', 'hr'],
        'Absen remote menunggu persetujuan',
        `${user.name} mengajukan absen remote hari ini dan menunggu persetujuan.`,
      );
    }
    return {
      success: true,
      message: isRemote ? 'Remote clock in submitted for approval' : 'Clock in successful',
      data: { ...attendance, face_verified: true, face_match_distance: face.distance, face_match_threshold: 0.6 },
    };
  }

  async checkOut(userId: number, dto: CheckOutDto) {
    const { latitude, longitude } = validateCoordinates(dto.latitude, dto.longitude);
    const user = await this.loadUserWithOffice(userId);
    const office = user.office!;
    const { start, end } = todayBounds();
    const todaysIn = await this.prisma.attendance.findFirst({
      where: { user_id: userId, check_type: 'in', timestamp: { gte: start, lte: end } },
    });
    if (!todaysIn) {
      throw new BadRequestException('Cannot check out without a check-in today');
    }
    const existingOut = await this.prisma.attendance.findFirst({
      where: { user_id: userId, check_type: 'out', timestamp: { gte: start, lte: end } },
    });
    if (existingOut) {
      throw new BadRequestException('Already checked out today');
    }
    // Check-out: verify when a selfie is supplied (same gate, same
    // rejection semantics); without a selfie it proceeds on GPS only.
    let faceDistance: number | null = null;
    let faceVerified = false;
    if (dto.selfiePhoto) {
      const face = await this.faceService.verifyForCheckIn(userId, dto.selfiePhoto);
      faceDistance = face.distance;
      faceVerified = true;
    }
    const distance = haversineMeters(latitude, longitude, office.latitude, office.longitude);
    const isRemote = distance > office.radius_meters;
    if (isRemote && !dto.reason) {
      throw new BadRequestException('Reason is required for remote attendance (out of range)');
    }
    const attendance = await this.prisma.attendance.create({
      data: {
        user_id: user.id,
        check_type: 'out',
        timestamp: new Date(),
        latitude,
        longitude,
        distance_meters: distance,
        photo_url: saveSelfiePhoto(dto.selfiePhoto, userId),
        status: isRemote ? 'pending' : 'approved',
        mode: isRemote ? 'remote' : 'normal',
        reason: dto.reason ?? null,
        face_match_score: faceDistance,
      },
    });
    return { success: true, message: 'Clock out successful', data: { ...attendance, face_verified: faceVerified } };
  }

  // Company-wide today summary for HR/admin (the dashboard's "Hadir
  // Hari Ini" card previously showed "-" because no such endpoint
  // existed). Counts distinct users with a check-in today.
  async getTodaySummary() {
    const { start, end } = todayBounds();
    const todaysIn = await this.prisma.attendance.findMany({
      where: { check_type: 'in', timestamp: { gte: start, lte: end } },
      select: { user_id: true, status: true, mode: true },
    });
    const presentUserIds = new Set(todaysIn.map((a) => a.user_id));
    const byStatus: Record<string, number> = {};
    for (const a of todaysIn) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
    const totalEmployees = await this.prisma.user.count({ where: { status: 'active' } });
    return {
      success: true,
      data: {
        date: start.toISOString().slice(0, 10),
        present_count: presentUserIds.size,
        total_employees: totalEmployees,
        by_status: byStatus,
        remote_count: todaysIn.filter((a) => a.mode === 'remote').length,
      },
    };
  }

  async getToday(userId: number) {
    const { start, end } = todayBounds();
    const attendances = await this.prisma.attendance.findMany({
      where: { user_id: userId, timestamp: { gte: start, lte: end } },
      orderBy: { timestamp: 'asc' },
    });
    const checkIn = attendances.find((a) => a.check_type === 'in');
    const checkOut = attendances.find((a) => a.check_type === 'out');
    return {
      success: true,
      data: {
        clock_in: checkIn ? checkIn.timestamp : null,
        clock_out: checkOut ? checkOut.timestamp : null,
        status: checkIn ? checkIn.status : null,
      },
    };
  }

  async getHistory(userId: number, page: number) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const attendances = await this.prisma.attendance.findMany({
      where: { user_id: userId },
      orderBy: { timestamp: 'desc' },
      take: 20,
      skip: (safePage - 1) * 20,
    });
    return { success: true, data: attendances };
  }

  async getPendingRemote() {
    const pending = await this.prisma.attendance.findMany({
      where: { status: 'pending', mode: 'remote' },
      include: { user: true },
    });
    return { success: true, data: pending.map(sanitizeNestedUser) };
  }

  private async requirePendingAttendance(id: number) {
    const row = await this.prisma.attendance.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Attendance not found');
    if (row.status !== 'pending') {
      throw new BadRequestException(`Attendance is already ${row.status}; only pending records can be decided`);
    }
    return row;
  }

  async approveRemote(id: number, approvedBy: number) {
    await this.requirePendingAttendance(id);
    const attendance = await this.prisma.attendance.update({
      where: { id },
      data: { status: 'approved', approved_by: approvedBy, approved_at: new Date() },
    });
    await this.audit.log(approvedBy, 'attendance.approve', 'Attendance', id);
    await this.notifications.notify(
      attendance.user_id,
      'Absen remote disetujui',
      'Absen remote Anda telah disetujui oleh HR/admin.',
      'approval',
    );
    return { success: true, data: attendance };
  }

  async rejectRemote(id: number, approvedBy: number) {
    await this.requirePendingAttendance(id);
    const attendance = await this.prisma.attendance.update({
      where: { id },
      data: { status: 'rejected', approved_by: approvedBy, approved_at: new Date() },
    });
    await this.audit.log(approvedBy, 'attendance.reject', 'Attendance', id);
    await this.notifications.notify(
      attendance.user_id,
      'Absen remote ditolak',
      'Absen remote Anda ditolak oleh HR/admin.',
      'approval',
    );
    return { success: true, data: attendance };
  }
}
