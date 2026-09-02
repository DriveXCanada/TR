'use client';

import { useActionState } from 'react';
import { purgeNow, type PurgeState } from '@/lib/actions/settings';

export function PurgePanel(
  { operationId, operationName, volunteerCount }: { operationId: string; operationName: string; volunteerCount: number },
): React.ReactNode {
  const [state, action, pending] = useActionState<PurgeState, FormData>(purgeNow, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="operationId" value={operationId} />
      <p className="text-sm text-tr-ink">
        Permanently deletes all <strong>{volunteerCount}</strong> volunteer records and their dietary and
        medical data for this operation. This cannot be undone and there is no backup.
      </p>
      <label className="text-sm block">
        <span className="label">Type <code>{operationName}</code> to confirm</span>
        <input name="confirm" className="input" autoComplete="off" />
      </label>
      {state.error !== undefined && (
        <p role="alert" className="text-sm text-severe">{state.error}</p>
      )}
      {state.deleted !== undefined && (
        <p role="status" className="text-sm text-emerald-700">
          Purged {state.deleted} volunteer record(s).
        </p>
      )}
      <button type="submit" className="btn bg-severe text-white hover:bg-severe/90" disabled={pending}>
        {pending ? 'Purging…' : 'Purge now'}
      </button>
    </form>
  );
}
