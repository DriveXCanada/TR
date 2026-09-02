/**
 * Server startup hook. Runs only in the Node.js runtime — never at build time,
 * never on the edge. Failures are logged, never fatal: a boot-time hiccup must
 * not take the console down for a field team.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (!process.env.DATABASE_URL) {
    console.log('[boot] DATABASE_URL not set — skipping master bootstrap.');
    return;
  }
  try {
    const { ensureMaster } = await import('./lib/db/bootstrap-master');
    console.log(`[boot] ${await ensureMaster()}`);
  } catch (err) {
    console.error('[boot] master bootstrap failed:', err);
  }
}
