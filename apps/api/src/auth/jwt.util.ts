import { createHmac, timingSafeEqual } from 'crypto';

// Minimal HS256 JWT implementation (no extra JWT dependency).
// Payload: { sub: userId, role: roleName, email, iat, exp }.
// Secret comes ONLY from JWT_SECRET; the server refuses to start without it
// (see main.ts) so there is never a fallback/default secret.
function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export interface JwtPayload {
  sub: number;
  role: string;
  email: string;
  iat: number;
  exp: number;
}

export function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  expiresInSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = { ...payload, iat: now, exp: now + expiresInSeconds };
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(full));
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64url(sig)}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [header, body, sig] = parts;
  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest();
  const actual = b64urlDecode(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error('Bad signature');
  }
  const payload = JSON.parse(b64urlDecode(body).toString('utf8')) as JwtPayload;
  if (!payload.exp || payload.exp * 1000 < Date.now()) throw new Error('Token expired');
  if (typeof payload.sub !== 'number') throw new Error('Bad payload');
  return payload;
}
