import { requireSession } from '@/lib/auth/current';
import { requireOpAccess } from '@/lib/data/access';
import { AppHeader } from '@/components/AppHeader';
import { OpNav } from '@/components/OpNav';

export default async function OperationLayout(
  { children, params }: { children: React.ReactNode; params: Promise<{ id: string }> },
): Promise<React.ReactNode> {
  const session = await requireSession();
  const { id } = await params;
  const op = await requireOpAccess(id, session);

  return (
    <div className="min-h-screen">
      <AppHeader opName={op.name} userName={session.name} />
      <OpNav opId={id} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
