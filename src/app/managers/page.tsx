import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireSession } from '@/lib/auth/current';
import { getDb, schema } from '@/lib/db';
import { probeDatabase } from '@/lib/db/probe';
import { AppHeader } from '@/components/AppHeader';
import { SetupError } from '@/components/SetupError';
import { Card, Empty } from '@/components/ui';
import { CreateManagerForm, ManagerRowActions, type ManagerRow } from './ManagersClient';

export const dynamic = 'force-dynamic';

export default async function ManagersPage(): Promise<React.ReactNode> {
  const session = await requireSession();
  if (!session.isMaster) redirect('/');

  const probe = await probeDatabase();
  if (probe.state !== 'ready') return <SetupError message={probe.message} />;

  const db = getDb();
  const [users, memberships, operations] = await Promise.all([
    db.select().from(schema.users),
    db.select().from(schema.operationMembers),
    db.select().from(schema.operations),
  ]);

  const opName = new Map(operations.map((o) => [o.id, o.name]));
  const rows: ManagerRow[] = users
    .map((u) => ({
      id: u.id, username: u.username, name: u.name,
      isMaster: u.isMaster, isActive: u.isActive,
      operations: memberships
        .filter((m) => m.userId === u.id)
        .map((m) => `${opName.get(m.operationId) ?? 'Unknown'} (${m.role})`),
    }))
    .sort((a, b) => Number(b.isMaster) - Number(a.isMaster) || a.username.localeCompare(b.username));

  return (
    <div className="min-h-screen">
      <AppHeader userName={session.name} />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-tr-charcoal">Accounts</h1>
          <Link href="/" className="text-sm text-tr-grey underline">Back to operations</Link>
        </div>

        <Card title="Add a manager" subtitle="Managers sign in with a username and PIN, and see only the operations you assign them to.">
          <CreateManagerForm />
          <p className="mt-3 text-xs text-tr-grey">
            There is no public sign-up and no email — PINs are handed over in person. Assign a manager to an
            operation from that operation&apos;s <strong>Settings → Team</strong>.
          </p>
        </Card>

        <Card title={`Accounts (${rows.length})`}>
          {rows.length === 0 ? <Empty>No accounts yet.</Empty> : (
            <ul className="divide-y divide-black/5">
              {rows.map((row) => (
                <li key={row.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-tr-charcoal">{row.name}</span>
                    <span className="font-mono text-xs text-tr-grey">{row.username}</span>
                    {row.isMaster && <span className="chip border-tr-red/30 bg-tr-red/10 text-tr-red">Master</span>}
                    {!row.isActive && <span className="chip chip-severe">Deactivated</span>}
                  </div>
                  <p className="mt-1 text-xs text-tr-grey">
                    {row.operations.length === 0
                      ? 'Not assigned to any operation yet.'
                      : row.operations.join(' · ')}
                  </p>
                  {row.isMaster ? (
                    <p className="mt-2 text-xs text-tr-grey">
                      The master account is managed through environment variables, not here — so a mistake on
                      this page can never lock you out.
                    </p>
                  ) : (
                    <ManagerRowActions row={row} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
