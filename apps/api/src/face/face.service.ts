import {
  Injectable,
  OnModuleInit,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { decodeSelfiePhoto } from '../common/photo';
import { euclideanDistance, isFaceMatch, FACE_MATCH_THRESHOLD } from './distance';
import { FaceApiDescriptorExtractor } from './descriptor-extractor';

/**
 * REAL face verification (replaces the previous 501 stub).
 *
 * - Enroll: the PHOTO is sent by the client, but the descriptor is always
 *   extracted ON THE SERVER (FaceApiDescriptorExtractor). A raw
 *   client-supplied descriptor is never accepted or stored: there is no
 *   endpoint that takes one, so a forged "match" cannot be injected.
 * - Verify: the check-in selfie is extracted on the server and compared
 *   with euclidean distance against the enrolled descriptor.
 *   Match iff distance <= 0.6 (FACE_MATCH_THRESHOLD, see distance.ts).
 * - face_embedding is stored (JSON array of 128 numbers) but NEVER
 *   returned by any API (see common/sanitize.ts and the boolean-only
 *   /employee/face-descriptor endpoint).
 * - If the models failed to load (weights missing), enroll/verify fail
 *   with 503 — never with a fake success and never by skipping the check.
 * - NO liveness detection: a photo of the enrolled person will match.
 */
export const FACE_NOT_ENROLLED_MESSAGE =
  'Belum ada wajah terdaftar untuk akun ini. Silakan daftarkan wajah dulu lewat enroll sebelum absen.';
export const FACE_NO_FACE_MESSAGE =
  'Tidak ada wajah terdeteksi di foto. Pastikan wajah terlihat jelas menghadap kamera, lalu coba lagi.';
export const FACE_MODEL_UNAVAILABLE_MESSAGE =
  'Model verifikasi wajah belum termuat di server (weights belum tersedia atau gagal dimuat). Hubungi admin; absen tidak dapat diproses tanpa verifikasi wajah.';
export const FACE_MISMATCH_MESSAGE =
  'Wajah tidak cocok dengan wajah yang terdaftar. Absen dibatalkan dan tidak ada absensi yang dicatat.';

@Injectable()
export class FaceService implements OnModuleInit {
  private readonly logger = new Logger(FaceService.name);

  constructor(
    private prisma: PrismaService,
    private extractor: FaceApiDescriptorExtractor,
    private audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Load once at boot, not per request. A failure here must NOT crash
    // the server (other features still work), but enroll/verify will
    // then fail loudly with 503 until the weights are fixed.
    const ok = await this.extractor.loadModels();
    if (!ok) {
      this.logger.error(
        'Model wajah GAGAL dimuat saat boot — enroll/verify akan menjawab 503. ' +
          'Jalankan apps/api/scripts/download-face-weights.sh atau set FACE_WEIGHTS_DIR.',
      );
    }
  }

  private parseStoredDescriptor(raw: string | null): number[] | null {
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length !== 128 || !parsed.every((v) => typeof v === 'number' && Number.isFinite(v))) {
        return null;
      }
      return parsed as number[];
    } catch {
      return null;
    }
  }

  private async extractOrThrow(selfiePhoto: string | undefined): Promise<number[]> {
    if (!selfiePhoto) throw new BadRequestException('Foto selfie wajib untuk verifikasi wajah');
    const { buffer, mime } = decodeSelfiePhoto(selfiePhoto);
    let descriptor: number[] | null;
    try {
      descriptor = await this.extractor.extractDescriptor(buffer, mime);
    } catch (err) {
      const msg = (err as Error)?.message ?? '';
      if (msg === 'MODEL_NOT_LOADED') {
        throw new ServiceUnavailableException(FACE_MODEL_UNAVAILABLE_MESSAGE);
      }
      // Decode/format errors from the extractor are client errors.
      throw new BadRequestException(msg || 'Foto tidak dapat diproses untuk verifikasi wajah');
    }
    if (!descriptor) throw new BadRequestException(FACE_NO_FACE_MESSAGE);
    return descriptor;
  }

  async getStatus(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    return { success: true, data: { has_face_registered: !!user.face_embedding } };
  }

  async enrollFace(userId: number, selfiePhoto: string | undefined) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    const descriptor = await this.extractOrThrow(selfiePhoto);
    await this.prisma.user.update({
      where: { id: userId },
      data: { face_embedding: JSON.stringify(descriptor) },
    });
    await this.audit.log(userId, 'face.enroll', 'User', userId);
    return { success: true, message: 'Wajah berhasil didaftarkan', data: { has_face_registered: true } };
  }

  async verifyFace(userId: number, selfiePhoto: string | undefined) {
    const result = await this.verifyInternal(userId, selfiePhoto);
    return {
      success: true,
      data: {
        match: result.match,
        distance: result.distance,
        threshold: FACE_MATCH_THRESHOLD,
        message: result.match ? 'Wajah cocok dengan wajah yang terdaftar.' : FACE_MISMATCH_MESSAGE,
      },
    };
  }

  /**
   * The check-in gate. Returns the real distance on match; throws on
   * every failure mode (no enrollment, no face in photo, model down,
   * mismatch) so the caller can NEVER create a record from a failed
   * verification. A mismatch message deliberately does not reveal the
   * distance threshold internals beyond what verifyFace already returns.
   */
  async verifyForCheckIn(userId: number, selfiePhoto: string | undefined): Promise<{ distance: number }> {
    const result = await this.verifyInternal(userId, selfiePhoto);
    if (!result.match) {
      throw new BadRequestException(FACE_MISMATCH_MESSAGE);
    }
    return { distance: result.distance };
  }

  private async verifyInternal(userId: number, selfiePhoto: string | undefined) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    const enrolled = this.parseStoredDescriptor(user.face_embedding);
    if (!enrolled) {
      // Covers both "never enrolled" and a corrupt stored template: in
      // both cases the safe action is to require a fresh enroll, and to
      // say so plainly instead of guessing.
      throw new BadRequestException(FACE_NOT_ENROLLED_MESSAGE);
    }
    const descriptor = await this.extractOrThrow(selfiePhoto);
    const distance = euclideanDistance(enrolled, descriptor);
    return { match: isFaceMatch(distance), distance };
  }
}
