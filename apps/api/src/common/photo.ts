import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB decoded
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface DecodedPhoto {
  buffer: Buffer;
  mime: string;
  ext: string;
}

// Decode a selfie photo (data-URI or raw base64, treated as JPEG) WITHOUT
// saving it. Face extraction and file saving both go through this single
// validator, so a photo accepted for storage is also decodable for
// verification and vice versa. External URLs are always rejected.
export function decodeSelfiePhoto(selfiePhoto: string | undefined): DecodedPhoto {
  if (!selfiePhoto) throw new BadRequestException('photo is required');
  if (selfiePhoto.startsWith('uploads/')) {
    throw new BadRequestException('photo must be uploaded as image data, not a stored path');
  }
  let mime = 'image/jpeg';
  let b64 = selfiePhoto;
  const m = selfiePhoto.match(/^data:(image\/[a-z]+);base64,(.+)$/s);
  if (m) {
    mime = m[1];
    b64 = m[2];
  } else if (/^https?:\/\//.test(selfiePhoto)) {
    throw new BadRequestException('photo must be uploaded as an image data-URI, not an external URL');
  }
  const ext = ALLOWED_MIME[mime];
  if (!ext) throw new BadRequestException('photo must be JPEG, PNG, or WebP');
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch {
    throw new BadRequestException('photo is not valid base64');
  }
  if (buf.length === 0 || buf.length > MAX_PHOTO_BYTES) {
    throw new BadRequestException('photo must be non-empty and at most 2 MB');
  }
  return { buffer: buf, mime, ext };
}

// Selfie photos are NEVER stored raw (base64) in SQLite.
// Files land in apps/api/uploads/ (git-ignored) and only the relative path
// is stored in photo_url. Reading them back requires the authenticated
// GET /api/v1/photos/:filename endpoint (see photos.controller.ts); the
// directory is NOT served statically any more.
export function saveSelfiePhoto(selfiePhoto: string | undefined, userId: number): string | null {
  if (!selfiePhoto) return null;
  if (selfiePhoto.startsWith('uploads/')) return selfiePhoto;
  const { buffer, ext } = decodeSelfiePhoto(selfiePhoto);
  const dir = join(process.cwd(), 'uploads');
  mkdirSync(dir, { recursive: true });
  const name = `user-${userId}-${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;
  writeFileSync(join(dir, name), buffer);
  return `uploads/${name}`;
}
