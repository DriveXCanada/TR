'use client';

import { useState } from 'react';
import { adjustStock, setStock } from '@/lib/actions/kit';
import { formatQty } from '@/lib/kit';

/**
 * Two ways to change stock, because there are two real situations.
 *
 * Most of the time something arrives or gets written off, which is a CHANGE —
 * so that is the default and it takes one tap. Occasionally somebody counts the
 * shelf, which is a NEW TOTAL, and that is behind a second control so the two
 * cannot be confused.
 */
export function StockControl(
  { operationId, itemId, stockOnHand, unit, name }: {
    operationId: string; itemId: string; stockOnHand: number; unit: string; name: string;
  },
): React.ReactNode {
  const [amount, setAmount] = useState('1');
  const [recounting, setRecounting] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="min-w-[3.5rem] font-bold text-tr-white" aria-label={`${name}: ${stockOnHand} ${unit} in stock`}>
          {formatQty(stockOnHand)}
        </span>
        <span className="text-xs text-tr-grey">{unit}</span>
      </div>

      {recounting ? (
        <form action={setStock} className="flex items-center gap-1">
          <input type="hidden" name="operationId" value={operationId} />
          <input type="hidden" name="itemId" value={itemId} />
          <input
            name="stockOnHand" className="input w-20 py-1 text-sm" inputMode="decimal"
            defaultValue={formatQty(stockOnHand)} aria-label={`Counted total for ${name}`} autoFocus
          />
          <button type="submit" className="btn-secondary px-2 py-1 text-xs">Set total</button>
          <button type="button" className="text-xs text-tr-grey underline" onClick={() => setRecounting(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          <form action={adjustStock} className="flex items-center gap-1">
            <input type="hidden" name="operationId" value={operationId} />
            <input type="hidden" name="itemId" value={itemId} />
            <input type="hidden" name="delta" value={`-${amount}`} />
            <button type="submit" className="btn-secondary px-2 py-1 text-sm" aria-label={`Remove ${amount} ${unit} of ${name}`}>−</button>
          </form>
          <input
            className="input w-14 py-1 text-center text-sm" inputMode="decimal" value={amount}
            onChange={(e) => setAmount(e.target.value)} aria-label={`Amount to add or remove for ${name}`}
          />
          <form action={adjustStock} className="flex items-center gap-1">
            <input type="hidden" name="operationId" value={operationId} />
            <input type="hidden" name="itemId" value={itemId} />
            <input type="hidden" name="delta" value={amount} />
            <button type="submit" className="btn-secondary px-2 py-1 text-sm" aria-label={`Add ${amount} ${unit} of ${name}`}>+</button>
          </form>
          <button type="button" className="ml-1 text-xs text-tr-grey underline hover:text-tr-white" onClick={() => setRecounting(true)}>
            Counted it
          </button>
        </div>
      )}
    </div>
  );
}
