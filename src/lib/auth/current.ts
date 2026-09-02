import { redirect } from 'next/navigation';
import { getSession, type SessionPayload } from './session';

/** Server-component guard: returns the session or sends the user to /login. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (session === null) redirect('/login');
  return session;
}
