import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OfficeDto, UpdateOfficeDto } from '../common/dto';

@Injectable()
export class OfficesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll() {
    const offices = await this.prisma.office.findMany();
    return { success: true, data: offices };
  }

  async findOne(id: number) {
    const office = await this.prisma.office.findUnique({ where: { id } });
    if (!office) throw new NotFoundException('Office not found');
    return { success: true, data: office };
  }

  async create(dto: OfficeDto, actorId?: number) {
    const office = await this.prisma.office.create({
      data: {
        name: dto.name,
        address: dto.address ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        radius_meters: dto.radius_meters ?? 100,
      },
    });
    await this.audit.log(actorId ?? null, 'office.create', 'Office', office.id, dto.name);
    return { success: true, message: 'Office created successfully', data: office };
  }

  async update(id: number, dto: UpdateOfficeDto, actorId?: number) {
    const office = await this.prisma.office.update({
      where: { id },
      data: {
        name: dto.name,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        radius_meters: dto.radius_meters,
      },
    });
    await this.audit.log(actorId ?? null, 'office.update', 'Office', id);
    return { success: true, message: 'Office updated successfully', data: office };
  }

  async remove(id: number, actorId?: number) {
    await this.prisma.office.delete({ where: { id } });
    await this.audit.log(actorId ?? null, 'office.delete', 'Office', id);
    return { success: true, message: 'Office deleted' };
  }
}
