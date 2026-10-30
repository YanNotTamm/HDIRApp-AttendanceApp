import { Controller, Get, Param, Res, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join, basename } from 'path';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';
import type { CurrentUserData } from '../auth/decorators';

/**
 * Authenticated selfie serving (replaces the previous public static
 * /uploads/ mount, which let anyone with a URL download any selfie).
 *
 * - Only the photo's owner (parsed from the `user-<id>-...` filename
 *   written by common/photo.ts) or HR/admin may download it.
 * - The filename is basenamed and extension-checked, so `../` traversal
 *   and non-image files are rejected before any filesystem access.
 * - Clients must send the Authorization header, so this is NOT a plain
 *   <img src> URL: fetch it with the bearer token (or use a short-lived
 *   signed URL, which is not implemented — see README limitations).
 */
const ALLOWED_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/photos')
export class PhotosController {
  @Get(':filename')
  async getPhoto(@Param('filename') filename: string, @CurrentUser() user: CurrentUserData, @Res() res: Response) {
    const safe = basename(filename);
    const m = safe.match(/^user-(\d+)-[A-Za-z0-9_-]+\.(jpg|png|webp)$/);
    if (!m) throw new NotFoundException('Photo not found');
    const ownerId = parseInt(m[1], 10);
    const isHrOrAdmin = user.role === 'admin' || user.role === 'hr';
    if (user.id !== ownerId && !isHrOrAdmin) {
      throw new ForbiddenException('You can only view your own photos');
    }
    const path = join(process.cwd(), 'uploads', safe);
    if (!existsSync(path)) throw new NotFoundException('Photo not found');
    res.setHeader('Content-Type', ALLOWED_EXT[m[2]]);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    createReadStream(path).pipe(res);
  }
}
