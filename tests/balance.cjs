// Full-run policies exercise the same public API used by the player.
// No rolls, success flags, balance values, healing or money are injected.
const fs = require('node:fs');
async function main() {
  const E=await import('../src/engine.js');
  const D=await import('../src/data.js');
  function play(policy,seed) {
    const r=E.newRun({seed,background:'solo'});let guard=0;
    const ready=()=>r.team.filter(x=>x.status==='active'&&x.hp>0&&x.unavailableUntil<=r.night);
    const health=()=>ready().reduce((s,x)=>s+x.hp/E.getRunnerMaxHP(x),0)/Math.max(1,ready().length);
    while(r.stage!=='result'&&guard++<1400){
      if(r.stage==='map') {
        const nodes=E.availableNodes(r);
        let node;
        if(policy==='novice')node=nodes.filter(x=>['job','danger','boss','defense'].includes(x.type)).sort((a,b)=>(E.nodeJob(r,b)?.pay||0)-(E.nodeJob(r,a)?.pay||0))[0]||nodes[0];
        else {
          node=nodes.find(x=>x.type==='boss'||x.type==='defense');
          if(!node&&ready().length<3)node=nodes.find(x=>x.type==='recruit');
          if(!node&&health()<.68)node=nodes.find(x=>x.type==='rest'||x.type==='doctor');
          if(!node)node=nodes.find(x=>x.type==='shop'&&r.money>2300&&r.night>=5);
          if(!node)node=nodes.filter(x=>['job','danger'].includes(x.type)).sort((a,b)=>E.estimate(r,b,{samples:16})-E.estimate(r,a,{samples:16}))[0]||nodes.find(x=>x.type==='rest')||nodes[0];
        }
        if(!node)throw Error('No node at '+r.night);
        E.selectNode(r,node.id);
      }else if(r.stage==='briefing'){
        const team=ready();const net=team.find(x=>x.role==='net');const field=team.filter(x=>x!==net).sort((a,b)=>(b.role==='solo')-(a.role==='solo')||b.hp-a.hp).slice(0,3).map(x=>x.id);if(!field.length&&net)field.push(net.id);
        const support=team.filter(x=>x!==net&&!field.includes(x.id)).slice(0,2).map(x=>x.id);
        const job=E.nodeJob(r);let route=job.routes[0].id;
        if(policy==='careful')route=job.routes.map(x=>({id:x.id,p:E.estimate(r,r.selectedNode,{field,support,net:field.includes(net?.id)?null:net?.id,route:x.id,intel:true,samples:24})})).sort((a,b)=>b.p-a.p)[0].id;
        const opts={route,field,support,net:field.includes(net?.id)?null:net?.id||null,intel:policy==='careful'&&r.money>750};
        if(!E.startMission(r,opts))throw Error(r.notice);
      }else if(r.stage==='mission')E.advanceMission(r);
      else if(r.stage==='decision'){
        const retreat=policy==='careful'&&r.mission.decision.kind==='risk'&&ready().some(p=>r.mission.field.includes(p.id)&&p.hp<E.getRunnerMaxHP(p)/2);
        E.decide(r,retreat?'retreat':r.mission.decision.kind==='police'?'surrender':'continue');
      }else if(r.stage==='reward'){
        let indices=r.rewards.map((_,i)=>i);
        if(policy==='novice'){const shift=Math.floor(E.random(r)*indices.length);indices=[...indices.slice(shift),...indices.slice(0,shift)];}
        else indices.sort((a,b)=>scoreReward(r.rewards[b])-scoreReward(r.rewards[a]));
        let chosen=false;
        for(const i of indices){const reward=r.rewards[i];if(['cash','intel','runner'].includes(reward.type)){if(E.chooseReward(r,i)){chosen=true;break;}}else {const candidates=ready().sort((a,b)=>b.humanity-a.humanity);for(const person of candidates)if(E.chooseReward(r,i,person.id)){chosen=true;break;}if(chosen)break;}}
        if(!chosen)E.chooseReward(r,-1);
      }else if(r.stage==='alliance')E.service(r,'alliance',{id:policy==='careful'?'verde':['mitsukane','verde','hakuro'][Math.floor(E.random(r)*3)]});
      else if(r.stage==='ending')E.service(r,'ending',{id:'publish'});
      else if(r.stage==='service'){
        const type=r.service.type;
        if(type==='recruit'){
          const candidates=r.service.candidates.slice().sort((a,b)=>(!ready().some(x=>x.role===b.role))-(!ready().some(x=>x.role===a.role)));
          for(const c of candidates)if(ready().length<5&&r.money>900)E.service(r,'hire',{runnerId:c.id,contract:'share'});
        }else if(type==='doctor'&&policy==='careful'){
          for(const p of ready()){if(p.hp/E.getRunnerMaxHP(p)<.85)E.service(r,'heal',{runnerId:p.id});if(p.humanity<25&&r.money>1100)E.service(r,'therapy',{runnerId:p.id});}
          const p=ready().find(x=>x.role==='solo');if(p&&r.money>3000){const c=r.service.stock.find(x=>x.special==='setsuna'&&x.act<=E.actOf(r));if(c)E.service(r,'buy',{type:'cyber',id:c.id,runnerId:p.id});}
        }else if(type==='shop'&&policy==='careful'){
          for(const p of ready()){if(p.armor<4)E.service(r,'repair',{runnerId:p.id});const item=r.service.stock.find(x=>x.type==='weapon'&&(x.special==='smart'||x.special==='pierce'&&p.role==='solo'));if(item&&r.money>item.price+900)E.service(r,'buy',{type:'weapon',id:item.id,runnerId:p.id});}
        }else if(type==='rest')E.service(r,'rest');
        else if(type==='event')E.service(r,'event',{index:policy==='careful'?r.service.event.choices.findIndex(x=>(x.effects?.cash||0)>0):0});
        // If a careful choice had no cash option, take the first neutral choice.
        if(type==='event'&&!r.service.used)E.service(r,'event',{index:0});
        E.finishNight(r);
      }else throw Error('Unknown stage '+r.stage);
    }
    if(guard>=1400)throw Error('Loop '+r.stage+' '+seed);
    return {won:r.result.won,night:r.night,bosses:r.summary.bosses,money:r.money,reason:r.result.reason,deaths:r.team.filter(p=>p.status==='dead').length,lost:r.team.filter(p=>p.status==='lost').length,cyber:r.team.reduce((s,p)=>s+p.cyber.length,0)};
    function scoreReward(x){if(x.type==='runner')return ready().some(p=>p.role===x.runner.role)?2:20;if(x.type==='cyber'){const c=D.CYBER.find(c=>c.id===x.id);return 8+(c.special==='setsuna'?7:0)+(ready().some(p=>p.cyber.some(id=>D.CYBER.find(c=>c.id===id)?.family===c.family))?5:0);}return x.type==='cash'?4:5;}
  }
  const crypto=require('node:crypto'),path=require('node:path');
  const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../',file))).digest('hex');
  const count=Number(process.env.RUNS||1000),report={runsPerPolicy:count,generatedAt:new Date().toISOString(),engineSHA256:hash('src/engine.js'),dataSHA256:hash('src/data.js'),policies:{}};
  for(const policy of ['novice','careful']){
    let wins=0,passed=[0,0,0],losses={},sumMoney=0,deaths=0,lost=0,cyber=0;
    for(let i=0;i<count;i++){const result=play(policy,`balance-${i}`);if(result.won)wins++;for(let a=0;a<3;a++)if(result.bosses>a)passed[a]++;losses[result.reason]=(losses[result.reason]||0)+1;sumMoney+=result.money;deaths+=result.deaths;lost+=result.lost;cyber+=result.cyber;}
    report.policies[policy]={wins,clearRate:wins/count,actPasses:passed,actConditional:passed.map((n,i)=>n/(i?passed[i-1]:count)),averageFinalMoney:Math.round(sumMoney/count),averageInstalledCyber:cyber/count,totalDeaths:deaths,totalHumanityLosses:lost,outcomes:losses};
    console.log(policy,JSON.stringify(report.policies[policy]));
  }
  report.decisionGap=report.policies.careful.clearRate-report.policies.novice.clearRate;
  report.targetMet=report.policies.novice.clearRate>=.15&&report.policies.novice.clearRate<=.25&&report.policies.careful.clearRate>=.5&&report.decisionGap>=.2;
  fs.mkdirSync(require('node:path').join(__dirname,'../test-results/'),{recursive:true});
  fs.writeFileSync(require('node:path').join(__dirname,'../test-results/balance.json'),JSON.stringify(report,null,2));
  console.log('Targets met:',report.targetMet,'decision gap:',report.decisionGap);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
