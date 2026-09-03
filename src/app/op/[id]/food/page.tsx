import { requireSession } from '@/lib/auth/current';
import { loadSnapshot } from '@/lib/data/access';
import { resolveSelection } from '@/lib/view-params';
import { crewForSlot, presenceWarnings, PRESENCE_WARNING_TEXT, peoplePresentOnDay } from '@/lib/presence';
import { SEVERITY_RANK, SLOTS, type Severity } from '@/lib/domain';
import { dailyBudget } from '@/lib/budget';
import { SlotSelector } from '@/components/SlotSelector';
import { Card, SeverityChip, Stat, Empty, money } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function BoardPage(
  { params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  },
): Promise<React.ReactNode> {
  const session = await requireSession();
  const { id } = await params;
  const snapshot = await loadSnapshot(id, session);
  const { operation, volunteers } = snapshot;
  const { days, day, slot } = resolveSelection(operation.startDate, operation.endDate, await searchParams);

  const crew = crewForSlot(volunteers, day, slot, operation.mealSchedule);
  const onDay = peoplePresentOnDay(volunteers, day, operation.mealSchedule);

  // Every restriction held by someone actually in the line for this service.
  const active = crew.flatMap((v) =>
    v.restrictions.map((r) => ({ ...r, volunteer: v })),
  ).sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  const severe = active.filter((r) => r.severity === 'severe');
  const epipens = crew.filter((v) => v.epipenCarrying);
  const ambiguous = crew
    .map((v) => ({ v, warnings: presenceWarnings(v) }))
    .filter((x) => x.warnings.length > 0);

  const byKey = new Map<string, { key: string; severity: Severity; people: string[] }>();
  for (const r of active) {
    const entry = byKey.get(r.key) ?? { key: r.key, severity: r.severity, people: [] };
    // Keep the worst severity seen for this restriction key.
    if (SEVERITY_RANK[r.severity] < SEVERITY_RANK[entry.severity]) entry.severity = r.severity;
    entry.people.push(`${r.volunteer.firstName} ${r.volunteer.lastName}`);
    byKey.set(r.key, entry);
  }
  const tiles = [...byKey.values()].sort((a, b) =>
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.people.length - a.people.length);

  return (
    <div className="space-y-6">
      <SlotSelector days={days} slots={SLOTS} day={day} slot={slot} />

      {/* The banner is the point of this page. Severe first, unmissable. */}
      {severe.length > 0 ? (
        <div role="alert" className="rounded-card border-2 border-severe-border bg-severe-bg p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-severe">
            <span aria-hidden>▲</span>
            {severe.length} SEVERE {severe.length === 1 ? 'ALLERGY' : 'ALLERGIES'} IN THE LINE
          </h2>
          <p className="mt-1 text-sm text-severe">
            On site for {day} {slot}. Check every dish against these before service.
          </p>
          <ul className="mt-3 space-y-2">
            {severe.map((r, i) => (
              <li key={`${r.volunteer.id}-${r.key}-${i}`} className="rounded-md border border-severe-border bg-tr-slate p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold text-tr-white">
                    {r.volunteer.firstName} {r.volunteer.lastName}
                  </span>
                  <span className="text-xs text-tr-grey">{r.volunteer.icsRole}</span>
                  <SeverityChip severity="severe">{r.key.toUpperCase()}</SeverityChip>
                </div>
                {r.note !== null && <p className="mt-1 text-sm text-tr-silver">{r.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-card border border-tr-line bg-tr-slate p-4 text-sm text-tr-grey">
          No severe allergies among the {crew.length} on site for {day} {slot}. Soft restrictions still apply below.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="On site — this service" value={crew.length} hint={`${day} · ${slot}`} />
        <Stat label="On site — this day" value={onDay} hint="any meal" />
        <Stat
          label="Day budget"
          value={money(dailyBudget(volunteers, day, operation.perPersonPerDay, operation.mealSchedule), operation.currency)}
          hint={`${money(operation.perPersonPerDay, operation.currency)} x ${onDay} on site`}
        />
      </div>

      {epipens.length > 0 && (
        <Card title="Auto-injectors on site" subtitle="Where they are, for this service. Read it before you need it.">
          <ul className="space-y-2">
            {epipens.map((v) => (
              <li key={v.id} className="rounded-md border border-severe-border bg-severe-bg p-3 text-sm">
                <span className="font-semibold text-tr-white">{v.firstName} {v.lastName}</span>
                <span className="ml-2 text-xs text-tr-grey">{v.icsRole}</span>
                <p className="mt-1 text-tr-silver">{v.epipenLocation ?? 'Location not recorded — ask at hand-off.'}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {ambiguous.length > 0 && (
        <Card title="Counted as present, but unconfirmed" subtitle="These stays are ambiguous. We counted them IN rather than risk missing someone.">
          <ul className="space-y-1 text-sm">
            {ambiguous.map(({ v, warnings }) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-tr-white">{v.firstName} {v.lastName}</span>
                {warnings.map((w) => (
                  <span key={w} className="chip chip-intolerance">{PRESENCE_WARNING_TEXT[w]}</span>
                ))}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Restrictions in the line" subtitle={`Everyone on site for ${day} ${slot}, ranked by severity.`}>
        {tiles.length === 0 ? (
          <Empty>No dietary or medical restrictions recorded for this service.</Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {tiles.map((tile) => (
              <li key={tile.key} className={`rounded-md border p-3 ${
                tile.severity === 'severe' ? 'border-severe-border bg-severe-bg'
                  : tile.severity === 'intolerance' ? 'border-intolerance-border bg-intolerance-bg'
                    : 'border-preference-border bg-preference-bg'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold capitalize text-tr-white">{tile.key.replace('-', ' ')}</span>
                  <SeverityChip severity={tile.severity} />
                </div>
                <p className="mt-1 text-xs text-tr-silver">{tile.people.length} on site: {tile.people.join(', ')}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
