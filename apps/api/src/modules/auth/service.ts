import type { FastifyReply, FastifyRequest } from 'fastify';
import { generateToken, generateUuid, hashPassword, sha256, verifyPassword } from '../../utils/crypto.js';
import {
  createSession,
  createUser,
  deleteSessionByTokenHash,
  deleteSessionsByUserId,
  findSessionByTokenHash,
  findUserByEmail,
  findUserById,
  touchSession
} from './repo.js';

export interface SessionPrincipal {
  sid: string;
  sessionId: string;
  userId: string;
  email: string;
  profileId: string | null;
  expiresAt: string;
}

function getCookieOptions(isProd: boolean, expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
    expires: expiresAt
  };
}

function parseCookieHeader(header: string | undefined, key: string): string | null {
  if (!header) {
    return null;
  }

  const entries = header.split(';');
  for (const entry of entries) {
    const [rawKey, ...valueParts] = entry.trim().split('=');
    if (rawKey !== key) {
      continue;
    }

    const value = valueParts.join('=');
    if (!value) {
      return null;
    }

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

function getSidFromRequest(request: FastifyRequest): string | null {
  const decorated = (request as FastifyRequest & { cookies?: { sid?: string } }).cookies?.sid;
  if (decorated) {
    return decorated;
  }

  const cookieHeader = typeof request.headers.cookie === 'string' ? request.headers.cookie : undefined;
  return parseCookieHeader(cookieHeader, 'sid');
}

function setSessionCookie(reply: FastifyReply, sid: string, isProd: boolean, expiresAt: Date): void {
  const decoratedReply = reply as FastifyReply & {
    setCookie?: (name: string, value: string, options: Record<string, unknown>) => FastifyReply;
  };

  if (typeof decoratedReply.setCookie === 'function') {
    decoratedReply.setCookie('sid', sid, getCookieOptions(isProd, expiresAt));
    return;
  }

  const secure = isProd ? '; Secure' : '';
  const serialized = `sid=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax${secure}; Expires=${expiresAt.toUTCString()}`;
  reply.header('set-cookie', serialized);
}

function clearSessionCookie(reply: FastifyReply, isProd: boolean): void {
  const decoratedReply = reply as FastifyReply & {
    clearCookie?: (name: string, options: Record<string, unknown>) => FastifyReply;
  };

  if (typeof decoratedReply.clearCookie === 'function') {
    decoratedReply.clearCookie('sid', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd
    });
    return;
  }

  const secure = isProd ? '; Secure' : '';
  reply.header('set-cookie', `sid=; Path=/; HttpOnly; SameSite=Lax${secure}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
}

function buildSessionExpiry(days: number): Date {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return expires;
}

export async function attachAuth(request: FastifyRequest): Promise<void> {
  const sid = getSidFromRequest(request);
  if (!sid) {
    request.auth = null;
    return;
  }

  const tokenHash = sha256(sid);
  const session = await findSessionByTokenHash(request.server.db, tokenHash);
  if (!session) {
    request.auth = null;
    return;
  }

  await touchSession(request.server.db, session.session_id);

  request.auth = {
    sid,
    sessionId: session.session_id,
    userId: session.user_id,
    email: session.email,
    profileId: session.profile_id,
    expiresAt: session.expires_at
  };
}

export async function registerUser(request: FastifyRequest, reply: FastifyReply, email: string, password: string) {
  const existing = await findUserByEmail(request.server.db, email);
  if (existing) {
    reply.code(409).send({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const userId = generateUuid();
  await createUser(request.server.db, { id: userId, email, passwordHash });

  await deleteSessionsByUserId(request.server.db, userId);
  const sid = generateToken();
  const tokenHash = sha256(sid);
  const expiresAt = buildSessionExpiry(request.server.env.SESSION_DAYS);
  await createSession(request.server.db, {
    id: generateUuid(),
    userId,
    tokenHash,
    expiresAtIso: expiresAt.toISOString()
  });

  setSessionCookie(reply, sid, request.server.env.NODE_ENV === 'production', expiresAt);
  reply.code(201).send({ userId, email, profileId: null });
}

export async function loginUser(request: FastifyRequest, reply: FastifyReply, email: string, password: string) {
  const user = await findUserByEmail(request.server.db, email);
  if (!user) {
    reply.code(401).send({ error: 'Invalid credentials' });
    return;
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    reply.code(401).send({ error: 'Invalid credentials' });
    return;
  }

  await deleteSessionsByUserId(request.server.db, user.id);

  const sid = generateToken();
  const tokenHash = sha256(sid);
  const expiresAt = buildSessionExpiry(request.server.env.SESSION_DAYS);
  await createSession(request.server.db, {
    id: generateUuid(),
    userId: user.id,
    tokenHash,
    expiresAtIso: expiresAt.toISOString()
  });

  const profile = await findSessionByTokenHash(request.server.db, tokenHash);

  setSessionCookie(reply, sid, request.server.env.NODE_ENV === 'production', expiresAt);
  reply.code(200).send({ userId: user.id, email: user.email, profileId: profile?.profile_id ?? null });
}

export async function logoutUser(request: FastifyRequest, reply: FastifyReply) {
  const sid = getSidFromRequest(request);
  if (sid) {
    await deleteSessionByTokenHash(request.server.db, sha256(sid));
  }

  clearSessionCookie(reply, request.server.env.NODE_ENV === 'production');
  reply.code(204).send();
}

export async function getMe(request: FastifyRequest, reply: FastifyReply) {
  if (!request.auth) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const user = await findUserById(request.server.db, request.auth.userId);
  if (!user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  reply.code(200).send({ userId: user.id, email: user.email, profileId: request.auth.profileId });
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await attachAuth(request);
  if (!request.auth) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}
