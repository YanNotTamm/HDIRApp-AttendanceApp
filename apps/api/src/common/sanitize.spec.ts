import { sanitizeNestedUser, sanitizeUser } from './sanitize';

describe('sanitizeUser', () => {
  it('never returns password_hash or face_embedding', () => {
    const out = sanitizeUser({
      id: 1,
      name: 'Test',
      email: 'test@example.com',
      password_hash: 'secret-plaintext',
      face_embedding: [0.1, 0.2, 0.3],
    }) as Record<string, unknown>;
    expect(out.password_hash).toBeUndefined();
    expect(out.face_embedding).toBeUndefined();
    expect(out.id).toBe(1);
    expect(out.name).toBe('Test');
    expect(out.email).toBe('test@example.com');
  });

  it('passes null/undefined through', () => {
    expect(sanitizeUser(null)).toBeNull();
    expect(sanitizeUser(undefined)).toBeUndefined();
  });
});

describe('sanitizeNestedUser', () => {
  it('strips secrets from a nested user on pending lists', () => {
    const out = sanitizeNestedUser({
      id: 9,
      user: { id: 1, password_hash: 'x', face_embedding: [1], name: 'A' },
    }) as { user: Record<string, unknown> };
    expect(out.user.password_hash).toBeUndefined();
    expect(out.user.face_embedding).toBeUndefined();
    expect(out.user.name).toBe('A');
  });
});
