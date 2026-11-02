/* Real-browser workflow checks. All saves live in an isolated, disposable profile. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4186';
const OUT = path.join(__dirname, '../test-results');
const RUN_KEY = 'fixers-cut.rogue.run.v1';
const META_KEY = 'fixers-cut.rogue.meta.v1';

(async () => {
  const E = await import(pathToFileURL(path.join(__dirname, '../src/engine.js')));
  const D = await import(pathToFileURL(path.join(__dirname, '../src/data.js')));
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.route('**/__browser_fixture__', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated save fixture</title>' }));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  let checks = 0;
  const check = (value, message) => { assert.ok(value, message); checks++; };
  const click = action => page.locator(`[data-action="${action}"]`).first().click();
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), RUN_KEY);
  const screenShot = name => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  const snapshot = (seed = 'ui-smoke', meta = E.newMeta()) => {
    const run = E.newRun({ background: 'solo', seed }, meta);
    run.money = 20000;
    run.team.push(E.makeRunner(run, 'net', 'ナギ'));
    return run;
  };
  async function load(run, meta = E.newMeta()) {
    // Unload the previous app before replacing its save. Its beforeunload save
    // must not overwrite a fixture installed immediately before a reload.
    await page.goto(BASE_URL + '/__browser_fixture__', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ run, meta, runKey, metaKey }) => {
      if (run) localStorage.setItem(runKey, JSON.stringify(run));
      else localStorage.removeItem(runKey);
      localStorage.setItem(metaKey, JSON.stringify(meta));
    }, { run, meta, runKey: RUN_KEY, metaKey: META_KEY });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  }
  function prepareService(type) {
    const run = snapshot('service-' + type);
    run.map[0].nodes = [{ id: 'fixture-' + type, night: 1, type, name: type, description: '操作検証用の夜' }];
    E.selectNode(run, 'fixture-' + type);
    return run;
  }
  async function noOverflow(label) {
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), label + ' has no horizontal page overflow');
  }
  try {
    await load(null);
    check(await page.locator('h1').innerText() === 'この街に、\n名前を残せ。', 'title renders');
    await screenShot('title-desktop');
    await page.locator('#run-seed').fill('browser-live-flow');
    await click('new-run');
    check((await saved()).stage === 'map', 'new run is saved immediately');
    await screenShot('map-desktop');
    await noOverflow('desktop map');
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow('mobile map');
    check(await page.locator('.map-swipe-hint').isVisible(), 'mobile map explains horizontal scrolling');
    check(await page.locator('.node-content>span:not(.node-bottom)').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize)) >= 12, 'mobile map body is readable');
    await screenShot('map-mobile');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('[data-action="node"][data-id]').first().click();
    check((await saved()).stage === 'briefing', 'mission brief is reachable');
    check((await page.locator('.success-estimate strong').innerText()).endsWith('%'), 'brief shows estimated success rate');
    await page.locator('[data-change="intel"]').check();
    await screenShot('briefing-desktop');
    await click('dispatch');
    const beforeStep = await saved();
    check(beforeStep.stage === 'mission', 'dispatch starts live communication');
    await click('advance');
    const afterStep = await saved();
    check(afterStep.mission.log.length > beforeStep.mission.log.length, 'advance resolves a real mission phase');
    await page.reload({ waitUntil: 'networkidle' });
    check((await saved()).rng === afterStep.rng, 'reload preserves random state');
    check(await page.locator('.mission-panel').isVisible(), 'reload resumes the mission screen');
    let guard = 0;
    while (['mission', 'decision'].includes((await saved()).stage) && guard++ < 80) {
      const state = await saved();
      if (state.stage === 'decision') {
        await screenShot('decision-desktop');
        await page.reload({ waitUntil: 'networkidle' });
        check(await page.locator('.decision-panel').isVisible(), 'reload preserves a pending decision');
        const choice = state.mission.decision.kind === 'police' ? 'surrender' : 'continue';
        await page.locator(`[data-action="decision"][data-id="${choice}"]`).click();
      } else await click('advance');
    }
    check(guard < 80, 'mission resolves without hanging');
    if ((await saved()).stage === 'reward') {
      await screenShot('reward-desktop');
      const rewardBefore = await saved();
      await page.locator('[data-action="reward"][data-index="-1"]').click();
      const next = await saved();
      check(next.night > rewardBefore.night || next.stage === 'alliance', 'reward closes the night');
      check(next.summary.expenses > rewardBefore.summary.expenses, 'nightly expenses are charged');
    }

    let run = prepareService('doctor');
    run.team[0].humanity = 35;
    await load(run);
    await screenShot('doctor-desktop');
    const cyber = run.service.stock.find(x => !D.CYBER.find(c => c.id === x.id).roles.length);
    const index = run.service.stock.findIndex(x => x.id === cyber.id);
    const expectedCyber = D.CYBER.find(c => c.id === cyber.id);
    await page.locator(`[data-action="buy"][data-index="${index}"]`).click();
    let state = await saved();
    check(state.team[0].cyber.includes(cyber.id), 'clinic installs selected cyberware');
    check(state.money === run.money - cyber.price, 'clinic charges exact price');
    check(state.team[0].humanity === 35 - expectedCyber.humanity, 'cyberware costs humanity');
    await page.locator('[data-change="insurance"]').first().selectOption('basic');
    check((await saved()).team[0].insurance === 'basic', 'Lazarus plan is saved');
    await page.locator('[data-action="treatment"][data-kind="therapy"]').first().click();
    check((await saved()).team[0].unavailableUntil === 3, 'therapy reserves the next night');
    await click('finish-night');
    check((await saved()).night === 2, 'service finishes normally');

    run = prepareService('shop');
    await load(run);
    await screenShot('shop-desktop');
    const stock = run.service.stock[0];
    await page.locator('[data-action="buy"]').first().click();
    state = await saved();
    const slot = stock.type === 'armor' ? 'armorId' : stock.type;
    check(state.team[0][slot] === stock.id, 'shop equips purchased item');
    const moneyBeforeSale = state.money;
    await page.locator(`[data-action="sell"][data-id="${state.team[0].id}"][data-slot="${stock.type}"]`).click();
    check((await saved()).money > moneyBeforeSale, 'shop buys equipment back');

    run = prepareService('recruit');
    await load(run);
    await screenShot('recruit-desktop');
    const teamSize = run.team.length;
    await page.locator('[data-action="hire"][data-contract="share"]').first().click();
    check((await saved()).team.length === teamSize + 1, 'recruit joins the squad');
    check((await saved()).team.at(-1).contract === 'share', 'selected contract is respected');

    run = prepareService('rest');
    run.team[0].hp = 1;
    run.team[0].humanity = 25;
    await load(run);
    await click('rest');
    state = await saved();
    check(state.service.used, 'rest is one-time per visit');
    check(state.team[0].hp === E.getRunnerMaxHP(state.team[0]), 'rest restores full HP');
    check(state.team[0].humanity === 30, 'rest restores five humanity');

    run = prepareService('event');
    await load(run);
    check(!(await page.locator('[data-action="finish-night"]').isEnabled()), 'event requires a choice before leaving');
    await click('event');
    check((await saved()).service.used, 'event choice applies and is saved');
    check(await page.locator('[data-action="finish-night"]').isEnabled(), 'event can finish after the choice');
    await click('finish-night');
    check((await saved()).stage === 'map', 'event returns to district map');

    run = snapshot('boss-brief');
    run.night = 4;
    E.selectNode(run, run.map[3].nodes[0].id);
    await load(run);
    check((await page.locator('.route-option').count()) === 2, 'boss briefing renders actual boss routes');
    check((await page.locator('.phase-table-row').count()) > 1, 'boss briefing has phase table');
    await page.locator('[data-change="intel"]').check();
    check((await page.locator('.intel-report').innerText()).includes('対策'), 'boss intel exposes a counter');

    run = snapshot('alliance');
    run.night = 4;
    run.stage = 'alliance';
    run.selectedNode = run.map[3].nodes[0];
    run.mission = { done: true, job: E.nodeJob(run, run.selectedNode), log: [] };
    await load(run);
    await screenShot('alliance-desktop');
    await page.locator('[data-action="alliance"][data-id="hakuro"]').click();
    check((await saved()).alliance === 'hakuro', 'company choice is stored');
    check((await saved()).night === 5, 'company choice starts the next act');

    run = snapshot('ending');
    run.night = 12;
    run.stage = 'ending';
    run.alliance = 'verde';
    run.endingOptions = [
      { id:'publish', name:'箱を公開する', description:'名簿を街へ流す。', locked:false },
      { id:'seal', name:'箱を封じる', description:'真実を次の夜に託す。', locked:false },
      { id:'release', name:'名前を返す', description:'失われた名前を返す。', locked:true, requirement:'過去の断片が必要' }
    ];
    await load(run);
    check(!(await page.locator('[data-action="ending"][data-id="release"]').isEnabled()), 'locked ending cannot be selected');
    await screenShot('ending-desktop');
    await page.locator('[data-action="ending"][data-id="publish"]').click();
    check((await saved()).stage === 'result', 'ending reaches result');
    check(await page.locator('.result-after p').count() === 3, 'each survivor has an epilogue line');
    const resultMeta = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), META_KEY);
    check(resultMeta.runs.length === 1, 'run is finalized exactly once');
    await screenShot('result-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow('mobile result');
    await screenShot('result-mobile');
    await click('result-home');
    check(await page.locator('h1').isVisible(), 'result returns to title');
    await screenShot('title-mobile');
    await noOverflow('mobile title');

    check(errors.length === 0, 'no uncaught browser errors: ' + errors.join('; '));
    const crypto = require('node:crypto');
    const hash = async file => crypto.createHash('sha256').update(await fs.readFile(path.join(__dirname, '../', file))).digest('hex');
    await fs.writeFile(path.join(OUT, 'browser-smoke.json'), JSON.stringify({ checks, pageErrors: errors, engineSHA256: await hash('src/engine.js'), dataSHA256: await hash('src/data.js'), appSHA256: await hash('src/app.js'), styleSHA256: await hash('src/style.css'), viewports: ['1440x1000', '390x844'] }, null, 2));
    console.log(`Browser smoke passed: ${checks} checks. Screenshots: ${OUT}`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
