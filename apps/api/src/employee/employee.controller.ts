import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';
import type { CurrentUserData } from '../auth/decorators';
import { DeviceBindDto, FacePhotoDto } from '../common/dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post('device/bind')
  async bindDevice(@Body() dto: DeviceBindDto, @CurrentUser() user: CurrentUserData) {
    return this.employeeService.bindDevice(user.id, dto);
  }

  @Get('device/is-bound')
  async isBound(@Query('device_uid') deviceUid: string | undefined, @CurrentUser() user: CurrentUserData) {
    return this.employeeService.checkDeviceBind(user.id, deviceUid || undefined);
  }

  // Legacy face-registration route: same real enroll behaviour as
  // POST /api/v1/face/enroll (photo in, server-extracted descriptor).
  @Post('employee/face-registration')
  async registerFace(@Body() dto: FacePhotoDto, @CurrentUser() user: CurrentUserData) {
    return this.employeeService.registerFace(user.id, dto.selfiePhoto);
  }

  @Get('employee/face-descriptor')
  async getFaceDescriptor(@CurrentUser() user: CurrentUserData) {
    return this.employeeService.getFaceDescriptor(user.id);
  }
}
