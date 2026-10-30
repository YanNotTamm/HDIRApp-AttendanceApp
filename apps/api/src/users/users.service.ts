import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { sanitizeUser, sanitizeUsers } from '../common/sanitize';
import { CreateUserDto, UpdateUserDto } from '../common/dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: { office: true, department: true, role: true },
    });
    return { success: true, data: sanitizeUsers(users) };
  }

  async findOne(id: number, caller: { id: number; role: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { office: true, department: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (caller.role === 'employee' && caller.id !== id) {
      throw new ForbiddenException('Employees can only view their own profile');
    }
    return { success: true, data: sanitizeUser(user) };
  }

  // LeaveQuota auto-creation (documented choice): every LeaveType gets a quota
  // row for the new user (current year, default_annual_quota). The same helper
  // is reused lazily by LeaveService.createLeave for pre-existing users.
  async ensureQuotas(userId: number, year: number) {
    const types = await this.prisma.leaveType.findMany();
    for (const t of types) {
      await this.prisma.leaveQuota.upsert({
        where: { user_id_leave_type_id_year: { user_id: userId, leave_type_id: t.id, year } },
        update: {},
        create: { user_id: userId, leave_type_id: t.id, year, quota_days: t.default_annual_quota },
      });
    }
  }

  async create(dto: CreateUserDto, actorId?: number) {
    const password_hash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password_hash,
        role_id: dto.role_id,
        employee_code: dto.employee_code,
        department_id: dto.department_id ?? null,
        office_id: dto.office_id ?? null,
        phone: dto.phone ?? null,
      },
      include: { office: true, department: true, role: true },
    });
    await this.ensureQuotas(user.id, new Date().getFullYear());
    await this.audit.log(actorId ?? null, 'user.create', 'User', user.id, user.email);
    return { success: true, message: 'User created successfully', data: sanitizeUser(user) };
  }

  async update(id: number, dto: UpdateUserDto, callerRole: string, actorId?: number) {
    // Only an admin may change role_id; HR updating a user must not be able
    // to escalate anyone (including themselves) via this endpoint.
    const data: Record<string, unknown> = {
      name: dto.name,
      email: dto.email,
      employee_code: dto.employee_code,
      department_id: dto.department_id,
      office_id: dto.office_id,
      phone: dto.phone,
    };
    if (dto.role_id !== undefined) {
      if (callerRole !== 'admin') throw new ForbiddenException('Only admin can change role');
      data.role_id = dto.role_id;
    }
    const user = await this.prisma.user.update({
      where: { id },
      data,
      include: { office: true, department: true, role: true },
    });
    await this.audit.log(actorId ?? null, 'user.update', 'User', id);
    return { success: true, message: 'User updated successfully', data: sanitizeUser(user) };
  }

  async remove(id: number, actorId?: number) {
    await this.prisma.user.update({ where: { id }, data: { status: 'inactive' } });
    await this.audit.log(actorId ?? null, 'user.deactivate', 'User', id);
    return { success: true, message: 'User deactivated' };
  }
}
