/**
 * PPE sizing: capture at the kiosk, tally in Logistics.
 *
 *   BASE_URL=... OP_ID=<uuid> KIOSK_TOKEN=<token> npm run test:e2e:sizes
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const OP = process.env.OP_ID;
const KIOSK = process.env.KIOSK_TOKEN;
const USER = process.env.E2E_USER ?? 'ful';
const PIN = process.env.E2E_PIN ?? '2468';
const RUN = Date.now().toString(36).toUpperCase();

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

await step('sign in', async () => {
  await go('/login'); await page.waitForSelector('#username');
  await page.fill('#username', USER); await page.fill('#pin', PIN);
  await Promise.all([page.waitForURL(`${BASE}/`, { timeout: 20000 }), page.click('form button[type=submit]')]);
  return 'ok';
});

await step('sizes page tallies the seeded crew', async () => {
  await go(`/op/${OP}/logistics/sizes?day=2026-03-05`);
  await page.waitForSelector('text=/ppe sizes/i');
  const t = await main();
  if (!/whole operation/i.test(t)) throw new Error('no roster-wide table');
  if (!/gloves/i.test(t)) throw new Error('no glove row');
  return 'tallies rendered';
});

await step('unknown sizes are reported, never folded into a size', async () => {
  const t = await main();
  if (!/nothing recorded/i.test(t)) throw new Error('missing coverage figure');
  if (!/unknown/i.test(t)) throw new Error('unknown not surfaced');
  if (!/chase/i.test(t)) throw new Error('no chase list for incomplete records');
  return 'unknown counted separately and chased';
});

await step('the tally follows presence — a quieter day needs fewer', async () => {
  const countFor = async (day) => {
    await go(`/op/${OP}/logistics/sizes?day=${day}`);
    await page.waitForSelector('text=/ppe sizes/i');
    const t = await main();
    const m = t.match(/ON SITE 2026-\d\d-\d\d\s*\n\s*(\d+)/i);
    return m === null ? -1 : Number(m[1]);
  };
  const busy = await countFor('2026-03-05');
  const quiet = await countFor('2026-03-02');
  if (busy < 0 || quiet < 0) throw new Error('could not read the on-site figure');
  if (busy === quiet) throw new Error(`expected different headcounts, both ${busy}`);
  return `${quiet} on 2 Mar vs ${busy} on 5 Mar`;
});

let created = false;
if (KIOSK !== undefined) {
  await step('a volunteer submits sizes through the kiosk', async () => {
    const ctx = await b.newContext(); const kiosk = await ctx.newPage();
    await kiosk.goto(`${BASE}/join/${KIOSK}`, { waitUntil: 'domcontentloaded' });
    const next = async (heading) => {
      await kiosk.click('[data-testid=wizard-next]');
      await kiosk.waitForSelector(`h2:has-text("${heading}")`, { state: 'visible', timeout: 10000 });
    };
    await kiosk.check('input[name=consent]');
    await next('Who are you?');
    await kiosk.fill('input[name=firstName]', 'Sizecheck');
    await kiosk.fill('input[name=lastName]', `Volunteer${RUN}`);
    await next('Kit sizes');
    await kiosk.selectOption('select[name=size_shirt]', '2XL');
    await kiosk.selectOption('select[name=size_glove]', 'XS');
    await kiosk.selectOption('select[name=size_boot]', '14');
    await next('Allergies, intolerances, diet');
    await next('Auto-injector');
    await next('Which meals are you on site for?');
    await kiosk.selectOption('select[name=arriveDate]', '2026-03-02');
    await next('Preferences');
    await next('Check and send');
    await kiosk.waitForSelector('[data-testid=wizard-submit]', { state: 'visible' });
    await kiosk.evaluate(() => {
      const button = document.querySelector('[data-testid=wizard-submit]');
      if (button === null) throw new Error('submit button not found');
      button.click();
    });
    await kiosk.waitForSelector('text=/on the roster/i', { timeout: 20000 });
    await ctx.close();
    created = true;
    return 'submitted 2XL shirt, XS glove, size 14 boot';
  });

  await step('those sizes reach the Logistics tally', async () => {
    if (!created) throw new Error('kiosk submission did not complete');
    await go(`/op/${OP}/logistics/sizes?day=2026-03-02`);
    await page.waitForSelector('text=/ppe sizes/i');
    const t = await main();
    // Rare sizes: only the volunteer who just signed in should have these.
    if (!/2XL×1|2XL x1|2XL×/i.test(t.replace(/\s+/g, ''))) throw new Error('2XL shirt not counted');
    if (!/14×|14x/i.test(t.replace(/\s+/g, ''))) throw new Error('size 14 boot not counted');
    return 'rare sizes appear in the roster-wide table';
  });
}

await step('no 5xx and no page errors', async () => {
  if (errs.length > 0) throw new Error(errs.join(' | '));
  return 'clean';
});

await b.close();
console.log(fails === 0 ? '\nAll sizing checks passed.' : `\n${fails} failed.`);
process.exit(fails === 0 ? 0 : 1);
