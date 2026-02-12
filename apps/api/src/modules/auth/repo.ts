import type { Pool, PoolClient, QueryResultRow } from 'pg';

export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
}

export interface DbSessionLookup {
  session_id: string;
  user_id: string;
  email: string;
  expires_at: string;
  profile_id: string | null;
}

async function queryOne<T extends QueryResultRow>(
  executor: Pool | PoolClient,
  text: string,
  values: unknown[]
): Promise<T | null> {
  const result = await executor.query<T>(text, values);
  return result.rows[0] ?? null;
}

export async function findUserByEmail(executor: Pool | PoolClient, email: string): Promise<DbUser | null> {
  return queryOne<DbUser>(
    executor,
    `SELECT id, email::text AS email, password_hash FROM users WHERE lower(email) = lower($1)`,
    [email]
  );
}

export async function findUserById(executor: Pool | PoolClient, userId: string): Promise<DbUser | null> {
  return queryOne<DbUser>(
    executor,
    `SELECT id, email::text AS email, password_hash FROM users WHERE id = $1`,
    [userId]
  );
}

export async function createUser(
  executor: Pool | PoolClient,
  input: { id: string; email: string; passwordHash: string }
): Promise<void> {
  await executor.query(`INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`, [
    input.id,
    input.email,
    input.passwordHash
  ]);
}

export async function createSession(
  executor: Pool | PoolClient,
  input: { id: string; userId: string; tokenHash: string; expiresAtIso: string }
): Promise<void> {
  await executor.query(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4::timestamptz)`,
    [input.id, input.userId, input.tokenHash, input.expiresAtIso]
  );
}

export async function findSessionByTokenHash(
  executor: Pool | PoolClient,
  tokenHash: string
): Promise<DbSessionLookup | null> {
  return queryOne<DbSessionLookup>(
    executor,
    `
      SELECT
        s.id AS session_id,
        s.user_id,
        u.email::text AS email,
        s.expires_at::text AS expires_at,
        p.id AS profile_id
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE s.token_hash = $1 AND s.expires_at > now()
    `,
    [tokenHash]
  );
}

export async function touchSession(executor: Pool | PoolClient, sessionId: string): Promise<void> {
  await executor.query(`UPDATE sessions SET last_seen_at = now() WHERE id = $1`, [sessionId]);
}

export async function deleteSessionByTokenHash(executor: Pool | PoolClient, tokenHash: string): Promise<void> {
  await executor.query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash]);
}

export async function deleteSessionsByUserId(executor: Pool | PoolClient, userId: string): Promise<void> {
  await executor.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}
