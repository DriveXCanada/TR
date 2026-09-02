'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Slot } from '@/lib/domain';

/**
 * Day + slot selector. Drives every downstream view — board, conflicts,
 * headcount, menu and budget all filter through the selection, so it lives in
 * the URL and survives a refresh, a shared link and an offline reload.
 */
export function SlotSelector(
  { days, slots, day, slot }: { days: readonly string[]; slots: readonly Slot[]; day: string; slot: Slot },
): React.ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(next: Partial<{ day: string; slot: string }>): void {
    const q = new URLSearchParams(params.toString());
    if (next.day !== undefined) q.set('day', next.day);
    if (next.slot !== undefined) q.set('slot', next.slot);
    router.push(`${pathname}?${q.toString()}`);
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        <span className="font-medium text-tr-grey">Day</span>
        <select className="input w-auto" value={day} onChange={(e) => go({ day: e.target.value })}>
          {days.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Meal">
        {slots.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => go({ slot: s })}
            className={`rounded-md px-3 py-2 text-sm font-medium capitalize transition ${
              s === slot ? 'bg-tr-red text-white' : 'border border-black/15 bg-white text-tr-ink hover:bg-tr-mist'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
