import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { mkdirSync } from 'fs';
import helmet from 'helmet';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  // Fail fast: JWT_SECRET must never silently fall back to a default, or
  // every token in every environment would be forgeable with a known secret.
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required (see apps/api/.env.example)');
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown body fields (incl. userId/approvedBy)
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  // CORS restricted to configured origins (comma-separated), defaulting to
  // the local dashboard dev origin. Never '*' with credentials.
  const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:3001')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  app.use(helmet());
  // JSON body limit MUST cover the documented selfie cap: DTOs allow up
  // to 3,000,000 chars (~2 MB decoded) and the previous round's "default
  // limits apply" comment was wrong — Express defaults to 100 kb, so
  // even an ordinary 256 KB phone JPEG was rejected with 413 before any
  // validation ran. 4 MB covers the DTO cap plus JSON overhead; anything
  // larger is still rejected by the DTO/photo validators with 400.
  // (DoS note: this is per-request memory, bounded by the same cap, and
  // all routes are additionally throttled per IP — see app.module.ts.)
  app.use(json({ limit: '4mb' }));
  // Selfie files are NOT served statically any more: uploads/ is only a
  // private directory, and GET /api/v1/photos/:filename (authenticated,
  // owner-or-HR/admin) is the only way to read a photo back.
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
