import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/current';
import { getDb, schema } from '@/lib/db';
import { ConceptBanner, PoweredByDriveX, Wordmark } from '@/components/Brand';
import { signOut } from '@/lib/actions/auth';

export const dynamic = 'force-dynamic';

export default async function OperationsPage(): Promise<React.ReactNode> {
  const session = await requireSession();
  const db = getDb();
  const ops = await db.select().from(schema.operations).orderBy(desc(schema.operations.startDate));

  return (
    <main className="min-h-screen">
      <ConceptBanner />
      <header className="bg-tr-charcoal px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <Wordmark subtitle="Field Operations" />
          <form action={signOut}>
            <button className="text-xs text-white/70 underline hover:text-white" type="submit">
              Sign out ({session.name})
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold text-tr-charcoal">Operations</h1>

        {ops.length === 0 ? (
          <div className="card p-6 text-sm text-tr-grey">
            No operations yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {ops.map((op) => (
              <li key={op.id}>
                <Link href={`/op/${op.id}`} className="card block p-4 transition hover:border-tr-red">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-tr-charcoal">{op.name}</span>
                    <span className="text-xs uppercase tracking-wide text-tr-grey">{op.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-tr-grey">
                    {op.location} · {op.startDate} → {op.endDate} · {op.currency} {op.perPersonPerDay}/person/day
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8"><PoweredByDriveX /></p>
      </div>
    </main>
  );
}
