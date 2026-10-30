import { Module } from '@nestjs/common';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [UsersModule, NotificationsModule, AuditModule],
  controllers: [LeaveController],
  providers: [LeaveService],
})
export class LeaveModule {}
