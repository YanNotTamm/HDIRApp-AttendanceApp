import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards } from '@nestjs/common';
import { OfficesService } from './offices.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser } from '../auth/decorators';
import type { CurrentUserData } from '../auth/decorators';
import { OfficeDto, UpdateOfficeDto } from '../common/dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/offices')
export class OfficesController {
  constructor(private readonly officesService: OfficesService) {}

  @Get()
  async findAll() {
    return this.officesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.officesService.findOne(+id);
  }

  @Roles('admin')
  @Post()
  async create(@Body() dto: OfficeDto, @CurrentUser() user: CurrentUserData) {
    return this.officesService.create(dto, user.id);
  }

  @Roles('admin')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateOfficeDto, @CurrentUser() user: CurrentUserData) {
    return this.officesService.update(+id, dto, user.id);
  }

  @Roles('admin')
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.officesService.remove(+id, user.id);
  }
}
