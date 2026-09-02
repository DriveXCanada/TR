/**
 * Database client. Lazily constructed so `next build`, unit tests and any
 * client-side import never force a connection.
 */
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type Db = PostgresJsDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __drivexDb: Db | undefined;
}

let cached: Db | undefined = globalThis.__drivexDb;

export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. See .env.example.');
  const db = drizzle(postgres(url, { max: 10, prepare: false }), { schema });
  cached = db;
  if (process.env.NODE_ENV !== 'production') globalThis.__drivexDb = db;
  return db;
}

export { schema };
