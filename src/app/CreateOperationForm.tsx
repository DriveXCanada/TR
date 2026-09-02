'use client';

import { useActionState } from 'react';
import { createOperation, type AdminState } from '@/lib/actions/admin';

export function CreateOperationForm(): React.ReactNode {
  const [state, action, pending] = useActionState<AdminState, FormData>(createOperation, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm"><span className="label">Operation name</span>
        <input name="name" className="input" placeholder="OP MAPLE SHIELD" required /></label>
      <label className="text-sm"><span className="label">Location</span>
        <input name="location" className="input" placeholder="Riverbend Community Centre, MB" required /></label>
      <label className="text-sm"><span className="label">Start date</span>
        <input name="startDate" type="date" className="input" required /></label>
      <label className="text-sm"><span className="label">End date</span>
        <input name="endDate" type="date" className="input" required /></label>
      <label className="text-sm"><span className="label">Per person per day (CAD)</span>
        <input name="perPersonPerDay" className="input" inputMode="decimal" defaultValue="25.00" required /></label>
      <div className="flex items-end">
        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? 'Creating…' : 'Create operation'}
        </button>
      </div>
      {state.error !== undefined && (
        <p role="alert" className="sm:col-span-2 text-sm text-severe">{state.error}</p>
      )}
      {state.ok !== undefined && (
        <p role="status" className="sm:col-span-2 text-sm text-emerald-700">{state.ok}</p>
      )}
    </form>
  );
}
