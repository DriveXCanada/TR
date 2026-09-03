import { requireSession } from '@/lib/auth/current';
import { loadSnapshot } from '@/lib/data/access';
import { resolveSelection } from '@/lib/view-params';
import { crewForSlot, peoplePresentOnDay, presenceWarnings, daysBetween } from '@/lib/presence';
import { SEVERITY_RANK, SLOTS, ICS_ROLES, type Severity } from '@/lib/domain';
import { dailyBudget } from '@/lib/budget';
import { costMenu } from '@/lib/menu-cost';
import { checkConflicts } from '@/lib/conflict';
import { SlotSelector } from '@/components/SlotSelector';
import { PrintButton } from './PrintButton';
import { money } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * The daily brief. Written to be PRINTED and pinned up in the kitchen — a field
 * team should not have to hold a phone in one hand while cooking, and the paper
 * copy keeps working when the network does not.
 */
export default async function BriefPage(
  { params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  },
): Promise<React.ReactNode> {
  const session = await requireSession();
  const { id } = await params;
  const snapshot = await loadSnapshot(id, session);
  const { operation, volunteers, recipes, ingredients, menu, travel, demands } = snapshot;
  const { days, day } = resolveSelection(operation.startDate, operation.endDate, await searchParams);

  const allDays = daysBetween(operation.startDate, operation.endDate);
  const costs = costMenu(menu, recipes, ingredients, volunteers, operation, allDays);
  const today = costs.find((c) => c.day === day);
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  const onDay = peoplePresentOnDay(volunteers, day, operation.mealSchedule);
  const dayCrew = operation.mealSchedule.flatMap((m) => crewForSlot(volunteers, day, m, operation.mealSchedule));
  const uniqueCrew = [...new Map(dayCrew.map((v) => [v.id, v])).values()];

  // Everyone with a severe restriction who is on site at any point today.
  const severePeople = uniqueCrew
    .flatMap((v) => v.restrictions.filter((r) => r.severity === 'severe').map((r) => ({ v, r })))
    .sort((a, b) => a.v.lastName.localeCompare(b.v.lastName));
  const epipens = uniqueCrew.filter((v) => v.epipenCarrying);
  const ambiguous = uniqueCrew.filter((v) => presenceWarnings(v).length > 0);

  const restrictionTotals = new Map<string, { severity: Severity; count: number }>();
  for (const v of uniqueCrew) {
    for (const r of v.restrictions) {
      const entry = restrictionTotals.get(r.key) ?? { severity: r.severity, count: 0 };
      if (SEVERITY_RANK[r.severity] < SEVERITY_RANK[entry.severity]) entry.severity = r.severity;
      entry.count += 1;
      restrictionTotals.set(r.key, entry);
    }
  }
  const totals = [...restrictionTotals.entries()]
    .sort((a, b) => SEVERITY_RANK[a[1].severity] - SEVERITY_RANK[b[1].severity] || b[1].count - a[1].count);

  const movements = travel.filter((t) => t.day === day);
  const demandToday = new Map(demands.filter((d) => d.day === day).map((d) => [d.icsRole, d.target]));

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <SlotSelector days={days} slots={SLOTS} day={day} slot="supper" />
        <PrintButton />
      </div>

      <article className="card space-y-5 p-6 print:border-0 print:shadow-none">
        <header className="border-b border-tr-line pb-3">
          <h1 className="text-2xl font-bold text-tr-white">Daily brief — {day}</h1>
          <p className="text-sm text-tr-grey">
            {operation.name} · {operation.location} · Team Rubicon Canada · Powered by DriveX
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label="On site today" value={String(onDay)} />
          <Figure label="Severe allergies" value={String(severePeople.length)} emphasis={severePeople.length > 0} />
          <Figure label="Auto-injectors" value={String(epipens.length)} />
          <Figure
            label="Day budget"
            value={money(dailyBudget(volunteers, day, operation.perPersonPerDay, operation.mealSchedule), operation.currency)}
          />
        </section>

        {/* Safety first, and unmissable in print as well as on screen. */}
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-severe">Safety — read before service</h2>
          {severePeople.length === 0 ? (
            <p className="text-sm text-tr-silver">
              No severe allergies among the {onDay} on site today. Soft restrictions still apply — see the summary below.
            </p>
          ) : (
            <ul className="space-y-2">
              {severePeople.map(({ v, r }, i) => (
                <li key={`${v.id}-${r.key}-${i}`} className="rounded-md border-2 border-severe-border bg-severe-bg p-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-bold text-tr-white">{v.firstName} {v.lastName}</span>
                    <span className="text-xs text-tr-grey">{v.icsRole}</span>
                    <span className="font-bold uppercase text-severe">{r.key}</span>
                  </div>
                  {r.note !== null && <p className="mt-1 text-sm text-tr-silver">{r.note}</p>}
                  <p className="mt-1 text-xs text-tr-silver">
                    On site:{' '}
                    {operation.mealSchedule
                      .filter((m) => crewForSlot([v], day, m, operation.mealSchedule).length > 0)
                      .join(', ') || 'not today'}
                    {v.epipenCarrying && v.epipenLocation !== null && <> · Auto-injector: {v.epipenLocation}</>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {epipens.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-tr-grey">Auto-injector locations</h2>
            <ul className="space-y-1 text-sm">
              {epipens.map((v) => (
                <li key={v.id}>
                  <strong>{v.firstName} {v.lastName}</strong> — {v.epipenLocation ?? 'location not recorded, ask at hand-off'}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-tr-grey">Menu today</h2>
          <div className="space-y-3">
              {SLOTS.map((slot) => {
                const planned = today?.slots.find((s) => s.slot === slot);
                const dishes = planned?.dishes ?? [];
                const crew = crewForSlot(volunteers, day, slot, operation.mealSchedule);
                const plannedIngredients = dishes.flatMap((d) => {
                  const r = d.recipeId === null ? undefined : recipeById.get(d.recipeId);
                  return r === undefined ? [d.name] : [r.name, ...r.ingredients.map((i) => i.name)];
                });
                const conflicts = checkConflicts(plannedIngredients, crew).conflicts;
                const severe = conflicts.filter((c) => c.severity === 'severe');

                return (
                  <div key={slot} className="rounded-md border border-tr-line p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold capitalize text-tr-white">{slot}</span>
                      <span className="text-xs text-tr-grey">
                        {crew.length} to serve · {money(planned?.cost ?? 0, operation.currency)}
                        {slot === 'lunch' && ' · packed, cold'}
                      </span>
                    </div>
                    {dishes.length === 0 ? (
                      <p className="mt-1 text-sm text-severe">Nothing planned.</p>
                    ) : (
                      <ul className="mt-1 list-inside list-disc text-sm text-tr-silver">
                        {dishes.map((d) => <li key={d.id}>{d.name}</li>)}
                      </ul>
                    )}
                    {severe.length > 0 && (
                      <p className="mt-2 rounded border border-severe-border bg-severe-bg px-2 py-1 text-sm font-semibold text-severe">
                        HOLD — {[...new Set(severe.map((c) => `${c.volunteerName} (${c.tag})`))].join(', ')}
                      </p>
                    )}
                  </div>
                );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-tr-grey">Restrictions on site</h2>
          {totals.length === 0 ? (
            <p className="text-sm text-tr-silver">None recorded.</p>
          ) : (
            <p className="text-sm text-tr-silver">
              {totals.map(([key, v], i) => (
                <span key={key}>
                  {i > 0 && ' · '}
                  <strong className={v.severity === 'severe' ? 'text-severe' : ''}>{key}</strong> ×{v.count}
                </span>
              ))}
            </p>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-tr-grey">Movements today</h2>
            {movements.length === 0 ? (
              <p className="text-sm text-tr-silver">None.</p>
            ) : (
              <ul className="space-y-1 text-sm text-tr-silver">
                {movements.map((t) => (
                  <li key={t.id}>
                    <strong className="capitalize">{t.direction}</strong> — {t.fromLoc ?? '?'} → {t.toLoc ?? '?'}
                    {t.flight !== null && ` (${t.flight})`}
                    {t.dep !== null && ` dep ${t.dep}`}
                    {t.notes !== null && ` — ${t.notes}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-tr-grey">Staffing today</h2>
            <ul className="text-sm text-tr-silver">
              {ICS_ROLES.map((role) => {
                const actual = uniqueCrew.filter((v) => v.icsRole === role).length;
                const target = demandToday.get(role) ?? 0;
                if (actual === 0 && target === 0) return null;
                return (
                  <li key={role} className={actual < target ? 'text-severe' : ''}>
                    {role}: {actual}/{target}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {ambiguous.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-intolerance">Unconfirmed stays</h2>
            <p className="text-sm text-tr-silver">
              Counted as present because their stay is ambiguous — confirm with them today:{' '}
              {ambiguous.map((v) => `${v.firstName} ${v.lastName}`).join(', ')}.
            </p>
          </section>
        )}

        <footer className="border-t border-tr-line pt-3 text-xs text-tr-grey">
          Printed from Field Operations. Contains health data on identifiable people — do not leave this
          copy where the public can read it, and destroy it at demobilisation.
        </footer>
      </article>
    </div>
  );
}

function Figure({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }): React.ReactNode {
  return (
    <div className={`rounded-md border p-3 ${emphasis ? 'border-severe-border bg-severe-bg' : 'border-tr-line'}`}>
      <div className="text-xs uppercase tracking-wide text-tr-grey">{label}</div>
      <div className={`mt-0.5 text-xl font-bold ${emphasis ? 'text-severe' : 'text-tr-white'}`}>{value}</div>
    </div>
  );
}
