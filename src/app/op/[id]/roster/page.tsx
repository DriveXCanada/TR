import { requireSession } from '@/lib/auth/current';
import { loadSnapshot } from '@/lib/data/access';
import { resolveSelection } from '@/lib/view-params';
import { isPresentForSlot, presenceWarnings, PRESENCE_WARNING_TEXT } from '@/lib/presence';
import { ICS_ROLES, SLOTS, SEVERITY_RANK } from '@/lib/domain';
import { SlotSelector } from '@/components/SlotSelector';
import { Card, SeverityChip, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function RosterPage(
  { params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  },
): Promise<React.ReactNode> {
  const session = await requireSession();
  const { id } = await params;
  const { operation, volunteers } = await loadSnapshot(id, session);
  const { days, day, slot } = resolveSelection(operation.startDate, operation.endDate, await searchParams);

  const byRole = ICS_ROLES.map((role) => ({
    role,
    people: volunteers.filter((v) => v.icsRole === role),
  })).filter((g) => g.people.length > 0);

  return (
    <div className="space-y-6">
      <SlotSelector days={days} slots={SLOTS} day={day} slot={slot} />
      <p className="text-sm text-tr-grey">
        {volunteers.length} on the roster. Highlighted rows are on site for <strong>{day} {slot}</strong>.
      </p>

      {byRole.length === 0 ? <Empty>No volunteers yet. Share the kiosk QR from Settings.</Empty> : byRole.map((group) => (
        <Card key={group.role} title={group.role} subtitle={`${group.people.length} assigned`}>
          <ul className="divide-y divide-black/5">
            {group.people.map((v) => {
              const present = isPresentForSlot(v, day, slot, operation.mealSchedule);
              const warnings = presenceWarnings(v);
              const sorted = [...v.restrictions].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
              return (
                <li key={v.id} className={`py-3 ${present ? '' : 'opacity-45'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-tr-charcoal">{v.firstName} {v.lastName}</span>
                    {present
                      ? <span className="chip border-tr-red/30 bg-tr-red/10 text-tr-red">On site</span>
                      : <span className="chip chip-preference">Not this service</span>}
                    {v.epipenCarrying && <span className="chip chip-severe">Auto-injector</span>}
                    {sorted.map((r, i) => (
                      <SeverityChip key={`${r.key}-${i}`} severity={r.severity}>{r.key}</SeverityChip>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-tr-grey">
                    {v.arriveDate ?? 'arrival unknown'} {v.arriveMeal ?? ''} → {v.departDate ?? 'open-ended'} {v.departMeal ?? ''}
                    {v.phone !== null && <> · {v.phone}</>}
                  </p>
                  {warnings.map((w) => (
                    <p key={w} className="mt-1 text-xs text-intolerance">{PRESENCE_WARNING_TEXT[w]}</p>
                  ))}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
