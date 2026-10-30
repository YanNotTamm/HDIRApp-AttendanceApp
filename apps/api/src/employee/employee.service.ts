import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FaceService } from '../face/face.service';
import { AuditService } from '../audit/audit.service';
import { DeviceBindDto } from '../common/dto';

/**
 * DEVICE BINDING: REAL now. The previous round returned 501 because no
 * device storage existed; the Device table (see schema.prisma) now exists
 * and bind/is-bound read and write it. What is NOT claimed: attendance
 * enforcement — a bound user can still check in from another device
 * (see the Device model comment). That is a deliberate, documented gap,
 * not a silent one.
 *
 * FACE REGISTRATION (legacy route): previously 501 for the same reason
 * as face.service.ts. It now delegates to the real FaceService.enroll
 * path, so /employee/face-registration and /face/enroll are the same
 * verified behaviour behind two routes.
 *
 * getFaceDescriptor stays boolean-only: the biometric template itself is
 * never returned through any endpoint.
 */
@Injectable()
export class EmployeeService {
  constructor(
    private prisma: PrismaService,
    private faceService: FaceService,
    private audit: AuditService,
  ) {}

  async bindDevice(userId: number, dto: DeviceBindDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const device = await this.prisma.device.upsert({
      where: { user_id_device_uid: { user_id: userId, device_uid: dto.device_uid } },
      update: { device_info: dto.device_info ?? null },
      create: { user_id: userId, device_uid: dto.device_uid, device_info: dto.device_info ?? null },
    });
    await this.audit.log(userId, 'device.bind', 'Device', device.id, dto.device_uid);
    return { success: true, message: 'Device bound successfully', data: { bound: true, device_uid: device.device_uid } };
  }

  async checkDeviceBind(userId: number, deviceUid?: string) {
    if (deviceUid) {
      const device = await this.prisma.device.findUnique({
        where: { user_id_device_uid: { user_id: userId, device_uid: deviceUid } },
      });
      return { success: true, data: { bound: !!device, device_uid: deviceUid } };
    }
    const count = await this.prisma.device.count({ where: { user_id: userId } });
    return { success: true, data: { bound: count > 0, bound_devices: count } };
  }

  async registerFace(userId: number, selfiePhoto: string | undefined) {
    return this.faceService.enrollFace(userId, selfiePhoto);
  }

  async getFaceDescriptor(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    // Deliberately boolean-only: the embedding itself is never returned.
    return { success: true, data: { has_face_registered: !!user.face_embedding } };
  }
}
