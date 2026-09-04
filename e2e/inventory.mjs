/**
 * Logistics inventory: templates, issue policy, stock and the order deadline.
 *
 *   BASE_URL=... OP_ID=<uuid> npm run test:e2e:inventory
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
const main = async () => page.locator('main').innerText();
/** Cards share item names, so every assertion must say which card it means. */
const card = (heading) => page.locator('section').filter({ has: page.locator('h2', { hasText: heading }) }).first();
const cardText = async (heading) => card(heading).innerText();
let fails = 0;
async function step(n, f) {
  try { const o = await f(); console.log(`PASS  ${n}${o ? ` — ${o}` : ''}`); }
  catch (e) { fails += 1; console.log(`FAIL  ${n} — ${e.message.split('\n')[0]}`); }
}

await step('sign in', async () => {
  await go('/login'); await page.waitForSelector('#username');
  await page.fill('#username', USER); await page.fill('#pin', PIN);
  await Promise.all([page.waitForURL(`${BASE}/`, { timeout: 20000 }), page.click('form button[type=submit]')]);
  return 'ok';
});

await step('an empty kit list offers standard loadouts rather than a blank page', async () => {
  await go(`/op/${OP}/logistics/inventory?day=2026-03-04`);
  await page.waitForSelector('text=/inventory/i');
  const t = await main();
  if (!/standard loadouts/i.test(t)) throw new Error('no templates offered');
  for (const label of ['general deployment', 'sifting', 'muck-out', 'chainsaw']) {
    if (!t.toLowerCase().includes(label)) throw new Error(`template missing: ${label}`);
  }
  return 'four loadouts offered';
});

await step('loading the chainsaw loadout populates the kit list', async () => {
  await page.click('[data-testid=load-chainsaw]');
  await page.waitForSelector('text=/needed on/i', { timeout: 30000 });
  const t = await main();
  if (!/chainsaw chaps/i.test(t)) throw new Error('chainsaw-specific PPE missing');
  if (!/steel-toe boots/i.test(t)) throw new Error('base PPE missing from the layered template');
  return 'chainsaw kit loaded, base PPE included';
});

await step('loading a second loadout does not duplicate the base PPE', async () => {
  const count = async () => (await main()).split('Steel-toe boots').length - 1;
  const before = await count();
  await page.click('[data-testid=load-general]');
  await page.waitForSelector('text=/needed on/i', { timeout: 30000 });
  const after = await count();
  if (after !== before) throw new Error(`Steel-toe boots appeared ${before} -> ${after} times`);
  return 'idempotent across templates';
});

await step('THE failure this prevents: boots are not ordered daily', async () => {
  // Per-deployment items are charged on arrival days only, so the daily need
  // table must explain itself rather than show a headcount.
  const needed = await cardText(/needed on/i);
  const lines = needed.split('\n');
  const i = lines.findIndex((l) => /steel-toe boots/i.test(l));
  if (i === -1) throw new Error('boots not in the daily table');
  const context = lines.slice(i, i + 6).join(' ');
  if (!/nobody new arriving|arriving/i.test(context)) {
    throw new Error(`per-deployment basis not shown: ${context}`);
  }

  // And across the whole operation: one pair per person, not one per person per day.
  const whole = await cardText(/whole operation/i);
  const w = whole.split('\n');
  const j = w.findIndex((l) => /steel-toe boots/i.test(l));
  const totals = w.slice(j, j + 3).join(' ');
  if (!/\b50 pair\b/.test(totals)) throw new Error(`expected 50 pair for 50 people, got: ${totals}`);
  return '50 pair total for 50 people, not 50 x days';
});

await step('single-use items DO scale with the day headcount', async () => {
  const t = await main();
  if (!/on site x/i.test(t)) throw new Error('no headcount-based basis shown');
  if (!/nitrile gloves/i.test(t)) throw new Error('consumable missing');
  return 'consumables scale with who is on site';
});

await step('sized items break down by size, unknowns kept separate', async () => {
  const t = await main();
  if (!/unknown/i.test(t)) throw new Error('unknown sizes not surfaced');
  return 'size breakdown present';
});

await step('setting stock produces a shortfall and an order-by date', async () => {
  const row = card(/whole operation/i).locator('tr').filter({ hasText: 'Nitrile gloves' }).first();
  const input = row.locator('input[name=stockOnHand]');
  await input.fill('40');
  await row.locator('button:has-text("Set")').click();
  await page.waitForTimeout(2500);
  const whole = await cardText(/whole operation/i);
  const lines = whole.split('\n');
  const i = lines.findIndex((l) => /nitrile gloves/i.test(l));
  const context = lines.slice(i, i + 8).join(' ');
  if (!/2026-03/.test(context)) throw new Error(`no run-out date for gloves: ${context}`);
  return 'shortfall and deadline computed from stock';
});

await step('the order-now alarm fires when the deadline has passed', async () => {
  const t = await main();
  if (!/order now/i.test(t)) throw new Error('no urgent banner despite a shortfall inside lead time');
  return 'urgent banner shown';
});

await step('an item can be switched between single-use and reusable', async () => {
  const form = card(/edit items/i).locator('form')
    .filter({ has: page.locator('select[name=issuePolicy]') })
    .filter({ has: page.locator('input[name=name][value="Nitrile gloves"]') }).first();
  await form.locator('select[name=issuePolicy]').selectOption('per_deployment');
  await form.locator('button:has-text("Save")').click();
  await page.waitForTimeout(3000);
  const needed = (await cardText(/needed on/i)).split('\n');
  const i = needed.findIndex((l) => /nitrile gloves/i.test(l));
  const ctx = needed.slice(i, i + 6).join(' ');
  if (!/once|arriving|nobody new/i.test(ctx)) throw new Error(`policy change did not take effect: ${ctx}`);
  return 'switched to per-deployment and the maths followed';
});

await step('exempting a role removes it from kit counts', async () => {
  await go(`/op/${OP}/logistics/inventory?day=2026-03-04`);
  await page.waitForSelector('text=/needed on/i');
  const readGloves = async () => {
    const lines = (await cardText(/needed on/i)).split('\n');
    const i = lines.findIndex((l) => /nitrile gloves/i.test(l));
    const m = lines.slice(i, i + 6).join(' ').match(/(\d+)\s+on site/);
    return m === null ? -1 : Number(m[1]);
  };
  const before = await readGloves();
  if (before <= 0) throw new Error(`could not read the baseline headcount (${before})`);

  await go(`/op/${OP}/logistics/staffing`);
  await page.waitForSelector('text=/who draws kit/i');
  await page.click('[data-testid=kit-toggle-Core-Ops]');
  await page.waitForTimeout(2500);

  await go(`/op/${OP}/logistics/inventory?day=2026-03-04`);
  await page.waitForSelector('text=/needed on/i');
  const after = await readGloves();
  if (after >= before) throw new Error(`exemption did not reduce the count: ${before} -> ${after}`);
  return `${before} -> ${after} drawing kit`;
});

await step('THE guarantee: food headcount is untouched by the exemption', async () => {
  await go(`/op/${OP}/food?day=2026-03-04&slot=supper`);
  await page.waitForSelector('text=/on site/i');
  const t = await main();
  const m = t.match(/ON SITE . THIS DAY\s*\n\s*(\d+)/i);
  if (m === null) throw new Error('could not read the food headcount');
  const fed = Number(m[1]);
  if (fed < 40) throw new Error(`food headcount collapsed to ${fed} — the exemption leaked into food`);
  return `${fed} still being fed`;
});

await step('the inventory discloses who is excluded rather than hiding it', async () => {
  await go(`/op/${OP}/logistics/inventory?day=2026-03-04`);
  await page.waitForSelector('text=/needed on/i');
  const t = await main();
  if (!/excluded from kit counts/i.test(t)) throw new Error('exclusion not disclosed');
  if (!/still counted for food/i.test(t)) throw new Error('does not say food is unaffected');
  return 'exclusion disclosed on the page';
});

await step('the toggle reverses', async () => {
  await go(`/op/${OP}/logistics/staffing`);
  await page.waitForSelector('text=/who draws kit/i');
  await page.click('[data-testid=kit-toggle-Core-Ops]');
  await page.waitForTimeout(2500);
  if (!/draws kit/i.test(await page.locator('main').innerText())) throw new Error('toggle did not come back on');
  return 'restored';
});

await step('no 5xx and no page errors', async () => {
  if (errs.length > 0) throw new Error(errs.join(' | '));
  return 'clean';
});

await b.close();
console.log(fails === 0 ? '\nAll inventory checks passed.' : `\n${fails} failed.`);
process.exit(fails === 0 ? 0 : 1);
