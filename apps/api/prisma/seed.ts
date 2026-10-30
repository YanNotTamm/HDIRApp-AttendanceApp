import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// DEV-ONLY SEED. WARNING: the passwords below are public, well-known dev
// credentials. Change them immediately in any shared/production deployment
// (and never seed a production database with this file).
//   admin:    admin@example.com    / Admin123!
//   HR:       hr@example.com       / Hr123456!
//   employee: employee@example.com / Employee123!
// Run:  DATABASE_URL="file:./prisma/dev.db" npm run db:seed   (from apps/api)

const prisma = new PrismaClient();

async function main() {
  const year = new Date().getFullYear();
  const adminRole = await prisma.role.upsert({ where: { name: 'admin' }, update: {}, create: { name: 'admin' } });
  const hrRole = await prisma.role.upsert({ where: { name: 'hr' }, update: {}, create: { name: 'hr' } });
  const empRole = await prisma.role.upsert({ where: { name: 'employee' }, update: {}, create: { name: 'employee' } });

  const office = await prisma.office.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Kantor Pusat', address: 'Jl. Contoh No. 1', latitude: -5.39714, longitude: 105.26679, radius_meters: 100 },
  });

  const leaveType = await prisma.leaveType.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Cuti Tahunan', default_annual_quota: 12, carry_over_allowed: false },
  });

  const mkUser = async (email: string, code: string, name: string, password: string, roleId: number) => {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name, email, employee_code: code, role_id: roleId, office_id: office.id,
        password_hash: await bcrypt.hash(password, 10),
      },
    });
    await prisma.leaveQuota.upsert({
      where: { user_id_leave_type_id_year: { user_id: user.id, leave_type_id: leaveType.id, year } },
      update: {},
      create: { user_id: user.id, leave_type_id: leaveType.id, year, quota_days: leaveType.default_annual_quota },
    });
    return user;
  };

  const admin = await mkUser('admin@example.com', 'EMP-ADMIN', 'Admin Contoh', 'Admin123!', adminRole.id);
  const hr = await mkUser('hr@example.com', 'EMP-HR', 'HR Contoh', 'Hr123456!', hrRole.id);
  const emp = await mkUser('employee@example.com', 'EMP-001', 'Karyawan Contoh', 'Employee123!', empRole.id);
  console.log(`Seed OK: roles admin/hr/employee, office #${office.id}, leave type #${leaveType.id}, users admin#${admin.id} hr#${hr.id} employee#${emp.id}, quotas year ${year}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
