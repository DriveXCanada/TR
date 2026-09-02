import Link from 'next/link';
import { SLOTS } from '@/lib/domain';
import { money } from '@/components/ui';
import type { DayCost } from '@/lib/menu-cost';

/**
 * The whole plan at a glance. Planning a two-week operation one day at a time
 * with no overview is how gaps get missed — an unplanned supper looks identical
 * to a planned one until someone is hungry.
 */
export function WeekOverview(
  { opId, days, selectedDay, currency }: {
    opId: string; days: readonly DayCost[]; selectedDay: string; currency: string;
  },
): React.ReactNode {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-tr-grey">
            <th className="py-2 pr-3">Day</th>
            {SLOTS.map((slot) => <th key={slot} className="px-2 py-2 capitalize">{slot}</th>)}
            <th className="px-2 py-2 text-right">Cost / budget</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.day} className={`border-b border-black/5 align-top ${
              day.day === selectedDay ? 'bg-tr-red/5' : ''
            }`}>
              <td className="py-2 pr-3 whitespace-nowrap">
                <Link href={`/op/${opId}/menu?day=${day.day}`}
                  className={`underline-offset-2 hover:underline ${
                    day.day === selectedDay ? 'font-semibold text-tr-red' : 'text-tr-charcoal'}`}>
                  {day.day}
                </Link>
              </td>
              {SLOTS.map((slot) => {
                const planned = day.slots.find((s) => s.slot === slot);
                const dishes = planned?.dishes ?? [];
                return (
                  <td key={slot} className="px-2 py-2">
                    {dishes.length === 0 ? (
                      <span className="text-xs text-severe">— nothing —</span>
                    ) : (
                      <ul className="space-y-0.5 text-xs text-tr-ink">
                        {dishes.map((d) => <li key={d.id}>{d.name}</li>)}
                      </ul>
                    )}
                  </td>
                );
              })}
              <td className={`px-2 py-2 text-right whitespace-nowrap ${day.overBudget ? 'text-severe' : 'text-tr-ink'}`}>
                {money(day.cost, currency)}
                <span className="text-tr-grey"> / {money(day.budget, currency)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-tr-grey">
        Red cost means the day is over its budget. &ldquo;— nothing —&rdquo; is an unplanned slot, not an
        intentionally empty one.
      </p>
    </div>
  );
}
