import { requireSession } from '@/lib/auth/current';
import { loadSnapshot } from '@/lib/data/access';
import { Card, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function TravelPage(
  { params }: { params: Promise<{ id: string }> },
): Promise<React.ReactNode> {
  const session = await requireSession();
  const { id } = await params;
  const { travel } = await loadSnapshot(id, session);

  const groups = [
    { key: 'inbound' as const, label: 'Inbound' },
    { key: 'outbound' as const, label: 'Outbound' },
  ];

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const rows = travel.filter((t) => t.direction === group.key);
        return (
          <Card key={group.key} title={group.label} subtitle={`${rows.length} movement${rows.length === 1 ? '' : 's'}`}>
            {rows.length === 0 ? <Empty>Nothing recorded.</Empty> : (
              <ul className="divide-y divide-black/5">
                {rows.map((t) => (
                  <li key={t.id} className="py-3">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium text-tr-charcoal">{t.day}</span>
                      <span className="text-sm text-tr-ink">{t.fromLoc ?? '?'} → {t.toLoc ?? '?'}</span>
                      {t.flight !== null && <span className="chip chip-preference">{t.flight}</span>}
                    </div>
                    <p className="mt-1 text-xs text-tr-grey">
                      {t.dep !== null && <>dep {t.dep} </>}{t.arr !== null && <>arr {t.arr} </>}
                      {t.rental !== null && <>· {t.rental} </>}
                      {t.notes !== null && <>· {t.notes}</>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
