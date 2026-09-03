import Link from 'next/link';
import { requireSession } from '@/lib/auth/current';
import { listOperations } from '@/lib/data/access';
import { ConceptBanner, PoweredByDriveX, Wordmark } from '@/components/Brand';
import { signOut } from '@/lib/actions/auth';
import { probeDatabase } from '@/lib/db/probe';
import { SetupError } from '@/components/SetupError';
import { CreateOperationForm } from './CreateOperationForm';

export const dynamic = 'force-dynamic';

export default async function OperationsPage(): Promise<React.ReactNode> {
  const session = await requireSession();

  const probe = await probeDatabase();
  if (probe.state !== 'ready') return <SetupError message={probe.message} />;

  // Membership-filtered. Listing every operation let a manager see the name,
  // location and dates of operations they are not on, and hand them a link that
  // could only 404.
  const ops = (await listOperations(session))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <main className="min-h-screen">
      <ConceptBanner />
      <header className="bg-tr-black px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <Wordmark subtitle="Field Operations" />
          <div className="flex items-center gap-4">
            {session.isMaster && (
              <Link href="/managers" className="text-xs text-white/70 underline hover:text-white">
                Accounts
              </Link>
            )}
            <form action={signOut}>
              <button className="text-xs text-white/70 underline hover:text-white" type="submit">
                Sign out ({session.name})
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold text-tr-white">Operations</h1>

        {ops.length === 0 ? (
          <div className="card p-6 text-sm text-tr-grey">
            {session.isMaster
              ? 'No operations yet. Create the first one below.'
              : 'You are not assigned to any operation yet. Ask the master account to add you from the operation\u2019s Settings \u2192 Team.'}
          </div>
        ) : (
          <ul className="space-y-3">
            {ops.map((op) => (
              <li key={op.id}>
                <Link href={`/op/${op.id}`} className="card block p-4 transition hover:border-tr-red">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-tr-white">{op.name}</span>
                    <span className="text-xs uppercase tracking-wide text-tr-grey">{op.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-tr-grey">
                    {op.location} · {op.startDate} → {op.endDate} · {op.currency} {op.perPersonPerDay.toFixed(2)}/person/day
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {session.isMaster && (
          <section className="card mt-8 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-tr-grey">New operation</h2>
            <CreateOperationForm />
            <p className="mt-3 text-xs text-tr-grey">
              You become a lead on whatever you create. Add other managers from that operation&apos;s
              Settings &rarr; Team.
            </p>
          </section>
        )}

        <p className="mt-8"><PoweredByDriveX /></p>
      </div>
    </main>
  );
}
