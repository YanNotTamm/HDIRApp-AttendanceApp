import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { signJwt } from './jwt.util';
import { sanitizeUser } from '../common/sanitize';

const ACCESS_TTL_SECONDS = 60 * 60; // ~1 hour
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // ~7 days

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private secret(): string {
    const s = process.env.JWT_SECRET;
    if (!s) throw new Error('JWT_SECRET is not configured');
    return s;
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Invalid email or password');
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');
    await this.audit.log(user.id, 'auth.login', 'User', user.id);
    return this.issueTokens(user.id, user.email, user.role.name);
  }

  private async issueTokens(userId: number, email: string, role: string) {
    const access_token = signJwt({ sub: userId, role, email }, this.secret(), ACCESS_TTL_SECONDS);
    const refresh_token = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        user_id: userId,
        token_hash: hashRefreshToken(refresh_token),
        expires_at: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
    return {
      success: true,
      message: 'Login successful',
      data: {
        access_token,
        refresh_token,
        token_type: 'Bearer',
        expires_in: ACCESS_TTL_SECONDS,
        user: { id: userId, email, role },
      },
    };
  }

  async refresh(refreshToken: string) {
    const row = await this.prisma.refreshToken.findUnique({
      where: { token_hash: hashRefreshToken(refreshToken) },
      include: { user: { include: { role: true } } },
    });
    if (!row || row.revoked || row.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (!row.user || row.user.status !== 'active') {
      throw new UnauthorizedException('User not found or inactive');
    }
    // Rotate: the old refresh token row is DELETED (not merely revoked)
    // and a new one issued, so rotated tokens cannot accumulate.
    await this.prisma.refreshToken.delete({ where: { id: row.id } });
    return this.issueTokens(row.user.id, row.user.email, row.user.role.name);
  }

  async logout(refreshToken?: string) {
    // Logout deletes the row (see refresh rotation above); a deleted
    // token can never be replayed, and nothing accumulates.
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: { token_hash: hashRefreshToken(refreshToken) },
      });
    }
    return { success: true, message: 'Logged out successfully' };
  }

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { office: true, department: true, role: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return { success: true, data: sanitizeUser(user) };
  }
}
