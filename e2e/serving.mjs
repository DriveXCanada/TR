/**
 * Serving a meal draws the pantry down; undo puts it back.
 *
 *   BASE_URL=... OP_ID=<uuid> npm run test:e2e:serving
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const OP = process.env.OP_ID;
const USER = process.env.E2E_USER ?? 'ful';
const PIN = process.env.E2E_PIN ?? '2468';
const DAY = process.env.E2E_DAY ?? '2026-03-02';

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
let fails = 0;
async function step(n, f) {
  try { const o = await f(); console.log(`PASS  ${n}${o ? ` — ${o}` : ''}`); }
  catch (e) { fails += 1; console.log(`FAIL  ${n} — ${e.message.split('\n')[0]}`); }
}

/** The oats row on the shopping list, which exposes stock on hand. */
async function oatsRow() {
  await go(`/op/${OP}/food/shopping`);
  await page.waitForSelector('text=/purchase cost/i');
  const row = page.locator('tr').filter({ hasText: 'Rolled oats' }).first();
  return (await row.innerText()).replace(/\s+/g, ' ').trim();
}

await step('sign in', async () => {
  await go('/login'); await page.waitForSelector('#username');
  await page.fill('#username', USER); await page.fill('#pin', PIN);
  await Promise.all([page.waitForURL(`${BASE}/`, { timeout: 20000 }), page.click('form button[type=submit]')]);
  return 'ok';
});

await step('a planned meal offers a Serve control', async () => {
  await go(`/op/${OP}/food/menu?day=${DAY}`);
  await page.waitForSelector('text=/the whole operation/i');
  if (!/mark breakfast served/i.test(await main())) throw new Error('no serve control on a planned slot');
  return 'serve control present';
});

let before = null;
await step('record the pantry before serving', async () => {
  before = await oatsRow();
  if (before === null || before === '') throw new Error('could not read the oats row');
  return before.slice(0, 70);
});

await step('serving breakfast draws the ingredients out of stock', async () => {
  await go(`/op/${OP}/food/menu?day=${DAY}`);
  await page.waitForSelector('[data-testid=serve-breakfast]');
  await page.click('[data-testid=serve-breakfast]');
  await page.waitForTimeout(4000);
  const t = await main();
  if (!/portions drawn from the pantry/i.test(t)) throw new Error('no draw-down confirmation');
  const after = await oatsRow();
  if (after === before) throw new Error('pantry did not move');
  return 'stock reduced';
});

await step('serving again is impossible — no double deduction', async () => {
  const afterFirst = await oatsRow();
  await go(`/op/${OP}/food/menu?day=${DAY}`);
  await page.waitForSelector('text=/the whole operation/i');
  if (/mark breakfast served/i.test(await main())) throw new Error('serve control still offered after serving');
  if (await oatsRow() !== afterFirst) throw new Error('stock moved again');
  return 'idempotent';
});

await step('undo returns exactly what was drawn', async () => {
  await go(`/op/${OP}/food/menu?day=${DAY}`);
  await page.waitForSelector('text=/portions drawn/i');
  await page.locator('button:has-text("Undo")').first().click();
  await page.waitForTimeout(4000);
  const restored = await oatsRow();
  if (restored !== before) throw new Error(`not restored: before "${before}" after "${restored}"`);
  return 'pantry back to the original figure';
});

await step('shopping list offers print as well as CSV', async () => {
  await go(`/op/${OP}/food/shopping`);
  await page.waitForSelector('text=/purchase cost/i');
  if (await page.locator('button:has-text("Print shopping list")').count() === 0) {
    throw new Error('no print button');
  }
  if (await page.locator('a:has-text("Download CSV")').count() === 0) throw new Error('CSV export lost');
  return 'print + CSV';
});

await step('inventory stock adjusts by amount rather than retyping a total', async () => {
  await go(`/op/${OP}/logistics/inventory`);
  await page.waitForSelector('h1:has-text("Inventory")');
  // This suite runs against a seeded operation that may have no kit list yet.
  if (await page.locator('tr').filter({ hasText: 'Nitrile gloves' }).count() === 0) {
    await page.click('[data-testid=load-general]');
    await page.waitForSelector('text=/needed on/i', { timeout: 30000 });
  }
  // Two tables mention the item; the stock control lives in "Whole operation".
  const whole = page.locator('section').filter({ has: page.locator('h2', { hasText: /whole operation/i }) }).first();
  const rowFor = () => whole.locator('tr').filter({ hasText: 'Nitrile gloves' }).first();
  // Read the stock figure itself, not the row's first cell (which is the name).
  const stockText = async () => rowFor().locator('[aria-label*="in stock"]').innerText();
  const start = Number((await stockText()).trim());
  await rowFor().locator('button[aria-label^="Add"]').click();
  await page.waitForTimeout(3000);
  const bumped = Number((await stockText()).trim());
  if (!(bumped > start)) throw new Error(`stock did not increase: ${start} -> ${bumped}`);

  await rowFor().locator('button[aria-label^="Remove"]').click();
  await page.waitForTimeout(3000);
  const back = Number((await stockText()).trim());
  if (back !== start) throw new Error(`minus did not reverse plus: ${start} -> ${bumped} -> ${back}`);
  return `${start} +1 -> ${bumped}, -1 -> ${back}`;
});

await step('command brief carries budget and safety on one sheet', async () => {
  await go(`/op/${OP}/food/brief?day=${DAY}`);
  await page.waitForSelector('h1:has-text("Command brief")');
  const t = await main();
  if (!/budget/i.test(t)) throw new Error('no budget section');
  if (!/operation total/i.test(t)) throw new Error('no operation-level budget expectation');
  if (!/safety — read before service/i.test(t)) throw new Error('safety section missing');
  if (await page.locator('button:has-text("Print")').count() === 0) throw new Error('no print control');
  return 'budget + safety + print';
});

await step('no 5xx and no page errors', async () => {
  if (errs.length > 0) throw new Error(errs.join(' | '));
  return 'clean';
});

await b.close();
console.log(fails === 0 ? '\nAll serving checks passed.' : `\n${fails} failed.`);
process.exit(fails === 0 ? 0 : 1);
