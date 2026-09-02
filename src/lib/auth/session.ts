/**
 * Session cookie. Signed JWT, httpOnly, no email and no third party.
 *
 * A missing AUTH_SECRET must never 500 the login page — a field team locked out
 * by a config error has no recourse. We surface the misconfiguration instead.
 */
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

const COOKIE = 'drivex_session';
const MAX_AGE_SECONDS = 60 * 60 * 12;

export interface SessionPayload {
  readonly userId: string;
  readonly username: string;
  readonly name: string;
  readonly isMaster: boolean;
}

export function authSecret(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET;
  if (secret === undefined || secret.trim().length < 16) return null;
  return new TextEncoder().encode(secret);
}

export function isAuthConfigured(): boolean {
  return authSecret() !== null;
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const key = authSecret();
  if (key === null) throw new Error('AUTH_SECRET is not configured.');
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key);

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const key = authSecret();
  if (key === null) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (token === undefined) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    const { userId, username, name, isMaster } = payload as Record<string, unknown>;
    if (typeof userId !== 'string' || typeof username !== 'string') return null;
    return {
      userId,
      username,
      name: typeof name === 'string' ? name : username,
      isMaster: isMaster === true,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
