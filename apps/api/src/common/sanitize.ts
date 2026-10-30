// NEVER return password_hash or face_embedding (biometric template) to any client.
// Every service that returns users must pass its rows through this helper, or
// use an explicit Prisma `select` that omits both fields.
export function sanitizeUser<T extends Record<string, unknown>>(user: T | null | undefined) {
  if (!user) return user;
  const { password_hash: _ph, face_embedding: _fe, ...rest } = user as Record<string, unknown> & {
    password_hash?: unknown;
    face_embedding?: unknown;
  };
  return rest;
}
export function sanitizeUsers<T extends Record<string, unknown>>(users: T[]) {
  return users.map((u) => sanitizeUser(u));
}
// Pending-approval lists include a nested user; strip secrets there too.
export function sanitizeNestedUser<T extends { user?: Record<string, unknown> | null }>(row: T) {
  if (!row || !row.user) return row;
  return { ...row, user: sanitizeUser(row.user) };
}
