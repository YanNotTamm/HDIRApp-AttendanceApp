import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser } from '../auth/decorators';
import type { CurrentUserData } from '../auth/decorators';
import { CreateUserDto, UpdateUserDto } from '../common/dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('admin', 'hr')
  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.usersService.findOne(+id, user);
  }

  @Roles('admin')
  @Post()
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: CurrentUserData) {
    return this.usersService.create(dto, user.id);
  }

  @Roles('admin', 'hr')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: CurrentUserData) {
    return this.usersService.update(+id, dto, user.role, user.id);
  }

  @Roles('admin')
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.usersService.remove(+id, user.id);
  }
}
