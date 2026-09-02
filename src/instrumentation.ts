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

  // Optional one-time sample data for a demo deployment. `npm run db:seed`
  // needs tsx, which is pruned in production, so this flag is the only way to
  // load the sample on a hosted instance. Set it, redeploy, then remove it.
  const flag = (process.env.SEED_DEMO ?? '').trim().toLowerCase();
  if (!['true', '1', 'yes', 'on'].includes(flag)) return;
  try {
    const { seed } = await import('./lib/db/seed');
    console.log(`[boot] ${await seed()}`);
  } catch (err) {
    console.error('[boot] demo seed failed:', err);
  }
}
