import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomUUID } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { prisma } from '@/lib/db';
import type { Role } from '@prisma/client';

const COOKIE_NAME = 'kapila_session';
const SESSION_TTL_DAYS = 30;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is not configured. Set a long random value in .env.');
  }
  return new TextEncoder().encode(secret);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionPayload {
  sub: string; // userId
  role: Role;
  sid: string; // Session row id
}

/**
 * Creates a persisted Session row + a signed JWT cookie for it. The JWT
 * carries the session id (`sid`); every request re-checks that the
 * matching Session row is still un-revoked and un-expired, so
 * "logout from all devices" takes effect immediately rather than waiting
 * for JWTs to naturally expire.
 */
export async function createSession(userId: string, role: Role) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const hdrs = await headers();
  const userAgent = hdrs.get('user-agent') ?? undefined;
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;

  const placeholderToken = randomUUID();
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(placeholderToken), // replaced below once JWT is known
      userAgent,
      ip,
      expiresAt,
    },
  });

  const token = await new SignJWT({ role } satisfies Omit<SessionPayload, 'sub' | 'sid'>)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setJti(session.id)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecret());

  await prisma.session.update({ where: { id: session.id }, data: { tokenHash: hashToken(token) } });

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return { sessionId: session.id, token };
}

export interface CurrentUser {
  userId: string;
  role: Role;
  sessionId: string;
}

/** Reads + verifies the session cookie for the current request. Returns null if absent/invalid/revoked. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = payload.sub;
    const sessionId = payload.jti;
    const role = (payload as Record<string, unknown>).role as Role | undefined;
    if (!userId || !sessionId || !role) return null;

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) return null;
    if (session.tokenHash !== hashToken(token)) return null;

    // Best-effort liveness ping; failure here should never break the request.
    prisma.session
      .update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);

    return { userId, role, sessionId };
  } catch {
    return null;
  }
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  jar.delete(COOKIE_NAME);
  if (!token) return;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.jti) {
      await prisma.session.update({ where: { id: payload.jti }, data: { revokedAt: new Date() } }).catch(() => undefined);
    }
  } catch {
    // token already invalid — nothing to revoke
  }
}

/** Logout from all devices: revokes every active session for a user. */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
