'use client';

import { useActionState } from 'react';
import { signIn, type AuthState } from '@/lib/actions/auth';

export function LoginForm(): React.ReactNode {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, {});

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input id="username" name="username" className="input" autoComplete="username" autoCapitalize="none" required />
      </div>
      <div>
        <label className="label" htmlFor="pin">PIN</label>
        <input
          id="pin" name="pin" type="password" inputMode="numeric"
          className="input" autoComplete="current-password" required
        />
      </div>
      {state.error !== undefined && (
        <p role="alert" className="rounded-md border border-severe-border bg-severe-bg px-3 py-2 text-sm text-severe">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
