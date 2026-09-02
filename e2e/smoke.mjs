/**
 * End-to-end smoke test against a running server and a seeded database.
 *
 *   npm run build && npm start          # in one shell
 *   BASE_URL=http://127.0.0.1:3000 OP_ID=<uuid> npm run test:e2e
 *
 * Not part of CI — it needs a database and a browser. It exists because the
 * safety behaviour that matters (who is in the line, what trips a HOLD) is only
 * really proven in a browser against real data.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const OP = process.env.OP_ID;
const USER = process.env.E2E_USER ?? 'ful';
const PIN = process.env.E2E_PIN ?? '2468';
const EXECUTABLE = process.env.CHROMIUM_PATH;

if (OP === undefined) {
  console.error('OP_ID is required — the uuid of a seeded operation.');
  process.exit(1);
}

const browser = await chromium.launch({
  ...(EXECUTABLE !== undefined ? { executablePath: EXECUTABLE } : {}),
  // Localhost must not be routed through an outbound proxy.
  args: ['--no-proxy-server'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('response', (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });

const go = (path) => page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
/** Page content only — the header shows the signed-in user's name and would pollute assertions. */
const body = async () => page.locator('main').innerText();

let failures = 0;
async function step(name, fn) {
  try { const out = await fn(); console.log(`PASS  ${name}${out ? ` — ${out}` : ''}`); }
  catch (e) { failures += 1; console.log(`FAIL  ${name} — ${e.message.split('\n')[0]}`); }
}

await step('login page renders', async () => {
  await go('/login');
  await page.waitForSelector('#username');
  return page.title();
});

await step('sign in', async () => {
  await page.fill('#username', USER);
  await page.fill('#pin', PIN);
  await Promise.all([page.waitForURL(`${BASE}/`, { timeout: 20000 }), page.click('button[type=submit]')]);
  return page.url();
});

await step('operations list shows the seeded operation', async () => {
  if (!(await body()).includes('MAPLE SHIELD')) throw new Error('seeded operation not listed');
  return 'visible';
});

await step('board: supper excludes a volunteer who departed after lunch', async () => {
  await go(`/op/${OP}?day=2026-03-05&slot=supper`);
  await page.waitForSelector('text=/on site/i');
  if ((await body()).includes('Priya')) throw new Error('still shown at supper after departing at lunch');
  return 'correctly absent';
});

await step('board: lunch includes her, with a severe banner', async () => {
  await go(`/op/${OP}?day=2026-03-05&slot=lunch`);
  await page.waitForSelector('text=/on site/i');
  const t = await body();
  if (!t.includes('Priya')) throw new Error('missing at lunch on her departure day');
  if (!/SEVERE/i.test(t)) throw new Error('no severe banner');
  return 'present + severe banner';
});

await step('board shows auto-injector locations', async () => {
  const t = await body();
  if (!/auto-?injectors on site/i.test(t)) throw new Error('no auto-injector block');
  if (!/belt pouch/i.test(t)) throw new Error('location text missing');
  return 'block + location';
});

await step('board shows headcount and a day budget', async () => {
  const m = (await body()).match(/CAD\s[\d.]+/);
  if (m === null) throw new Error('no budget figure');
  return `budget ${m[0]}`;
});

for (const [name, path, expected] of [
  ['roster', '/roster', /on the roster/i],
  ['resources', '/resources', /demand vs actual/i],
  ['travel', '/travel', /inbound/i],
]) {
  await step(`${name} page renders`, async () => {
    await go(`/op/${OP}${path}`);
    await page.waitForSelector('main');
    if (!expected.test(await body())) throw new Error(`expected content missing (${expected})`);
    return 'ok';
  });
}

await step('check: worcestershire on pulled pork -> HOLD, explained as anchovy', async () => {
  await go(`/op/${OP}/check?day=2026-03-05&slot=lunch`);
  await page.waitForSelector('#dish');
  await page.fill('#dish', 'pulled pork, brown sugar, worcestershire sauce, buns');
  await page.click('[data-testid=run-check]');
  await page.waitForSelector('text=/HOLD/i', { timeout: 20000 });
  await page.waitForSelector('text=/anchovy in worcestershire/i', { timeout: 20000 });
  await page.waitForSelector('text=/Devon Achterberg/', { timeout: 20000 });
  return 'HOLD + derivation + fish-allergic volunteer flagged';
});

await step('check: PB&J trips the peanut allergy', async () => {
  await go(`/op/${OP}/check?day=2026-03-05&slot=lunch`);
  await page.waitForSelector('#dish');
  await page.fill('#dish', 'PB&J sandwich: bread, peanut butter, jam');
  await page.click('[data-testid=run-check]');
  await page.waitForSelector('text=/HOLD/i', { timeout: 20000 });
  await page.waitForSelector('text=/Priya Ondaatje-Bell/', { timeout: 20000 });
  return 'HOLD + peanut-allergic volunteer flagged';
});

await step('check: a safe dish is CLEAR TO SERVE', async () => {
  await go(`/op/${OP}/check?day=2026-03-05&slot=supper`);
  await page.waitForSelector('#dish');
  await page.fill('#dish', 'rice, carrots, salt');
  await page.click('[data-testid=run-check]');
  await page.waitForSelector('text=/CLEAR TO SERVE/i', { timeout: 20000 });
  return 'CLEAR';
});

await step('an unauthenticated visitor cannot reach the board', async () => {
  const ctx = await browser.newContext();
  const anon = await ctx.newPage();
  await anon.goto(`${BASE}/op/${OP}`, { waitUntil: 'domcontentloaded' });
  const url = anon.url();
  await ctx.close();
  if (!url.includes('/login')) throw new Error(`expected /login, got ${url}`);
  return 'redirected to /login';
});

await step('no page errors and no 5xx responses', async () => {
  if (errors.length > 0) throw new Error(errors.join(' | '));
  return 'clean';
});

await browser.close();
console.log(failures === 0 ? '\nAll e2e checks passed.' : `\n${failures} e2e check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
