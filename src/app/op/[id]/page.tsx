import Link from 'next/link';
import { requireSession } from '@/lib/auth/current';
import { loadSnapshot } from '@/lib/data/access';
import { peoplePresentOnDay, daysBetween } from '@/lib/presence';
import { dailyBudget } from '@/lib/budget';
import { money } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Section chooser. Opening an operation asks one question — which job are you
 * here to do — instead of presenting ten tabs that mix two different roles.
 */
export default async function OperationHome(
  { params }: { params: Promise<{ id: string }> },
): Promise<React.ReactNode> {
  const session = await requireSession();
  const { id } = await params;
  const { operation, volunteers } = await loadSnapshot(id, session);

  const today = new Date().toISOString().slice(0, 10);
  const days = daysBetween(operation.startDate, operation.endDate);
  const day = days.includes(today) ? today : (days[0] ?? operation.startDate);

  const onSite = peoplePresentOnDay(volunteers, day, operation.mealSchedule);
  const severe = volunteers.filter((v) =>
    v.restrictions.some((r) => r.severity === 'severe')).length;
  const budget = dailyBudget(volunteers, day, operation.perPersonPerDay, operation.mealSchedule);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header>
        <p className="eyebrow">{operation.status} · {operation.location}</p>
        <h1 className="mt-1 text-3xl font-black uppercase text-tr-white">{operation.name}</h1>
        <p className="mt-1 text-sm text-tr-grey">
          {operation.startDate} → {operation.endDate} · showing {day}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="On site" value={String(onSite)} />
        <Metric label="Severe allergies" value={String(severe)} alarm={severe > 0} />
        <Metric label="Day budget" value={money(budget, operation.currency)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          href={`/op/${id}/food`}
          eyebrow="Food Unit"
          title="Feed the crew"
          blurb="Safety board, roster, menu planner, shopping list, pre-service checks and the daily brief."
          items={['Severe-allergy board', 'Menu + packed lunches', 'Shopping list & budget', 'Clear-to-serve check']}
        />
        <SectionCard
          href={`/op/${id}/logistics`}
          eyebrow="Logistics"
          title="Equip the crew"
          blurb="PPE and consumables against who is actually on site, kit templates by operation type, movements and staffing."
          items={['PPE demand by size', 'Consumables & resupply', 'Kit templates', 'Travel & staffing']}
        />
      </div>

      <Link href={`/op/${id}/settings`} className="inline-block text-sm text-tr-grey underline hover:text-tr-white">
        Operation settings, team and kiosk QR
      </Link>
    </main>
  );
}

function Metric({ label, value, alarm = false }: { label: string; value: string; alarm?: boolean }): React.ReactNode {
  return (
    <div className={`card p-4 ${alarm ? 'border-severe-border' : ''}`}>
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 text-3xl font-black ${alarm ? 'text-severe' : 'text-tr-white'}`}>{value}</div>
    </div>
  );
}

function SectionCard(
  { href, eyebrow, title, blurb, items }: {
    href: string; eyebrow: string; title: string; blurb: string; items: readonly string[];
  },
): React.ReactNode {
  return (
    <Link
      href={href}
      className="card group relative overflow-hidden p-6 transition hover:border-tr-red focus:outline-none focus:ring-2 focus:ring-tr-red"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-tr-red transition group-hover:w-1.5" />
      <p className="eyebrow text-tr-red-bright">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-black uppercase text-tr-white">{title}</h2>
      <p className="mt-2 text-sm text-tr-grey">{blurb}</p>
      <ul className="mt-4 space-y-1 text-sm text-tr-silver">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <span aria-hidden className="h-1 w-1 rounded-full bg-tr-red" />
            {item}
          </li>
        ))}
      </ul>
      <span className="mt-5 inline-block text-xs font-bold uppercase tracking-wide text-tr-red-bright">
        Open {eyebrow} →
      </span>
    </Link>
  );
}
