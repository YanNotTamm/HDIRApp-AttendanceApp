import { Controller, Post, Get, Put, Body, Query, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser } from '../auth/decorators';
import type { CurrentUserData } from '../auth/decorators';
import { CreateLeaveDto, CreateLeaveTypeDto, UpdateQuotaDto } from '../common/dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  async requestLeave(@Body() dto: CreateLeaveDto, @CurrentUser() user: CurrentUserData) {
    return this.leaveService.createLeave(user.id, dto);
  }

  @Get('types')
  async listLeaveTypes() {
    return this.leaveService.listLeaveTypes();
  }

  @Roles('admin', 'hr')
  @Post('types')
  async createLeaveType(@Body() dto: CreateLeaveTypeDto, @CurrentUser() user: CurrentUserData) {
    return this.leaveService.createLeaveType(dto, user.id);
  }

  @Get()
  async getMyLeaves(@CurrentUser() user: CurrentUserData, @Query('page') page: string) {
    return this.leaveService.getLeaves(user.id, parseInt(page, 10) || 1);
  }

  @Get('quota')
  async getMyQuota(@CurrentUser() user: CurrentUserData, @Query('userId') queryUserId: string) {
    const target = queryUserId ? parseInt(queryUserId, 10) : user.id;
    return this.leaveService.getQuota(target, user);
  }

  @Roles('admin', 'hr')
  @Get('pending')
  async getPendingLeaves() {
    return this.leaveService.getPendingLeaves();
  }

  @Roles('admin', 'hr')
  @Post(':id/approve')
  async approveLeave(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.leaveService.approveLeave(parseInt(id, 10), user.id);
  }

  @Roles('admin', 'hr')
  @Post(':id/reject')
  async rejectLeave(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.leaveService.rejectLeave(parseInt(id, 10), user.id);
  }

  @Roles('admin', 'hr')
  @Put('quota/:id')
  async updateQuota(@Param('id') id: string, @Body() dto: UpdateQuotaDto) {
    return this.leaveService.updateQuota(parseInt(id, 10), dto.quota_days);
  }
}
