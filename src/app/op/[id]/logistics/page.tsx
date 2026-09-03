import Link from 'next/link';
import { requireSession } from '@/lib/auth/current';
import { loadSnapshot } from '@/lib/data/access';
import { peoplePresentOnDay, daysBetween } from '@/lib/presence';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function LogisticsOverview(
  { params }: { params: Promise<{ id: string }> },
): Promise<React.ReactNode> {
  const session = await requireSession();
  const { id } = await params;
  const { operation, volunteers } = await loadSnapshot(id, session);

  const days = daysBetween(operation.startDate, operation.endDate);
  const today = new Date().toISOString().slice(0, 10);
  const day = days.includes(today) ? today : (days[0] ?? operation.startDate);
  const onSite = peoplePresentOnDay(volunteers, day, operation.mealSchedule);
  const peak = days.reduce((max, d) =>
    Math.max(max, peoplePresentOnDay(volunteers, d, operation.mealSchedule)), 0);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow text-tr-red-bright">Logistics</p>
        <h1 className="mt-1 text-2xl font-black uppercase text-tr-white">Equip the crew</h1>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Figure label={`On site ${day}`} value={String(onSite)} />
        <Figure label="Peak on site" value={String(peak)} hint="drives kit ordering" />
        <Figure label="Operation length" value={`${days.length} days`} />
      </div>

      <Card title="Coming next" subtitle="Built on the same presence engine the Food Unit uses, so headcount is never guessed.">
        <ul className="space-y-3 text-sm">
          <Planned
            title="PPE demand by size"
            detail="Gloves, boots, shirts, masks, hard hats — how many of each size are needed on a given day, from who is actually on site that day."
          />
          <Planned
            title="Consumables and resupply"
            detail="A tablet by the strike-team kit where crews log what they took. Projected burn against stock, flagged early enough to cover the resupply lead time."
          />
          <Planned
            title="Kit templates by operation type"
            detail="Standard loadouts for sifting, muck-out, chainsaw and the rest, so a new operation starts from a known list rather than a blank page."
          />
        </ul>
        <p className="mt-4 text-xs text-tr-grey">
          Sizes come from the volunteer sign-in form, so logistics and the Food Unit read from one intake
          rather than two.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href={`/op/${id}/logistics/travel`} className="card p-4 transition hover:border-tr-red">
          <p className="eyebrow">Available now</p>
          <h2 className="mt-1 text-lg font-black uppercase text-tr-white">Travel</h2>
          <p className="mt-1 text-sm text-tr-grey">Inbound and outbound movements, flights and rentals.</p>
        </Link>
        <Link href={`/op/${id}/logistics/staffing`} className="card p-4 transition hover:border-tr-red">
          <p className="eyebrow">Available now</p>
          <h2 className="mt-1 text-lg font-black uppercase text-tr-white">Staffing</h2>
          <p className="mt-1 text-sm text-tr-grey">Demand against actual, per ICS role, per day.</p>
        </Link>
      </div>
    </div>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }): React.ReactNode {
  return (
    <div className="card p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 text-3xl font-black text-tr-white">{value}</div>
      {hint !== undefined && <div className="mt-0.5 text-xs text-tr-grey">{hint}</div>}
    </div>
  );
}

function Planned({ title, detail }: { title: string; detail: string }): React.ReactNode {
  return (
    <li className="border-l-2 border-tr-line pl-3">
      <span className="font-bold uppercase tracking-wide text-tr-silver">{title}</span>
      <p className="mt-0.5 text-tr-grey">{detail}</p>
    </li>
  );
}
