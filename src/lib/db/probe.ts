/**
 * Database reachability probe.
 *
 * A field team locked out by a configuration error has no recourse and no
 * access to server logs. An opaque "Application error" digest tells an
 * administrator nothing, so every entry point that needs the database reports
 * *which* part of the setup is wrong instead.
 */
import { sql } from 'drizzle-orm';
import { getDb } from './index';

export type DbState = 'ready' | 'no-schema' | 'unreachable' | 'unconfigured';

export interface DbProbe {
  readonly state: DbState;
  /** Safe to show an operator. Never contains credentials. */
  readonly message: string;
}

const MESSAGES: Record<DbState, string> = {
  ready: 'Database reachable and migrated.',
  'no-schema': 'The database is reachable but has no tables — migrations have not run. '
    + 'Check the release/pre-deploy step ran `npm run db:migrate:deploy` and look for "Migrations up to date." in the deploy log.',
  unreachable: 'The database is configured but cannot be reached. Check that DATABASE_URL points at the '
    + 'Postgres service in this same project and that the service reference matches its exact name.',
  unconfigured: 'DATABASE_URL is not set on this service.',
};

export async function probeDatabase(): Promise<DbProbe> {
  if (!process.env.DATABASE_URL) {
    return { state: 'unconfigured', message: MESSAGES.unconfigured };
  }
  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    try {
      await db.execute(sql`select 1 from users limit 1`);
      return { state: 'ready', message: MESSAGES.ready };
    } catch {
      return { state: 'no-schema', message: MESSAGES['no-schema'] };
    }
  } catch {
    return { state: 'unreachable', message: MESSAGES.unreachable };
  }
}
