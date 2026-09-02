'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { verifyPin } from '@/lib/auth/password';
import { createSession, destroySession, isAuthConfigured } from '@/lib/auth/session';

const credentials = z.object({
  username: z.string().trim().min(1, 'Enter your username.'),
  pin: z.string().min(1, 'Enter your PIN.'),
});

export interface AuthState {
  readonly error?: string;
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isAuthConfigured()) {
    return { error: 'AUTH_SECRET is not configured on this server. Contact your administrator.' };
  }

  const parsed = credentials.safeParse({
    username: formData.get('username'),
    pin: formData.get('pin'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid sign-in.' };
  }

  const db = getDb();
  const found = await db.select().from(schema.users)
    .where(eq(schema.users.username, parsed.data.username)).limit(1);
  const user = found[0];

  // Same message either way — never confirm which usernames exist.
  const rejection: AuthState = { error: 'Incorrect username or PIN.' };
  if (user === undefined || !user.isActive) return rejection;
  if (!(await verifyPin(parsed.data.pin, user.pinHash))) return rejection;

  await createSession({
    userId: user.id, username: user.username, name: user.name, isMaster: user.isMaster,
  });
  redirect('/');
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect('/login');
}
