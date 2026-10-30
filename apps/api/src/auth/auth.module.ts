import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenCleanupService } from './token-cleanup.service';
import { JwtAuthGuard, RolesGuard } from './guards';
import { AuditModule } from '../audit/audit.module';

// Global so every feature module can use JwtAuthGuard/RolesGuard without
// importing AuthModule (and without a circular import).
@Global()
@Module({
  imports: [AuditModule],
  controllers: [AuthController],
  providers: [AuthService, TokenCleanupService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
