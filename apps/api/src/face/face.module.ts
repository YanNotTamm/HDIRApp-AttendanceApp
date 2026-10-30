import { Module } from '@nestjs/common';
import { FaceController } from './face.controller';
import { FaceService } from './face.service';
import { FaceApiDescriptorExtractor } from './descriptor-extractor';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [FaceController],
  providers: [FaceService, FaceApiDescriptorExtractor],
  exports: [FaceService],
})
export class FaceModule {}
