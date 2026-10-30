import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveModule } from './leave/leave.module';
import { EmployeeModule } from './employee/employee.module';
import { UsersModule } from './users/users.module';
import { OfficesModule } from './offices/offices.module';
import { FaceModule } from './face/face.module';
import { PhotosModule } from './photos/photos.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { ReportsModule } from './reports/reports.module';

// Rate limiting (in-memory, per IP, single instance — see README):
// default 100 requests/minute per IP for all API routes, with login
// tightened further to 10/minute on the login handler itself
// (see auth.controller.ts). Behind a reverse proxy, set trust proxy so
// the real client IP is counted; otherwise all clients share one bucket.
@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    AttendanceModule,
    LeaveModule,
    EmployeeModule,
    UsersModule,
    OfficesModule,
    FaceModule,
    PhotosModule,
    NotificationsModule,
    AuditModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
