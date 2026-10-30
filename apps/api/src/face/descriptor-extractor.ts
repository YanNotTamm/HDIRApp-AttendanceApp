import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import * as faceapi from 'face-api.js';
import * as tf from '@tensorflow/tfjs';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

/**
 * Server-side face descriptor extraction — NO native canvas, NO tfjs-node.
 *
 * Why this stack: the previous stack (face-api.js + canvas 3.x) never
 * loaded a model in this environment because canvas's native postinstall
 * binary failed to download (ECONNRESET). face-api.js 0.22.2 itself
 * accepts a tf.Tensor3D as network input (see its NetInput), so the only
 * missing pieces were image decoding and a tensor — both pure JS here:
 * jpeg-js decodes JPEG, pngjs decodes PNG, and @tensorflow/tfjs runs on
 * its pure-JS CPU backend. Verified in this VM on 2026-10-30: models
 * loaded in ~1.5 s, a real photo produced a 128-dim descriptor, the same
 * photo re-detected at distance 0.0, and a different person at ~0.90.
 *
 * Limits (honest, also in README):
 * - JPEG and PNG only. WebP is rejected with a clear error: no pure-JS
 *   WebP decoder is bundled. Mobile sends JPEG by default, so this does
 *   not block the normal flow.
 * - CPU-only: detection takes a few seconds on a large photo, so images
 *   are downscaled to a max side of 1280 px before detection.
 * - Single face only (detectSingleFace). Group photos verify against the
 *   most prominent face, which may not be the user's.
 * - NO liveness detection: a printed photo of the enrolled person matches.
 */
export interface DescriptorExtractor {
  /** True once all three nets have loaded successfully. */
  isReady(): boolean;
  /** Load the nets once (concurrent callers share the same promise). */
  loadModels(): Promise<boolean>;
  /**
   * Extract a 128-dim descriptor, or null when no face is detected.
   * Throws on undecodable images / unsupported formats (caller maps to 400)
   * and when the models are not loaded (caller maps to 503).
   */
  extractDescriptor(imageBuffer: Buffer, mime: string): Promise<number[] | null>;
}

const MAX_SIDE_PX = 1280;

function decodeToRgb(imageBuffer: Buffer, mime: string): { width: number; height: number; rgb: Float32Array } {
  let width: number;
  let height: number;
  let rgba: Uint8Array;
  if (mime === 'image/jpeg') {
    const raw = jpeg.decode(imageBuffer, { useTArray: true });
    width = raw.width;
    height = raw.height;
    rgba = raw.data;
  } else if (mime === 'image/png') {
    const raw = PNG.sync.read(imageBuffer);
    width = raw.width;
    height = raw.height;
    rgba = raw.data;
  } else {
    throw new Error(
      `Format ${mime} tidak didukung untuk verifikasi wajah di server (hanya JPEG/PNG). ` +
        'Kirim foto selfie sebagai JPEG (bawaan kamera mobile) atau PNG.',
    );
  }
  if (!width || !height || rgba.length < width * height * 4) {
    throw new Error('Gambar tidak dapat di-decode untuk verifikasi wajah');
  }
  const rgb = new Float32Array(width * height * 3);
  for (let i = 0, j = 0; i < width * height; i++, j += 3) {
    const k = i * 4;
    rgb[j] = rgba[k];
    rgb[j + 1] = rgba[k + 1];
    rgb[j + 2] = rgba[k + 2];
  }
  return { width, height, rgb };
}

// Area-average downscale (deterministic: the same file always yields the
// same tensor, so enroll and verify of the same photo score distance 0).
function downscale(src: { width: number; height: number; rgb: Float32Array }): { width: number; height: number; rgb: Float32Array } {
  const { width, height, rgb } = src;
  const maxSide = Math.max(width, height);
  if (maxSide <= MAX_SIDE_PX) return src;
  const scale = MAX_SIDE_PX / maxSide;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor(x / scale);
      const sy0 = Math.floor(y / scale);
      const sx1 = Math.min(width, Math.ceil((x + 1) / scale));
      const sy1 = Math.min(height, Math.ceil((y + 1) / scale));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const k = (sy * width + sx) * 3;
          r += rgb[k];
          g += rgb[k + 1];
          b += rgb[k + 2];
          n++;
        }
      }
      const o = (y * w + x) * 3;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
    }
  }
  return { width: w, height: h, rgb: out };
}

@Injectable()
export class FaceApiDescriptorExtractor implements DescriptorExtractor {
  private readonly logger = new Logger(FaceApiDescriptorExtractor.name);
  private loadPromise: Promise<boolean> | null = null;
  private ready = false;

  weightsDir(): string {
    return process.env.FACE_WEIGHTS_DIR ?? join(process.cwd(), 'weights');
  }

  isReady(): boolean {
    return this.ready;
  }

  loadModels(): Promise<boolean> {
    if (this.ready) return Promise.resolve(true);
    if (!this.loadPromise) {
      this.loadPromise = this.doLoad().catch((err: unknown) => {
        this.loadPromise = null; // allow a later retry (e.g. after weights are downloaded)
        this.logger.error(`Gagal memuat model wajah dari ${this.weightsDir()}: ${(err as Error)?.message ?? err}`);
        return false;
      });
    }
    return this.loadPromise;
  }

  private async doLoad(): Promise<boolean> {
    await tf.setBackend('cpu');
    await tf.ready();
    const dir = this.weightsDir();
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(dir);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(dir);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(dir);
    this.ready = true;
    this.logger.log(`Model wajah dimuat dari ${dir} (ssdMobilenetv1 + faceLandmark68Net + faceRecognitionNet, backend CPU tfjs)`);
    return true;
  }

  async extractDescriptor(imageBuffer: Buffer, mime: string): Promise<number[] | null> {
    if (!(await this.loadModels())) {
      throw new Error('MODEL_NOT_LOADED');
    }
    const decoded = downscale(decodeToRgb(imageBuffer, mime));
    const tensor = tf.tensor3d(decoded.rgb, [decoded.height, decoded.width, 3]);
    try {
      // Runtime note: face-api 0.22.2 accepts a Tensor3D here (proven by
      // the probe in /tmp/faceprobe), but its bundled tfjs-core types
      // predate the installed tfjs 4.x Tensor class, so the cast below
      // is a type-level bridge only — it changes nothing at runtime.
      const input = tensor as unknown as Parameters<typeof faceapi.detectSingleFace>[0];
      const detection = await faceapi.detectSingleFace(input).withFaceLandmarks().withFaceDescriptor();
      if (!detection) return null;
      return Array.from(detection.descriptor);
    } finally {
      tensor.dispose();
    }
  }
}
