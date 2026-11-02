import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as E from '../src/engine.js';
import {CYBER,ROLES} from '../src/data.js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const failures=[],results=[];
await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
try {
 for(let attempt=0;attempt<4;attempt++) {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>failures.push(e.message));
  await page.goto(process.env.BASE_URL||'http://127.0.0.1:4186',{waitUntil:'networkidle'});
  const click=async(action,id)=>{const selector=`[data-action="${action}"]${id!==undefined?`[data-id="${id}"]`:''}`;await page.locator(selector).filter({visible:true}).first().click({timeout:10000});};
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fixers-cut.rogue.run.v1')));
  await page.locator('#run-seed').fill(`ui-complete-${attempt}`);
  await click('new-run');
  let r=await state(),steps=0,reloaded=false;
  while(r.stage!=='result'&&steps++<700) {
   const ready=r.team.filter(p=>p.status==='active'&&p.hp>0&&p.unavailableUntil<=r.night);
   if(r.stage==='map') {
    const nodes=E.availableNodes(r),health=ready.reduce((n,p)=>n+p.hp/E.getRunnerMaxHP(p),0)/Math.max(1,ready.length);
    const node=nodes.find(n=>n.type==='boss'||n.type==='defense')||(ready.length<4?nodes.find(n=>n.type==='recruit'):null)||(health<.8?nodes.find(n=>n.type==='rest'||n.type==='doctor'):null)||nodes.filter(n=>['job','danger'].includes(n.type)).sort((a,b)=>E.estimate(r,b,{samples:16,intel:true})-E.estimate(r,a,{samples:16,intel:true}))[0]||nodes[0];
    await click('node',node.id);
   } else if(r.stage==='briefing') {
    for(const p of ready)await page.locator(`[data-change="assignment"][data-id="${p.id}"]`).selectOption('reserve');
    const net=ready.find(p=>p.role==='net'),field=ready.filter(p=>p!==net).sort((a,b)=>(b.role==='solo')-(a.role==='solo')||b.hp-a.hp).slice(0,3);
    if(!field.length&&net)field.push(net);
    const support=ready.filter(p=>p!==net&&!field.includes(p)).slice(0,2);
    for(const p of field)await page.locator(`[data-change="assignment"][data-id="${p.id}"]`).selectOption('field');
    for(const p of support)await page.locator(`[data-change="assignment"][data-id="${p.id}"]`).selectOption('support');
    if(net&&!field.includes(net))await page.locator(`[data-change="assignment"][data-id="${net.id}"]`).selectOption('net');
    const intel=r.money>800;
    const options={field:field.map(x=>x.id),support:support.map(x=>x.id),net:net&&!field.includes(net)?net.id:null,intel,samples:24};
    const route=E.nodeJob(r).routes.map(x=>({...x,chance:E.estimate(r,r.selectedNode,{...options,route:x.id})})).sort((a,b)=>b.chance-a.chance)[0];
    await click('route',route.id);
    await page.locator('[data-change="intel"]').setChecked(intel);
    await click('dispatch');
   } else if(r.stage==='mission')await click('advance');
   else if(r.stage==='decision') {
    if(!reloaded){await page.reload({waitUntil:'networkidle'});const restored=await state();if(JSON.stringify(restored)!==JSON.stringify(r))throw Error('Reload changed saved decision');reloaded=true;}
    await click('decision',r.mission.decision.kind==='police'?'surrender':'continue');
   } else if(r.stage==='reward') {
    const priority=r.rewards.map((x,i)=>({x,i,score:x.type==='runner'?20:x.type==='cyber'?12:x.type==='cash'?2:5})).sort((a,b)=>b.score-a.score);
    let taken=false;
    for(const {x,i} of priority){const b=page.locator(`[data-action="reward"][data-index="${i}"]`);if(await b.isEnabled()){await b.click();const next=await state();if(next.stage!=='reward'){taken=true;break;}}}
    if(!taken)await page.locator('[data-action="reward"][data-index="-1"]').click();
   } else if(r.stage==='alliance')await click('alliance','verde');
   else if(r.stage==='ending'){await page.screenshot({path:new URL(`../test-results/ending-${attempt}.png`,import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});await click('ending','publish');}
   else if(r.stage==='service') {
    if(r.service.type==='recruit')for(const p of r.service.candidates){const current=await state();if(current.team.filter(p=>p.status==='active').length>=5||current.money<1000)break;await page.locator(`[data-action="hire"][data-id="${p.id}"][data-contract="share"]`).click();}
    if(r.service.type==='rest'&&!r.service.used)await click('rest');
    if(r.service.type==='event'&&!r.service.used)await page.locator('[data-action="event"][data-index="0"]').click();
    if(r.service.type==='doctor'){
     for(const p of ready)if(p.hp<E.getRunnerMaxHP(p)*.9){const b=page.locator(`[data-action="treatment"][data-id="${p.id}"][data-kind="heal"]`);if(await b.isEnabled())await b.click();}
     const current=await state(),solo=ready.find(p=>p.role==='solo');
     const i=current.service.stock.findIndex(x=>x.special==='setsuna'&&!solo?.cyber.includes(x.id));
     if(solo&&i>=0&&current.money>current.service.stock[i].price+900){await page.locator(`#stock-recipient-${i}`).selectOption(solo.id);await page.locator(`[data-action="buy"][data-index="${i}"]`).click();}
    }
    await click('finish-night');
   }else throw Error('Unhandled stage '+r.stage);
   r=await state();
  }
  if(r.stage!=='result')throw Error('UI run never reached result');
  results.push({seed:r.seed,won:r.result.won,night:r.night,credit:r.result.credit,steps,reloaded,reason:r.result.reason});
  console.log(results.at(-1));
  await page.screenshot({path:new URL(`../test-results/full-run-${attempt}.png`,import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  await click('result-home');
  const meta=await page.evaluate(()=>JSON.parse(localStorage.getItem('fixers-cut.rogue.meta.v1')));
  if(meta.runs.length!==1||meta.credit!==r.result.credit)throw Error('Result not saved exactly once');
  await page.close();
  if(r.result.won)break;
 }
 if(!results.some(r=>r.won))throw Error('Four legitimate UI runs did not produce a verified win');
 if(failures.length)throw Error(failures.join('\n'));
 const hash=async file=>createHash('sha256').update(await readFile(new URL('../'+file,import.meta.url))).digest('hex');
 await writeFile(new URL('../test-results/full-run.json',import.meta.url),JSON.stringify({results,pageErrors:failures,engineSHA256:await hash('src/engine.js'),dataSHA256:await hash('src/data.js')},null,2));
} finally {await browser.close();}
