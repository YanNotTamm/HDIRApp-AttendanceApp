import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';
import type { CurrentUserData } from '../auth/decorators';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@CurrentUser() user: CurrentUserData) {
    return this.notificationsService.listForUser(user.id);
  }

  @Post('read-all')
  async readAll(@CurrentUser() user: CurrentUserData) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Post(':id/read')
  async read(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.notificationsService.markRead(user.id, parseInt(id, 10));
  }
}
