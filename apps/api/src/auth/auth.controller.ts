import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public, CurrentUser } from './decorators';
import type { CurrentUserData } from './decorators';
import { LoginDto, RefreshDto } from '../common/dto';
import { JwtAuthGuard, RolesGuard } from './guards';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Brute-force brake: 10 login attempts/minute per IP, on top of the
  // global 100/minute. A 429 here means "slow down", not "bad password".
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  // Public by design: it only revokes the presented refresh token (by hash)
  // and always returns success, so it leaks nothing about token validity.
  @Public()
  @Post('logout')
  async logout(@Body() body: { refresh_token?: string }) {
    return this.authService.logout(body?.refresh_token);
  }

  @Get('me')
  async me(@CurrentUser() user: CurrentUserData) {
    return this.authService.getMe(user.id);
  }
}
