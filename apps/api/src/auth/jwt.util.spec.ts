import { signJwt, verifyJwt } from './jwt.util';

const SECRET = 'test-secret-only-for-unit-tests';

describe('JWT (HS256, custom implementation)', () => {
  it('signs and verifies a token with the same secret', () => {
    const token = signJwt({ sub: 3, role: 'employee', email: 'e@example.com' }, SECRET, 3600);
    const payload = verifyJwt(token, SECRET);
    expect(payload.sub).toBe(3);
    expect(payload.role).toBe('employee');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it('rejects a token signed with another secret (no shared mock token)', () => {
    const token = signJwt({ sub: 3, role: 'employee', email: 'e@example.com' }, SECRET, 3600);
    expect(() => verifyJwt(token, 'different-secret')).toThrow('Bad signature');
  });

  it('rejects an expired token', () => {
    const token = signJwt({ sub: 3, role: 'employee', email: 'e@example.com' }, SECRET, -10);
    expect(() => verifyJwt(token, SECRET)).toThrow('Token expired');
  });

  it('rejects a malformed token', () => {
    expect(() => verifyJwt('not-a-token', SECRET)).toThrow();
    expect(() => verifyJwt('a.b', SECRET)).toThrow();
  });
});
