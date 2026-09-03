import { requireSession } from '@/lib/auth/current';
import { loadSnapshot } from '@/lib/data/access';
import { resolveSelection } from '@/lib/view-params';
import { crewForSlot } from '@/lib/presence';
import { SLOTS } from '@/lib/domain';
import { SlotSelector } from '@/components/SlotSelector';
import { CheckView } from './CheckView';

export const dynamic = 'force-dynamic';

export default async function CheckPage(
  { params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  },
): Promise<React.ReactNode> {
  const session = await requireSession();
  const { id } = await params;
  const { operation, volunteers } = await loadSnapshot(id, session);
  const { days, day, slot } = resolveSelection(operation.startDate, operation.endDate, await searchParams);
  const crew = crewForSlot(volunteers, day, slot, operation.mealSchedule);

  return (
    <div className="space-y-5">
      <SlotSelector days={days} slots={SLOTS} day={day} slot={slot} />
      <p className="text-sm text-tr-grey">
        Checking against the <strong>{crew.length}</strong> on site for {day} {slot}.
      </p>
      <CheckView operationId={id} day={day} slot={slot} />
    </div>
  );
}
