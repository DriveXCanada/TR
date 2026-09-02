/**
 * Liveness endpoint for the Railway healthcheck.
 *
 * Answers 200 as soon as the server can serve a request. Database state is
 * reported but never gates the response: migrations run in the release phase, so
 * a genuinely broken database already fails the deploy, and failing the
 * healthcheck on a transient blip would restart a server that is still feeding
 * a field team.
 */
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function databaseStatus(): Promise<'up' | 'down' | 'unconfigured'> {
  if (!process.env.DATABASE_URL) return 'unconfigured';
  try {
    await getDb().execute(sql`select 1`);
    return 'up';
  } catch {
    return 'down';
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: 'ok',
      database: await databaseStatus(),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
