/**
 * Privacy and retention: the notice a volunteer consents against must exist and
 * be reachable before they have an account.
 *
 *   BASE_URL=... KIOSK_TOKEN=<token> npm run test:e2e:privacy
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const KIOSK = process.env.KIOSK_TOKEN;

const b = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-proxy-server'],
});
let fails = 0;
async function step(n, f) {
  try { const o = await f(); console.log(`PASS  ${n}${o ? ` — ${o}` : ''}`); }
  catch (e) { fails += 1; console.log(`FAIL  ${n} — ${e.message.split('\n')[0]}`); }
}

const ctx = await b.newContext();           // deliberately signed OUT
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('response', (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });

await step('the notice is public — no sign-in required', async () => {
  const res = await page.goto(`${BASE}/privacy`, { waitUntil: 'domcontentloaded' });
  if (res.status() !== 200) throw new Error(`HTTP ${res.status()}`);
  if (page.url().includes('/login')) throw new Error('redirected to sign-in');
  return 'HTTP 200, no redirect';
});

await step('it states what is collected, who sees it, and for how long', async () => {
  const t = await page.locator('article').innerText();
  for (const probe of [/auto-injector/i, /deleted/i, /not sold/i, /decline/i, /pipeda/i]) {
    if (!probe.test(t)) throw new Error(`missing: ${probe}`);
  }
  return 'all required disclosures present';
});

await step('the sign-in page links to it and the link resolves', async () => {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  const link = page.locator('a[href="/privacy"]').first();
  if (await link.count() === 0) throw new Error('no privacy link on sign-in');
  await link.click();
  await page.waitForURL(/\/privacy$/, { timeout: 15000 });
  return 'resolves from /login';
});

if (KIOSK !== undefined) {
  await step('THE one that matters: the consent step links to a notice that exists', async () => {
    await page.goto(`${BASE}/join/${KIOSK}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[name=consent]');
    const link = page.locator('a[href="/privacy"]').first();
    if (await link.count() === 0) throw new Error('consent step has no privacy link');
    // Opens in a new tab from the wizard.
    const res = await page.request.get(`${BASE}/privacy`);
    if (res.status() !== 200) throw new Error(`notice returns HTTP ${res.status()}`);
    return 'consent links to a live notice';
  });

  await step('the kiosk states the retention period to the volunteer', async () => {
    const t = await page.locator('main').innerText();
    if (!/deleted after \d+ days/i.test(t)) throw new Error('retention period not stated at sign-in');
    return 'retention stated before consent';
  });
}

await step('no 5xx and no page errors', async () => {
  if (errs.length > 0) throw new Error(errs.join(' | '));
  return 'clean';
});

await ctx.close();
await b.close();
console.log(fails === 0 ? '\nAll privacy checks passed.' : `\n${fails} failed.`);
process.exit(fails === 0 ? 0 : 1);
