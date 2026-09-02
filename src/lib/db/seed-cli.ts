/**
 * CLI entry for `npm run db:seed`. Kept separate from seed.ts so that the seed
 * itself pulls in no devDependencies — it is also bundled into the server for
 * the SEED_DEMO boot flag, where tsx and dotenv do not exist.
 */
import { config } from 'dotenv';
import { seed } from './seed';

config({ path: '.env.local' });
config();

seed()
  .then((message) => { console.log(message); process.exit(0); })
  .catch((error) => { console.error('Seed failed:', error); process.exit(1); });
