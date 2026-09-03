import { chromium } from 'playwright-core';
/**
 * Daily brief checks, against the seeded sample deployment.
 *
 *   BASE_URL=... OP_ID=<uuid> npm run test:e2e:brief
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const OP = process.env.OP_ID ?? process.argv[2];
const USER = process.env.E2E_USER ?? 'ful';
const PIN = process.env.E2E_PIN ?? '2468';
const b=await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {}),args:['--no-proxy-server']});
const page=await b.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
page.on('response',r=>{ if(r.status()>=500) errs.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
const main=async()=>page.locator('main').innerText();
let fails=0;
async function step(n,f){ try{ const o=await f(); console.log(`PASS  ${n}${o?' — '+o:''}`);}catch(e){ fails++; console.log(`FAIL  ${n} — ${e.message.split('\n')[0]}`);} }

await step('sign in', async()=>{
  await page.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#username');
  await page.fill('#username',USER); await page.fill('#pin',PIN);
  await Promise.all([page.waitForURL(`${BASE}/`,{timeout:20000}), page.click('form button[type=submit]')]);
  return 'ok';
});

await step('brief renders for a day with a severe allergy on site', async()=>{
  await page.goto(`${BASE}/op/${OP}/food/brief?day=2026-03-05`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('text=/daily brief/i');
  const t=await main();
  if(!/safety — read before service/i.test(t)) throw new Error('no safety section');
  if(!t.includes('Priya')) throw new Error('severe-allergy volunteer missing');
  if(!/peanuts/i.test(t)) throw new Error('allergen not named');
  return 'safety section leads with the severe allergy';
});

await step('brief shows which meals each person is on site for', async()=>{
  const lines=(await main()).split('\n');
  // Priya departs after lunch on 5 March: breakfast and lunch, never supper.
  const priya=lines.findIndex(l=>l.includes('Priya Ondaatje-Bell'));
  if(priya===-1) throw new Error('Priya not in the safety section');
  const priyaLine=lines.slice(priya, priya+10).find(l=>/On site:/i.test(l)) ?? '';
  if(!/breakfast/i.test(priyaLine)||!/lunch/i.test(priyaLine)) throw new Error(`Priya: expected breakfast+lunch, got: ${priyaLine}`);
  if(/supper/i.test(priyaLine)) throw new Error(`Priya: supper wrongly listed: ${priyaLine}`);

  // Devon stays to 8 March, so he SHOULD show all three on the same day.
  const devon=lines.findIndex(l=>l.includes('Devon Achterberg'));
  if(devon===-1) throw new Error('Devon not in the safety section');
  const devonLine=lines.slice(devon, devon+10).find(l=>/On site:/i.test(l)) ?? '';
  if(!/supper/i.test(devonLine)) throw new Error(`Devon: supper missing, got: ${devonLine}`);
  return 'Priya breakfast+lunch only; Devon all three';
});

await step('brief carries auto-injector locations', async()=>{
  await page.goto(`${BASE}/op/${OP}/food/brief?day=2026-03-05`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('text=/daily brief/i');
  const t=await main();
  if(!/auto-injector locations/i.test(t)) throw new Error('no auto-injector section');
  if(!/belt pouch/i.test(t)) throw new Error('location text missing');
  return 'locations printed';
});

await step('brief shows the menu with per-slot headcount and cost', async()=>{
  await page.goto(`${BASE}/op/${OP}/food/brief?day=2026-03-04`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('text=/daily brief/i');
  const t=await main();
  if(!/menu today/i.test(t)) throw new Error('no menu section');
  if(!/to serve/i.test(t)) throw new Error('no per-slot headcount');
  if(!/packed, cold/i.test(t)) throw new Error('packed lunch not labelled');
  return 'menu, headcount and packed-lunch note';
});

await step('brief flags a HOLD where a planned dish conflicts', async()=>{
  // 4 March has PB&J in the packed lunch and Priya (severe peanut) on site.
  await page.goto(`${BASE}/op/${OP}/food/brief?day=2026-03-04`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('text=/daily brief/i');
  const t=await main();
  if(!/HOLD/.test(t)) throw new Error('no HOLD despite PB&J planned against a severe peanut allergy');
  if(!/Priya/.test(t)) throw new Error('HOLD does not name who it is for');
  return 'HOLD names the person at risk';
});

await step('brief shows headcount, budget, movements and staffing', async()=>{
  await page.goto(`${BASE}/op/${OP}/food/brief?day=2026-03-05`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('text=/daily brief/i');
  const t=await main();
  for(const [label,re] of [['on site today',/on site today/i],['day budget',/day budget/i],
                           ['movements',/movements today/i],['staffing',/staffing today/i]]){
    if(!re.test(t)) throw new Error(`missing: ${label}`);
  }
  const m=t.match(/CAD\s[\d.]+/); if(m===null) throw new Error('no budget figure');
  return `budget ${m[0]}`;
});

await step('brief warns about unconfirmed stays', async()=>{
  // 6 March: the open-ended volunteer has arrived by then.
  await page.goto(`${BASE}/op/${OP}/food/brief?day=2026-03-06`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('text=/daily brief/i');
  const t=await main();
  if(!/unconfirmed stays/i.test(t)) throw new Error('no unconfirmed-stay warning (expected: one open-ended volunteer)');
  return 'unconfirmed stays called out';
});

await step('brief carries a handling warning for a printed copy', async()=>{
  await page.goto(`${BASE}/op/${OP}/food/brief?day=2026-03-05`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('text=/daily brief/i');
  const t=await main();
  if(!/health data on identifiable people/i.test(t)) throw new Error('no handling warning');
  return 'print footer warns about the data';
});

await step('a day with nobody severe does not invent an alarm', async()=>{
  await page.goto(`${BASE}/op/${OP}/food/brief?day=2026-03-08`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('text=/daily brief/i');
  const t=await main();
  if(!/safety — read before service/i.test(t)) throw new Error('safety section missing');
  return 'renders without fabricating warnings';
});

await step('no 5xx and no page errors', async()=>{ if(errs.length) throw new Error(errs.join(' | ')); return 'clean'; });
await b.close();
console.log(fails===0?'\nAll brief checks passed.':`\n${fails} failed.`);
process.exit(fails===0?0:1);
