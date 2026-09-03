import { chromium } from 'playwright-core';
/**
 * Admin-path end-to-end checks: account creation, operation creation, team
 * assignment, manual roster entry, and the access-control boundaries between
 * master and manager. Re-runnable: it provisions its own accounts and
 * operations, so it needs only a migrated database and a running server.
 *
 *   BASE_URL=... MASTER_PIN=... npm run test:e2e:admin
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const MASTER_USER = process.env.MASTER_USERNAME ?? 'lead';
const MASTER_PIN = process.env.MASTER_PIN ?? '470468';

// Unique per run: this suite creates accounts and operations. Fixed names
// collide with what a previous run left behind and — worse — make row-scoped
// clicks ambiguous, which once let a security assertion pass while silently
// acting on the wrong account.
const RUN = Date.now().toString(36).toUpperCase();
// Accounts are stored lowercased, so keep the fixture username lowercase —
// case-insensitivity is covered by e2e/access.mjs, not here.
const MGR_USER = `fieldlead${RUN}`.toLowerCase();
const MGR_NAME = `Sana Okorafor ${RUN}`;
const OP_NAME = `OP TEST ${RUN}`;

const b=await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {}),args:['--no-proxy-server']});
const page=await b.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
page.on('response',r=>{ if(r.status()>=500) errs.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
const go=(p)=>page.goto(`${BASE}${p}`,{waitUntil:'domcontentloaded'});
const main=async()=>page.locator('main').innerText();
let fails=0;
async function step(n,f){ try{ const o=await f(); console.log(`PASS  ${n}${o?' — '+o:''}`);}catch(e){ fails++; console.log(`FAIL  ${n} — ${e.message.split('\n')[0]}`);} }

await step('master signs in and can create operations', async ()=>{
  await go('/login'); await page.waitForSelector('#username');
  await page.fill('#username',MASTER_USER); await page.fill('#pin',MASTER_PIN);
  await Promise.all([page.waitForURL(`${BASE}/`,{timeout:20000}), page.click('form button[type=submit]')]);
  const t=await main();
  // Not an empty-database assertion any more — this suite is re-runnable, so
  // assert the capability instead: a master is offered operation creation.
  if(!/new operation/i.test(t)) throw new Error('master was not offered operation creation');
  return 'master can create an operation';
});

await step('master can create an operation', async ()=>{
  await page.fill('input[name=name]',OP_NAME);
  await page.fill('input[name=location]','Test Hall, MB');
  await page.fill('input[name=startDate]','2026-04-01');
  await page.fill('input[name=endDate]','2026-04-05');
  await page.click('button:has-text("Create operation")');
  await page.waitForSelector(`text=/${OP_NAME}/`,{timeout:20000});
  return 'operation created and listed';
});

await step('master can create a manager account', async ()=>{
  await go('/managers'); await page.waitForSelector('input[name=username]');
  await page.fill('input[name=username]',MGR_USER);
  await page.fill('input[name=name]',MGR_NAME);
  await page.fill('input[name=pin]','8371');
  await page.click('button:has-text("Create manager")');
  await page.waitForSelector(`text=/${MGR_USER}/`,{timeout:20000});
  const row = page.locator('li').filter({ hasText: MGR_USER }).first();
  if(!/not assigned to any operation/i.test(await row.innerText())) {
    throw new Error('new manager not shown as unassigned');
  }
  return 'manager created, shown as unassigned';
});

let opId;
await step('assign the manager to the operation as a lead', async ()=>{
  await go('/'); await page.waitForSelector(`text=/${OP_NAME}/`);
  await page.click(`text=/${OP_NAME}/`);
  await page.waitForURL(/\/op\/[0-9a-f-]+$/,{timeout:20000});
  opId = page.url().split('/op/')[1];  // chooser page
  await go(`/op/${opId}/settings`); await page.waitForSelector('select[name=userId]');
  await page.selectOption('select[name=userId]',{label:`${MGR_NAME} (${MGR_USER.toLowerCase()})`});
  await page.selectOption('select[name=role]','lead');
  await page.click('button:has-text("Assign")');
  await page.waitForSelector('text=/Sana Okorafor/',{timeout:20000});
  return 'assigned as lead';
});

await step('lead can add a volunteer by hand with a severe allergy', async ()=>{
  await go(`/op/${opId}/food/roster`); await page.waitForSelector('[data-testid=add-volunteer]');
  await page.fill('input[name=firstName]','Ozias');
  await page.fill('input[name=lastName]','Brackenridge');
  await page.selectOption('select[name=arriveDate]','2026-04-01');
  await page.selectOption('select[name=departDate]','2026-04-03');
  await page.selectOption('select[name=departMeal]','lunch');
  await page.check('input[name=epipenCarrying]');
  await page.fill('input[name=epipenLocation]','Chest rig, left pouch');
  await page.fill('input[name=restrictionKey]','shellfish');
  await page.selectOption('select[name=restrictionSeverity]','severe');
  await page.click('[data-testid=add-volunteer]');
  await page.waitForSelector('text=/Ozias Brackenridge/',{timeout:20000});
  return 'volunteer added';
});

await step('the hand-added volunteer drives the board correctly', async ()=>{
  await go(`/op/${opId}/food?day=2026-04-03&slot=lunch`); await page.waitForSelector('text=/on site/i');
  let t=await main();
  if(!t.includes('Ozias')) throw new Error('missing at lunch');
  if(!/SEVERE/i.test(t)) throw new Error('no severe banner');
  if(!/chest rig/i.test(t)) throw new Error('auto-injector location missing');
  await go(`/op/${opId}/food?day=2026-04-03&slot=supper`); await page.waitForSelector('text=/on site/i');
  t=await main();
  if(t.includes('Ozias')) throw new Error('still counted at supper after a lunch departure');
  return 'present at lunch with severe banner, absent at supper';
});

await step('the new manager can sign in and sees only their operation', async ()=>{
  const ctx=await b.newContext(); const mgr=await ctx.newPage();
  await mgr.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'});
  await mgr.fill('#username',MGR_USER); await mgr.fill('#pin','8371');
  await Promise.all([mgr.waitForURL(`${BASE}/`,{timeout:20000}), mgr.click('form button[type=submit]')]);
  const t=await mgr.locator('main').innerText();
  if(!t.includes(OP_NAME)) throw new Error('assigned operation not visible');
  if(/new operation/i.test(t)) throw new Error('non-master was offered operation creation');
  await ctx.close();
  return 'sees the assigned op, no create form';
});

await step('a manager cannot reach the accounts page', async ()=>{
  const ctx=await b.newContext(); const mgr=await ctx.newPage();
  await mgr.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'});
  await mgr.fill('#username',MGR_USER); await mgr.fill('#pin','8371');
  await Promise.all([mgr.waitForURL(`${BASE}/`,{timeout:20000}), mgr.click('form button[type=submit]')]);
  await mgr.goto(`${BASE}/managers`,{waitUntil:'domcontentloaded'});
  const url=mgr.url(); await ctx.close();
  if(url.includes('/managers')) throw new Error('manager reached /managers');
  return 'redirected away from /managers';
});

await step('a deactivated manager cannot sign in', async ()=>{
  await go('/managers');
  // Scope to THIS manager's row. A bare :has-text("Deactivate") clicks whichever
  // account is first, which would deactivate someone else and let this
  // assertion pass while testing nothing.
  const row = page.locator('li').filter({ hasText: MGR_USER }).first();
  await row.waitFor({timeout:20000});
  await row.locator('button:has-text("Deactivate")').click();
  await row.locator('text=/Deactivated/').waitFor({timeout:20000});
  const ctx=await b.newContext(); const mgr=await ctx.newPage();
  await mgr.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'});
  await mgr.fill('#username',MGR_USER); await mgr.fill('#pin','8371');
  await mgr.click('form button[type=submit]');
  await mgr.waitForTimeout(3000);
  const blocked = mgr.url().includes('/login');
  await ctx.close();
  if(!blocked) throw new Error('deactivated account still signed in');
  return 'sign-in refused';
});

await step('no 5xx and no page errors', async ()=>{ if(errs.length) throw new Error(errs.join(' | ')); return 'clean'; });
await b.close();
console.log(fails===0?'\nAll admin checks passed.':`\n${fails} failed.`);
process.exit(fails===0?0:1);
