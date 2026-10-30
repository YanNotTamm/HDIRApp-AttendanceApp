import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser } from '../auth/decorators';
import type { CurrentUserData } from '../auth/decorators';
import { CheckInDto, CheckOutDto } from '../common/dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  async checkIn(@Body() dto: CheckInDto, @CurrentUser() user: CurrentUserData) {
    return this.attendanceService.checkIn(user.id, dto);
  }

  @Post('check-out')
  async checkOut(@Body() dto: CheckOutDto, @CurrentUser() user: CurrentUserData) {
    return this.attendanceService.checkOut(user.id, dto);
  }

  @Roles('admin', 'hr')
  @Get('today-summary')
  async todaySummary() {
    return this.attendanceService.getTodaySummary();
  }

  @Get('today')
  async today(@CurrentUser() user: CurrentUserData) {
    return this.attendanceService.getToday(user.id);
  }

  @Get('history')
  async history(@CurrentUser() user: CurrentUserData, @Query('page') page: string) {
    return this.attendanceService.getHistory(user.id, parseInt(page, 10) || 1);
  }

  @Roles('admin', 'hr')
  @Get('pending')
  async getPending() {
    return this.attendanceService.getPendingRemote();
  }

  @Roles('admin', 'hr')
  @Post(':id/approve')
  async approveRemote(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.attendanceService.approveRemote(parseInt(id, 10), user.id);
  }

  @Roles('admin', 'hr')
  @Post(':id/reject')
  async rejectRemote(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.attendanceService.rejectRemote(parseInt(id, 10), user.id);
  }
}
