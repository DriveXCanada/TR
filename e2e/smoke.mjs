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
const KIOSK = process.env.KIOSK_TOKEN;

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
  await go(`/op/${OP}/food?day=2026-03-05&slot=supper`);
  await page.waitForSelector('text=/on site/i');
  if ((await body()).includes('Priya')) throw new Error('still shown at supper after departing at lunch');
  return 'correctly absent';
});

await step('board: lunch includes her, with a severe banner', async () => {
  await go(`/op/${OP}/food?day=2026-03-05&slot=lunch`);
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
  ['roster', '/food/roster', /on the roster/i],
  ['staffing', '/logistics/staffing', /demand vs actual/i],
  ['travel', '/logistics/travel', /inbound/i],
]) {
  await step(`${name} page renders`, async () => {
    await go(`/op/${OP}${path}`);
    await page.waitForSelector('main');
    if (!expected.test(await body())) throw new Error(`expected content missing (${expected})`);
    return 'ok';
  });
}

await step('check: worcestershire on pulled pork -> HOLD, explained as anchovy', async () => {
  await go(`/op/${OP}/food/check?day=2026-03-05&slot=lunch`);
  await page.waitForSelector('#dish');
  await page.fill('#dish', 'pulled pork, brown sugar, worcestershire sauce, buns');
  await page.click('[data-testid=run-check]');
  await page.waitForSelector('text=/HOLD/i', { timeout: 20000 });
  await page.waitForSelector('text=/anchovy in worcestershire/i', { timeout: 20000 });
  await page.waitForSelector('text=/Devon Achterberg/', { timeout: 20000 });
  return 'HOLD + derivation + fish-allergic volunteer flagged';
});

await step('check: PB&J trips the peanut allergy', async () => {
  await go(`/op/${OP}/food/check?day=2026-03-05&slot=lunch`);
  await page.waitForSelector('#dish');
  await page.fill('#dish', 'PB&J sandwich: bread, peanut butter, jam');
  await page.click('[data-testid=run-check]');
  await page.waitForSelector('text=/HOLD/i', { timeout: 20000 });
  await page.waitForSelector('text=/Priya Ondaatje-Bell/', { timeout: 20000 });
  return 'HOLD + peanut-allergic volunteer flagged';
});

await step('check: a safe dish is CLEAR TO SERVE', async () => {
  await go(`/op/${OP}/food/check?day=2026-03-05&slot=supper`);
  await page.waitForSelector('#dish');
  await page.fill('#dish', 'rice, carrots, salt');
  await page.click('[data-testid=run-check]');
  await page.waitForSelector('text=/CLEAR TO SERVE/i', { timeout: 20000 });
  return 'CLEAR';
});


await step('menu: lunch offers ONLY packed options', async () => {
  await go(`/op/${OP}/food/menu?day=2026-03-02`);
  await page.waitForSelector('main');
  const lunchSection = page.locator('section', { has: page.locator('h2', { hasText: /^lunch$/i }) }).first();
  const options = await lunchSection.locator('select[name=recipeId] option').allInnerTexts();
  const named = options.filter((o) => !/choose/i.test(o));
  if (named.length === 0) throw new Error('no lunch options offered');
  const hot = named.filter((o) => /chilli|roast chicken|pasta bake|pancakes/i.test(o));
  if (hot.length > 0) throw new Error(`hot dishes offered for the packed lunch: ${hot.join(', ')}`);
  return `${named.length} pack options, no hot dishes`;
});

await step('menu: add then remove a dish', async () => {
  const supperSection = () =>
    page.locator('section', { has: page.locator('h2', { hasText: /^supper$/i }) }).first();
  // Count planned dishes by their Remove button — the empty state is also an <li>.
  const planned = () => supperSection().locator('li:has(button:has-text("Remove"))').count();

  await go(`/op/${OP}/food/menu?day=2026-03-06`);
  await page.waitForSelector('main');
  const before = await planned();

  await supperSection().locator('select[name=recipeId]').selectOption({ index: 1 });
  await supperSection().locator('button:has-text("Add")').click();
  await page.waitForTimeout(2000);
  const mid = await planned();
  if (mid !== before + 1) throw new Error(`dish not added (${before} -> ${mid})`);

  await supperSection().locator('button:has-text("Remove")').first().click();
  await page.waitForTimeout(2000);
  const end = await planned();
  if (end !== before) throw new Error(`dish not removed (${mid} -> ${end}, expected ${before})`);
  return `added and removed (${before} -> ${mid} -> ${end})`;
});

await step('menu: planned dishes carry their conflict chips', async () => {
  await go(`/op/${OP}/food/menu?day=2026-03-02`);
  await page.waitForSelector('main');
  const t = await body();
  if (!/peanuts/i.test(t)) throw new Error('PB&J in the lunch slot did not surface a peanuts chip');
  return 'peanuts flagged on the packed lunch';
});

await step('shopping: consolidates, prices and compares to budget', async () => {
  await go(`/op/${OP}/food/shopping`);
  await page.waitForSelector('main');
  const t = await body();
  if (!/purchase cost/i.test(t)) throw new Error('no purchase cost');
  if (!/operation budget/i.test(t)) throw new Error('no budget comparison');
  const rows = await page.locator('table tbody tr').count();
  if (rows < 5) throw new Error(`expected a consolidated list, got ${rows} rows`);
  return `${rows} ingredient lines`;
});

await step('shopping: CSV export downloads', async () => {
  // Fetch from inside the page: the session cookie is Secure, and Playwright's
  // Node-side request client will not send it over plain HTTP.
  const out = await page.evaluate(async (url) => {
    const r = await fetch(url, { credentials: 'include' });
    return { status: r.status, text: await r.text() };
  }, `${BASE}/api/op/${OP}/shopping.csv`);
  if (out.status !== 200) throw new Error(`HTTP ${out.status}`);
  if (!out.text.startsWith('Category,Ingredient')) throw new Error('unexpected CSV header');
  return `${out.text.split('\n').length} CSV rows`;
});

await step('recipes: page lists the book and can add a recipe', async () => {
  await go(`/op/${OP}/food/recipes`);
  await page.waitForSelector('main');
  const before = await page.locator('text=/\\/serving/').count();
  await page.fill('input[name=name]', 'E2E Test Loaf');
  await page.fill('input[name=tags]', 'pack, vegetarian');
  await page.locator('button:has-text("Save recipe")').click();
  await page.waitForTimeout(1500);
  const t = await body();
  if (!t.includes('E2E Test Loaf')) throw new Error('new recipe not listed');
  return `recipe created (was ${before} recipes)`;
});

await step('recipes: a new pack recipe becomes selectable at lunch', async () => {
  await go(`/op/${OP}/food/menu?day=2026-03-02`);
  await page.waitForSelector('main');
  const lunch = page.locator('section', { has: page.locator('h2', { hasText: /^lunch$/i }) }).first();
  const options = await lunch.locator('select[name=recipeId] option').allInnerTexts();
  if (!options.some((o) => o.includes('E2E Test Loaf'))) throw new Error('pack-tagged recipe not offered at lunch');
  return 'pack tag flows through to the lunch picker';
});


if (KIOSK !== undefined) {
  await step('join: an invalid kiosk token 404s without leaking', async () => {
    const res = await page.goto(`${BASE}/join/deadbeefdeadbeefdead`, { waitUntil: 'domcontentloaded' });
    if (res.status() !== 404) throw new Error(`expected 404, got ${res.status()}`);
    return '404';
  });

  await step('join: a volunteer signs in through the QR wizard', async () => {
    const ctx = await browser.newContext();
    const kiosk = await ctx.newPage();
    await kiosk.goto(`${BASE}/join/${KIOSK}`, { waitUntil: 'domcontentloaded' });

    // Every step stays mounted (the form must submit all fields at once) and
    // React reuses the footer button node when Next becomes Submit. So advance
    // one step at a time, waiting for the next heading to actually be visible,
    // rather than firing six clicks at the same element.
    const next = async (heading) => {
      await kiosk.click('[data-testid=wizard-next]');
      await kiosk.waitForSelector(`h2:has-text("${heading}")`, { state: 'visible', timeout: 10000 });
    };

    await kiosk.check('input[name=consent]');
    await next('Who are you?');

    await kiosk.fill('input[name=firstName]', 'Wendeline');
    await kiosk.fill('input[name=lastName]', 'Quartermain');
    await kiosk.selectOption('select[name=icsRole]', 'Core Ops');
    await next('Allergies, intolerances, diet');

    // Severe shellfish allergy, chosen by tap then escalated to severe.
    await kiosk.click('button:has-text("Shellfish")');
    await kiosk.selectOption('select[aria-label="How serious is shellfish?"]', 'severe');
    await next('Auto-injector');

    await kiosk.check('input[name=epipenCarrying]');
    await kiosk.fill('input[name=epipenLocation]', 'Left hip pouch, orange case');
    await next('Which meals are you on site for?');

    // Arrives 4 March at breakfast, leaves after LUNCH on 6 March.
    await kiosk.selectOption('select[name=arriveDate]', '2026-03-04');
    await kiosk.selectOption('select[name=arriveMeal]', 'breakfast');
    await kiosk.selectOption('select[name=departDate]', '2026-03-06');
    await kiosk.selectOption('select[name=departMeal]', 'lunch');
    await next('Preferences');
    await next('Check and send');

    // The form unmounts on success, so an in-page click avoids Playwright
    // retrying an element that is gone precisely because the click worked.
    await kiosk.waitForSelector('[data-testid=wizard-submit]', { state: 'visible' });
    await kiosk.evaluate(() => {
      const button = document.querySelector('[data-testid=wizard-submit]');
      if (button === null) throw new Error('submit button not found');
      button.click();
    });
    await kiosk.waitForSelector('text=/on the roster/i', { timeout: 20000 });
    await ctx.close();
    return 'signed in with a severe allergy and a lunch departure';
  });

  await step('join: she appears at LUNCH on her departure day, flagged severe', async () => {
    await go(`/op/${OP}/food?day=2026-03-06&slot=lunch`);
    await page.waitForSelector('text=/on site/i');
    const t = await body();
    if (!t.includes('Wendeline')) throw new Error('kiosk sign-in did not reach the board');
    if (!/shellfish/i.test(t)) throw new Error('severe restriction not on the board');
    if (!/left hip pouch/i.test(t)) throw new Error('auto-injector location not shown');
    return 'present, severe shellfish, auto-injector location shown';
  });

  await step('join: she is GONE from supper the same day', async () => {
    await go(`/op/${OP}/food?day=2026-03-06&slot=supper`);
    await page.waitForSelector('text=/on site/i');
    if ((await body()).includes('Wendeline')) throw new Error('still counted at supper after a lunch departure');
    return 'correctly absent';
  });

  await step('join: she is absent before she arrives', async () => {
    await go(`/op/${OP}/food?day=2026-03-03&slot=supper`);
    await page.waitForSelector('text=/on site/i');
    if ((await body()).includes('Wendeline')) throw new Error('counted before arrival');
    return 'correctly absent';
  });

  await step('check: shellfish now trips a HOLD at her lunch', async () => {
    await go(`/op/${OP}/food/check?day=2026-03-06&slot=lunch`);
    await page.waitForSelector('#dish');
    await page.fill('#dish', 'seafood chowder with shrimp and clams');
    await page.click('[data-testid=run-check]');
    await page.waitForSelector('text=/HOLD/i', { timeout: 20000 });
    await page.waitForSelector('text=/Wendeline Quartermain/', { timeout: 20000 });
    return 'HOLD naming the volunteer who just signed in';
  });

  await step('settings: kiosk QR renders and roster CSV includes her', async () => {
    await go(`/op/${OP}/settings`);
    await page.waitForSelector('img[alt*="QR"]');
    const out = await page.evaluate(async (url) => {
      const r = await fetch(url, { credentials: 'include' });
      return { status: r.status, text: await r.text() };
    }, `${BASE}/api/op/${OP}/roster.csv`);
    if (out.status !== 200) throw new Error(`roster CSV HTTP ${out.status}`);
    if (!out.text.includes('Quartermain')) throw new Error('new volunteer missing from the roster export');
    if (!/SEVERE:shellfish/.test(out.text)) throw new Error('severity missing from the roster export');
    return 'QR rendered, CSV carries the severe flag';
  });
}

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
