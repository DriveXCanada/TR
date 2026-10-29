/**
 * Every control that looks clickable must do something.
 *
 * The meal buttons used to be drawn on pages that ignored the meal entirely:
 * clicking one rewrote the URL, changed nothing on screen, and left the
 * highlight on a meal you had not chosen. This sweeps every page in an
 * operation and fails on any meal control that cannot act.
 *
 *   BASE_URL=... OP_ID=<uuid> npm run test:e2e:controls
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const OP = process.env.OP_ID;
const USER = process.env.E2E_USER ?? 'ful';
const PIN = process.env.E2E_PIN ?? '2468';

const b = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-proxy-server'],
});
const page = await b.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('response', (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
const go = (p) => page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded' });
let fails = 0;
async function step(n, f) {
  try { const o = await f(); console.log(`PASS  ${n}${o ? ` — ${o}` : ''}`); }
  catch (e) { fails += 1; console.log(`FAIL  ${n} — ${e.message.split('\n')[0]}`); }
}

const PAGES = [
  ['food board', ''],
  ['food roster', '/roster'],
  ['menu', '/menu'],
  ['recipes', '/recipes'],
  ['shopping', '/shopping'],
  ['check', '/check'],
  ['brief', '/brief'],
];
const LOGISTICS = [
  ['logistics overview', ''],
  ['inventory', '/inventory'],
  ['PPE sizes', '/sizes'],
  ['travel', '/travel'],
  ['staffing', '/staffing'],
];

await step('sign in', async () => {
  await go('/login'); await page.waitForSelector('#username');
  await page.fill('#username', USER); await page.fill('#pin', PIN);
  await Promise.all([page.waitForURL(`${BASE}/`, { timeout: 20000 }), page.click('form button[type=submit]')]);
  return 'ok';
});

// Without this, a failed sign-in bounces every page to /login, no page shows a
// meal control, and "no meal control offered" reports a clean sweep against
// screens the suite never actually reached.
if (fails > 0) {
  console.log('\nSign-in failed — stopping rather than reporting passes for pages never reached.');
  await b.close();
  process.exit(1);
}

/** The meal buttons, where a page offers them. */
const meals = () => page.locator('[role=group][aria-label="Meal"] button');

/**
 * Either the page offers no meal control, or clicking one must move the
 * highlight onto what was clicked.
 */
async function assertMealControlActs(label, expectedPath) {
  if (page.url().includes('/login')) throw new Error(`${label}: bounced to the login page`);
  if (!page.url().includes(expectedPath)) {
    throw new Error(`${label}: expected to be on ${expectedPath}, actually ${page.url()}`);
  }
  const body = await page.locator('main').innerText();
  if (body.trim().length < 20) throw new Error(`${label}: page rendered no content to test`);

  const count = await meals().count();
  if (count === 0) return 'no meal control offered';

  const names = await meals().allInnerTexts();
  // Find one that is not already selected.
  let target = -1;
  for (let i = 0; i < count; i += 1) {
    const cls = await meals().nth(i).getAttribute('class') ?? '';
    if (!cls.includes('bg-tr-red')) { target = i; break; }
  }
  if (target === -1) throw new Error(`${label}: every meal button reads as selected`);

  const wanted = (names[target] ?? '').trim().toLowerCase();
  await meals().nth(target).click();
  await page.waitForTimeout(2500);

  const after = await meals().count();
  if (after === 0) throw new Error(`${label}: meal control vanished after clicking "${wanted}"`);
  let selected = null;
  for (let i = 0; i < after; i += 1) {
    const cls = await meals().nth(i).getAttribute('class') ?? '';
    if (cls.includes('bg-tr-red')) selected = (await meals().nth(i).innerText()).trim().toLowerCase();
  }
  if (selected !== wanted) {
    throw new Error(`${label}: clicked "${wanted}" but the selection reads "${selected ?? 'none'}" — the control does nothing`);
  }
  return `"${wanted}" selects`;
}

for (const [label, path] of PAGES) {
  await step(`${label}: a meal control, if offered, acts`, async () => {
    await go(`/op/${OP}/food${path}`);
    await page.waitForSelector('main');
    await page.waitForTimeout(600);
    return assertMealControlActs(label, `/op/${OP}/food${path}`);
  });
}

for (const [label, path] of LOGISTICS) {
  await step(`${label}: a meal control, if offered, acts`, async () => {
    await go(`/op/${OP}/logistics${path}`);
    await page.waitForSelector('main');
    await page.waitForTimeout(600);
    return assertMealControlActs(label, `/op/${OP}/logistics${path}`);
  });
}

await step('the day selector still works where a page reports on a day', async () => {
  await go(`/op/${OP}/logistics/sizes`);
  await page.waitForSelector('main');
  const select = page.locator('select').first();
  if (await select.count() === 0) throw new Error('no day selector on a day-level page');
  const options = await select.locator('option').allInnerTexts();
  if (options.length < 2) throw new Error('only one day to choose from');
  const target = (options[1] ?? '').trim();
  await select.selectOption(target);
  await page.waitForTimeout(2500);
  if (!page.url().includes(`day=${target}`)) throw new Error(`day did not reach the URL: ${page.url()}`);
  const now = await page.locator('select').first().inputValue();
  if (now !== target) throw new Error(`day selector did not hold "${target}"`);
  return `day moved to ${target}`;
});

await step('the planner offers a way to reach each meal on the page', async () => {
  await go(`/op/${OP}/food/menu`);
  await page.waitForSelector('main');
  const jump = page.locator('[role=group][aria-label="Jump to a meal"] a');
  const n = await jump.count();
  if (n === 0) throw new Error('no way to reach a meal further down a page listing every meal');
  for (const slot of ['breakfast', 'lunch', 'supper', 'snack', 'drinks']) {
    const anchor = page.locator(`#slot-${slot}`);
    if (await anchor.count() === 0) throw new Error(`"${slot}" has no section to jump to`);
  }
  // A link that points at nothing is the same dead control in another costume.
  const hrefs = await jump.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  for (const h of hrefs) {
    if (h === null || !h.startsWith('#')) throw new Error(`jump link is not an anchor: ${h}`);
    if (await page.locator(h).count() === 0) throw new Error(`jump link ${h} points at nothing`);
  }
  return `${n} jump links, all resolving`;
});

await step('no 5xx and no page errors', async () => {
  if (errs.length > 0) throw new Error(errs.join(' | '));
  return 'clean';
});

await b.close();
console.log(fails === 0 ? '\nAll control checks passed.' : `\n${fails} failed.`);
process.exit(fails === 0 ? 0 : 1);
