import Link from 'next/link';
import { requireSession } from '@/lib/auth/current';
import { loadSnapshot } from '@/lib/data/access';
import { resolveSelection } from '@/lib/view-params';
import { crewForSlot, peoplePresentOnDay, daysBetween } from '@/lib/presence';
import { SLOTS } from '@/lib/domain';
import { tallySizes, sizeCompleteness, SCHEMES, SIZE_SCHEMES } from '@/lib/sizes';
import { splitKitAudience } from '@/lib/kit';
import { SlotSelector } from '@/components/SlotSelector';
import { Card, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * PPE sizes for the people actually on site. Built on the same presence engine
 * the Food Unit uses, so the headcount behind a glove count is the same
 * headcount behind a meal count — one source of truth, not two.
 */
export default async function SizesPage(
  { params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  },
): Promise<React.ReactNode> {
  const session = await requireSession();
  const { id } = await params;
  const { operation, volunteers } = await loadSnapshot(id, session);
  const { days, day } = resolveSelection(operation.startDate, operation.endDate, await searchParams);

  const allDays = daysBetween(operation.startDate, operation.endDate);
  // Sizes exist to order PPE, so exempt roles are excluded here too.
  const { drawsKit } = splitKitAudience(volunteers, operation.kitExemptRoles);
  const onDay = [...new Map(
    operation.mealSchedule.flatMap((m) => crewForSlot(drawsKit, day, m, operation.mealSchedule))
      .map((v) => [v.id, v]),
  ).values()];

  const tallies = tallySizes(onDay);
  const coverage = sizeCompleteness(drawsKit);
  const peak = allDays.reduce((max, d) => Math.max(max, peoplePresentOnDay(drawsKit, d, operation.mealSchedule)), 0);
  const everyoneTallies = tallySizes(drawsKit);

  const chase = drawsKit.filter((v) => SIZE_SCHEMES.some((s) => v.sizes[s] === undefined));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-tr-red-bright">Logistics</p>
          <h1 className="mt-1 text-2xl font-black uppercase text-tr-white">PPE sizes</h1>
        </div>
        <SlotSelector days={days} slots={SLOTS} day={day} slot="supper" />
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Figure label={`On site ${day}`} value={String(onDay.length)} />
        <Figure label="Peak on site" value={String(peak)} hint="size the order to this" />
        <Figure label="Sizes complete" value={`${coverage.complete}/${coverage.total}`} />
        <Figure
          label="Nothing recorded"
          value={String(coverage.missing)}
          alarm={coverage.missing > 0}
          hint={coverage.missing > 0 ? 'chase before ordering' : undefined}
        />
      </div>

      {onDay.length === 0 ? (
        <Empty>Nobody is on site on {day}.</Empty>
      ) : (
        <Card title={`Needed for ${day}`} subtitle={`${onDay.length} on site. Order to the peak, not to today.`}>
          <div className="space-y-5">
            {tallies.map((tally) => (
              <div key={tally.scheme}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-tr-silver">{tally.label}</h3>
                  {tally.unknown > 0 && (
                    <span className="chip chip-intolerance">{tally.unknown} unknown</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {tally.counts.filter((c) => c.count > 0).map((c) => (
                    <span key={c.size} className="rounded border border-tr-line bg-tr-raised px-3 py-1.5 text-sm">
                      <span className="font-bold text-tr-white">{c.size}</span>
                      <span className="ml-2 text-tr-grey">x{c.count}</span>
                    </span>
                  ))}
                  {tally.counts.every((c) => c.count === 0) && (
                    <span className="text-sm text-tr-grey">Nobody on site has recorded a {tally.label.toLowerCase()} size.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Whole operation" subtitle="Every volunteer on the roster, regardless of which day they are here. Use this to place the order.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-tr-line text-left">
                <th className="py-2 pr-3 eyebrow">Item</th>
                <th className="px-2 py-2 eyebrow">Sizes needed</th>
                <th className="px-2 py-2 eyebrow text-right">Unknown</th>
              </tr>
            </thead>
            <tbody>
              {everyoneTallies.map((tally) => (
                <tr key={tally.scheme} className="border-b border-tr-line align-top">
                  <td className="py-2 pr-3 font-bold text-tr-white">{tally.label}</td>
                  <td className="px-2 py-2">
                    {tally.counts.filter((c) => c.count > 0).map((c) => `${c.size}×${c.count}`).join('  ·  ') || '—'}
                  </td>
                  <td className={`px-2 py-2 text-right ${tally.unknown > 0 ? 'text-intolerance' : 'text-tr-grey'}`}>
                    {tally.unknown}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-tr-grey">
          Unknown is never folded into a size. Guessing produces kit nobody can wear; counting it separately
          produces a phone call, which is the right outcome.
        </p>
      </Card>

      {chase.length > 0 && (
        <Card title={`Chase ${chase.length}`} subtitle="On the roster with at least one size missing.">
          <ul className="flex flex-wrap gap-2 text-sm">
            {chase.map((v) => (
              <li key={v.id} className="rounded border border-tr-line bg-tr-raised px-2 py-1">
                <span className="text-tr-white">{v.firstName} {v.lastName}</span>
                <span className="ml-2 text-xs text-tr-grey">
                  {SIZE_SCHEMES.filter((s) => v.sizes[s] === undefined).map((s) => SCHEMES[s].label).join(', ')}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-tr-grey">
            Sizes are collected on the volunteer sign-in form — the same link sent with dispatch orders.
            A lead can also set them on the{' '}
            <Link href={`/op/${id}/food/roster`} className="underline hover:text-tr-white">roster</Link>.
          </p>
        </Card>
      )}
    </div>
  );
}

function Figure({ label, value, hint, alarm = false }: {
  label: string; value: string; hint?: string; alarm?: boolean;
}): React.ReactNode {
  return (
    <div className={`card p-4 ${alarm ? 'border-severe-border' : ''}`}>
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 text-3xl font-black ${alarm ? 'text-severe' : 'text-tr-white'}`}>{value}</div>
      {hint !== undefined && <div className="mt-0.5 text-xs text-tr-grey">{hint}</div>}
    </div>
  );
}
