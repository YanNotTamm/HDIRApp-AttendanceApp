import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { FaceService } from './face.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';
import type { CurrentUserData } from '../auth/decorators';
import { FacePhotoDto } from '../common/dto';

// Route: api/v1/face (fixed in the previous round from /v1/face).
// Enroll/verify take a PHOTO, never a client-supplied descriptor: the
// descriptor is always extracted on the server (see face.service.ts).
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/face')
export class FaceController {
  constructor(private readonly faceService: FaceService) {}

  @Post('enroll')
  async enroll(@Body() dto: FacePhotoDto, @CurrentUser() user: CurrentUserData) {
    return this.faceService.enrollFace(user.id, dto.selfiePhoto);
  }

  @Post('verify')
  async verify(@Body() dto: FacePhotoDto, @CurrentUser() user: CurrentUserData) {
    return this.faceService.verifyFace(user.id, dto.selfiePhoto);
  }

  @Get('status')
  async status(@CurrentUser() user: CurrentUserData) {
    return this.faceService.getStatus(user.id);
  }
}
