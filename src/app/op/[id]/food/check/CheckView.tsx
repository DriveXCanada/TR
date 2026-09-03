'use client';

import { useActionState } from 'react';
import { runCheck, type CheckState } from '@/lib/actions/check';
import { SeverityChip } from '@/components/ui';

export function CheckView(
  { operationId, day, slot }: { operationId: string; day: string; slot: string },
): React.ReactNode {
  const [state, action, pending] = useActionState<CheckState, FormData>(runCheck, { ran: false });

  return (
    <div className="space-y-4">
      <form action={action} className="card space-y-3 p-4">
        <input type="hidden" name="operationId" value={operationId} />
        <input type="hidden" name="day" value={day} />
        <input type="hidden" name="slot" value={slot} />
        <div>
          <label className="label" htmlFor="dish">Dish or ingredient list</label>
          <textarea
            id="dish" name="dish" rows={6} className="input font-mono text-sm"
            placeholder={'Paste the label, the recipe, or just type it:\n\npulled pork, brown sugar, worcestershire sauce, buns'}
            defaultValue={state.dishText ?? ''}
            required
          />
          <p className="mt-1 text-xs text-tr-grey">
            Checked against everyone on site for {day} {slot}. Hidden ingredients are resolved — worcestershire counts as fish.
          </p>
        </div>
        {state.error !== undefined && (
          <p role="alert" className="text-sm text-severe">{state.error}</p>
        )}
        <button type="submit" name="action" value="check" data-testid="run-check" className="btn-primary" disabled={pending}>
          {pending ? 'Checking…' : 'Check against the line'}
        </button>
      </form>

      {state.ran && (
        <div
          role="alert"
          className={`rounded-card border-2 p-4 ${
            state.verdict === 'clear'
              ? 'border-ok-border bg-ok-bg'
              : 'border-severe-border bg-severe-bg'
          }`}
        >
          <h2 className={`text-2xl font-black tracking-tight ${
            state.verdict === 'clear' ? 'text-ok' : 'text-severe'
          }`}>
            {state.verdict === 'clear' ? 'CLEAR TO SERVE' : 'HOLD — DO NOT SERVE'}
          </h2>
          <p className="mt-1 text-sm">
            {state.verdict === 'clear'
              ? `No conflicts against the ${state.crewSize} on site for this service.`
              : `${state.conflicts?.length ?? 0} conflict${(state.conflicts?.length ?? 0) === 1 ? '' : 's'} against the ${state.crewSize} on site` +
                (state.severeCount ? ` — ${state.severeCount} SEVERE.` : '.')}
          </p>

          {state.conflicts !== undefined && state.conflicts.length > 0 && (
            <ul className="mt-3 space-y-2">
              {state.conflicts.map((c, i) => (
                <li key={`${c.volunteerId}-${c.tag}-${i}`} className="rounded-md border border-tr-line bg-tr-slate p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityChip severity={c.severity} />
                    <span className="font-semibold text-tr-white">{c.volunteerName}</span>
                    <span className="text-sm text-tr-silver">
                      cannot have <strong className="capitalize">{c.tag.replace('-', ' ')}</strong>
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-tr-silver">
                    Found in: <span className="font-mono">{c.ingredient}</span>
                    {c.via !== undefined && <span className="text-tr-grey"> — {c.via}</span>}
                  </p>
                  {c.note !== null && c.note !== undefined && (
                    <p className="mt-1 text-xs text-tr-grey">{c.note}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {state.unmatchedKeys !== undefined && state.unmatchedKeys.length > 0 && (
            <p className="mt-3 rounded-md border border-intolerance-border bg-intolerance-bg p-2 text-sm text-intolerance">
              Not automatically checked — judge these yourself: {state.unmatchedKeys.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
