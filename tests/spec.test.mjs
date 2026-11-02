import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, BACKGROUNDS, FACTIONS, JOBS, CYBER, WEAPONS, ARMORS, TOOLS, BOSSES, NEWS, EVENTS, STORY_RUNNERS, UNLOCKS } from '../src/data.js';
import * as engine from '../src/engine.js';

test('the full baseline and all five story runners are present, not replaced with a sample subset', () => {
  assert.deepEqual(Object.keys(ROLES).sort(), ['driver','medic','net','solo','tech']);
  assert.deepEqual([1,2,3].map(rank => JOBS.filter(j => j.rank === rank && !j.unlock).length), [9,6,3]);
  assert.equal(NEWS.length, 17);
  assert.equal(STORY_RUNNERS.length, 5);
  assert.ok(CYBER.length >= 31 + 10);
  assert.ok(WEAPONS.length + ARMORS.length + TOOLS.length >= 21);
});

test('content IDs are unique, route keys are unique within each job, and references are valid', () => {
  for (const group of [BACKGROUNDS, JOBS, CYBER, WEAPONS, ARMORS, TOOLS, NEWS, EVENTS, STORY_RUNNERS, UNLOCKS]) {
    assert.equal(new Set(group.map(x=>x.id)).size, group.length);
  }
  const allowedField = new Set(['stealth','trap','door','negotiate','medical','drive','escape','combat','rest','objective']);
  const allowedNet = new Set(['camera','ice','data']);
  for (const job of JOBS) {
    assert.ok(FACTIONS[job.target], `${job.id} target`);
    assert.ok(job.required.every(role=>ROLES[role]), `${job.id} required role`);
    assert.ok(job.duration === 1 || job.duration === 2);
    assert.ok(job.routes.length >= 2, `${job.id} offers meaningful route choice`);
    assert.equal(new Set(job.routes.map(x=>x.id)).size, job.routes.length);
    for (const route of job.routes) {
      assert.ok(route.phases.length >= 3);
      assert.ok(route.phases.some(p=>p.field === 'objective'));
      for (const p of route.phases) {
        assert.ok(allowedField.has(p.field), `${job.id}: field ${p.field}`);
        assert.ok(p.net == null || allowedNet.has(p.net));
        assert.ok(Number.isFinite(p.dv));
      }
    }
  }
  const contentIDs = new Set([...CYBER,...WEAPONS,...ARMORS,...TOOLS].map(x=>x.id));
  for (const boss of Object.values(BOSSES)) assert.ok(contentIDs.has(boss.loot), boss.loot);
});

test('six backgrounds retain the specified initial roles and unlock costs', () => {
  const expected = {
    solo: {roles:['solo','driver'],cost:0},
    net: {roles:['net','tech'],cost:0},
    medic: {roles:['medic','solo'],cost:0},
    corp: {roles:['tech','driver'],cost:20},
    snake: {roles:['solo','solo'],cost:35},
    mix: {roles:['solo','net','medic'],cost:60}
  };
  assert.equal(BACKGROUNDS.length, 6);
  for (const b of BACKGROUNDS) {
    assert.deepEqual(b.roles, expected[b.id].roles);
    assert.equal(b.cost, expected[b.id].cost);
  }
});

test('all named cyber build centers use the required slots, humanity costs, and acts', () => {
  const expected = {
    setsuna1:['nerve',12,1], setsuna2:['nerve',18,2], setsuna3:['nerve',26,3],
    mikiri:['nerve',6,1], onibi:['organ',10,2], kamaitachi:['arm',9,1],
    nio:['arm',9,1], joro:['arm',8,2], hammer:['arm',10,2],
    oboro:['skin',9,2], interrupt:['brain',7,1], yata:['sense',5,1], heart3:['organ',18,3]
  };
  for (const [id, values] of Object.entries(expected)) {
    const c = CYBER.find(x=>x.id===id);
    assert.ok(c, id);
    assert.deepEqual([c.slot,c.humanity,c.act], values, id);
  }
  for (const c of CYBER) {
    assert.ok(['nerve','brain','sense','arm','organ','skin'].includes(c.slot));
    assert.ok(['passive','active','builtin'].includes(c.type));
    assert.ok(c.roles.every(role=>ROLES[role]));
    assert.ok(c.humanity > 0 && c.price > 0);
  }
  assert.equal(CYBER.find(c=>c.id==='mimic').family, CYBER.find(c=>c.id==='oboro').family,
    'optical camouflage is a genuine upgrade family and replaces its lower model');
});

test('equipment prices and restrictions preserve the specified trade-offs', () => {
  const prices = {nanami:800,yodaka:1500,raiden:2600,tsubame:2200,smart:2400,onigawara:1800,
    ozutsu:3500,yotaka:2500,pierce:2800,murasame:3000,hanabi:3000,rail:5000,namazu:900,
    jacket:700,mesh:1200,'heavy-vest':1800,absorb:2400,hazmat:1600,exo:4500,poncho:1600,uniform:1800,coat:1400,hood:1400};
  const equipment = [...WEAPONS,...ARMORS];
  for (const [id,price] of Object.entries(prices)) assert.equal(equipment.find(e=>e.id===id)?.price, price, id);
  assert.deepEqual(WEAPONS.find(x=>x.id==='pierce').roles,['solo']);
  assert.deepEqual(ARMORS.find(x=>x.id==='exo').roles,['solo']);
  assert.deepEqual(ARMORS.find(x=>x.id==='hood').roles,['net']);
});

test('meta choices total 390 credit and never add direct permanent stat bonuses', () => {
  assert.equal(UNLOCKS.reduce((n,u)=>n+u.cost,0),390);
  for (const u of UNLOCKS) {
    assert.equal(u.effects, undefined);
    assert.equal(u.stats, undefined);
  }
  for (const r of STORY_RUNNERS) assert.equal(UNLOCKS.find(u=>u.id===r.id)?.cost,40);
  assert.equal(UNLOCKS.find(u=>u.id==='cyber')?.cost,25);
  assert.equal(UNLOCKS.find(u=>u.id==='jobs')?.cost,50);
  for (const job of JOBS.filter(j=>j.unlock)) assert.ok(UNLOCKS.some(u=>u.id===job.unlock));
});

const copy = x => JSON.parse(JSON.stringify(x));
function visit(run, type, jobId = 'lost-chip') {
  run.stage = 'map';
  run.map = [{night:run.night,nodes:[{id:'fixture-node',night:run.night,type,jobId}]}];
  assert.ok(engine.selectNode(run,'fixture-node'));
  return run;
}
function mission(seed='spec', background='solo', type='job', jobId='lost-chip') {
  const run = engine.newRun({seed,background});
  visit(run,type,jobId);
  assert.ok(engine.startMission(run));
  return run;
}
function succeed(run) {
  run.mission.columns=[];
  run.mission.column=0;
  run.mission.objectives=1;
  run.mission.bossHP=0;
  engine.advanceMission(run);
  assert.equal(run.stage,'reward');
}

test('map generation satisfies every night guarantee across 200 seeds and all acts', () => {
  for (let seed=0; seed<200; seed++) {
    const run=engine.newRun({seed:`map-${seed}`});
    for (let act=1; act<=3; act++) {
      const rows=run.map;
      assert.equal(rows.length,4);
      assert.deepEqual(rows.map(row=>row.nodes.length),[3,3,2,1]);
      for (const row of rows) assert.equal(new Set(row.nodes.map(n=>n.type)).size,row.nodes.length);
      assert.ok(rows[0].nodes.some(n=>n.type==='job'));
      assert.ok(rows[1].nodes.some(n=>n.type==='job'));
      assert.ok(rows[1].nodes.some(n=>['doctor','shop'].includes(n.type)));
      assert.ok(rows[2].nodes.some(n=>['rest','doctor'].includes(n.type)));
      for(const node of rows[2].nodes.filter(n=>n.jobId)) {
        assert.equal(engine.nodeJob(run,node).duration,1,'a two-night contract cannot occupy the night reserved for the big job');
      }
      assert.equal(rows[3].nodes[0].type,'boss');
      if(act===1) assert.ok(rows.every(row=>row.nodes.every(n=>n.type!=='danger')));
      if(act<3) {
        run.night=act*4;
        visit(run,'boss');
        engine.startMission(run);
        succeed(run);
        engine.chooseReward(run,-1);
        if(run.stage==='alliance') engine.service(run,'alliance',{id:'mitsukane'});
        assert.equal(run.night,act*4+1);
      }
    }
  }
});

test('two-night jobs charge both available optional nights and cannot skip the mandatory big job', () => {
  for (const night of [5,6]) {
    const run=engine.newRun({seed:`two-${night}`});
    run.night=night;
    visit(run,'job','night-ferry');
    engine.startMission(run);
    succeed(run);
    const before=run.money;
    engine.chooseReward(run,-1);
    assert.equal(run.night,Math.min(8,night+2));
    assert.equal(run.summary.nights,2);
    const expected=2*(200+run.team.reduce((sum,r)=>sum+r.wage,0));
    assert.equal(run.money,before+500-expected);
  }
});

test('two-night contracts are rejected on the night before a mandatory big job', () => {
  const run=engine.newRun({seed:'two-night-before-boss'});
  run.night=7;
  visit(run,'job','night-ferry');
  assert.equal(engine.startMission(run),false);
  assert.equal(run.stage,'briefing');
  assert.equal(run.mission,null);
});

test('boss withdrawal preserves damage, permits one retry, and keeps the act night', () => {
  const run=engine.newRun({seed:'retry'});
  run.night=4;
  visit(run,'boss');
  engine.startMission(run);
  run.bossDamage[1]=1;
  run.mission.bossHP=1;
  run.stage='decision';
  run.mission.decision={kind:'risk'};
  engine.decide(run,'retreat');
  assert.equal(run.stage,'map');
  assert.equal(run.night,4);
  assert.equal(run.extraNights,1);
  visit(run,'boss');
  engine.startMission(run);
  assert.equal(run.mission.bossHP,1);
  run.stage='decision';
  run.mission.decision={kind:'risk'};
  engine.decide(run,'retreat');
  assert.equal(run.stage,'result');
  assert.equal(run.result.won,false);
});

test('a won run settles the twelfth night, including its costs and credit', () => {
  const run=engine.newRun({seed:'night12'});
  run.night=12;
  run.summary.nights=11;
  run.alliance='mitsukane';
  visit(run,'boss');
  engine.startMission(run);
  succeed(run);
  const before=run.money;
  const expense=200+run.team.reduce((sum,r)=>sum+r.wage,0);
  engine.chooseReward(run,-1);
  assert.equal(run.stage,'ending');
  assert.equal(run.summary.nights,12);
  assert.equal(run.money,before+500-expense);
  engine.service(run,'ending',{id:'publish'});
  assert.equal(run.stage,'result');
  assert.equal(run.result.won,true);
});

test('events apply the displayed cash, relation and fragment effects and cannot be repeated', () => {
  const run=engine.newRun({seed:'event'});
  visit(run,'event');
  run.service.event=copy(EVENTS.find(e=>e.id==='snake-visit'));
  const before=run.money;
  engine.service(run,'event',{index:0});
  assert.equal(run.money,before+600);
  assert.equal(run.snake,15);
  assert.equal(engine.service(run,'event',{index:0}),false);
  assert.equal(run.money,before+600);
});

test('event purchases reject insufficient funds without applying any effect', () => {
  const run=engine.newRun({seed:'event-funds'});
  visit(run,'event');
  run.service.event=copy(EVENTS.find(e=>e.id==='street-clinic'));
  run.money=100;
  run.team[0].hp=5;
  assert.equal(engine.service(run,'event',{index:1}),false);
  assert.equal(run.team[0].hp,5);
  assert.equal(run.money,100);
});

test('a recovered story fragment survives finalization into the meta archive', () => {
  const run=engine.newRun({seed:'fragment'}), meta=engine.newMeta();
  visit(run,'event');
  run.service.event=copy(EVENTS.find(e=>e.id==='old-radio'));
  engine.service(run,'event',{index:1});
  engine.endRun(run,'fragment test');
  engine.finalizeRun(run,meta);
  assert.ok(meta.fragments.some(f=>f.id.includes('radio')));
});

test('a second premium evacuation in one job uses the basic plan', () => {
  const run=mission('insurance');
  run.money=10000;
  for(const r of run.team) {r.insurance='premium';r.stats.BODY=0;r.hp=0;}
  engine.deathSave(run,run.team[0]);
  assert.equal(run.mission.premiumUsed,true);
  const before=run.money;
  engine.deathSave(run,run.team[1]);
  assert.equal(before-run.money,Math.round(run.mission.job.pay*.3));
  assert.equal(run.team[1].hp,1);
});

test('Hakuro camera failure adds the advertised two reinforcements', () => {
  const run=mission('cameras','net');
  run.mission.job.target='hakuro';
  run.mission.columns=[{field:'combat',net:null,dv:13}];
  engine.netPhase(run,'camera',100);
  engine.advanceMission(run);
  engine.advanceMission(run);
  assert.equal(run.mission.enemies.length,4);
});

test('boss rewards always contain the boss own gear', () => {
  for(const [act,company,key] of [[1,null,'act1'],[2,'mitsukane','act2'],[3,'mitsukane','mitsukane'],[3,'verde','verde'],[3,'hakuro','hakuro']]) {
    for(let seed=0;seed<10;seed++) {
      const run=engine.newRun({seed:`loot-${act}-${company}-${seed}`});
      run.night=act*4;
      run.alliance=company;
      visit(run,'boss');
      engine.startMission(run);
      succeed(run);
      assert.ok(run.rewards.some(r=>r.id===BOSSES[key].loot),`${key} / ${seed}`);
    }
  }
});

test('credit unlock IDs immediately allow their background, with no permanent stat growth', () => {
  const meta=engine.newMeta();
  meta.credit=1000;
  for(const id of ['corp','snake','mix']) {
    assert.equal(engine.buyUnlock(meta,id),true);
    const run=engine.newRun({seed:'unlock-'+id,background:id},meta);
    assert.equal(run.background,id);
    assert.deepEqual(run.team[0].stats,ROLES[run.team[0].role].stats);
  }
  assert.throws(()=>engine.newRun({background:'corp'},engine.newMeta()));
});

test('therapy lasts through the next night and rest cannot be repeatedly farmed', () => {
  const run=engine.newRun({seed:'therapy'});
  visit(run,'doctor');
  const r=run.team[0];
  r.humanity=20;
  const money=run.money;
  assert.ok(engine.service(run,'therapy',{runnerId:r.id}));
  assert.equal(r.humanity,35);
  assert.equal(run.money,money-600);
  assert.equal(r.unavailableUntil,3);
  engine.finishNight(run);
  visit(run,'job');
  assert.equal(engine.startMission(run,{field:[r.id],net:null}),false);
  run.stage='map';
  visit(run,'rest');
  const humanity=r.humanity;
  engine.service(run,'rest');
  assert.equal(r.humanity,humanity+5);
  assert.equal(engine.service(run,'rest'),false);
});

test('serializing at a decision preserves the exact random continuation', () => {
  const run=mission('serialize');
  run.stage='decision';
  run.mission.decision={kind:'risk'};
  const restored=copy(run);
  engine.decide(run,'continue');
  engine.decide(restored,'continue');
  for(let step=0;step<200 && run.stage==='mission';step++) {
    engine.advanceMission(run);
    engine.advanceMission(restored);
    assert.deepEqual(restored,run);
  }
});

test('armor-piercing defeats normal armor but does not erase all four boss durability at once', () => {
  const run=engine.newRun({seed:'steel-boss',background:'net'});
  run.night=12;
  run.alliance='mitsukane';
  visit(run,'boss');
  engine.startMission(run);
  const r=run.team.find(r=>r.role==='tech');
  r.weapon='rail';
  r.skills.shoot=100;
  r.used.combat={};
  run.mission.field=[r.id];
  run.mission.net=null;
  run.mission.support=[];
  run.mission.columns=[{net:null,field:'combat',dv:19}];
  run.mission.netDone=true;
  run.mission.enemies=[{id:'steel-boss',name:'鋼の番犬',type:'armor',boss:true,hp:4,maxHP:4,dv:20,attack:-100,dice:1,bonus:0}];
  engine.advanceMission(run);
  assert.equal(run.mission.bossHP,3);
});

test('the 1-to-15 humanity band rolls for a seizure without also rolling unstable-band shaking', () => {
  for(let seed=0;seed<100;seed++) {
    const run=mission('seizure-band-'+seed);
    run.mission.columns=[{net:null,field:'combat',dv:13}];
    run.mission.netDone=true;
    run.mission.job.target='mitsukane';
    run.team.forEach(r=>r.humanity=15);
    engine.advanceMission(run);
    assert.ok(run.team.every(r=>!r.used.shaken),String(seed));
  }
});

test('cyber slot replacement is explicit, upgrades reuse a slot, and removing never refunds humanity', () => {
  const run=engine.newRun({seed:'slots'});
  run.metaSnapshot.unlocks.push('cyber');
  run.money=100000;
  visit(run,'doctor');
  const r=run.team[0];
  const buy=(id,replaceId)=>engine.service(run,'buy',{id,type:'cyber',runnerId:r.id,replaceId});
  assert.ok(buy('reflex1'));
  assert.ok(buy('synapse1'));
  const before={cash:run.money,humanity:r.humanity,cyber:[...r.cyber]};
  assert.equal(buy('setsuna1'),false);
  assert.equal(run.money,before.cash);
  assert.equal(r.humanity,before.humanity);
  assert.deepEqual(r.cyber,before.cyber);
  assert.ok(buy('setsuna1','reflex1'));
  assert.equal(r.humanity,before.humanity-12);
  assert.deepEqual(r.cyber,['synapse1','setsuna1']);
  run.night=5;
  visit(run,'doctor');
  const humanity=r.humanity;
  assert.ok(buy('setsuna2'));
  assert.deepEqual(r.cyber,['synapse1','setsuna2']);
  assert.equal(r.humanity,humanity-18);
});

test('role-incompatible surgery fails without charging cash or humanity', () => {
  const run=engine.newRun({seed:'roles'});
  visit(run,'doctor');
  const r=run.team[0],before=copy(r),cash=run.money;
  assert.equal(engine.service(run,'buy',{id:'deck1',type:'cyber',runnerId:r.id}),false);
  assert.equal(run.money,cash);
  assert.deepEqual(r,before);
});

test('the doctor background reduces install humanity cost while keeping a minimum cost of one', () => {
  const run=engine.newRun({seed:'doctor-cost',background:'medic'});
  visit(run,'doctor');
  const r=run.team[0],before=r.humanity;
  assert.ok(engine.service(run,'buy',{id:'ear1',type:'cyber',runnerId:r.id}));
  assert.equal(r.humanity,before-2);
});

test('gas traps ignore ordinary armor but protective clothing stops the gas entirely', () => {
  const run=mission('gas');
  run.mission.job.target='verde';
  const protectedRunner=run.team[0],normal=run.team[1];
  protectedRunner.armorId='hazmat';
  const beforeProtected=protectedRunner.hp,beforeNormal=normal.hp;
  normal.armor=1000;
  engine.fieldPhase(run,'trap',100);
  assert.equal(protectedRunner.hp,beforeProtected);
  assert.ok(normal.hp<beforeNormal);
  assert.equal(normal.armor,1000);
});

test('rampaging runners are excluded from Lazarus rescue, even with premium insurance', () => {
  const run=mission('no-rampage-rescue');
  const r=run.team[0];
  r.stats.BODY=0;
  r.insurance='premium';
  r.used.rampage=true;
  r.hp=0;
  const cash=run.money;
  engine.deathSave(run,r);
  assert.equal(r.status,'dead');
  assert.equal(run.money,cash);
  assert.ok(!run.mission.evacuated.includes(r.id));
});

test('three negative-balance nights end the business, while a positive night resets the streak', () => {
  const run=engine.newRun({seed:'bankruptcy'});
  run.money=-10000;
  for(let i=1;i<=3;i++) {
    visit(run,'rest');
    engine.finishNight(run);
    assert.equal(run.redNights,i);
    assert.equal(run.stage,i===3?'result':'map');
  }
  assert.ok(run.result.reason.includes('廃業'));
  const reset=engine.newRun({seed:'reset-red'});
  reset.redNights=2;
  visit(reset,'rest');
  engine.finishNight(reset);
  assert.equal(reset.redNights,0);
});

test('heat 100 forces a corporate defense instead of optional destinations', () => {
  const run=engine.newRun({seed:'defense'});
  run.heat.hakuro=100;
  const nodes=engine.availableNodes(run);
  assert.equal(nodes.length,1);
  assert.equal(nodes[0].type,'defense');
  assert.equal(nodes[0].target,'hakuro');
});

test('a next-run interlude can occur again, once per run, even if its fragment is already archived', () => {
  const meta=engine.newMeta();
  meta.seen.push('mirror');
  const run=engine.newRun({seed:'new-mirror'},meta);
  visit(run,'event');
  const event=copy(EVENTS.find(e=>e.id==='unclaimed'));
  run.service.event=event;
  run.team[0].humanity=16;
  engine.service(run,'event',{index:1});
  assert.equal(run.storyFlags.filter(f=>f.id==='mirror').length,1);
});

test('protecting a runner fights the police before an objective, without consuming that objective column', () => {
  const run=mission('police-before-objective');
  const m=run.mission;
  m.columns=[{net:null,field:'objective',dv:13}];
  m.column=0;
  m.objectives=0;
  for(const r of run.team){r.skills.shoot=100;r.skills.evade=100;r.used.combat={};}
  run.stage='decision';
  m.decision={kind:'police',runnerId:run.team[0].id};
  m.policePending=run.team[0].id;
  engine.decide(run,'protect');
  assert.equal(m.policeCombat,true);
  for(let step=0;step<4&&m.policeCombat;step++)engine.advanceMission(run);
  assert.equal(m.policeCombat,false);
  assert.equal(m.column,0);
  assert.equal(m.objectives,0);
  assert.equal(run.wantedAct,1);
});

test('surrender records custody separately from death and the remaining squad can continue', () => {
  const run=mission('custody');
  const r=run.team[0];
  run.stage='decision';
  run.mission.decision={kind:'police',runnerId:r.id};
  engine.decide(run,'surrender');
  assert.equal(r.status,'captured');
  assert.equal(run.stage,'mission');
  assert.equal(run.deaths,undefined);
});

test('three rampage kills summon police and active cyberware charges its humanity costs', () => {
  const run=mission('three-rampage-kills');
  const r=run.team[0];
  r.cyber=['onibi','setsuna1'];
  r.skills.shoot=100;
  r.skills.evade=100;
  run.mission.job.target='verde';
  run.mission.columns=[{net:null,field:'combat',dv:13},{net:null,field:'objective',dv:13}];
  run.mission.extraEnemies=1;
  run.mission.netDone=true;
  const humanity=r.humanity;
  engine.advanceMission(run);
  assert.equal(r.used.rampage,true);
  engine.advanceMission(run);
  assert.equal(r.used.rampageKills,3);
  assert.equal(run.stage,'decision');
  assert.equal(run.mission.decision.kind,'police');
  assert.equal(r.humanity,humanity-4);
});

test('ignoring a former runner past the five-night deadline adds a suppression memorial exactly once', () => {
  const run=engine.newRun({seed:'former-deadline'});
  const former=engine.makeRunner(run,'solo','期限を過ぎた仲間');
  former.status='lost';
  run.former.push({runner:former,deadline:2,resolved:false});
  run.night=2;
  visit(run,'rest');
  engine.finishNight(run);
  assert.equal(run.night,3);
  assert.equal(run.former[0].resolved,true);
  assert.equal(run.deaths.filter(x=>x.name===former.name&&x.cause==='鎮圧').length,1);
  visit(run,'rest');
  engine.finishNight(run);
  assert.equal(run.deaths.filter(x=>x.name===former.name).length,1);
});

test('zero humanity at surgery immediately removes the runner and creates the five-night hunt', () => {
  const run=engine.newRun({seed:'zero-humanity'});
  visit(run,'doctor');
  const r=run.team[0];
  r.humanity=1;
  assert.ok(engine.service(run,'buy',{id:'ear1',type:'cyber',runnerId:r.id}));
  assert.equal(r.humanity,0);
  assert.equal(r.status,'lost');
  assert.equal(run.former[0].runner.id,r.id);
  assert.equal(run.former[0].deadline,6);
  engine.finishNight(run);
  assert.ok(engine.availableNodes(run).some(n=>n.type==='hunt'&&n.formerId===r.id));
});

test('a dead field runner never performs a subsequent action or becomes a reward recipient', () => {
  const run=mission('dead-runner');
  const r=run.team[0];
  r.stats.BODY=0;
  r.hp=0;
  engine.deathSave(run,r);
  assert.equal(r.status,'dead');
  const before=r.xp.perception||0;
  engine.fieldPhase(run,'objective',13);
  assert.equal(r.xp.perception||0,before);
  succeed(run);
  run.rewards=[{type:'cyber',id:'ear1',name:'音響センサー',description:''}];
  assert.equal(engine.chooseReward(run,0,r.id),false);
  assert.ok(!r.cyber.includes('ear1'));
});

test('estimating a mission simulates its full outcome without changing live random or squad state', () => {
  const run=engine.newRun({seed:'estimate-isolation'});
  const node=engine.availableNodes(run).find(n=>n.type==='job');
  const before=structuredClone(run);
  const p=engine.estimate(run,node,{samples:16});
  assert.ok(p>=0&&p<=1);
  assert.equal(p*16,Math.round(p*16));
  assert.deepEqual(run,before);
});

test('the maintenance chief has exactly three ICE checks rather than an extra generic fourth check', () => {
  const run=engine.newRun({seed:'three-ice',background:'net'});
  run.night=12;
  run.alliance='hakuro';
  visit(run,'boss');
  engine.startMission(run);
  const hacker=run.team.find(r=>r.role==='net');
  hacker.skills.interface=100;
  engine.netPhase(run,'ice',19);
  assert.equal(hacker.xp.interface,3);
  assert.equal(run.mission.bossBypass,true);
});

test('physical network disconnection uses its fixed DV20 rather than the route door DV', () => {
  const run=engine.newRun({seed:'physical-disconnect',background:'net'});
  run.night=12;
  run.alliance='hakuro';
  visit(run,'boss');
  engine.startMission(run);
  const tech=run.team.find(r=>r.role==='tech');
  tech.skills.electronics=100;
  engine.fieldPhase(run,'door',19);
  assert.equal(run.mission.bossBypass,true);
  assert.ok(run.mission.log.some(l=>l.text.includes('電子')&&l.text.includes('DV20')));
});

test('bringing the subject back to sanity requires one fixed persuasion DV18 check', () => {
  const run=engine.newRun({seed:'subject-mercy',background:'medic'});
  run.night=12;
  run.alliance='verde';
  visit(run,'boss');
  engine.startMission(run);
  const medic=run.team.find(r=>r.role==='medic');
  medic.skills.persuade=100;
  engine.fieldPhase(run,'negotiate',19);
  assert.equal(medic.xp.persuade,1);
  assert.equal(run.mission.mercy,true);
  assert.ok(run.mission.log.some(l=>l.text.includes('説得')&&l.text.includes('DV18')));
});

function reachEnding(meta=engine.newMeta(),company='mitsukane') {
  const run=engine.newRun({seed:'ending-'+company},meta);
  run.night=12;
  run.summary.nights=11;
  run.summary.bosses=2;
  run.alliance=company;
  visit(run,'boss');
  engine.startMission(run);
  succeed(run);
  engine.chooseReward(run,-1);
  assert.equal(run.stage,'ending');
  return run;
}

test('new players may publish or seal the box, while the memory-based ending remains locked', () => {
  const run=reachEnding();
  assert.deepEqual(run.endingOptions.map(e=>e.id),['publish','seal','release']);
  assert.ok(!run.endingOptions.find(e=>e.id==='publish').locked);
  assert.ok(!run.endingOptions.find(e=>e.id==='seal').locked);
  assert.equal(run.endingOptions.find(e=>e.id==='release').locked,true);
  assert.equal(engine.service(run,'ending',{id:'release'}),false);
  assert.equal(run.stage,'ending');
  assert.ok(engine.service(run,'ending',{id:'seal'}));
  assert.equal(run.stage,'result');
  assert.equal(run.ending,'seal');
  assert.equal(run.result.credit,42);
});

test('archived act fragments unlock an alternative ending and ending choice survives serialization', () => {
  const meta=engine.newMeta();
  meta.fragments=[{id:'box-1-key'},{id:'box-2-mitsukane'}];
  const run=reachEnding(meta,'hakuro');
  assert.equal(run.endingOptions.find(e=>e.id==='release').locked,false);
  const restored=copy(run);
  engine.service(restored,'ending',{id:'release'});
  assert.equal(restored.stage,'result');
  assert.equal(restored.ending,'release');
  assert.equal(restored.result.won,true);
  assert.equal(restored.result.credit,42);
  engine.finalizeRun(restored,meta);
  assert.equal(meta.credit,42);
  assert.equal(meta.maxDifficulty,1);
  const saved=copy(meta);
  engine.finalizeRun(restored,meta);
  assert.deepEqual(meta,saved);
});

test('radio and identity-card fragments provide a second path to the memory ending', () => {
  const meta=engine.newMeta();
  meta.fragments=[{id:'radio'},{id:'wallet'}];
  const run=reachEnding(meta,'verde');
  assert.equal(run.endingOptions.find(e=>e.id==='release').locked,false);
  engine.service(run,'ending',{id:'release'});
  assert.equal(run.result.won,true);
});

test('one current run cannot bypass the ending archive gate by collecting its own act fragments', () => {
  const run=engine.newRun({seed:'current-fragments'});
  run.night=12;
  run.alliance='mitsukane';
  run.storyFlags=[{id:'box-1-key'},{id:'box-2-mitsukane'}];
  visit(run,'boss');
  engine.startMission(run);
  succeed(run);
  engine.chooseReward(run,-1);
  assert.equal(run.endingOptions.find(e=>e.id==='release').locked,true);
});

test('each corporate publication route has a distinct epilogue and a distinct sealed alternative', () => {
  const published=[];
  for(const company of ['mitsukane','verde','hakuro']) {
    const run=reachEnding(engine.newMeta(),company);
    const seal=copy(run);
    engine.service(run,'ending',{id:'publish'});
    engine.service(seal,'ending',{id:'seal'});
    published.push(run.result.epilogue);
    assert.notEqual(run.result.epilogue,seal.result.epilogue);
  }
  assert.equal(new Set(published).size,3);
});

test('hunting a former runner always reaches a confrontation instead of silently completing a normal job', () => {
  const run=engine.newRun({seed:'hunt-audit'});
  const former=engine.makeRunner(run,'solo','対決すべき元部下');
  former.status='lost';
  run.former.push({runner:former,deadline:6,resolved:false});
  const node=engine.availableNodes(run).find(n=>n.type==='hunt');
  engine.selectNode(run,node.id);
  const job=engine.nodeJob(run);
  assert.ok(job.routes.every(route=>route.phases.some(phase=>phase.field==='combat')));
  engine.startMission(run);
  for(const r of run.team){for(const key of Object.keys(r.skills))r.skills[key]=100;r.hp=engine.getRunnerMaxHP(r);}
  for(let step=0;step<100&&['mission','decision'].includes(run.stage);step++) {
    if(run.stage==='decision')engine.decide(run,'continue');
    else engine.advanceMission(run);
  }
  assert.ok(run.logs.some(l=>l.text.includes('交戦開始')&&l.text.includes(former.name)));
  assert.equal(run.former[0].resolved,true);
});

test('the port warehouse has distinct non-allied corporate security for all three alliance branches', () => {
  const branches=[];
  for(const company of ['mitsukane','verde','hakuro']) {
    const run=engine.newRun({seed:'security-branches'});
    run.night=8;
    run.alliance=company;
    visit(run,'boss');
    engine.startMission(run);
    const job=run.mission.job;
    assert.ok(['mitsukane','verde','hakuro'].includes(job.securityFaction));
    assert.notEqual(job.securityFaction,company);
    assert.equal(job.target,'scav');
    run.mission.columns=[{net:null,field:'combat',dv:17}];
    run.mission.netDone=true;
    engine.advanceMission(run);
    branches.push({security:job.securityFaction,guards:run.mission.enemies.filter(e=>!e.boss).map(e=>e.type).sort().join(',')});
  }
  assert.equal(new Set(branches.map(b=>b.security)).size,3);
  assert.ok(new Set(branches.map(b=>b.guards)).size>1);
});

test('installing an arm blade never forces a weaker attack than the carried assault rifle against a sniper', () => {
  const shotBase=cyber=>{
    const run=mission('weapon-audit');
    const solo=run.team[0];
    solo.cyber=cyber;
    solo.weapon='yotaka';
    solo.used.combat={};
    run.mission.field=[solo.id];
    run.mission.support=[];
    run.mission.net=null;
    run.mission.columns=[{field:'combat',dv:13,net:null}];
    run.mission.netDone=true;
    run.mission.enemies=[{id:'sniper-audit',type:'sniper',name:'遠距離の狙撃手',hp:20,dv:100,attack:-100,dice:1,bonus:0}];
    engine.advanceMission(run);
    return Number(run.mission.log.find(l=>l.text.includes('射撃：')).text.match(/射撃：(-?\d+)/)[1]);
  };
  assert.ok(shotBase(['kamaitachi','nio'])>=shotBase(['nio']));
});

test('mandatory big-job nights do not gain optional hunts or personal errands', () => {
  const run=engine.newRun({seed:'mandatory-boss'});
  run.night=4;
  const former=engine.makeRunner(run,'solo','元部下');
  former.status='lost';
  run.former.push({runner:former,deadline:8,resolved:false});
  run.team[0].storyId='yoru';
  run.team[0].missions=3;
  const nodes=engine.availableNodes(run);
  assert.equal(nodes.length,1);
  assert.equal(nodes[0].type,'boss');
});

test('Mikiri rerolls failed evasion, never replaces failed ICE interface with an evasion check', () => {
  const run=mission('mikiri-audit');
  const r=run.team[0];
  r.cyber=['mikiri'];
  r.skills.interface=-100;
  r.skills.evade=100;
  r.skills.shoot=-100;
  r.used.combat={};
  run.mission.field=[r.id];
  run.mission.support=[];
  run.mission.net=null;
  run.mission.columns=[{field:'combat',dv:13,net:null}];
  run.mission.netDone=true;
  run.mission.enemies=[{id:'ice-audit',type:'net',name:'ICE攻撃',hp:20,dv:100,attack:20,dice:2,bonus:0}];
  const hp=r.hp;
  engine.advanceMission(run);
  assert.ok(r.hp<hp);
  assert.ok(!r.used.combat.mikiri);
});

test('rehiring a poached runner restores one usable identity instead of duplicating the inactive ID', () => {
  const run=mission('rehire');
  const old=run.team[0];
  old.cyber=['eye1'];
  old.status='poached';
  run.poached=[copy(old)];
  run.stage='reward';
  run.rewards=[{type:'runner',runner:{...copy(old),status:'active',loyalty:50},id:old.id,name:old.name}];
  assert.ok(engine.chooseReward(run,0));
  assert.equal(new Set(run.team.map(r=>r.id)).size,run.team.length);
  const restored=run.team.find(r=>r.id===old.id);
  assert.equal(restored.status,'active');
  assert.deepEqual(restored.cyber,['eye1']);
  assert.ok(engine.service(run,'contract',{runnerId:old.id,contract:'share'}));
  assert.equal(restored.contract,'share');
});

test('a share-contract runner pays only for cyberware actually installed, including when a body slot is full', () => {
  const run=mission('auto-full');
  const r=run.team[0];
  r.contract='share';
  r.cyber=['synapse1','setsuna1'];
  r.wallet=2000;
  const initial=[...r.cyber];
  const netPay=Math.round(run.mission.job.pay*.8*(1+(run.news?.pay||0)));
  const earnings=Math.round(netPay*.12);
  succeed(run);
  const installed=r.cyber.filter(id=>!initial.includes(id));
  const priceInstalled=installed.reduce((sum,id)=>sum+CYBER.find(c=>c.id===id).price,0);
  assert.equal(2000+earnings-r.wallet,priceInstalled);
  assert.ok(run.obtained.every(id=>r.cyber.includes(id)));
});

test('corporate heat above eighty adds a guard to the final big job too', () => {
  for(const company of ['mitsukane','verde','hakuro']) {
    const counts=[];
    for(const heat of [0,90]) {
      const run=engine.newRun({seed:'heat-boss'});
      run.night=12;
      run.alliance=company;
      run.heat[company]=heat;
      visit(run,'boss');
      engine.startMission(run);
      run.mission.columns=[{net:null,field:'combat',dv:19}];
      run.mission.netDone=true;
      engine.advanceMission(run);
      counts.push(run.mission.enemies.length);
    }
    assert.equal(counts[1],counts[0]+1,company);
  }
});

test('defeating a former runner never damages the unrelated act boss', () => {
  const run=engine.newRun({seed:'former-boss-damage'});
  const former=engine.makeRunner(run,'solo','元部下');
  former.status='lost';
  run.former.push({runner:former,deadline:6,resolved:false});
  for(const r of run.team)for(const skill of Object.keys(r.skills))r.skills[skill]=100;
  engine.selectNode(run,engine.availableNodes(run).find(n=>n.type==='hunt').id);
  engine.startMission(run);
  for(let step=0;step<60&&['mission','decision'].includes(run.stage);step++) {
    if(run.stage==='mission')engine.advanceMission(run);
    else engine.decide(run,'continue');
  }
  assert.equal(run.stage,'reward');
  assert.deepEqual(run.bossDamage,{});
  engine.chooseReward(run,-1);
  run.night=4;
  engine.selectNode(run,run.map.find(row=>row.night===4).nodes[0].id);
  engine.startMission(run);
  assert.equal(run.mission.bossHP,engine.bossFor(run).hp);
});

test('boss loot does not re-offer a cyberware item already acquired earlier in the run', () => {
  const run=engine.newRun({seed:'duplicate-boss-loot'});
  run.night=8;
  run.alliance='mitsukane';
  run.obtained.push('eye2');
  visit(run,'boss');
  engine.startMission(run);
  succeed(run);
  assert.ok(run.rewards.every(reward=>!reward.id||!run.obtained.includes(reward.id)));
});

function rngForFirstFace(face) {
  for(let rng=0;rng<1000;rng++)if(engine.rollD10({rng}).first===face)return rng;
  throw Error('Expected a deterministic fixture for d10 face '+face);
}

test('d10 tens add a second die, ones subtract it, and smart linkage protects only the one', () => {
  const ten=engine.rollD10({rng:rngForFirstFace(10)});
  assert.equal(ten.first,10);
  assert.ok(ten.second>=1&&ten.second<=10);
  assert.equal(ten.total,10+ten.second);
  const oneSeed=rngForFirstFace(1);
  const one=engine.rollD10({rng:oneSeed});
  assert.equal(one.first,1);
  assert.ok(one.second>=1&&one.second<=10);
  assert.equal(one.total,1-one.second);
  assert.deepEqual(engine.rollD10({rng:oneSeed},true),{first:1,second:0,total:1});
  assert.deepEqual(engine.rollD10({rng:rngForFirstFace(10)},true),ten);
  assert.equal(engine.probability(0,10),.1);
  assert.equal(engine.probability(0,1),.9);
  assert.equal(engine.probability(0,1,true),1);
});

test('Yata actually removes the natural-one penalty when firing a smart weapon', () => {
  const shot=cyber=>{
    const run=mission('yata-natural-one','net');
    const r=run.team.find(r=>r.role==='tech');
    r.weapon='smart';
    r.cyber=cyber;
    r.used.combat={};
    run.mission.field=[r.id];
    run.mission.support=[];
    run.mission.net=null;
    run.mission.columns=[{net:null,field:'combat',dv:13}];
    run.mission.netDone=true;
    run.mission.enemies=[{id:'smart-target',type:'soldier',name:'的',hp:20,dv:100,attack:-100,dice:1,bonus:0}];
    run.rng=rngForFirstFace(1);
    engine.advanceMission(run);
    return run.mission.log.find(l=>l.text.includes('射撃：')).text;
  };
  assert.ok(shot(['yata']).includes('d10(1)'));
  assert.ok(shot([]).includes('d10(1−'));
});

test('the live doctor stock exposes thirteen initial cyber families and all twenty-six after the credit unlock', () => {
  const families=unlocked=>{
    const meta=engine.newMeta();
    if(unlocked){meta.credit=25;assert.ok(engine.buyUnlock(meta,'cyber'));}
    const run=engine.newRun({seed:'family-gates'},meta);
    run.night=9;
    visit(run,'doctor');
    return new Set(run.service.stock.map(c=>c.family));
  };
  const initial=families(false),all=families(true);
  assert.equal(initial.size,13);
  assert.equal(all.size,26);
  assert.ok([...initial].every(f=>all.has(f)));
  assert.ok(!initial.has('barrier')&&!initial.has('pain'));
  assert.ok(all.has('barrier')&&all.has('pain'));
});

test('healing HP after therapy cannot cancel the required next-night rest', () => {
  const run=engine.newRun({seed:'therapy-heal'});
  visit(run,'doctor');
  const r=run.team[0];
  r.humanity=20;
  assert.ok(engine.service(run,'therapy',{runnerId:r.id}));
  const unavailable=r.unavailableUntil;
  r.hp=1;
  assert.ok(engine.service(run,'heal',{runnerId:r.id}));
  assert.equal(r.hp,engine.getRunnerMaxHP(r));
  assert.equal(r.unavailableUntil,unavailable);
  engine.finishNight(run);
  visit(run,'job');
  assert.equal(engine.startMission(run,{field:[r.id],net:null}),false);
});

test('every personal quest grants its signature and saves its own story fragment into the meta archive', () => {
  for(const story of STORY_RUNNERS) {
    const run=engine.newRun({seed:'personal-'+story.id}),meta=engine.newMeta();
    const r=engine.makeRunner(run,story.role,story.name);
    r.storyId=story.id;
    r.contract='exclusive';
    r.missions=3;
    run.team.push(r);
    const node=engine.availableNodes(run).find(n=>n.type==='personal');
    assert.ok(node,story.id);
    engine.selectNode(run,node.id);
    engine.startMission(run);
    succeed(run);
    assert.equal(r.personalDone,true);
    assert.equal(r.signature,true);
    assert.equal(run.summary.personal,1);
    const flag=run.storyFlags.find(f=>f.id==='personal-'+story.id);
    assert.equal(flag.title,story.quest);
    assert.ok(flag.text.includes(story.reward));
    engine.endRun(run,'個人依頼断片の保存検証');
    engine.finalizeRun(run,meta);
    assert.deepEqual(meta.fragments.find(f=>f.id===flag.id),flag);
  }
});

test('the past-run archive keeps the chosen ending, epilogue and each survivor after the live result is gone', () => {
  const meta=engine.newMeta();
  const run=reachEnding(meta,'hakuro');
  engine.service(run,'ending',{id:'publish'});
  engine.finalizeRun(run,meta);
  const archive=copy(meta).runs[0];
  assert.equal(archive.ending,'publish');
  assert.equal(archive.epilogue,run.result.epilogue);
  assert.deepEqual(archive.after,run.result.after);
  assert.equal(archive.after.length,run.team.filter(r=>r.status==='active').length);
  run.result.after[0]='後から変更しても過去記録を壊さない';
  assert.deepEqual(meta.runs[0].after,archive.after);
});

test('cyber effectiveness counts accumulate across missions and survive saving rather than resetting with combat flags', () => {
  const run=mission('cumulative-effects');
  const r=run.team[0];
  r.cyber=['setsuna1','reflex1'];
  r.skills.shoot=100;
  r.skills.evade=100;
  r.skills.perception=100;
  const fight=()=>{
    run.mission.job.target='mitsukane';
    run.mission.columns=[{net:null,field:'combat',dv:13},{net:null,field:'objective',dv:13}];
    run.mission.netDone=true;
    for(let step=0;step<60&&['mission','decision'].includes(run.stage);step++) {
      if(run.stage==='mission')engine.advanceMission(run);
      else engine.decide(run,'continue');
    }
    assert.equal(run.stage,'reward');
  };
  fight();
  const first=copy(r.effectCounts);
  assert.equal(first.setsuna1,1);
  assert.ok(first.reflex1>0);
  engine.chooseReward(run,-1);
  visit(run,'job');
  engine.startMission(run);
  assert.deepEqual(r.effectCounts,first);
  fight();
  assert.equal(r.effectCounts.setsuna1,2);
  assert.ok(r.effectCounts.reflex1>first.reflex1);
  const saved=copy(run).team.find(person=>person.id===r.id);
  assert.deepEqual(saved.effectCounts,r.effectCounts);
});

test('finalization is idempotent, records the memorial and leaves runner power behind', () => {
  const run=engine.newRun({seed:'finalize'}), meta=engine.newMeta();
  run.summary.nights=4;
  run.summary.bosses=1;
  run.deaths=[{name:'記録される仲間',role:'solo',night:3,cause:'任務中の死亡'}];
  engine.endRun(run,'検証用終了');
  engine.finalizeRun(run,meta);
  const saved=copy(meta);
  engine.finalizeRun(run,meta);
  assert.deepEqual(meta,saved);
  assert.equal(meta.memorial[0].name,'記録される仲間');
  const next=engine.newRun({seed:'next'},meta);
  assert.equal(next.money,3000);
  assert.ok(next.team.every(r=>r.cyber.length===0));
});
