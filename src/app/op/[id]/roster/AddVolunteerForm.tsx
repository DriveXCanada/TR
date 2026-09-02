'use client';

import { useActionState } from 'react';
import { addVolunteer, type RosterState } from '@/lib/actions/roster';
import { ICS_ROLES, MEALS, SEVERITIES } from '@/lib/domain';

export function AddVolunteerForm(
  { operationId, days }: { operationId: string; days: readonly string[] },
): React.ReactNode {
  const [state, action, pending] = useActionState<RosterState, FormData>(addVolunteer, {});

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="operationId" value={operationId} />

      <label className="text-sm"><span className="label">First name</span>
        <input name="firstName" className="input" required /></label>
      <label className="text-sm"><span className="label">Last name</span>
        <input name="lastName" className="input" required /></label>
      <label className="text-sm"><span className="label">ICS role</span>
        <select name="icsRole" className="input" defaultValue="Core Ops">
          {ICS_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select></label>

      <label className="text-sm"><span className="label">Phone (optional)</span>
        <input name="phone" className="input" inputMode="tel" /></label>
      <label className="text-sm"><span className="label">Arrives</span>
        <select name="arriveDate" className="input" defaultValue={days[0] ?? ''}>
          <option value="">Unknown</option>
          {days.map((d) => <option key={d} value={d}>{d}</option>)}
        </select></label>
      <label className="text-sm"><span className="label">First meal</span>
        <select name="arriveMeal" className="input" defaultValue="breakfast">
          <option value="">Unknown</option>
          {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select></label>

      <label className="text-sm"><span className="label">Departs</span>
        <select name="departDate" className="input" defaultValue="">
          <option value="">Not known yet</option>
          {days.map((d) => <option key={d} value={d}>{d}</option>)}
        </select></label>
      <label className="text-sm"><span className="label">Last meal</span>
        <select name="departMeal" className="input" defaultValue="supper">
          <option value="">Unknown</option>
          {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select></label>
      <label className="flex items-end gap-2 text-sm">
        <span className="flex items-center gap-2 pb-2">
          <input type="checkbox" name="epipenCarrying" value="yes" />
          Carries an auto-injector
        </span>
      </label>

      <label className="text-sm sm:col-span-3"><span className="label">Auto-injector location</span>
        <input name="epipenLocation" className="input" placeholder="e.g. right thigh pocket; spare in the kitchen first-aid box" /></label>

      <fieldset className="sm:col-span-3 rounded-md border border-black/10 p-3">
        <legend className="px-1 text-xs uppercase tracking-wide text-tr-grey">First restriction (optional)</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm"><span className="label">Restriction</span>
            <input name="restrictionKey" className="input" placeholder="peanuts" /></label>
          <label className="text-sm"><span className="label">Severity</span>
            <select name="restrictionSeverity" className="input" defaultValue="severe">
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></label>
          <label className="text-sm"><span className="label">Note</span>
            <input name="restrictionNote" className="input" placeholder="Anaphylaxis" /></label>
        </div>
        <p className="mt-2 text-xs text-tr-grey">
          Add more restrictions from the volunteer&apos;s row once they are on the roster.
        </p>
      </fieldset>

      {state.error !== undefined && (
        <p role="alert" className="sm:col-span-3 text-sm text-severe">{state.error}</p>
      )}
      {state.ok !== undefined && (
        <p role="status" className="sm:col-span-3 text-sm text-emerald-700">{state.ok}</p>
      )}

      <div className="sm:col-span-3">
        <button type="submit" className="btn-primary" data-testid="add-volunteer" disabled={pending}>
          {pending ? 'Adding…' : 'Add volunteer'}
        </button>
      </div>
    </form>
  );
}
