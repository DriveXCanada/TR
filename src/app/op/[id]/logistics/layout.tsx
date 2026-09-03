import { OpNav } from '@/components/OpNav';

export default async function LogisticsLayout(
  { children, params }: { children: React.ReactNode; params: Promise<{ id: string }> },
): Promise<React.ReactNode> {
  const { id } = await params;
  return (
    <>
      <OpNav opId={id} section="logistics" />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
