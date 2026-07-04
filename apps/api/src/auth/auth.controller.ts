import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any) {
    return this.authService.login(body.email, body.password);
  }

  @Post('logout')
  async logout() {
    return { success: true, message: 'Logged out successfully' };
  }
  
  @Get('me')
  async me() {
    return this.authService.getMe();
  }
}
