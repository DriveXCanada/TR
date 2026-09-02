import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { loadSnapshot } from '@/lib/data/access';
import { shoppingListForOperation } from '@/lib/shopping-from-menu';
import { shoppingListToCsv } from '@/lib/shopping';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request, { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (session === null) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await params;
  const snapshot = await loadSnapshot(id, session);
  const csv = shoppingListToCsv(shoppingListForOperation(snapshot));

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="shopping-${id}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
