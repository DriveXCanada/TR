/**
 * CLI entry for `npm run db:purge`. Kept separate so purge.ts pulls in no
 * devDependencies and can also be called from the server.
 */
import { config } from 'dotenv';
import { runPurge } from './purge';

config({ path: '.env.local' });
config();

const dryRun = process.argv.includes('--dry');
const today = new Date().toISOString().slice(0, 10);

runPurge(today, dryRun)
  .then((result) => {
    for (const line of result.lines) console.log(line);
    console.log(
      `\n${dryRun ? '[dry run] ' : ''}${result.operationsChecked} operation(s) checked · `
      + `${result.operationsPurged} past retention · ${result.volunteersDeleted} volunteer record(s) `
      + `${dryRun ? 'would be deleted' : 'deleted'}.`,
    );
    process.exit(0);
  })
  .catch((error) => { console.error('Purge failed:', error); process.exit(1); });
