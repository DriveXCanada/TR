/**
 * A Food Unit Leader can invent a dish, write its ingredients in one go,
 * correct it afterwards, and be told what the system cannot vouch for.
 *
 *   BASE_URL=... OP_ID=<uuid> npm run test:e2e:recipes
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const OP = process.env.OP_ID;
const USER = process.env.E2E_USER ?? 'ful';
const PIN = process.env.E2E_PIN ?? '2468';
// Run-unique so a re-run never collides with an earlier recipe of the same name.
const DISH = `Field hash ${Date.now().toString().slice(-6)}`;

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

/** The recipe's own card, so controls elsewhere on the page are never clicked. */
const card = () => page.locator('li').filter({ hasText: DISH }).first();
/** Case-insensitive, because a pasted name takes the catalogue's capitalisation. */
const qtyOf = (n) => card().getByLabel(new RegExp(`quantity of ${n} per serving`, 'i'));
const unitOf = (n) => card().getByLabel(new RegExp(`unit for ${n}`, 'i'));
/** The paste box collapses once a recipe has ingredients. */
async function openPasteBox() {
  const box = card().locator('textarea[name=text]');
  if (!(await box.first().isVisible().catch(() => false))) {
    await card().locator('summary', { hasText: /write the ingredient list/i }).first().click();
  }
  await box.first().waitFor({ state: 'visible', timeout: 15000 });
  return box.first();
}

await step('sign in', async () => {
  await go('/login'); await page.waitForSelector('#username');
  await page.fill('#username', USER); await page.fill('#pin', PIN);
  await Promise.all([page.waitForURL(`${BASE}/`, { timeout: 20000 }), page.click('form button[type=submit]')]);
  return 'ok';
});

await step('Recipes is reachable from the Food Unit navigation', async () => {
  await go(`/op/${OP}/food/menu`);
  await page.waitForSelector('nav');
  const link = page.locator(`nav a[href="/op/${OP}/food/recipes"]`);
  if (await link.count() === 0) throw new Error('no Recipes link in the nav — the page is orphaned');
  await Promise.all([page.waitForURL(/food\/recipes/, { timeout: 20000 }), link.first().click()]);
  return 'nav link works';
});

await step('create a recipe', async () => {
  await go(`/op/${OP}/food/recipes`);
  await page.waitForSelector('text=/new recipe/i');
  const form = page.locator('form').filter({ has: page.locator('button:has-text("Save recipe")') }).first();
  await form.locator('input[name=name]').fill(DISH);
  await form.locator('input[name=tags]').fill('test, breakfast');
  await Promise.all([page.waitForLoadState('domcontentloaded'), form.locator('button:has-text("Save recipe")').click()]);
  await page.waitForTimeout(2500);
  if (!(await main()).includes(DISH)) throw new Error('recipe not listed after saving');
  return DISH;
});

await step('writing a pasted ingredient list fills the whole recipe in one submit', async () => {
  await go(`/op/${OP}/food/recipes`);
  await page.waitForSelector(`text=${DISH}`);
  const box = await openPasteBox();
  await box.fill('250 g potatoes\n80 g onion\n2 eggs\n15 ml vegetable oil\nsalt');
  await Promise.all([
    page.waitForURL(/paste=ok/, { timeout: 20000 }),
    card().getByRole('button', { name: /write ingredients for/i }).first().click(),
  ]);
  await page.waitForTimeout(1500);
  const t = await main();
  if (!/5 ingredients written/i.test(t)) throw new Error(`no confirmation of 5 lines: ${t.slice(0, 160)}`);
  for (const n of ['potatoes', 'onion', 'eggs', 'vegetable oil', 'salt']) {
    if (!new RegExp(n, 'i').test(t)) throw new Error(`"${n}" missing from the recipe`);
  }
  return '5 lines, one submit';
});

await step('quantities and units are read off each line', async () => {
  await go(`/op/${OP}/food/recipes`);
  await page.waitForSelector(`text=${DISH}`);
  if (await qtyOf('potatoes').count() === 0) throw new Error('no editable quantity for potatoes');
  const v = await qtyOf('potatoes').first().inputValue();
  if (Number(v) !== 250) throw new Error(`potatoes quantity read as ${v}, expected 250`);
  const unit = await unitOf('potatoes').first().inputValue();
  if (unit !== 'g') throw new Error(`potatoes unit read as "${unit}"`);
  // "2 eggs" has no unit written — it must become a count, not 2 grams.
  const eggUnit = await unitOf('eggs').first().inputValue();
  if (eggUnit !== 'each') throw new Error(`eggs unit read as "${eggUnit}", expected each`);
  return '250 g potatoes, 2 each eggs';
});

await step('an unpriced ingredient is reported, not hidden', async () => {
  const t = await main();
  if (!/no price/i.test(t)) throw new Error('nothing said about ingredients created without a price');
  return 'price gap surfaced';
});

await step('a known allergen on a pasted line is labelled', async () => {
  await go(`/op/${OP}/food/recipes`);
  await page.waitForSelector(`text=${DISH}`);
  const row = card().locator('li').filter({ hasText: 'eggs' }).first();
  if (!/egg/i.test(await row.innerText())) throw new Error('egg not flagged as an allergen on the line');
  return 'egg flagged';
});

await step('a quantity can be corrected in place', async () => {
  await go(`/op/${OP}/food/recipes`);
  await page.waitForSelector(`text=${DISH}`);
  await qtyOf('potatoes').first().fill('300');
  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    card().getByRole('button', { name: /save potatoes line/i }).first().click(),
  ]);
  await page.waitForTimeout(2500);
  await go(`/op/${OP}/food/recipes`);
  await page.waitForSelector(`text=${DISH}`);
  const after = await qtyOf('potatoes').first().inputValue();
  if (Number(after) !== 300) throw new Error(`correction did not stick: ${after}`);
  return '250 -> 300';
});

await step('one ingredient can be removed without rebuilding the recipe', async () => {
  await go(`/op/${OP}/food/recipes`);
  await page.waitForSelector(`text=${DISH}`);
  const lines = () => card().getByLabel(/quantity of .* per serving/i);
  const before = await lines().count();
  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    card().getByRole('button', { name: /remove salt from/i }).first().click(),
  ]);
  await page.waitForTimeout(2500);
  await go(`/op/${OP}/food/recipes`);
  await page.waitForSelector(`text=${DISH}`);
  const after = await lines().count();
  if (after !== before - 1) throw new Error(`line count ${before} -> ${after}`);
  if (/\bsalt\b/i.test(await card().innerText())) throw new Error('salt still on the recipe');
  return `${before} -> ${after} lines`;
});

await step('re-writing the list replaces lines rather than doubling them', async () => {
  await go(`/op/${OP}/food/recipes`);
  await page.waitForSelector(`text=${DISH}`);
  await (await openPasteBox()).fill('400 g potatoes');
  await Promise.all([
    page.waitForURL(/paste=ok/, { timeout: 20000 }),
    card().getByRole('button', { name: /write ingredients for/i }).first().click(),
  ]);
  await page.waitForTimeout(1500);
  await go(`/op/${OP}/food/recipes`);
  await page.waitForSelector(`text=${DISH}`);
  const rows = await qtyOf('potatoes').count();
  if (rows !== 1) throw new Error(`potatoes appears on ${rows} lines — the shopping list would double it`);
  const v = await qtyOf('potatoes').first().inputValue();
  if (Number(v) !== 400) throw new Error(`quantity not replaced: ${v}`);
  return 'one line, updated to 400';
});

await step('a recipe can be renamed after the fact', async () => {
  await go(`/op/${OP}/food/recipes`);
  await page.waitForSelector(`text=${DISH}`);
  const edit = card().locator('details').filter({ hasText: /edit name, tags and method/i }).first();
  await edit.locator('summary').click();
  await edit.locator('input[name=name]').fill(`${DISH} v2`);
  await edit.locator('textarea[name=method]').fill('Par-boil, then fry hard.');
  await Promise.all([page.waitForLoadState('domcontentloaded'), edit.locator('button:has-text("Save changes")').click()]);
  await page.waitForTimeout(2500);
  await go(`/op/${OP}/food/recipes`);
  await page.waitForSelector('text=/recipe book/i');
  if (!(await main()).includes(`${DISH} v2`)) throw new Error('rename did not stick');
  return 'renamed and method saved';
});

await step('an unreadable list is refused rather than half-written', async () => {
  await go(`/op/${OP}/food/recipes`);
  await page.waitForSelector(`text=${DISH}`);
  await (await openPasteBox()).fill('\n\n');
  await Promise.all([
    page.waitForURL(/paste=none/, { timeout: 20000 }),
    card().getByRole('button', { name: /write ingredients for/i }).first().click(),
  ]);
  await page.waitForSelector('text=/nothing could be read/i', { timeout: 15000 });
  const t = await main();
  if (!/60 g rolled oats/i.test(t)) throw new Error('refusal does not show the format to use');
  // Nothing may be written from a list it could not read.
  if (/ingredients written to the recipe/i.test(t)) throw new Error('claimed to write ingredients from an unreadable list');
  return 'told what to type instead';
});

await step('the new recipe is offered to the menu planner', async () => {
  await go(`/op/${OP}/food/menu`);
  await page.waitForSelector('text=/the whole operation/i');
  if (!(await page.locator('body').innerText()).includes(`${DISH} v2`)) {
    throw new Error('a recipe created here is not selectable on the menu');
  }
  return 'selectable on the menu';
});

await step('tidy up the test recipe', async () => {
  await go(`/op/${OP}/food/recipes`);
  await page.waitForSelector(`text=${DISH} v2`);
  const mine = page.locator('li').filter({ hasText: `${DISH} v2` }).first();
  await Promise.all([page.waitForLoadState('domcontentloaded'), mine.locator('button:has-text("Delete")').first().click()]);
  await page.waitForTimeout(2500);
  return 'removed';
});

await step('no 5xx and no page errors', async () => {
  if (errs.length > 0) throw new Error(errs.join(' | '));
  return 'clean';
});

await b.close();
console.log(fails === 0 ? '\nAll recipe checks passed.' : `\n${fails} failed.`);
process.exit(fails === 0 ? 0 : 1);
