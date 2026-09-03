'use client';

import { useActionState } from 'react';
import { createManager, resetManagerPin, toggleManagerActive, type AdminState } from '@/lib/actions/admin';

export interface ManagerRow {
  readonly id: string;
  readonly username: string;
  readonly name: string;
  readonly isMaster: boolean;
  readonly isActive: boolean;
  readonly operations: readonly string[];
}

export function CreateManagerForm(): React.ReactNode {
  const [state, action, pending] = useActionState<AdminState, FormData>(createManager, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      <label className="text-sm"><span className="label">Username</span>
        <input name="username" className="input" autoCapitalize="none" required /></label>
      <label className="text-sm"><span className="label">Display name</span>
        <input name="name" className="input" required /></label>
      <label className="text-sm"><span className="label">PIN</span>
        <input name="pin" className="input" inputMode="numeric" required /></label>
      <div className="flex items-end">
        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? 'Creating…' : 'Create manager'}
        </button>
      </div>
      {state.error !== undefined && (
        <p role="alert" className="sm:col-span-4 text-sm text-severe">{state.error}</p>
      )}
      {state.ok !== undefined && (
        <p role="status" className="sm:col-span-4 text-sm text-ok">{state.ok}</p>
      )}
    </form>
  );
}

export function ResetPinForm({ userId }: { userId: string }): React.ReactNode {
  const [state, action, pending] = useActionState<AdminState, FormData>(resetManagerPin, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="text-sm">
        <span className="sr-only">New PIN</span>
        <input name="pin" className="input w-28 py-1 text-sm" inputMode="numeric" placeholder="New PIN" required />
      </label>
      <button type="submit" className="btn-secondary px-2 py-1 text-xs" disabled={pending}>Reset PIN</button>
      {state.error !== undefined && <span className="text-xs text-severe">{state.error}</span>}
      {state.ok !== undefined && <span className="text-xs text-ok">{state.ok}</span>}
    </form>
  );
}

export function ManagerRowActions({ row }: { row: ManagerRow }): React.ReactNode {
  return (
    <div className="mt-2 flex flex-wrap items-end gap-3">
      <ResetPinForm userId={row.id} />
      <form action={toggleManagerActive}>
        <input type="hidden" name="userId" value={row.id} />
        <button type="submit" className="btn-secondary px-2 py-1 text-xs">
          {row.isActive ? 'Deactivate' : 'Reactivate'}
        </button>
      </form>
    </div>
  );
}
