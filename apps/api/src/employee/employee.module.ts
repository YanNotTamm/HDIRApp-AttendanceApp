import { Module } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { FaceModule } from '../face/face.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [FaceModule, AuditModule],
  controllers: [EmployeeController],
  providers: [EmployeeService],
})
export class EmployeeModule {}
