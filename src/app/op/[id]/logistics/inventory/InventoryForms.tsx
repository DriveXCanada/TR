'use client';

import { useActionState } from 'react';
import { createKitItem, type KitState } from '@/lib/actions/kit';
import { ISSUE_POLICIES, ISSUE_POLICY_LABELS, KIT_CATEGORIES } from '@/lib/kit';
import { SIZE_SCHEMES, SCHEMES } from '@/lib/sizes';

export function NewItemForm({ operationId }: { operationId: string }): React.ReactNode {
  const [state, action, pending] = useActionState<KitState, FormData>(createKitItem, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="operationId" value={operationId} />
      <label className="text-sm sm:col-span-2"><span className="label">Item</span>
        <input name="name" className="input" placeholder="Nitrile gloves" required /></label>
      <label className="text-sm"><span className="label">Category</span>
        <select name="category" className="input" defaultValue="ppe">
          {KIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select></label>
      <label className="text-sm"><span className="label">Unit</span>
        <input name="unit" className="input" defaultValue="each" required /></label>

      <label className="text-sm sm:col-span-2"><span className="label">How is it issued?</span>
        <select name="issuePolicy" className="input" defaultValue="single_use">
          {ISSUE_POLICIES.map((p) => <option key={p} value={p}>{ISSUE_POLICY_LABELS[p]}</option>)}
        </select></label>
      <label className="text-sm"><span className="label">Every N days</span>
        <input name="intervalDays" className="input" inputMode="numeric" defaultValue="1" /></label>
      <label className="text-sm"><span className="label">Qty per person</span>
        <input name="qtyPerPerson" className="input" inputMode="decimal" defaultValue="1" /></label>

      <label className="text-sm"><span className="label">Sized?</span>
        <select name="sizeScheme" className="input" defaultValue="">
          <option value="">One size</option>
          {SIZE_SCHEMES.map((s) => <option key={s} value={s}>{SCHEMES[s].label}</option>)}
        </select></label>
      <label className="text-sm"><span className="label">Stock on hand</span>
        <input name="stockOnHand" className="input" inputMode="decimal" defaultValue="0" /></label>
      <label className="text-sm"><span className="label">Reorder at</span>
        <input name="reorderLevel" className="input" inputMode="decimal" defaultValue="0" /></label>
      <label className="text-sm"><span className="label">Lead time (days)</span>
        <input name="leadTimeDays" className="input" inputMode="numeric" defaultValue="2" /></label>

      {state.error !== undefined && <p role="alert" className="sm:col-span-4 text-sm text-severe">{state.error}</p>}
      {state.ok !== undefined && <p role="status" className="sm:col-span-4 text-sm text-ok">{state.ok}</p>}
      <div className="sm:col-span-4">
        <button type="submit" className="btn-primary" data-testid="add-kit-item" disabled={pending}>
          {pending ? 'Adding…' : 'Add item'}
        </button>
      </div>
    </form>
  );
}
