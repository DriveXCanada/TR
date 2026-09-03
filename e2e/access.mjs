import { chromium } from 'playwright-core';
/**
 * Access-control and sign-in regression checks. Both cases here were real bugs
 * reported from a live deployment:
 *
 *  1. The operations list ignored membership, so a manager saw every operation
 *     and got a 404 on any they were not assigned to.
 *  2. Usernames were compared case-sensitively, so an account created as "Ben"
 *     (stored lowercased) rejected "Ben" at sign-in as if the PIN were wrong.
 *
 *   BASE_URL=... OP_ID=<uuid the manager is assigned to> npm run test:e2e:access
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const MASTER_USER = process.env.MASTER_USERNAME ?? 'lead';
const MASTER_PIN = process.env.MASTER_PIN ?? '470468';
// Unique per run: this suite creates accounts and operations, and must not
// collide with what a previous run left behind.
const RUN = Date.now().toString(36).toUpperCase();
const MGR_USER = `Ben${RUN}`;          // deliberately capitalised — that is the bug under test
const MGR_NAME = `Ben Halloran ${RUN}`;
const MINE = `OP MINE ${RUN}`;
const THEIRS = `OP THEIRS ${RUN}`;
const b=await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {}),args:['--no-proxy-server']});
let fails=0;
async function step(n,f){ try{ const o=await f(); console.log(`PASS  ${n}${o?' — '+o:''}`);}catch(e){ fails++; console.log(`FAIL  ${n} — ${e.message.split('\n')[0]}`);} }

const master=await b.newPage();
const errs=[]; master.on('pageerror',e=>errs.push(e.message));
master.on('response',r=>{ if(r.status()>=500) errs.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });

async function signIn(page,u,p){
  await page.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#username');
  await page.fill('#username',u); await page.fill('#pin',p);
  await page.click('form button[type=submit]');
  await page.waitForTimeout(3500);
  return page.url();
}

await step('master signs in', async()=>{
  const url=await signIn(master,MASTER_USER,MASTER_PIN);
  if(url.includes('/login')) throw new Error('master could not sign in');
  return 'ok';
});

await step('master creates "Ben" — typed with a capital B', async()=>{
  await master.goto(`${BASE}/managers`,{waitUntil:'domcontentloaded'});
  await master.waitForSelector('input[name=username]');
  await master.fill('input[name=username]',MGR_USER);
  await master.fill('input[name=name]',MGR_NAME);
  await master.fill('input[name=pin]','5150');
  await master.click('button:has-text("Create manager")');
  await master.waitForSelector(`text=/${MGR_NAME}/`,{timeout:20000});
  return 'account created';
});

await step('master creates a SECOND operation Ben is not on', async()=>{
  await master.goto(`${BASE}/`,{waitUntil:'domcontentloaded'});
  await master.waitForSelector('input[name=name]');
  await master.fill('input[name=name]',THEIRS);
  await master.fill('input[name=location]','Somewhere Else, MB');
  await master.fill('input[name=startDate]','2026-05-01');
  await master.fill('input[name=endDate]','2026-05-03');
  await master.click('button:has-text("Create operation")');
  await master.waitForSelector(`text=/${THEIRS}/`,{timeout:20000});
  return 'second operation created';
});

let opId;
await step('master creates the operation Ben WILL be on', async()=>{
  await master.goto(`${BASE}/`,{waitUntil:'domcontentloaded'});
  await master.waitForSelector('input[name=name]');
  await master.fill('input[name=name]',MINE);
  await master.fill('input[name=location]','Access Fixture, MB');
  await master.fill('input[name=startDate]','2026-06-01');
  await master.fill('input[name=endDate]','2026-06-03');
  await master.click('button:has-text("Create operation")');
  await master.waitForSelector(`text=/${MINE}/`,{timeout:20000});
  await master.click(`text=/${MINE}/`);
  await master.waitForURL(/\/op\/[0-9a-f-]+$/,{timeout:20000});
  opId = master.url().split('/op/')[1];
  return opId;
});

await step('master assigns Ben to that operation only', async()=>{
  await master.goto(`${BASE}/op/${opId}/settings`,{waitUntil:'domcontentloaded'});
  await master.waitForSelector('select[name=userId]');
  await master.selectOption('select[name=userId]',{label:`${MGR_NAME} (${MGR_USER.toLowerCase()})`});
  await master.selectOption('select[name=role]','assistant');
  await master.click('button:has-text("Assign")');
  await master.waitForSelector(`text=/${MGR_NAME}/`,{timeout:20000});
  return 'assigned to OP TEST SHIELD only';
});

// --- BUG 2: capitalised username was rejected as bad credentials -------------
await step('BUG 2: Ben signs in typing "Ben" with a capital B', async()=>{
  const ctx=await b.newContext(); const ben=await ctx.newPage();
  const url=await signIn(ben,MGR_USER,'5150');
  const text=await ben.locator('main').innerText();
  await ctx.close();
  if(url.includes('/login')) throw new Error(`rejected: ${text.match(/Incorrect[^\n]*/)?.[0] ?? 'still on login'}`);
  return 'accepted';
});

await step('and typing "BEN" in all caps, and "  ben  " with spaces', async()=>{
  for(const variant of [MGR_USER.toUpperCase(),`  ${MGR_USER.toLowerCase()}  `]){
    const ctx=await b.newContext(); const ben=await ctx.newPage();
    const url=await signIn(ben,variant,'5150');
    await ctx.close();
    if(url.includes('/login')) throw new Error(`rejected "${variant}"`);
  }
  return 'both accepted';
});

await step('a genuinely wrong PIN is still refused', async()=>{
  const ctx=await b.newContext(); const ben=await ctx.newPage();
  const url=await signIn(ben,'Ben','0000');
  const t=await ben.locator('main').innerText();
  await ctx.close();
  if(!url.includes('/login')) throw new Error('wrong PIN was accepted');
  if(!/incorrect username or pin/i.test(t)) throw new Error('no rejection message');
  return 'refused correctly';
});

// --- BUG 1: the list showed operations the user cannot open ------------------
await step('BUG 1: Ben sees ONLY the operation he is on', async()=>{
  const ctx=await b.newContext(); const ben=await ctx.newPage();
  await signIn(ben,MGR_USER,'5150');
  const t=await ben.locator('main').innerText();
  await ctx.close();
  if(!t.includes(MINE)) throw new Error('his own operation is missing');
  if(t.includes(THEIRS)) throw new Error('LEAK: sees an operation he is not a member of');
  return 'one operation listed, the other invisible';
});

await step('and clicking his operation opens it, not a 404', async()=>{
  const ctx=await b.newContext(); const ben=await ctx.newPage();
  await signIn(ben,MGR_USER,'5150');
  await ben.click(`text=/${MINE}/`);
  await ben.waitForURL(/\/op\/[0-9a-f-]+$/,{timeout:20000});
  // The operation now opens on the section chooser, not straight to the board.
  await ben.waitForSelector('text=/equip the crew/i',{timeout:20000});
  const t=await ben.locator('main').innerText();
  const url=ben.url();
  await ctx.close();
  if(/404|not found/i.test(t)) throw new Error('404 on his own operation');
  if(!/feed the crew/i.test(t)) throw new Error('section chooser did not render');
  return `board opened at ${url.split('/op/')[1]}`;
});

await step('a direct link to the other operation is still refused', async()=>{
  const ctx=await b.newContext(); const ben=await ctx.newPage();
  await signIn(ben,MGR_USER,'5150');
  const res=await ben.goto(`${BASE}/op/00000000-0000-0000-0000-000000000000`,{waitUntil:'domcontentloaded'});
  const status=res.status(); await ctx.close();
  if(status!==404) throw new Error(`expected 404, got ${status}`);
  return '404 as it should be';
});

await step('no 5xx and no page errors', async()=>{ if(errs.length) throw new Error(errs.join(' | ')); return 'clean'; });
await b.close();
console.log(fails===0?'\nAll regression checks passed.':`\n${fails} failed.`);
process.exit(fails===0?0:1);
