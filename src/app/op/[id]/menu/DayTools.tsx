'use client';

import { useState } from 'react';
import { copyDay, loadStarterLibrary } from '@/lib/actions/menu';

export function StarterLibraryButton({ operationId, recipeCount }: { operationId: string; recipeCount: number }): React.ReactNode {
  return (
    <form action={loadStarterLibrary} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="operationId" value={operationId} />
      <button type="submit" className="btn-primary" data-testid="load-starter">
        Load the standard field-kitchen library
      </button>
      <span className="text-xs text-tr-grey">
        {recipeCount === 0
          ? 'Adds ~40 priced ingredients and 20 recipes, including the four packed-lunch options. Nothing to type.'
          : 'Adds anything missing. Existing recipes and ingredients are left exactly as they are.'}
      </span>
    </form>
  );
}

export function CopyDayForm(
  { operationId, fromDay, days }: { operationId: string; fromDay: string; days: readonly string[] },
): React.ReactNode {
  const others = days.filter((d) => d !== fromDay);
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(day: string): void {
    setSelected((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  if (others.length === 0) return null;

  return (
    <form action={copyDay} className="space-y-3">
      <input type="hidden" name="operationId" value={operationId} />
      <input type="hidden" name="fromDay" value={fromDay} />
      {selected.map((day) => <input key={day} type="hidden" name="toDays" value={day} />)}

      <div className="flex flex-wrap gap-1">
        {others.map((day) => (
          <button
            key={day} type="button" onClick={() => toggle(day)}
            className={`rounded-md border px-2 py-1 text-xs ${
              selected.includes(day)
                ? 'border-tr-red bg-tr-red text-white'
                : 'border-black/15 bg-white text-tr-ink hover:bg-tr-mist'
            }`}
          >{day.slice(5)}</button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary text-xs" onClick={() => setSelected(others)}>
          Select all
        </button>
        <button type="button" className="btn-secondary text-xs" onClick={() => setSelected([])}>
          Clear
        </button>
        <button type="submit" className="btn-primary" data-testid="copy-day" disabled={selected.length === 0}>
          Copy {fromDay} to {selected.length} day{selected.length === 1 ? '' : 's'}
        </button>
      </div>

      <p className="text-xs text-tr-grey">
        This <strong>replaces</strong> whatever those days currently have. Servings overrides are not copied —
        headcount differs day to day, so the target days go back to following their own.
      </p>
    </form>
  );
}
