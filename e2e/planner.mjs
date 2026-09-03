import { chromium } from 'playwright-core';
/**
 * Menu-planner end-to-end checks, run the way a Food Unit Leader meets the tool:
 * an operation with no catalogue at all, through to a costed multi-day plan.
 *
 *   BASE_URL=... OP_ID=<uuid> npm run test:e2e:planner
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const OP = process.env.OP_ID ?? process.argv[2];
const MASTER_USER = process.env.MASTER_USERNAME ?? 'lead';
const MASTER_PIN = process.env.MASTER_PIN ?? '470468';
const b=await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {}),args:['--no-proxy-server']});
const page=await b.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
page.on('response',r=>{ if(r.status()>=500) errs.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
const go=(p)=>page.goto(`${BASE}${p}`,{waitUntil:'domcontentloaded'});
const main=async()=>page.locator('main').innerText();
let fails=0;
async function step(n,f){ try{ const o=await f(); console.log(`PASS  ${n}${o?' — '+o:''}`);}catch(e){ fails++; console.log(`FAIL  ${n} — ${e.message.split('\n')[0]}`);} }

await step('sign in', async()=>{
  await go('/login'); await page.waitForSelector('#username');
  await page.fill('#username',MASTER_USER); await page.fill('#pin',MASTER_PIN);
  await Promise.all([page.waitForURL(`${BASE}/`,{timeout:20000}), page.click('form button[type=submit]')]);
  return 'ok';
});

// This suite mutates the operation it plans against, so it provisions a fresh
// one each run rather than depending on fixture state left by a previous run.
let OPID = OP;
await step('provision a fresh operation to plan against', async()=>{
  const name = `OP PLANNER ${Date.now().toString(36).toUpperCase()}`;
  await go('/'); await page.waitForSelector('input[name=name]');
  await page.fill('input[name=name]', name);
  await page.fill('input[name=location]','Planner Fixture, MB');
  await page.fill('input[name=startDate]','2026-04-01');
  await page.fill('input[name=endDate]','2026-04-05');
  await page.click('button:has-text("Create operation")');
  await page.waitForSelector(`text=/${name}/`,{timeout:20000});
  await page.click(`text=/${name}/`);
  await page.waitForURL(/\/op\/[0-9a-f-]+$/,{timeout:20000});
  OPID = page.url().split('/op/')[1];
  return name;
});

await step('an empty operation explains itself instead of showing dead pickers', async()=>{
  await go(`/op/${OPID}/food/menu`); await page.waitForSelector('main');
  const t=await main();
  if(!/nothing to plan with yet/i.test(t)) throw new Error('no empty-state explanation');
  if(!/load the standard field-kitchen library/i.test(t)) throw new Error('no one-click way out');
  return 'empty state with a way forward';
});

await step('one click loads the whole catalogue', async()=>{
  await page.click('[data-testid=load-starter]');
  await page.waitForSelector('text=/the whole operation/i',{timeout:30000});
  return 'planner now usable';
});

await step('recipes and ingredients actually landed', async()=>{
  await go(`/op/${OPID}/food/recipes`); await page.waitForSelector('main');
  const t=await main();
  const m=t.match(/(\d+) recipes · (\d+) ingredients/);
  if(m===null) throw new Error('no counts shown');
  if(Number(m[1])<15 || Number(m[2])<30) throw new Error(`too few: ${m[0]}`);
  return m[0];
});

await step('loading twice is safe and does not duplicate', async()=>{
  const before=(await main()).match(/(\d+) recipes · (\d+) ingredients/)[0];
  await page.click('[data-testid=load-starter]');
  await page.waitForTimeout(3000);
  await go(`/op/${OPID}/food/recipes`); await page.waitForSelector('main');
  const after=(await main()).match(/(\d+) recipes · (\d+) ingredients/)[0];
  if(before!==after) throw new Error(`counts changed: ${before} -> ${after}`);
  return `idempotent (${after})`;
});

await step('week overview shows every day and flags unplanned slots', async()=>{
  await go(`/op/${OPID}/food/menu?day=2026-04-01`); await page.waitForSelector('text=/the whole operation/i');
  const t=await main();
  if(!t.includes('2026-04-01')||!t.includes('2026-04-05')) throw new Error('not all days listed');
  if(!/— nothing —/.test(t)) throw new Error('unplanned slots not flagged');
  return 'all 5 days, empty slots called out';
});

await step('plan one day', async()=>{
  const sec=(name)=>page.locator('section',{has:page.locator('h2',{hasText:new RegExp(`^${name}$`,'i')})}).first();
  for(const slot of ['breakfast','supper']){
    await sec(slot).locator('select[name=recipeId]').selectOption({index:1});
    await sec(slot).locator('button:has-text("Add")').click();
    await page.waitForTimeout(1800);
  }
  const planned=await page.locator('li:has(button:has-text("Remove"))').count();
  if(planned<2) throw new Error(`expected 2 dishes, got ${planned}`);
  return `${planned} dishes on 1 April`;
});

await step('roll that day forward across the operation', async()=>{
  await page.click('button:has-text("Select all")');
  await page.click('[data-testid=copy-day]');
  await page.waitForTimeout(4000);
  await go(`/op/${OPID}/food/menu?day=2026-04-04`); await page.waitForSelector('main');
  const planned=await page.locator('li:has(button:has-text("Remove"))').count();
  if(planned<2) throw new Error(`4 April did not receive the copy (${planned} dishes)`);
  return `4 April now has ${planned} dishes`;
});

await step('the shopping list picks it all up', async()=>{
  await go(`/op/${OPID}/food/shopping`); await page.waitForSelector('main');
  const rows=await page.locator('table tbody tr').count();
  if(rows<3) throw new Error(`expected consolidated lines, got ${rows}`);
  return `${rows} priced lines from a 5-day plan`;
});

await step('no 5xx and no page errors', async()=>{ if(errs.length) throw new Error(errs.join(' | ')); return 'clean'; });
await b.close();
console.log(fails===0?'\nAll planner checks passed.':`\n${fails} failed.`);
process.exit(fails===0?0:1);
