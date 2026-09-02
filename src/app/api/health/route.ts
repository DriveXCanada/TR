/**
 * Liveness endpoint for the Railway healthcheck.
 *
 * Answers 200 as soon as the server can serve a request. Database state is
 * reported but never gates the response: migrations run in the release phase, so
 * a genuinely broken database already fails the deploy, and failing the
 * healthcheck on a transient blip would restart a server that is still feeding
 * a field team.
 *
 * The `database` field doubles as the first diagnostic an operator reaches for,
 * so it distinguishes "not configured" from "unreachable" from "no tables yet".
 */
import { NextResponse } from 'next/server';
import { probeDatabase } from '@/lib/db/probe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const probe = await probeDatabase();
  return NextResponse.json(
    {
      status: 'ok',
      database: probe.state,
      detail: probe.message,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
