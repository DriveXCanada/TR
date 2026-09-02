import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { loadSnapshot } from '@/lib/data/access';
import { SEVERITY_RANK } from '@/lib/domain';

export const dynamic = 'force-dynamic';

function cell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET(
  _req: Request, { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (session === null) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await params;
  const { volunteers } = await loadSnapshot(id, session);

  const header = [
    'Last name', 'First name', 'ICS role', 'Phone', 'Arrive date', 'Arrive meal',
    'Depart date', 'Depart meal', 'Auto-injector', 'Auto-injector location', 'Restrictions',
  ];
  const rows = volunteers.map((v) => [
    v.lastName, v.firstName, v.icsRole, v.phone ?? '',
    v.arriveDate ?? '', v.arriveMeal ?? '', v.departDate ?? '', v.departMeal ?? '',
    v.epipenCarrying ? 'YES' : '', v.epipenLocation ?? '',
    [...v.restrictions]
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
      .map((r) => `${r.severity.toUpperCase()}:${r.key}${r.note === null ? '' : ` (${r.note})`}`)
      .join(' | '),
  ]);

  const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="roster-safety-${id}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
