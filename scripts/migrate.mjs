// Release-phase migration runner (Railway preDeployCommand).
//
// Uses ONLY production dependencies (postgres + drizzle-orm) so it runs on the
// deployed server, where devDependencies such as drizzle-kit and tsx are pruned.
// Idempotent: drizzle skips migrations already recorded in __drizzle_migrations.
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set — cannot run migrations.');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
try {
  await migrate(drizzle(sql), { migrationsFolder: './drizzle' });
  console.log('Migrations up to date.');
} catch (err) {
  console.error('Migration failed:', err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
