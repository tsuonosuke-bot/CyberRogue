import * as E from './engine.js';
import { ROLES, BACKGROUNDS, FACTIONS, JOBS, CYBER, WEAPONS, ARMORS, TOOLS, BOSSES, UNLOCKS } from './data.js';

const KEYS = { run: 'fixers-cut.rogue.run.v1', meta: 'fixers-cut.rogue.meta.v1', settings: 'fixers-cut.rogue.settings.v1' };
const $ = (s, root = document) => root.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const money = value => Number(value || 0).toLocaleString('ja-JP');
const clamp = value => Math.max(0, Math.min(100, value));
const findItem = id => [...CYBER, ...WEAPONS, ...ARMORS, ...TOOLS].find(x => x.id === id);
const roleName = id => ROLES[id]?.name || id || 'ランナー';
const actor = id => run?.team?.find(x => x.id === id);
const activeTeam = () => (run?.team || []).filter(x => x.status === 'active');
const availableTeam = () => activeTeam().filter(x => !(x.unavailableUntil > run.night));
const typeName = { job:'依頼', danger:'危険依頼', doctor:'闇医者', shop:'古物屋', recruit:'路地裏', rest:'隠れ家', event:'事件', boss:'大仕事', personal:'個人依頼', hunt:'元部下', defense:'防衛戦' };
const phaseName = { camera:'カメラ網', ice:'黒ICE', data:'データ抽出', stealth:'隠密', trap:'罠', door:'扉', negotiate:'交渉', medical:'医療', drive:'運転', escape:'逃走', combat:'交戦', rest:'休息', objective:'目標確保' };
const statusName = { active:'稼働中', dead:'死亡', lost:'喪失', captured:'拘束', poached:'引き抜き', retired:'離脱' };
const slotName = { nerve:'神経系', brain:'頭脳', sense:'感覚と発声', arm:'腕と手', organ:'内臓', skin:'体表' };
const glyph = { job:'◇', danger:'⚠', doctor:'✚', shop:'▣', recruit:'♟', rest:'⌂', event:'✳', boss:'◈', personal:'♧', hunt:'◎', defense:'⬡', cyber:'⌘', weapon:'⌁', armor:'⬡', tool:'⊞', runner:'♟', intel:'◉', cash:'₵' };
let meta = read(KEYS.meta) || E.newMeta();
let run = read(KEYS.run);
let settings = { sound: false, speed: 850, ...read(KEYS.settings) };
let screen = run && run.stage !== 'result' ? 'game' : 'home';
let homeTab = 'start';
let selectedBackground = 'solo';
let selectedDifficulty = 0;
let selectedCompany = 'mitsukane';
let draftRoles = ['solo', 'net', 'medic'];
let draft = {};
let rewardChoice = null;
let autoTimer = null;
let modal = null;
let toastTimer;
let audioContext;
const forecastCache = new Map();
let saveFailed = false;

function read(key) {
  try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value && typeof value === 'object' ? value : null; }
  catch { return null; }
}
function save() {
  try {
    localStorage.setItem(KEYS.meta, JSON.stringify(meta));
    if (run) localStorage.setItem(KEYS.run, JSON.stringify(run));
    localStorage.setItem(KEYS.settings, JSON.stringify(settings));
  } catch { if (!saveFailed) toast('保存できませんでした。ブラウザーの保存容量や設定を確認してください。'); saveFailed = true; }
}
function toast(text) {
  $('#toast').textContent = text;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4400);
}
function tone(negative = false) {
  if (!settings.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = negative ? 135 : 610;
    gain.gain.setValueAtTime(0.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.13);
    oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + 0.15);
  } catch { /* Sound is optional on browsers without Web Audio. */ }
}
function stopAuto() { clearInterval(autoTimer); autoTimer = null; }
function mutate(fn) {
  try {
    if (run) run.notice = '';
    fn();
    if (run?.stage === 'result' && !run.finalized) E.finalizeRun(run, meta);
    if (run?.notice) toast(run.notice);
    if (run?.stage !== 'mission') stopAuto();
    save(); render();
  } catch (error) {
    stopAuto(); toast(error.message || '操作を完了できませんでした。');
    console.error(error); render();
  }
}
function icon(name, className = '') { return `<span class="glyph ${className}" aria-hidden="true">${glyph[name] || '◇'}</span>`; }
function pill(text, style = '') { return `<span class="pill ${style}">${esc(text)}</span>`; }
function button(text, action, attrs = '', cls = '') { return `<button type="button" data-action="${action}" class="button ${cls}" ${attrs}>${text}</button>`; }
function panelTitle(kicker, title, aside = '') { return `<div class="panel-title"><div><p class="eyebrow">${kicker}</p><h2>${title}</h2></div>${aside}</div>`; }
function sectionTitle(title, aside = '') { return `<div class="section-title"><h3>${title}</h3>${aside}</div>`; }
function faction(id) { return FACTIONS[id] || { name:id || '独立依頼', color:'#91a3ae', trait:'', counter:'' }; }
function factionTag(id) { const f = faction(id); return `<span class="faction-tag" style="--faction:${esc(f.color)}">${esc(f.name)}</span>`; }
function newsModifiers() {
  const n=run?.news||{}, items=[];
  if(n.dv)items.push(pill(`判定DV ${n.dv>0?'+':''}${n.dv}`,n.dv>0?'danger':'success'));
  if(n.pay)items.push(pill(`報酬 ${n.pay>0?'+':''}${Math.round(n.pay*100)}%`,n.pay>0?'success':'danger'));
  if(n.heat)items.push(pill(`成功時ヒート ${n.heat>0?'+':''}${n.heat}`,n.heat>0?'danger':'success'));
  return items.length?`<div class="news-modifiers">${items.join('')}</div>`:'';
}
function logo(small = false) { return `<a class="brand ${small ? 'small' : ''}" href="#" data-action="home" aria-label="タイトルへ"><span class="brand-mark">F<span>〳</span></span><span>FIXER'S CUT<small>TWELVE NIGHTS IN YOMIHAMA</small></span></a>`; }
function citySVG(compact = false) {
  const buildings = Array.from({ length: 27 }, (_, i) => {
    const x = i * 46 - 30, h = 70 + ((i * 113 + 17) % 205), w = 31 + i % 4 * 9, top = 365 - h;
    const windows = Array.from({length:Math.floor(h / 16)}, (_, j) => `<path d="M${x + 8} ${top + 13 + j * 16}h${w - 15}" stroke="${i % 5 === 0 ? '#b47f40' : '#355d6a'}" stroke-width="2" opacity="${j % 3 === 0 ? '.6' : '.22'}"/>`).join('');
    return `<g><path d="M${x} 365V${top}h${w}v${h}" fill="${i % 3 === 0 ? '#172d38' : '#11222d'}" stroke="#28404b"/>${windows}${i % 4 === 0 ? `<path d="M${x + w/2} ${top}v-24" stroke="#4d7880"/><circle cx="${x + w/2}" cy="${top - 26}" r="2" fill="#e6b860"/>` : ''}</g>`;
  }).join('');
  return `<svg class="city-art ${compact ? 'compact' : ''}" viewBox="0 0 1200 440" role="img" aria-label="雨のヨミハマ。工場と高層ビルの間にネオンが光る都市。"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#152c38"/><stop offset="1" stop-color="#101b26"/></linearGradient><linearGradient id="haze" x2="0" y2="1"><stop stop-color="#d3a257" stop-opacity=".17"/><stop offset="1" stop-color="#d3a257" stop-opacity="0"/></linearGradient><pattern id="rain" width="44" height="62" patternUnits="userSpaceOnUse"><path d="M19 2l-8 27" stroke="#7ea3ae" opacity=".1"/></pattern></defs><rect width="1200" height="440" fill="url(#sky)"/><circle cx="825" cy="113" r="71" fill="url(#haze)" stroke="#b69261" stroke-opacity=".13"/><circle cx="825" cy="113" r="94" fill="none" stroke="#b69261" stroke-opacity=".06"/><path d="M0 259L150 201 270 245 390 171 590 232 702 179 870 214 1100 166 1200 206V440H0Z" fill="#11232e"/>${buildings}<g stroke="#3c606c" fill="none"><path d="M0 339C260 320 410 366 680 319S1050 288 1200 328"/><path d="M0 347C260 328 410 374 680 327S1050 296 1200 336" opacity=".45"/><path d="M230 356v-74m0 17h80m-80 9h57m475 19v-81m0 24h94"/></g><g fill="#dbb46c"><rect x="272" y="181" width="18" height="49" rx="1"/><rect x="928" y="223" width="43" height="13" rx="1"/></g><g fill="#172c36" font-size="10" font-family="sans-serif"><text x="276" y="196">闇</text><text x="276" y="209">医</text><text x="276" y="222">者</text><text x="932" y="233">ヨミハマ</text></g><path d="M0 367H1200v73H0Z" fill="#0d1821"/><path d="M200 440L637 366 1200 406M0 402l1200 34M700 440l90-74" stroke="#27434d" fill="none"/><path d="M418 415l175-31M787 399l156 14" stroke="#bb9752" opacity=".25" stroke-width="4"/><rect width="1200" height="440" fill="url(#rain)"/><text x="1060" y="53" fill="#75939c" font-size="10" letter-spacing="3">YOMIHAMA / 03</text><path d="M1036 46h-30m15-15v30" stroke="#749098" opacity=".4"/></svg>`;
}
function avatar(r, large = false) {
  const n = [...(r.name || r.role || 'x')].reduce((sum, c) => sum + c.codePointAt(0), 0);
  const colors = ['#6a8d91', '#a17d62', '#748299', '#8f7d96', '#75937a'];
  const color = colors[n % colors.length];
  return `<svg class="avatar ${large ? 'large' : ''}" viewBox="0 0 64 72" aria-hidden="true"><rect width="64" height="72" fill="#14252f"/><path d="M0 53L20 44h24l20 9v19H0" fill="${color}" opacity=".6"/><path d="M21 39v13l11 9 11-9V39" fill="#354954"/><path d="M17 14l16-6 15 8-3 26-13 10-13-11Z" fill="#6c8086"/><path d="M17 24l-2-11L32 4l17 8 2 15-14-9-9 4Z" fill="#0c1720"/><path d="M19 31h10m7 0h9" stroke="#101e29" stroke-width="4"/><path d="M36 31h7" stroke="${r.humanity <= 15 ? '#e57d6f' : '#dcba75'}" stroke-width="2"/><path d="M38 35v10h6M29 39h5" stroke="#314b58" fill="none"/><path d="M0 62h18m28 0h18" stroke="#b89458" stroke-width="2"/><path d="M4 4h8M4 4v8m56 48v8h-8" stroke="#68848e" fill="none" opacity=".5"/></svg>`;
}
function bossPortrait() {
  const act=E.actOf(run), key=act===1?'electric':act===2?'kaname':run.alliance||'mitsukane';
  const color={electric:'#c1a86e',kaname:'#bc8b73',mitsukane:'#b9ab82',verde:'#9cac85',hakuro:'#82b9c4'}[key];
  const mask=key==='mitsukane'?'<path d="M18 22l21-9h20l23 9-5 38-25 18-27-18Z" fill="#4b5b61" stroke="#7a8e93"/><path d="M19 28h63v12H19zM29 56h42v8H29z" fill="#12222c"/><path d="M27 33h16m14 0h16" stroke="#e6b860" stroke-width="3"/><path d="M48 14v42m-22-9h48" stroke="#263e49" stroke-width="4"/>':key==='verde'?'<path d="M32 17l18-8 18 10 3 28-20 25-22-22Z" fill="#62756e"/><path d="M31 29h40M37 31l-3 18m30-18l3 18" stroke="#213b3b" stroke-width="4"/><path d="M43 48h16v15H43z" fill="#273e3b"/><path d="M44 54C18 52 24 86 9 97m49-43c26-2 20 32 35 43" stroke="#6e947c" stroke-width="4" fill="none"/>':key==='kaname'?'<path d="M28 17L48 9l24 13-5 30-18 19-21-18Z" fill="#677a80"/><path d="M20 28l8-17 23-8 24 12 4 19-20-14-17 4Z" fill="#10202a"/><path d="M27 36h20v8H27zM50 36h20v8H50z" fill="#182c36"/><path d="M51 40h15" stroke="#dc9f79" stroke-width="3"/><path d="M37 52h25l-5 14H42Z" fill="#253d49"/><path d="M56 18v38" stroke="#a1a48d" stroke-width="2"/>':key==='hakuro'?'<path d="M27 18L48 7l23 10 2 39-24 18-23-19Z" fill="#657a81"/><path d="M24 16l24-12 27 12v25H22Z" fill="#17313f"/><path d="M20 31h58v13H20z" fill="#0f222d" stroke="#456675"/><path d="M27 37h42" stroke="#8dc8d1" stroke-width="3"/><path d="M32 54h8v9h-8m27-9h8v9h-8" fill="#2c4653"/>':'<path d="M30 18l20-10 22 12-5 34-18 18-20-21Z" fill="#657a80"/><path d="M22 20l10-13L53 3l22 15-9 10-19-7-19 13Z" fill="#11222e"/><path d="M29 34h19v10H29zM52 34h18v10H52z" fill="#142a36"/><path d="M32 39h11m13 0h11" stroke="#d8b46f" stroke-width="2"/><path d="M22 34v20m55-20v20M25 52l-8 27m56-27l9 27" stroke="#385564" stroke-width="4"/>';
  return `<svg class="boss-portrait" viewBox="0 0 100 110" role="img" aria-label="${esc(bossOfRun().name)}の姿"><rect width="100" height="110" fill="#14252f"/><path d="M0 90L29 65l20 13 22-13 29 25v20H0Z" fill="${color}" opacity=".55"/>${mask}<path d="M6 6h13M6 6v13m88 72v13H81" stroke="${color}" fill="none" opacity=".6"/><path d="M0 93h100" stroke="#223e4c"/><text x="7" y="103" font-size="5" font-family="monospace" fill="${color}" letter-spacing="2">TARGET / ${act}</text></svg>`;
}
function render() {
  document.body.classList.toggle('in-game', screen === 'game');
  $('#app').innerHTML = screen === 'game' && run ? gameView() : homeView();
  renderModal();
  if (run?.stage === 'mission' || run?.stage === 'decision') {
    const log = $('#mission-log');
    if (log) log.scrollTop = log.scrollHeight;
  }
}
function homeView() {
  const resumable = run && run.stage !== 'result';
  return `<div class="home-shell"><header class="site-header">${logo()}<nav aria-label="メインメニュー">${button('遊び方', 'rules', '', 'text-button')}${button(settings.sound ? '音 ON' : '音 OFF', 'sound', 'aria-label="操作音の切り替え"', 'text-button')}</nav></header><main><section class="hero"><div class="hero-copy"><p class="eyebrow"><span class="signal-dot"></span> A CYBERPUNK FIXER ROGUELIKE</p><h1>この街に、<br>名前を残せ。</h1><p class="hero-sub">引き金を引くのは、仲間たち。<br>誰を信じ、何を失うかを決めるのは、あなただ。</p><div class="hero-meta"><span><strong>12</strong> NIGHTS</span><span><strong>3</strong> ACTS</span><span>NO SECOND LIVES</span></div></div><div class="hero-art">${citySVG()}<span class="city-stamp">横浜湾岸特別経済区<br><b>ヨミハマ</b><small>35° 27′ N / 139° 38′ E</small></span><div class="art-caption"><span>雨は、誰の血も洗い流す。</span><span>EST. 2077</span></div></div></section><div class="home-nav" role="tablist" aria-label="隠れ家">${['start','archive','unlocks'].map((id, i) => `<button role="tab" aria-selected="${homeTab === id}" class="${homeTab === id ? 'active' : ''}" data-action="home-tab" data-id="${id}"><small>0${i+1}</small>${{start:'ランを始める',archive:'街の記録',unlocks:'顔役との信用'}[id]}</button>`).join('')}<div class="credit-display"><span>信用</span><strong>${money(meta.credit)}</strong></div></div>${homeTab === 'start' ? startView(resumable) : homeTab === 'archive' ? archiveView() : unlocksView()}</main><footer class="footer"><span>FIXER'S CUT <b>／</b> 十二夜のヨミハマ</span><span>判定はダイス。引き際は、あなたの仕事。</span></footer></div>`;
}
function startView(resumable) {
  const bg = BACKGROUNDS.find(x => x.id === selectedBackground) || BACKGROUNDS[0];
  return `<section class="start-section">${run?.stage==='result'?`<div class="last-result-banner"><span>前のラン · 第 ${run.night} 夜 / ${run.result?.won?'夜明け':'通信終了'}</span>${button('前のランの結果を見る →','last-result','','text-button')}</div>`:''}${resumable ? `<div class="resume-banner"><div><span class="eyebrow">YOUR LINE IS STILL OPEN</span><strong>第 ${run.night} 夜の通信が残っている。</strong><p>${esc(run.selectedNode?.name || 'ヨミハマで、仲間があなたの指示を待っている。')}</p></div>${button('続きから再開 ↗','resume','','primary')}</div>` : ''}${panelTitle('01 / CHOOSE YOUR PAST','フィクサーになる前の話。','<p class="muted">前歴は隊と、小さな利点を決める。</p>')}<div class="background-grid">${BACKGROUNDS.map((b, i) => {
    const unlocked = !b.cost || (meta.unlocks || []).includes(b.id) || (meta.unlocks || []).includes(`bg-${b.id}`) || (meta.unlocks || []).includes(`background_${b.id}`);
    return `<button class="background-card ${selectedBackground === b.id ? 'selected' : ''} ${!unlocked ? 'locked' : ''}" data-action="background" data-id="${b.id}" ${!unlocked ? 'disabled' : ''} aria-pressed="${selectedBackground === b.id}"><span class="bg-number">0${i+1}</span><span class="bg-label">${unlocked ? 'BACKGROUND' : 'LOCKED / '+b.cost+' 信用'}</span><h3>${esc(b.name)}</h3><p class="role-line">${(b.roles || []).map(roleName).join(' ＋ ') || '好きなロール × 3'}</p><p>${esc(b.perk)}</p><span class="bg-weakness">${esc(b.weakness)}</span><span class="selection-dot">${selectedBackground === b.id ? '●' : '○'}</span></button>`;
  }).join('')}</div><div class="start-controls"><div><label for="difficulty">難易度の段</label><select id="difficulty" data-change="difficulty">${Array.from({length:Math.min(5, meta.maxDifficulty || 0)+1},(_,i)=>`<option value="${i}" ${i===selectedDifficulty?'selected':''}>${i===0?'標準 — はじめの十二夜':`第 ${i} 段 — ${['','敵のDV・攻撃＋1','専属手当 1.25倍','悪いニュースが増える','死亡セーブ −1','大仕事の再挑戦なし'][i]}`}</option>`).join('')}</select></div><div><label for="run-seed">街の合言葉 <span class="muted">任意</span></label><input id="run-seed" maxlength="40" placeholder="空欄で新しい街" autocomplete="off"></div>${bg.id === 'corp' ? `<div><label for="company">最初に組む企業</label><select id="company" data-change="company">${['mitsukane','verde','hakuro'].map(id=>`<option value="${id}" ${selectedCompany===id?'selected':''}>${faction(id).name}</option>`).join('')}</select></div>` : ''}${bg.id === 'mix' ? `<div class="draft-roles"><label>最初の3人</label>${draftRoles.map((r,i)=>`<select data-change="draft-role" data-index="${i}" aria-label="${i+1}人目のロール">${Object.keys(ROLES).map(id=>`<option value="${id}" ${r===id?'selected':''}>${roleName(id)}</option>`).join('')}</select>`).join('')}</div>` : ''}<div class="start-button-group"><span class="muted">1ラン 約30〜45分・自動保存</span>${button('十二夜を始める <span>↗</span>',resumable?'confirm-new':'new-run','','primary start-button')}</div></div><div class="intro-strip"><div><b>01</b><span>道を選ぶ<small>二夜先を読み、今夜を決める。</small></span></div><div><b>02</b><span>隊を組む<small>義体と装備で、戦い方を変える。</small></span></div><div><b>03</b><span>引き際を決める<small>生き残れば、次の夜が来る。</small></span></div></div></section>`;
}
function archiveView() {
  const runs = meta.runs || [], memorial = meta.memorial || [], fragments = meta.fragments || [];
  return `<section class="archive-section">${panelTitle('02 / WHAT THE CITY REMEMBERS','忘れられなかったもの。')}<div class="archive-summary"><div><strong>${runs.length}</strong><span>残されたラン</span></div><div><strong>${runs.filter(x=>x.won).length}</strong><span>見届けた夜明け</span></div><div><strong>${memorial.length}</strong><span>慰霊碑の名前</span></div></div><div class="archive-columns"><section>${sectionTitle('ブラックボックスの断片')}${fragments.length ? fragments.map((f,i)=>`<article class="fragment"><span class="eyebrow">FRAGMENT / ${String(i+1).padStart(2,'0')}</span><h4>${esc(typeof f==='string'?f:f.title)}</h4>${typeof f==='object'?`<p>${esc(f.text || f.description)}</p>`:''}</article>`).join('') : '<div class="empty-state">箱はまだ、閉じている。<p>幕の大仕事と個人依頼で、街の真実を拾おう。</p></div>'}</section><section>${sectionTitle('慰霊碑')}${memorial.length ? memorial.map(r=>`<article class="memorial"><span>＋</span><div><h4>${esc(r.name || r)}</h4><p>${esc(roleName(r.role))} · ${esc(r.cause || r.reason || 'ヨミハマにて')} ${r.night ? `／ 第${r.night}夜` : ''}</p></div></article>`).join('') : '<div class="empty-state">まだ、名前は刻まれていない。<p>失った仲間の記憶は、次のランへ残る。</p></div>'}${sectionTitle('過去のラン')}${runs.slice().reverse().slice(0,10).map((r,index)=>`<button data-action="archive-run" data-index="${runs.length-1-index}" class="run-record"><span class="${r.won?'positive':'muted'}">${r.won?'夜明け':'通信終了'}</span><span>第 ${r.night || r.nights || '—'} 夜</span><span>${esc(r.reason || r.epilogue || '詳細を見る →')}</span></button>`).join('')}</section></div></section>`;
}
function unlocksView() {
  return `<section class="unlock-section">${panelTitle('03 / NEW POSSIBILITIES','強さではなく、選べる未来を。','<p class="muted">信用は敗北したランでも得られる。</p>')}<div class="unlock-grid">${UNLOCKS.map(u=>{const unlocked=(meta.unlocks||[]).includes(u.id);return `<article class="unlock-card ${unlocked?'unlocked':''}"><span class="eyebrow">${unlocked?'CONNECTED':'NEW CONNECTION'}</span><h3>${esc(u.name)}</h3><p>${esc(u.description)}</p><div>${pill(unlocked?'解放済み':`${u.cost} 信用`)}${!unlocked ? button('解放する','unlock',`data-id="${esc(u.id)}" ${meta.credit<u.cost?'disabled':''}`,'small-button') : '<span class="positive">✓</span>'}</div></article>`;}).join('')}</div></section>`;
}
function gameView() {
  const act = E.actOf(run);
  const district = ['屋台街','港湾倉庫','企業区画上層'][act-1] || 'ヨミハマ';
  return `<div class="game-shell"><header class="site-header game-header">${logo(true)}<div class="night-display"><span>ACT ${String(act).padStart(2,'0')}</span><strong>第 ${run.night} 夜 <small>/ 12</small></strong><span>${district}</span></div><nav>${button('記録','journal','','text-button')}${button('ルール','rules','','text-button')}${button(settings.sound?'♫':'♪','sound',`aria-label="操作音 ${settings.sound?'オフ':'オン'}"`,'text-button')}</nav></header><div class="run-status"><div><span class="label">運転資金</span><strong class="${run.money<0?'danger-text':''}">${money(run.money)}<small> cr</small></strong></div><div><span class="label">今夜の固定費</span><span>${money(nightlyCost())} cr</span></div><div><span class="label">情報券</span><span>${run.intelTickets || 0} 回</span></div><div><span class="label">白蛇会</span><span class="${run.snake>=30?'positive':run.snake<=-30?'danger-text':''}">${run.snake>0?'+':''}${run.snake || 0}</span></div><div class="heat-bars">${['mitsukane','verde','hakuro'].map(id=>`<div title="${faction(id).name}：80超で敵増加、100で防衛戦"><span>${esc(faction(id).name.slice(0,4))}</span><i><b style="width:${clamp(run.heat?.[id] || 0)}%;--heat:${(run.heat?.[id]||0)>80?'#e98776':faction(id).color}"></b></i><small>${run.heat?.[id]||0}</small></div>`).join('')}</div><span class="save-indicator"><span class="signal-dot"></span> ${saveFailed?'保存失敗':'自動保存'}</span></div><div class="game-layout"><aside class="squad-sidebar">${squadView()}</aside><main class="operations" id="operations">${run.stage === 'map' ? mapView() : run.stage === 'briefing' ? briefingView() : ['mission','decision'].includes(run.stage) ? missionView() : run.stage === 'reward' ? rewardView() : run.stage === 'service' ? serviceView() : run.stage === 'alliance' ? allianceView() : run.stage === 'ending' ? endingView() : run.stage === 'result' ? resultView() : '<div class="empty-state">通信を接続しています。</div>'}</main></div><footer class="game-footer"><span><span class="signal-dot"></span> 隠れ家回線 / 暗号化済み</span><span>SEED ${esc(run.seed ?? '')} · 段 ${run.difficulty || 0}</span>${button('タイトルへ','home','','text-button')}</footer></div>`;
}
function nightlyCost() {
  return 200 + activeTeam().reduce((sum,r)=>sum+(r.contract==='exclusive'?Math.ceil((r.wage||ROLES[r.role]?.wage||200)*(run.difficulty>=2?1.25:1)):0)+(r.insurance==='premium'?300:r.insurance==='basic'?100:0),0);
}
function squadView() {
  return `<div class="squad-heading"><div><p class="eyebrow">YOUR RUNNERS</p><h2>いつもの面子</h2></div><span>${activeTeam().length}<small> 名</small></span></div>${(run.team||[]).map(r=>runnerCard(r)).join('')}<div class="squad-tip"><span>FIXER'S NOTE</span><p>${run.stage==='briefing'?'現場3・支援2・ネット1。得意なことを任せれば、悪い出目にも備えられる。':activeTeam().some(r=>r.humanity<=30)?'力を得るほど、自分を失う。次の闇医者まで、人間性は持つだろうか。':'全員を専属で抱えると、失敗した夜が重い。歩合には固定の手当がない。'}</p></div>`;
}
function runnerCard(r, selectable = false) {
  const hpMax = E.getRunnerMaxHP(r), humanMax = r.maxHumanity || (r.stats?.EMP || 6)*10;
  const unavailable = r.status!=='active' || r.unavailableUntil>run.night;
  return `<button class="runner-card ${unavailable?'unavailable':''} ${r.humanity<=15?'unstable':''}" data-action="runner" data-id="${esc(r.id)}"><div class="runner-card-top">${avatar(r)}<div><span class="eyebrow">${esc(roleName(r.role))}</span><h3>${esc(r.name)}</h3><span class="runner-contract">${r.status!=='active'?esc(statusName[r.status]||r.status):r.unavailableUntil>run.night?'療養中':r.contract==='share'?'歩合契約':`専属 ${money(r.wage)}cr/夜`}</span></div><span class="runner-more">↗</span></div><div class="meter-label"><span>HP</span><span>${Math.max(0,r.hp)} <small>/ ${hpMax}</small></span></div><div class="meter hp"><i style="width:${clamp(r.hp/hpMax*100)}%"></i></div><div class="meter-label"><span>人間性 <small>${r.humanity<=15?'兆候':r.humanity<=30?'不安定':'安定'}</small></span><span>${r.humanity} <small>/ ${humanMax}</small></span></div><div class="meter humanity ${r.humanity<=30?'low':''}"><i style="width:${clamp(r.humanity/humanMax*100)}%"></i></div><div class="runner-loadout"><span>${esc(findItem(r.weapon)?.name || '標準拳銃')}</span><span>${r.cyber?.length || 0} 義体 · 装甲 ${r.armor || 0}</span></div></button>`;
}
function currentNode() { return typeof run.selectedNode==='string' ? (run.map || []).flatMap(n=>n.nodes).find(n=>n.id===run.selectedNode) : run.selectedNode; }
function bossOfRun() { const act=E.actOf(run); return BOSSES[act===1?'act1':act===2?'act2':run.alliance || 'mitsukane'] || {}; }
function mapView() {
  const act = E.actOf(run), boss = bossOfRun();
  const nights = (run.map || []).filter(n=>n.night>=run.night && n.night<=run.night+2);
  const current = E.availableNodes(run) || [];
  if (!nights.length || !nights.some(n=>n.night===run.night)) nights.unshift({night:run.night,nodes:current});
  return `<section class="map-panel">${panelTitle('DISTRICT ROUTE / ACT '+String(act).padStart(2,'0'),'今夜、どこへ行く。',`<span class="pill">${['屋台街','港湾倉庫','企業区画上層'][act-1]}</span>`)}<div class="news-ticker"><span>街のニュース</span><div><b>${esc(run.news?.title || '雨、当分やまず。')}</b><p>${esc(run.news?.text || '通りの隅々に、仕事と噂が流れている。')}</p></div>${newsModifiers()}</div><div class="route-board"><div class="map-city">${citySVG(true)}</div><div class="map-swipe-hint">横にスワイプして、この先の二夜を見る →</div><div class="map-coordinates">YOMIHAMA CITY GRID <span>35.450 / 139.638</span></div><div class="night-columns">${nights.slice(0,3).map((night,i)=>`<section class="night-column ${i===0?'current':'future'}"><div class="column-heading"><span class="night-dot"></span><div><strong>第 ${night.night} 夜</strong><small>${i===0?'今夜の行き先':'この先の選択肢'}</small></div>${i===0?'<span class="now-label">NOW</span>':''}</div><div class="node-list">${(i===0?current:night.nodes||[]).map(node=>nodeCard(node,i===0)).join('')}</div></section>`).join('')}</div><div class="map-legend"><span>◇ 依頼</span><span>✚ ケア</span><span>◈ 大仕事</span><span>一夜に選べる場所は、一つだけ。</span></div></div><div class="boss-intel"><div class="boss-symbol">${bossPortrait()}</div><div><p class="eyebrow">ACT ${act} / THE BIG JOB</p><h3>${esc(boss.name || '箱の向こうに待つ者')}</h3><p>${esc(boss.description || '')}</p></div><div class="boss-stats"><span>耐久 <b>${boss.hp || '—'}</b></span><span>護衛 <b>${(boss.guards||[]).length}</b></span><small>仕掛けは情報購入で開示</small></div></div>${(run.logs||[]).length ? `<div class="last-message"><span>最新の通信</span><p>${esc(logText(run.logs[run.logs.length-1]))}</p></div>` : ''}</section>`;
}
function nodeCard(node,current) {
  const job=JOBS.find(j=>j.id===node.jobId), pay=job?.pay, f=faction(node.target||job?.target);
  return `<button class="map-node node-${esc(node.type)}" data-action="node" data-id="${esc(node.id)}" ${!current?'disabled':''}><span class="node-icon">${icon(node.type)}</span><span class="node-content"><small>${esc(typeName[node.type]||'行き先')}${node.type==='danger'?' / HIGH RISK':''}</small><strong>${esc(node.name)}</strong><span>${esc(node.description||job?.description||'')}</span><span class="node-bottom">${['job','danger','boss','defense','personal','hunt'].includes(node.type)?`<i style="color:${esc(f.color)}">${esc(f.name)}</i>${pay?`<b>${money(Math.round(pay*.8))} cr〜</b>`:''}`:'<i>準備と選択の夜</i>'}${job?.duration===2?'<b>2夜</b>':''}</span></span><span class="node-arrow">↗</span></button>`;
}
function getJob() {
  const node=currentNode();
  return run.mission?.job || E.nodeJob?.(run,node) || JOBS.find(j=>j.id===node?.jobId) || node?.job || {name:node?.name,description:node?.description,target:node?.target,required:[],routes:[{id:'default',name:'標準ルート',phases:[]}]};
}
function ensureDraft() {
  const job=getJob(), team=availableTeam();
  if (draft.node!==currentNode()?.id) {
    const net=team.find(r=>r.role==='net');
    const field=team.filter(r=>r.id!==net?.id).slice(0,3);
    draft={node:currentNode()?.id,route:job.routes?.[0]?.id || 0,field:field.map(r=>r.id),support:team.filter(r=>r.id!==net?.id&&!field.some(f=>f.id===r.id)).slice(0,2).map(r=>r.id),net:net?.id || '',intel:false};
  }
}
function briefingView() {
  ensureDraft();
  const job=getJob(), node=currentNode(), routes=job.routes||[], route=routes.find(r=>r.id===draft.route)||routes[Number(draft.route)]||routes[0];
  let estimate;
  try { const key=JSON.stringify([run.rng,run.night,node?.id,draft]); if(!forecastCache.has(key)) { if(forecastCache.size>100)forecastCache.clear();forecastCache.set(key,E.estimate(run,node,draft)); } estimate=forecastCache.get(key); } catch { estimate=null; }
  const chance = typeof estimate==='number'?estimate:estimate?.success ?? estimate?.chance ?? estimate?.probability ?? null;
  const percentage = chance===null?'—':`${Math.round(chance<=1?chance*100:chance)}%`;
  const missing=(job.required||[]).filter(role=>![...draft.field,...draft.support,draft.net].map(actor).some(r=>r?.role===role));
  const boss=node?.type==='boss'?bossOfRun():null;
  return `<section class="briefing-panel">${panelTitle('CONTRACT / MISSION BRIEF',esc(job.name || node?.name),button('← マップへ','back-map','','text-button'))}<div class="briefing-intro"><div>${factionTag(job.target || node?.target)}${pill(job.duration===2?'2夜の依頼':'1夜の依頼')}<p class="brief-description">${esc(job.description)}</p><div class="job-terms"><span>報酬目安（歩合前） <b>${money(Math.round((job.pay||0)*.8*(1+(run.news?.pay||0))))} cr</b></span><span>必須ロール <b>${(job.required||[]).map(roleName).join('・') || 'なし'}</b></span><span>地区 <b>${esc(job.district || ['屋台街','港湾倉庫','企業区画上層'][E.actOf(run)-1])}</b></span></div><div class="briefing-news"><span>今夜のニュース：${esc(run.news?.title)}</span>${newsModifiers()}</div></div><div class="success-estimate"><span>成功の見込み</span><strong>${percentage}</strong><small>続行を前提とした参考値。撤退の判断で結果は変わる。</small></div></div>${missing.length?`<div class="warning">⚠ ${missing.map(roleName).join('・')}が編成にいません。不得意な局面が増えますが、派遣は可能です。</div>`:''}<div class="briefing-columns"><div>${sectionTitle('01 / 侵入ルート')}<div class="route-options">${routes.map(r=>`<button class="route-option ${route?.id===r.id?'selected':''}" data-action="route" data-id="${esc(r.id)}" aria-pressed="${route?.id===r.id}"><span>${route?.id===r.id?'●':'○'}</span><div><strong>${esc(r.name)}</strong><p>${esc(r.description)}</p></div></button>`).join('')}</div><label class="intel-control"><input type="checkbox" data-change="intel" ${draft.intel?'checked':''}><span><strong>事前情報を手に入れる</strong><small>成功率の補正・敵と勢力の癖を開示。情報券／前歴の無料分を優先。</small></span><b>${(run.intelTickets||0)>0?'情報券を使用':run.background==='net'&&!run.freeIntel?.[E.actOf(run)]?'前歴特典':`${(run.snake>=30?150:250)*E.actOf(run)} cr`}</b></label>${draft.intel?`<div class="intel-report"><span class="eyebrow">INTELLIGENCE REPORT</span><p>${esc(faction(job.target||node?.target).trait)}</p><p><b>対策：</b>${esc(boss?.counter || faction(job.target||node?.target).counter)}</p>${boss?`<p>${esc(boss.mechanic)}</p>`:''}</div>`:''}${sectionTitle('02 / フェーズ表')}<div class="phase-table"><div class="phase-table-row head"><span>#</span><span>ネット →</span><span>現場</span><span>DV</span></div>${(route?.phases||[]).map((p,i)=>`<div class="phase-table-row"><span>${String(i+1).padStart(2,'0')}</span><span class="cyan">${esc(phaseName[p.net]||p.net||'—')}</span><span>${esc(phaseName[p.field]||p.field)}</span><b>${p.dv ? p.dv+(run.news?.dv||0)+(node?.type==='danger'?1:0) : '—'}</b></div>`).join('')}</div></div><div>${sectionTitle('03 / 派遣する面子','<span class="muted">現場3 / 支援2 / ネット1</span>')}<div class="assignment-list">${activeTeam().map(r=>assignmentRow(r)).join('')}</div><p class="help-text">ネットの担当はネットランナー。支援は得意な技能で隊を補助します。各レーンの担当は自動で選ばれます。</p>${draft.field.length===0?'<div class="warning">現場に最低1名を配置してください。</div>':''}</div></div><div class="action-bar"><span>判定が悪くても、撤退の判断は残っている。</span>${button('この編成で派遣する ↗','dispatch',`${!draft.field.length?'disabled':''}`,'primary')}</div></section>`;
}
function assignmentRow(r) {
  const value=draft.net===r.id?'net':draft.field.includes(r.id)?'field':draft.support.includes(r.id)?'support':'reserve';
  const unavailable=r.unavailableUntil>run.night;
  const stats=E.getRunnerStats(r);
  return `<div class="assignment-row">${avatar(r)}<div><strong>${esc(r.name)}</strong><span>${esc(roleName(r.role))} · HP ${r.hp}/${E.getRunnerMaxHP(r)}</span><small>射撃 ${stats.REF+(r.skills?.shoot||0)} · 隠密 ${stats.COOL+(r.skills?.stealth||0)} · 電子 ${stats.TECH+(r.skills?.electronics||0)}</small></div><select data-change="assignment" data-id="${esc(r.id)}" aria-label="${esc(r.name)}の配置" ${unavailable?'disabled':''}><option value="reserve">${unavailable?'療養中':'待機'}</option><option value="field" ${value==='field'?'selected':''}>現場</option><option value="support" ${value==='support'?'selected':''}>支援</option>${r.role==='net'?`<option value="net" ${value==='net'?'selected':''}>ネット</option>`:''}</select></div>`;
}
function logText(entry) { return typeof entry==='string'?entry:entry?.text || entry?.message || ''; }
function missionView() {
  const m=run.mission||{}, columns=m.columns||[], current=columns[m.column]||{}, decision=m.decision||run.decision;
  const logs=m.log||m.logs||run.logs||[];
  return `<section class="mission-panel">${panelTitle('LIVE / ENCRYPTED FEED',esc(m.job?.name||currentNode()?.name||'現場との通信'),pill(run.stage==='decision'?'判断待ち':'通信中',run.stage==='decision'?'danger':'live'))}<div class="mission-progress">${columns.map((p,i)=>`<div class="${i<m.column?'complete':i===m.column?'current':''}"><span>${i<m.column?'✓':String(i+1).padStart(2,'0')}</span><small>${esc(phaseName[p.field]||p.field)}</small></div>`).join('')}</div><div class="live-summary"><span><i class="signal-dot"></i> ${esc(phaseName[current.field]||current.field||'依頼完了')}</span><span>警報 <b class="${m.alarm>1?'danger-text':''}">${m.alarm||0}</b></span><span>目標 <b>${m.objectives||0}</b></span>${m.round?`<span>交戦 <b>${m.round} / 3</b></span>`:''}${currentNode()?.type==='boss'&&m.bossHP!==undefined?`<span>ボス耐久 <b>${m.bossHP}</b></span>`:''}</div>${(m.enemies||[]).length?`<div class="enemy-line"><span>敵部隊</span>${m.enemies.map(e=>`<span class="enemy-chip ${e.hp<=0?'defeated':''}">${esc(e.name||e.type)} <b>${e.hp??e.durability??1}</b></span>`).join('')}</div>`:''}<div class="mission-log" id="mission-log" role="log" aria-label="派遣の経過">${logs.map((entry,i)=>`<div class="log-entry ${esc(entry.tone||'')}" style="--entry:${i}"><span class="log-index">${String(i+1).padStart(3,'0')}</span><p>${esc(logText(entry))}</p></div>`).join('')}${!logs.length?'<div class="log-entry"><span class="log-index">000</span><p>回線確立。現場は、あなたの指示を待っている。</p></div>':''}</div>${run.stage==='decision'?`<div class="decision-panel"><div class="decision-symbol">!</div><div><span class="eyebrow">YOUR CALL, FIXER</span><h3>${decision?.kind==='police'?'鎮圧班が来る。':'この先へ、進ませるか。'}</h3><p>${esc(decision?.text || '隊の損耗が増しています。続行するか、今夜の仕事を捨てて撤退するかを決めてください。')}</p><div class="decision-buttons">${decision?.kind==='police'?`${button('引き渡す','decision','data-id="surrender"','danger-button')}${button('仲間をかばう','decision','data-id="protect"','primary')}${button('全員で撤退','decision','data-id="retreat"')}`:`${button('続行する →','decision','data-id="continue"','primary')}${button('撤退して帰す','decision','data-id="retreat"','danger-button')}`}</div></div></div>`:`<div class="action-bar"><div class="auto-control">${button(autoTimer?'Ⅱ 自動進行を止める':'▷ 自動で進める','auto','','secondary')}<select data-change="speed" aria-label="通信速度"><option value="1400" ${settings.speed===1400?'selected':''}>ゆっくり</option><option value="850" ${settings.speed===850?'selected':''}>標準速度</option><option value="280" ${settings.speed===280?'selected':''}>高速</option></select></div>${button('次の通信を受ける →','advance','','primary')}</div>`}</section>`;
}
function recipientOptions(item) {
  const data=findItem(item.id)||item;
  return activeTeam().filter(r=>!data.roles?.length||data.roles.includes(r.role));
}
function rewardView() {
  const rewards=run.rewards||[];
  return `<section class="reward-panel">${panelTitle('CONTRACT COMPLETE / YOUR CUT','今夜の取り分。',pill('依頼成功','success'))}<p class="panel-description">次の夜へ、何を持っていく。<br>一つだけ選べる。義体の施術費はかからないが、人間性は削れる。</p><div class="reward-grid">${rewards.map((item,index)=>`<article class="reward-card ${item.rare?'rare':''} ${rewardChoice===index?'selected':''}"><div class="reward-card-head"><span class="eyebrow">${{cyber:'CYBERWARE',weapon:'WEAPON',armor:'ARMOR',tool:'TOOL',runner:'NEW RUNNER',intel:'INTELLIGENCE',cash:'CREDITS'}[item.type]||'REWARD'}</span>${item.rare?pill('希少','gold'):''}</div><div class="reward-art">${icon(item.type)}</div><h3>${esc(item.name || item.runner?.name || findItem(item.id)?.name)}</h3><p>${esc(item.description || findItem(item.id)?.description || '')}</p>${item.type==='cyber'?`<div class="item-details"><span>部位 <b>${esc(slotName[findItem(item.id)?.slot]||'義体')}</b></span><span>人間性 <b class="danger-text">−${findItem(item.id)?.humanity||0}</b></span></div>`:''}${item.type==='runner'?`<div class="item-details"><span>${esc(roleName(item.runner?.role))}</span><span>歩合で加入</span></div>`:''}<div class="reward-card-controls">${['cyber','weapon','armor','tool'].includes(item.type)?`<label for="reward-recipient-${index}">受け取るランナー</label><select id="reward-recipient-${index}" data-change="reward-recipient" data-index="${index}">${recipientOptions(item).map(r=>`<option value="${esc(r.id)}">${esc(r.name)} / ${esc(roleName(r.role))}</option>`).join('')}</select><div id="reward-replacement-${index}">${replacementSelect(item,recipientOptions(item)[0]?.id,`reward-replace-${index}`)}</div>`:''}${button('これを受け取る →','reward',`data-index="${index}" ${['cyber','weapon','armor','tool'].includes(item.type)&&!recipientOptions(item).length?'disabled':''}`,'primary')}</div></article>`).join('')}</div><div class="skip-reward"><p>どれも必要なければ、現金で受け取れる。</p>${button('すべて見送り、500 cr を受け取る','reward','data-index="-1"','text-button')}</div></section>`;
}
function replacementSelect(item, runnerId, id) {
  const data=findItem(item.id)||item, r=actor(runnerId);
  if (item.type!=='cyber'||!r) return '';
  const installed=(r.cyber||[]).map(findItem).filter(Boolean);
  const family=installed.find(x=>x.family===data.family);
  if (family) return `<p class="help-text">${esc(family.name)}と置き換え。外した義体と人間性は戻りません。</p>`;
  const same=installed.filter(x=>x.slot===data.slot), capacity=data.slot==='skin'?1:2;
  if (same.length<capacity) return `<p class="help-text">${esc(slotName[data.slot])} ${same.length}/${capacity} 枠使用中</p>`;
  return `<label for="${id}">外す義体（戻りません）</label><select id="${id}">${same.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select>`;
}
function serviceView() {
  const service=run.service||{}, type=service.type || currentNode()?.type;
  const stock=service.stock||[], candidates=service.candidates||[];
  const titles={doctor:['CLINIC / AFTER HOURS','人間であるうちに。'],shop:['SECONDHAND / GOOD AS NEW','昨日の誰かの切り札。'],recruit:['BACK ALLEY / NEW FACES','一人では、夜は越せない。'],rest:['SAFEHOUSE / A QUIET NIGHT','今夜は、帰る場所がある。'],event:['CITY ENCOUNTER / YOUR CHOICE','路地裏で、声がした。']};
  const title=titles[type]||['YOMIHAMA / NIGHT LIFE',currentNode()?.name||'街の片隅'];
  return `<section class="service-panel">${panelTitle(title[0],title[1],pill(typeName[type]||type))}<p class="panel-description">${esc(currentNode()?.description||service.description||'この夜のうちに、次の一手を整えよう。')}</p>${type==='doctor'?doctorView(stock):type==='shop'?shopView(stock):type==='recruit'?recruitView(candidates):type==='rest'?restView():type==='event'?eventView(service):'<div class="empty-state">街の出来事を記録しました。</div>'}<div class="action-bar"><span>夜が明けると、隠れ家代と専属の手当が支払われる。</span>${button('この夜を終える →','finish-night',type==='event'&&!service.used?'disabled':'','primary')}</div></section>`;
}
function stockCard(item,index,type) {
  const data=findItem(item.id)||item;
  const normalized={...data,...item,type:item.type||type};
  const recipients=recipientOptions(normalized), recipient=recipients[0];
  return `<article class="stock-card"><div class="stock-icon">${icon(normalized.type)}</div><div class="stock-details"><span class="eyebrow">${normalized.type==='cyber'?esc(slotName[data.slot])+' / '+(data.type==='active'?'起動型':data.type==='builtin'?'内蔵武器':'常時型'):{weapon:'武器',armor:'防具',tool:'道具'}[normalized.type]||'装備'}</span><h3>${esc(data.name)}</h3><p>${esc(data.description)}</p>${normalized.type==='cyber'?`<span class="danger-text">人間性 −${data.humanity}</span>`:''}</div><div class="stock-purchase"><strong>${money(item.price??data.price)} <small>cr</small></strong><select id="stock-recipient-${index}" data-change="stock-recipient" data-index="${index}" aria-label="${esc(data.name)}の購入先">${recipients.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select><div id="stock-replacement-${index}">${replacementSelect(normalized,recipient?.id,`stock-replace-${index}`)}</div>${button(normalized.type==='cyber'?'購入して施術':'購入して装備','buy',`data-index="${index}" ${run.money<(item.price??data.price)||!recipients.length?'disabled':''}`,'small-button')}</div></article>`;
}
function doctorView(stock) {
  return `<div class="clinic-services">${sectionTitle('処置とラザロ契約')}<div class="treatment-grid">${activeTeam().map(r=>`<article class="treatment-card"><div class="treatment-runner">${avatar(r)}<div><h3>${esc(r.name)}</h3><p>HP ${r.hp}/${E.getRunnerMaxHP(r)} · 人間性 ${r.humanity}</p></div></div><div class="treatment-buttons">${button('治療 / 400 cr','treatment',`data-id="${esc(r.id)}" data-kind="heal" ${run.money<400||r.hp>=E.getRunnerMaxHP(r)?'disabled':''}`,'small-button')}${button('セラピー＋15 / 600 cr','treatment',`data-id="${esc(r.id)}" data-kind="therapy" ${run.money<600||r.humanity>=r.maxHumanity?'disabled':''}`,'small-button')}</div><p class="help-text">セラピー後は次の1夜、派遣できません。</p><label>ラザロ / 救急プラン<select data-change="insurance" data-id="${esc(r.id)}"><option value="none" ${!r.insurance||r.insurance==='none'?'selected':''}>未加入</option><option value="basic" ${r.insurance==='basic'?'selected':''}>基本 / 100 cr・夜 + 回収30%</option><option value="premium" ${r.insurance==='premium'?'selected':''} ${E.actOf(run)<2?'disabled':''}>武装回収 / 300 cr・夜 + 出動費</option></select></label></article>`).join('')}</div><p class="help-text">ラザロは死亡セーブ失敗時に回収。武装回収は1依頼に1回、援護付き。暴走中は契約対象外です。</p></div>${sectionTitle('義体の在庫','<span class="muted">同系統は上位モデルに交換 / 各部位2枠・体表1枠</span>')}<div class="stock-list">${stock.map((item,index)=>stockCard(item,index,'cyber')).join('')||'<div class="empty-state">今夜の在庫は売り切れた。</div>'}</div>`;
}
function shopView(stock) {
  return `${sectionTitle('今夜の品揃え')}<div class="stock-list">${stock.map((item,index)=>stockCard(item,index,'weapon')).join('')||'<div class="empty-state">今夜の在庫は売り切れた。</div>'}</div>${sectionTitle('修理と下取り')}<div class="repair-grid">${activeTeam().map(r=>`<article class="repair-card"><h3>${esc(r.name)}</h3><p>現在の装甲 ${r.armor || 0}</p>${button('防具を修理 / 150 cr','treatment',`data-id="${esc(r.id)}" data-kind="repair" ${run.money<150?'disabled':''}`,'small-button')}<div class="sell-list">${[['weapon',r.weapon],['armor',r.armorId],['tool',r.tool]].filter(([,id])=>findItem(id)).map(([slot,id])=>`${button(`${esc(findItem(id).name)}を売る / ${money(Math.floor(findItem(id).price/2))} cr`,'sell',`data-id="${esc(r.id)}" data-slot="${slot}"`,'text-button')}`).join('')}</div></article>`).join('')}</div>`;
}
function recruitView(candidates) {
  return `<p class="help-text recruitment-fee">紹介料は1人 ${money(300*E.actOf(run))} cr。歩合は毎夜の固定費なし、専属は成功報酬を隊に残せます。</p><div class="candidate-grid">${candidates.map((candidate,index)=>{const r=candidate.runner||candidate;return `<article class="candidate-card">${avatar(r,true)}<span class="eyebrow">${esc(roleName(r.role))}</span><h3>${esc(r.name)}</h3>${r.trait?pill(typeof r.trait==='object'?r.trait.name:r.trait,'gold'):''}<p>${esc(r.description || ROLES[r.role]?.description)}</p><div class="candidate-stats">${Object.entries(r.stats||{}).map(([k,v])=>`<span>${k}<b>${v}</b></span>`).join('')}</div><p class="help-text">HP ${r.hp || E.getRunnerMaxHP(r)} · 人間性 ${r.humanity} · 専属手当 ${money(r.wage)} cr</p><div class="candidate-actions">${button('歩合で迎える','hire',`data-id="${esc(r.id)}" data-index="${index}" data-contract="share"`,'primary')}${button('専属で迎える','hire',`data-id="${esc(r.id)}" data-index="${index}" data-contract="exclusive"`,'secondary')}</div></article>`;}).join('')||'<div class="empty-state">今夜会える候補は、もういない。</div>'}</div>`;
}
function restView() {
  return `<div class="rest-scene">${citySVG(true)}<div><span class="eyebrow">ONE NIGHT OFF THE GRID</span><h3>窓の外は、まだ雨だ。</h3><p>武器を置き、湯を沸かす。<br>隣に座る誰かが、今日あった話をする。<br>それだけで、少し人間に戻れる。</p><div class="rest-benefits">${pill('全員のHPを全回復','success')}${pill('全員の人間性＋5','success')}${pill('防具の即席修理')}</div>${run.service?.used?'<p class="positive">✓ 隊は休息を取った。</p>':button('みんなを休ませる','rest','','primary')}</div></div>`;
}
function eventView(service) {
  const event=service.event||service;
  return `<article class="event-card"><span class="event-emblem">✳</span><span class="eyebrow">${esc(event.subtitle||'A STORY FROM THE STREETS')}</span><h3>${esc(event.title || event.name || currentNode()?.name)}</h3><p>${esc(event.text || event.description || currentNode()?.description)}</p>${service.used?`<div class="event-outcome">${esc(service.outcome || (run.logs?.at(-1)?.text) || '選択は街に記録された。明日の夜が、その続きを語る。')}</div>`:`<div class="event-choices">${(event.choices||[]).map((choice,index)=>`<button data-action="event" data-index="${index}" class="event-choice"><span>${String(index+1).padStart(2,'0')}</span><div><strong>${esc(choice.name || choice.label || choice.text)}</strong><small>${esc(choice.description || choice.hint || '')}</small></div><b>→</b></button>`).join('')}</div>`}</article>`;
}
function allianceView() {
  return `<section class="alliance-panel">${panelTitle('THE KEY IS YOURS / PICK A SIDE','鍵は手に入れた。次は、誰を信じる。')}<p class="panel-description">箱の中身は、三社が欲しがっている。<br>組んだ社が道を開く。そして最後、その社が道を塞ぐ。</p><div class="alliance-grid">${['mitsukane','verde','hakuro'].map(id=>`<article class="alliance-card" style="--faction:${esc(faction(id).color)}"><div class="alliance-emblem">${{mitsukane:'三',verde:'Ⅴ',hakuro:'白'}[id]}</div><span class="eyebrow">CORPORATE CONNECTION</span><h3>${esc(faction(id).name)}</h3><p>${esc({mitsukane:'重工の秩序は、鋼鉄の向こうにある。強い身体と、装甲を抜く手段が必要になる。',verde:'救いと実験は、同じ薬瓶に入っている。治療する力と、言葉を交わす余地を残そう。',hakuro:'回線は街の血管だ。腕のいいハッカーか、回線を切り落とす技術が要る。'}[id])}</p><div class="alliance-boss"><span>最後に待つ者</span><b>${esc(BOSSES[id]?.name)}</b></div>${button('この社と手を組む →','alliance',`data-id="${id}"`,'primary')}</article>`).join('')}</div></section>`;
}
function endingView() {
  return `<section class="ending-panel">${panelTitle('THE BOX IS OPEN / ONE LAST CALL','箱を開けた、その先へ。')}<p class="panel-description">名簿に載るのは、奪われた名前。<br>この街に何を残すか。最後の判断は、フィクサーに託された。</p><div class="alliance-grid">${(run.endingOptions||[]).map(option=>`<article class="alliance-card ending-card ${option.locked?'ending-locked':''}"><div class="alliance-emblem">${{publish:'◉',seal:'◇',release:'✳'}[option.id]||'◈'}</div><span class="eyebrow">${option.locked?'A STORY STILL UNTOLD':'THE FINAL CUT'}</span><h3>${esc(option.name)}</h3><p>${esc(option.description)}</p><div class="alliance-boss"><span>${option.locked?'解放条件':'この選択が、街に残る。'}</span><b>${esc(option.locked?option.requirement:'十二夜の結末')}</b></div>${button(option.locked?'まだ選べない':'この結末を選ぶ →','ending',`data-id="${esc(option.id)}" ${option.locked?'disabled':''}`,'primary')}</article>`).join('')}</div></section>`;
}
function resultView() {
  const result=run.result||{}, won=result.won;
  return `<section class="result-panel"><div class="result-art">${citySVG()}</div><div class="result-copy"><span class="eyebrow">${won?'THE CITY KNOWS YOUR NAME':'THE LINE WENT QUIET'}</span><h2>${won?'そして、夜が明けた。':'それでも、街は眠らない。'}</h2><p class="result-reason">${esc(result.reason || '')}</p><p class="epilogue">${esc(result.epilogue || '残された者が、次の夜の話をする。')}</p></div><div class="result-stats"><div><span>辿り着いた夜</span><strong>${run.night}<small> / 12</small></strong></div><div><span>手に入った信用</span><strong>＋${result.credit || 0}</strong></div><div><span>残った資金</span><strong>${money(run.money)}<small> cr</small></strong></div><div><span>生き残った仲間</span><strong>${activeTeam().length}<small> 名</small></strong></div></div><div class="result-survivors">${run.team.map(r=>`<div>${avatar(r)}<strong>${esc(r.name)}</strong><span>${esc(statusName[r.status]||r.status)}</span></div>`).join('')}</div>${(result.after||[]).length?`<div class="result-after"><span class="eyebrow">THE RUNNERS / AFTER THE RAIN</span>${result.after.map(line=>`<p>${esc(line)}</p>`).join('')}</div>`:''}<div class="action-bar"><span>信用と記憶は残る。次の隊は、またゼロから。</span>${button('次の十二夜へ →','result-home','','primary')}</div></section>`;
}

function renderModal() {
  const root=$('#modal-root');
  if (!modal) { root.innerHTML=''; document.body.classList.remove('modal-open'); return; }
  document.body.classList.add('modal-open');
  let content='';
  if (modal.type==='rules') content=rulesView();
  if (modal.type==='runner') content=runnerDetail(actor(modal.id));
  if (modal.type==='journal') content=journalView();
  if (modal.type==='past-run') { const record=meta.runs[modal.index]||{}; content=`<span class="eyebrow">THE CITY REMEMBERS / ${record.won?'DAWN':'END OF LINE'}</span><h2>第 ${record.night} 夜の、その後。</h2><p>${esc(record.reason || '')}</p><div class="past-run-epilogue"><p>${esc(record.epilogue || 'このランの詳細な結末は記録されていません。')}</p>${(record.after||[]).map(line=>`<p>${esc(line)}</p>`).join('')}</div><p class="help-text">SEED ${esc(record.seed)} / 段 ${record.difficulty || 0} / 信用＋${record.credit || 0}</p>`; }
  if (modal.type==='confirm-new') content=`<span class="eyebrow">A NEW LINE</span><h2>現在のランを終えて、新しく始める。</h2><p>仲間と装備は引き継がれません。ここまでの記憶と信用は、街に残ります。</p><div class="modal-actions">${button('現在のランに戻る','close-modal','','secondary')}${button('新しいランを始める','new-run','','primary')}</div>`;
  root.innerHTML=`<div class="modal-backdrop" data-action="close-backdrop"><section class="modal ${modal.type==='runner'?'runner-modal':''}" role="dialog" aria-modal="true" aria-label="${{rules:'ルール',runner:'ランナー詳細',journal:'通信記録','past-run':'過去のラン','confirm-new':'新しいラン'}[modal.type]||'詳細'}"><button class="modal-close" data-action="close-modal" aria-label="閉じる">×</button>${content}</section></div>`;
  setTimeout(()=>$('.modal-close')?.focus(),0);
}
function rulesView() {
  return `<p class="eyebrow">FIXER'S FIELD MANUAL</p><h2>引き金の向こうに、判断を。</h2><p class="panel-description">あなたはフィクサー。自分では撃たず、隊を編成して仕事に送り出す。</p><div class="rules-grid"><section><h3>十二夜の流れ</h3><p>1ランは3幕×4夜。毎夜、行き先を一つ選びます。先の2夜を見て、回復と強化を挟みましょう。4・8・12夜は大仕事。失敗でラン終了です。</p><p>大仕事から撤退した場合、一度だけ再挑戦できます。ボスの耐久は削れたまま、護衛は復活します。第5段では再挑戦できません。</p></section><section><h3>ダイスと判定</h3><p><b>能力＋技能＋補正＋d10 ≧ DV</b> で成功。10は追加のd10を足し、1は追加のd10を引きます。HP半分未満は判定−2。技能は使うほど伸びます。</p><p>成功の見込みは保証ではありません。ルート・編成・情報の違いを比較するための目安です。</p></section><section><h3>隊と二つのレーン</h3><p>現場3名・支援2名・ネット1名。各列はネット→現場の順に進み、最も得意なランナーが担当します。ネット担当がいなければネット判定は失敗します。</p><p>交戦は3ラウンド。敵の顔ぶれを知り、武器やロールで対策を。重傷・警報などで、続行か撤退かを選べます（1依頼2回まで）。</p></section><section><h3>命と防具</h3><p>最大HPは11＋BODY×4。被ダメージから装甲を引き、貫通されると装甲が1摩耗。HP0では <b>d10＜BODY＋補正</b> の死亡セーブ。死んだ仲間は戻りません。</p><p>闇医者で加入するラザロは、失敗した死亡セーブから命を回収します。武装回収は第2幕から。暴走中は対象外です。</p></section><section><h3>人間性と義体</h3><p>義体は各部位2枠、体表1枠。上位モデルは下位と交換。起動型は自動で働き、使用ごとに人間性−1。外しても人間性は戻りません。</p><p>31以上は安定、16〜30は10%で動揺（射撃・回避−2）、15以下は発作を判定。暴走すると強くなる反面、撤退指示を聞かず、敵3体を倒すと鎮圧班が追います。0で隊を離脱します。</p><p>隠れ家で全員＋5。セラピーは600crで1名＋15、次の1夜は派遣不可。上限のEMP×10まで回復できます。</p></section><section><h3>資金と信用</h3><p>隠れ家代200cr＋専属の手当を毎夜支払います。歩合契約は固定費がなく、成功報酬から分配。所持金が3夜連続でマイナスになると廃業です。</p><p>企業ヒート80超は敵＋1、100で次の夜が防衛戦。敵を過剰に倒すほど上がります。</p><p>夜を越えると信用1、大仕事は5、クリアは15、個人依頼は3。信用で選択肢を解放できますが、能力は引き継ぎません。</p></section></div><div class="rules-footer">保存はブラウザー内。各操作と判断待ちで自動保存されます。<br>操作：ボタンはTab・Enterで選択 / Escapeで詳細を閉じる。</div>`;
}
function runnerDetail(r) {
  if (!r) return '<p>ランナーが見つかりません。</p>';
  const stats=E.getRunnerStats(r), installed=(r.cyber||[]).map(findItem).filter(Boolean);
  return `<div class="runner-detail-head">${avatar(r,true)}<div><span class="eyebrow">${esc(roleName(r.role))} / ${esc(statusName[r.status]||r.status)}</span><h2>${esc(r.name)}</h2><p>${esc(r.description || ROLES[r.role]?.description)}</p>${r.trait?pill(typeof r.trait==='object'?r.trait.name:r.trait,'gold'):''}</div></div><div class="detail-stats">${['BODY','REF','INT','TECH','COOL','EMP'].map(k=>`<div><span>${k}</span><strong>${stats[k]}</strong></div>`).join('')}</div><div class="runner-detail-columns"><section>${sectionTitle('技能')}<div class="skill-list">${Object.entries({shoot:'射撃',evade:'回避',drive:'運転',perception:'知覚',interface:'インターフェース',electronics:'電子',medical:'医療',stealth:'隠密',persuade:'説得'}).map(([id,name])=>`<div><span>${name}</span><b>${r.skills?.[id]||0}</b></div>`).join('')}</div>${sectionTitle('契約')}<p>忠誠 ${r.loyalty || 0} / 達成依頼 ${r.missions || 0} 回</p>${r.status==='active'?`<label>契約の種類<select data-change="contract" data-id="${esc(r.id)}"><option value="exclusive" ${r.contract==='exclusive'?'selected':''}>専属 / ${money(r.wage)} cr・夜</option><option value="share" ${r.contract==='share'?'selected':''}>歩合 / 成功報酬から分配</option></select></label>`:''}</section><section>${sectionTitle('装備')}<div class="detail-equipment">${[['武器',r.weapon],['防具',r.armorId],['道具',r.tool]].map(([name,id])=>`<div><span>${name}</span><strong>${esc(findItem(id)?.name||'なし')}</strong><p>${esc(findItem(id)?.description||'')}</p></div>`).join('')}</div></section></div>${sectionTitle('義体 / 使用した効果の記録')}<div class="cyber-slots">${Object.entries(slotName).map(([slot,name])=>`<div class="cyber-slot"><span>${name}<small>${installed.filter(c=>c.slot===slot).length}/${slot==='skin'?1:2}</small></span>${installed.filter(c=>c.slot===slot).map(c=>`<div><strong>${esc(c.name)}</strong><p>${esc(c.description)}</p><small>効いた回数 ${r.effectCounts?.[c.id] || 0}</small></div>`).join('')||'<em>空き枠</em>'}</div>`).join('')}</div>`;
}
function journalView() {
  const logs=[...(run?.history||[]),...(run?.logs||[])];
  return `<p class="eyebrow">THE RUN / SAVED TRANSMISSIONS</p><h2>通信の記録</h2><div class="journal-log">${logs.map((l,i)=>`<div class="log-entry ${esc(l.tone||'')}"><span class="log-index">${String(i+1).padStart(3,'0')}</span><p>${esc(typeof l==='object'?l.text||l.message||`${l.night?'第'+l.night+'夜 ':''}${l.name||l.reason||l.result||''}`:l)}</p></div>`).join('')||'<p class="muted">最初の通信は、まだ届いていない。</p>'}</div>`;
}

function doNewRun() {
  const seed=$('#run-seed')?.value.trim() || draft.seed || undefined;
  mutate(()=>{
    if (run && run.stage!=='result') { E.endRun(run,'引退：新しい十二夜へ'); E.finalizeRun(run,meta); }
    run=E.newRun({background:selectedBackground,difficulty:selectedDifficulty,seed,roles:draftRoles,company:selectedCompany},meta);
    screen='game'; draft={}; modal=null; stopAuto();
  });
  window.scrollTo({top:0,behavior:'smooth'});
}
function advance() { if (run?.stage!=='mission') return stopAuto(); mutate(()=>E.advanceMission(run)); }
function toggleAuto() {
  if (autoTimer) { stopAuto(); render(); return; }
  if (run?.stage!=='mission') return;
  autoTimer=setInterval(advance,settings.speed);
  render();
}
function onAction(event) {
  const target=event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action=target.dataset.action;
  if (action==='close-backdrop' && target!==event.target) return;
  event.preventDefault();
  tone(['retreat','surrender'].includes(target.dataset.id));
  switch(action) {
    case 'home': stopAuto(); screen='home'; modal=null; save(); render(); break;
    case 'resume': case 'last-result': screen='game'; render(); break;
    case 'home-tab': homeTab=target.dataset.id; render(); break;
    case 'sound': settings.sound=!settings.sound; save(); render(); break;
    case 'rules': modal={type:'rules'}; renderModal(); break;
    case 'journal': modal={type:'journal'}; renderModal(); break;
    case 'archive-run': modal={type:'past-run',index:Number(target.dataset.index)};renderModal();break;
    case 'close-modal': case 'close-backdrop': modal=null; renderModal(); break;
    case 'runner': modal={type:'runner',id:target.dataset.id}; renderModal(); break;
    case 'background': selectedBackground=target.dataset.id; draft.seed=$('#run-seed')?.value; render(); break;
    case 'confirm-new': draft.seed=$('#run-seed')?.value; modal={type:'confirm-new'}; renderModal(); break;
    case 'new-run': doNewRun(); break;
    case 'unlock': mutate(()=>E.buyUnlock(meta,target.dataset.id)); break;
    case 'node': mutate(()=>{E.selectNode(run,target.dataset.id);draft={};}); break;
    case 'back-map': mutate(()=>{run.stage='map';run.selectedNode=null;draft={};}); break;
    case 'route': draft.route=target.dataset.id; render(); break;
    case 'dispatch': mutate(()=>E.startMission(run,{route:draft.route,field:draft.field,support:draft.support,net:draft.net||null,intel:draft.intel})); break;
    case 'advance': advance(); break;
    case 'auto': toggleAuto(); break;
    case 'decision': mutate(()=>E.decide(run,target.dataset.id)); break;
    case 'reward': {
      const index=Number(target.dataset.index), recipient=$(`#reward-recipient-${index}`)?.value, replace=$(`#reward-replace-${index}`)?.value;
      mutate(()=>E.chooseReward(run,index,recipient,replace)); break;
    }
    case 'buy': {
      const index=Number(target.dataset.index), item=run.service?.stock?.[index];
      if (!item) break;
      mutate(()=>E.service(run,'buy',{id:item.id,type:item.type||((run.service?.type||currentNode()?.type)==='doctor'?'cyber':'weapon'),runnerId:$(`#stock-recipient-${index}`)?.value,replaceId:$(`#stock-replace-${index}`)?.value})); break;
    }
    case 'treatment': mutate(()=>E.service(run,target.dataset.kind,{runnerId:target.dataset.id})); break;
    case 'sell': mutate(()=>E.service(run,'sell',{runnerId:target.dataset.id,slot:target.dataset.slot})); break;
    case 'hire': mutate(()=>E.service(run,'hire',{runnerId:target.dataset.id,index:Number(target.dataset.index),contract:target.dataset.contract})); break;
    case 'rest': mutate(()=>E.service(run,'rest',{})); break;
    case 'event': mutate(()=>E.service(run,'event',{index:Number(target.dataset.index)})); break;
    case 'alliance': mutate(()=>E.service(run,'alliance',{id:target.dataset.id})); break;
    case 'ending': mutate(()=>E.service(run,'ending',{id:target.dataset.id})); break;
    case 'finish-night': mutate(()=>E.finishNight(run)); break;
    case 'result-home': screen='home';homeTab='start';render();break;
  }
}
document.addEventListener('click',onAction);
document.addEventListener('change',event=>{
  const el=event.target, change=el.dataset.change;
  if (!change) return;
  if (change==='difficulty') selectedDifficulty=Number(el.value);
  if (change==='company') selectedCompany=el.value;
  if (change==='draft-role') draftRoles[Number(el.dataset.index)]=el.value;
  if (change==='speed') { settings.speed=Number(el.value);save();if(autoTimer){stopAuto();toggleAuto();} }
  if (change==='intel') { draft.intel=el.checked;render(); }
  if (change==='assignment') {
    const id=el.dataset.id;
    const max=el.value==='field'?3:el.value==='support'?2:1;
    const count=el.value==='net'?(draft.net?1:0):draft[el.value]?.length||0;
    const already=el.value==='net'?draft.net===id:draft[el.value]?.includes(id);
    if (el.value!=='reserve'&&!already&&count>=max) {toast(`その配置は${max}名までです。先に別の人を待機へ戻してください。`);render();return;}
    draft.field=draft.field.filter(x=>x!==id);draft.support=draft.support.filter(x=>x!==id);if(draft.net===id)draft.net='';
    if(el.value==='net')draft.net=id;else if(el.value!=='reserve')draft[el.value].push(id);
    render();
  }
  if(change==='insurance')mutate(()=>E.service(run,'insurance',{runnerId:el.dataset.id,plan:el.value}));
  if(change==='contract')mutate(()=>E.service(run,'contract',{runnerId:el.dataset.id,contract:el.value}));
  if(change==='reward-recipient') {
    const index=Number(el.dataset.index);$(`#reward-replacement-${index}`).innerHTML=replacementSelect(run.rewards[index],el.value,`reward-replace-${index}`);
  }
  if(change==='stock-recipient') {
    const index=Number(el.dataset.index);$(`#stock-replacement-${index}`).innerHTML=replacementSelect({...run.service.stock[index],type:run.service.stock[index].type||'cyber'},el.value,`stock-replace-${index}`);
  }
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&modal){modal=null;renderModal();}
  if(event.key==='Tab'&&modal){
    const elements=[...document.querySelectorAll('.modal button:not([disabled]),.modal select,.modal input,.modal a')];
    const first=elements[0], last=elements[elements.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopAuto();save();}});
window.addEventListener('beforeunload',save);
render();
