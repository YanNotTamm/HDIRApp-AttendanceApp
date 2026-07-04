import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async login(email: string, password: string) {
    // In a real app, hash and compare password.
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
        employee: true,
      }
    });

    if (!user || user.password_hash !== password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Return mock token for now
    return {
      success: true,
      message: 'Login successful',
      data: {
        token: 'mock-jwt-token-12345',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role.name,
        },
        employee: user.employee
      }
    };
  }

  async getMe() {
    // Return mock user for dev
    return {
      success: true,
      data: {
        id: 1,
        name: 'Mock User',
        email: 'mock@example.com',
        role: 'employee'
      }
    };
  }
}
