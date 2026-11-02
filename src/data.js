// Content authored for the 12-night Fixer's Cut edition. Prices are gross cr.
export const ROLES = {
  solo: {name:'ソロ',stats:{BODY:7,REF:7,INT:5,TECH:4,COOL:5,EMP:5},skills:{shoot:6,evade:5,drive:2,perception:5,interface:0,electronics:1,medical:1,stealth:3,persuade:2},wage:250,description:'二連射で道を開く戦闘の専門家。重装甲や群れを押し切る。'},
  driver: {name:'ドライバー',stats:{BODY:5,REF:7,INT:5,TECH:5,COOL:6,EMP:6},skills:{shoot:4,evade:5,drive:6,perception:5,interface:0,electronics:2,medical:1,stealth:4,persuade:3},wage:180,description:'運転と逃走の切り札。失敗した仕事から仲間を連れて帰る。'},
  net: {name:'ネットランナー',stats:{BODY:4,REF:5,INT:8,TECH:6,COOL:5,EMP:6},skills:{shoot:2,evade:3,drive:1,perception:5,interface:6,electronics:4,medical:1,stealth:3,persuade:2},wage:220,description:'監視網と黒ICEを破る。ネットレーンを担当できる唯一のロール。'},
  tech: {name:'テック',stats:{BODY:5,REF:5,INT:6,TECH:8,COOL:5,EMP:6},skills:{shoot:3,evade:3,drive:3,perception:4,interface:1,electronics:6,medical:3,stealth:3,persuade:3},wage:200,description:'電子錠、装甲兵、企業設備に強い。機械は嘘をつかない。'},
  medic: {name:'メドテック',stats:{BODY:5,REF:5,INT:6,TECH:7,COOL:6,EMP:8},skills:{shoot:3,evade:3,drive:1,perception:5,interface:0,electronics:3,medical:6,stealth:3,persuade:5},wage:200,description:'治療と交渉の専門家。生身の限界を知る者ほど仲間を生かす。'}
};

export const BACKGROUNDS = [
  {id:'solo',name:'元ソロ',roles:['solo','driver'],perk:'交戦の第1ラウンドは隊全員の射撃＋1。',weakness:'ネットランナーを迎えるまでネット判定は自動失敗。',cost:0},
  {id:'net',name:'元ネットランナー',roles:['net','tech'],perk:'各幕で情報を1回無料購入できる。',weakness:'初期の隊に交戦の専門家がいない。',cost:0},
  {id:'medic',name:'闇医者のツテ',roles:['medic','solo'],perk:'義体の人間性コスト−1（最低1）。',weakness:'運転・逃走を担当する者に乏しい。',cost:0},
  {id:'corp',name:'企業の元社員',roles:['tech','driver'],perk:'開始時に組む社を選択。その社のヒート−15。',weakness:'残り2社のヒート＋10から始まる。',cost:20},
  {id:'snake',name:'白蛇会の身内',roles:['solo','solo'],perk:'白蛇会との関係＋30。情報が割引、路地裏の候補が増える。',weakness:'人間性の低い候補が現れやすい。',cost:35},
  {id:'mix',name:'寄せ集め',roles:['solo','net','medic'],perk:'好きなロール3人で始められる。',weakness:'初期資金1,000cr。依頼の報酬は2択。',cost:60}
];

export const FACTIONS = {
  mitsukane:{name:'ミツカネ重工',color:'#e8ac5b',trait:'装甲兵と義体兵が多い。鋼鉄の壁が進路を塞ぐ。',counter:'テック／徹甲ライフル'},
  verde:{name:'ヴェルデ製薬',color:'#a4da71',trait:'戦闘薬で第1ラウンド攻撃＋2。検疫ガスは防具を無視する。',counter:'メドテック／知覚／防護服'},
  hakuro:{name:'ハクロウ通信',color:'#65bfff',trait:'ネットDV＋1。カメラ網に失敗すると敵＋2。',counter:'ネットランナー／ニューラル防壁'},
  snake:{name:'白蛇会',color:'#d5b1fb',trait:'群れを率いる。関係＋30なら説得で交戦を避けられ、−30以下なら敵＋1。',counter:'説得／白蛇会との関係'},
  scav:{name:'回収屋',color:'#eb7999',trait:'交戦を2ラウンドで終えられないと目標を持ち去る。',counter:'ソロ／二連射／運転で追撃'}
};

const p = (field,dv,net=null) => ({net,field,dv});
const routes = (dv,kind='infiltrate') => kind==='transport' ? [
  {id:'road',name:'幹線道路',description:'交渉で検問を抜け、運転で追手を振り切る。',phases:[p('negotiate',dv,'camera'),p('combat',dv),p('drive',dv+1),p('objective',dv)]},
  {id:'canal',name:'旧水路',description:'罠の多い抜け道。電子と逃走がものをいう。',phases:[p('trap',dv),p('door',dv,'ice'),p('escape',dv+1),p('objective',dv)]}
] : kind==='rescue' ? [
  {id:'quiet',name:'静かな救出',description:'監視を落とし、見張りを避けて負傷者を連れ帰る。',phases:[p('stealth',dv,'camera'),p('door',dv,'ice'),p('medical',dv+1),p('objective',dv)]},
  {id:'breach',name:'正面突破',description:'護衛と交戦。途中の救護所で立て直せる。',phases:[p('combat',dv,'camera'),p('medical',dv),p('rest',dv),p('objective',dv+1,'data')]}
] : [
  {id:'shadow',name:'影のルート',description:'隠密と電子で侵入。監視が生きていれば警報が増える。',phases:[p('stealth',dv,'camera'),p('trap',dv),p('door',dv,'ice'),p('objective',dv+1,'data')]},
  {id:'force',name:'突破ルート',description:'敵を排除して目的地へ。戦闘力と防具が頼りになる。',phases:[p('combat',dv,'camera'),p('door',dv),p('combat',dv+1,'ice'),p('objective',dv,'data')]}
];
const job = (id,name,rank,target,required,pay,description,kind='infiltrate',duration=1,unlock) => ({id,name,rank,target,district:['屋台街','港湾倉庫','企業区画上層'][rank-1],required,pay,duration,description,routes:routes([13,16,18][rank-1],kind),...(unlock?{unlock}:{})});
export const JOBS = [
  job('lost-chip','雨に沈んだチップ',1,'snake',[],2000,'屋台の古い端末に、死んだ運び屋の最後の記録が残っている。'),
  job('cold-chain','冷たい運び物',1,'verde',['driver'],2400,'停電寸前の保冷庫から生体試料を運び出す。荷札には人の名前。','transport'),
  job('missing-child','帰らない使い走り',1,'snake',['medic'],2200,'白蛇会の使い走りが帰らない。依頼人は「撃つな」とだけ言った。','rescue'),
  job('blackout','停電の五分間',1,'hakuro',['tech'],2400,'屋台街の配電盤を落とす。五分あれば誰かが国境を越えられる。'),
  job('scrap-yard','鉄屑の庭',1,'mitsukane',['tech'],2600,'廃棄義体の山に埋もれた、まだ消去されていない記録を探せ。'),
  job('courier','終電のない街',1,'scav',['driver'],2200,'地下駅で待つ人物を夜明けまでに港へ。切符の代わりに弾倉を受け取った。','transport'),
  job('clinic','路地の診療所',1,'verde',['medic'],2300,'無許可診療所が検疫部隊に封鎖された。患者だけでも連れ出してほしい。','rescue'),
  job('ghost-line','幽霊回線',1,'hakuro',['net'],2500,'使われていない回線から子守唄が流れる。送信元の端末を回収する。'),
  job('pawn','質屋の裏口',1,'mitsukane',[],1900,'質屋に流れた企業認証鍵。売り主より先に見つけなければならない。'),
  job('manifest','消された積荷',2,'mitsukane',['tech'],6500,'荷役機械が無人で動く倉庫。存在しないはずのコンテナを奪取する。'),
  job('quarantine','検疫線の向こう',2,'verde',['medic'],7000,'隔離区域の研究助手を救出。検疫ガスと契約書のどちらも人を殺す。','rescue'),
  job('relay','水底の中継局',2,'hakuro',['net'],7600,'浸水した中継局に入り、ブラックボックスの通信履歴を抜き出す。'),
  job('night-ferry','夜の渡し船',2,'scav',['driver'],8000,'沈没予定の貨物船から証人を運ぶ。クロガネの縄張りを通る仕事だ。','transport',2),
  job('snake-ledger','白い蛇の帳簿',2,'snake',[],5500,'白蛇会の古い帳簿を取り返す。借りを返すか、借りを作るか。'),
  job('auction','名前の競売',2,'scav',['solo'],7400,'人の生存権が売られる地下競売。ネオンも同じ標的を狙っている。'),
  job('steel-garden','鋼鉄の楽園',3,'mitsukane',['tech'],14000,'上層警備艇の制御核を奪う。護衛は人間より装甲の方が多い。'),
  job('trial-zero','第零治験棟',3,'verde',['medic'],15000,'名簿から消された被験者の最後の記録。生かして連れ帰る方法を探せ。','rescue'),
  job('sky-server','空に浮く墓標',3,'hakuro',['net'],16000,'高層通信塔の冷却室へ侵入。街の死者を記録するサーバーが待っている。'),
  job('evacuation','消える街区',3,'mitsukane',['driver'],15000,'再開発の爆破時刻までに住民を上層へ。警備ドローンは避難者も標的とみなす。','transport',2,'jobs'),
  job('last-witness','最後の証言者',3,'verde',['medic'],15500,'会社を訴えるはずだった証人。記憶を消される前に医療施設を抜けろ。','rescue',1,'jobs'),
  job('dead-air','無音の放送',3,'hakuro',['net'],16000,'企業の放送枠を一分だけ奪う。一分あれば、街は箱の中身を知る。','infiltrate',1,'jobs')
];

const c = (id,name,family,tier,slot,type,humanity,price,act,effects={},special='',description='',unlock) => ({id,name,family,tier,slot,type,humanity,price,act,roles:[],effects,special,description,...(unlock?{unlock}:{})});
export const CYBER = [
  c('reflex1','反射増幅器 Mk.I','reflex',1,'nerve','passive',5,1600,1,{REF:1},'','反射＋1。射撃・回避・運転を底上げ。'),
  c('reflex2','反射増幅器 Mk.II','reflex',2,'nerve','passive',9,3600,2,{REF:2},'','反射＋2。下位モデルと入れ替え。'),
  c('reflex3','反射増幅器 Mk.III','reflex',3,'nerve','passive',14,6800,3,{REF:3},'','反射＋3。限界を超えた神経伝達。'),
  c('synapse1','シナプス加速器 Mk.I','synapse',1,'nerve','passive',6,2400,1,{shoot:1,evade:1},'','射撃・回避＋1。'),
  c('synapse2','シナプス加速器 Mk.II','synapse',2,'nerve','passive',10,4800,2,{shoot:2,evade:1},'','射撃＋2、回避＋1。'),
  c('synapse3','シナプス加速器 Mk.III','synapse',3,'nerve','passive',16,7600,3,{shoot:2,evade:2},'','射撃・回避＋2。'),
  c('eye1','鷹の目 Mk.I','eye',1,'sense','passive',4,1400,1,{shoot:1,perception:1},'','射撃・知覚＋1。'),
  c('eye2','鷹の目 Mk.II','eye',2,'sense','passive',8,3200,2,{shoot:2,perception:1},'','射撃＋2、知覚＋1。カナメも愛用する狙撃用義眼。'),
  c('eye3','鷹の目 Mk.III','eye',3,'sense','passive',12,6000,3,{shoot:2,perception:2},'','射撃・知覚＋2。'),
  c('ear1','音響センサー Mk.I','ear',1,'sense','passive',3,1200,1,{perception:2},'','知覚＋2。壁の向こうの呼吸を拾う。'),
  c('ear2','音響センサー Mk.II','ear',2,'sense','passive',6,2600,2,{perception:3},'','知覚＋3。指揮官の通信を識別する。'),
  c('voice','共鳴声帯「コトノハ」','voice',1,'sense','passive',4,1500,1,{persuade:2},'','説得＋2。相手が聞きたい声になる。','cyber'),
  c('deck1','電脳デッキ「小夜」','deck',1,'brain','passive',5,1600,1,{interface:1},'','インターフェース＋1。'),
  c('deck2','電脳デッキ「小夜・弐」','deck',2,'brain','passive',9,3500,2,{interface:2},'','インターフェース＋2。電気屋の使っていた改造型。'),
  c('deck3','電脳デッキ「小夜・極」','deck',3,'brain','passive',14,7000,3,{interface:3},'','インターフェース＋3。'),
  c('memory','記憶補助「栞」','memory',1,'brain','passive',4,1600,1,{INT:1},'','知力＋1。捨てた記憶も残っている。','cyber'),
  c('tech-hand1','精密指「機織」','tech-hand',1,'arm','passive',4,1500,1,{electronics:2},'','電子＋2。'),
  c('tech-hand2','精密指「機織・弐」','tech-hand',2,'arm','passive',7,3300,2,{electronics:3},'','電子＋3。'),
  c('steel-arm1','鉄骨アーム Mk.I','steel-arm',1,'arm','passive',5,1800,1,{BODY:1,shoot:1},'','BODY・射撃＋1。'),
  c('steel-arm2','鉄骨アーム Mk.II','steel-arm',2,'arm','passive',9,3900,2,{BODY:2,shoot:1},'','BODY＋2、射撃＋1。'),
  c('medic-hand','医療指「縫」','medic-hand',1,'arm','passive',4,1500,1,{medical:2},'','医療＋2。','cyber'),
  c('heart1','人工心臓「ツヅミ」','heart',1,'organ','passive',6,1800,1,{BODY:1,death:1},'','BODY＋1、死亡セーブ＋1。'),
  c('heart2','人工心臓「ツヅミ・弐」','heart',2,'organ','passive',11,4200,2,{BODY:2,death:2},'','BODY＋2、死亡セーブ＋2。'),
  c('lung','濾過肺「シラヌイ」','lung',1,'organ','passive',5,1800,1,{BODY:1},'filter','BODY＋1。検疫ガスのダメージを半減。','cyber'),
  c('adrenal','副腎調律器','adrenal',1,'organ','passive',5,2000,1,{evade:1,drive:1},'','回避・運転＋1。','cyber'),
  c('skin1','皮下装甲板 Mk.I','skin',1,'skin','passive',5,1500,1,{armor:2},'','防具の上限＋2。'),
  c('skin2','皮下装甲板 Mk.II','skin',2,'skin','passive',9,3400,2,{armor:3},'','防具の上限＋3。'),
  c('skin3','皮下装甲板 Mk.III','skin',3,'skin','passive',14,6200,3,{armor:4},'','防具の上限＋4。'),
  c('mimic','擬態皮膚','mimic',1,'skin','passive',6,2000,1,{stealth:2},'','隠密＋2。朧と同じ部位を使う。'),
  c('pain','痛覚遮断器','pain',1,'nerve','passive',7,2200,1,{},'pain','重傷による判定−2を無視。','cyber'),
  c('barrier','ニューラル防壁','barrier',1,'brain','passive',6,2200,1,{interface:1},'barrier','インターフェース＋1。ICEの逆流ダメージを半減。','cyber'),
  c('setsuna1','加速脊椎「刹那」','setsuna',1,'nerve','active',12,2400,1,{},'setsuna','最初のラウンド、先手・射撃＋2で3連射。終了後は回避−2。起動ごと人間性−1。'),
  c('setsuna2','加速脊椎「刹那・弐」','setsuna',2,'nerve','active',18,5200,2,{},'setsuna','最初のラウンド、先手・射撃＋2で4連射。終了後は回避−2。起動ごと人間性−1。'),
  c('setsuna3','加速脊椎「刹那・極」','setsuna',3,'nerve','active',26,9800,3,{},'setsuna','2ラウンド、先手・射撃＋2で4連射。終了後は回避−2。起動ごと人間性−1。'),
  c('mikiri','反射神経束「見切り」','mikiri',1,'nerve','active',6,1800,1,{},'mikiri','交戦ごと1度、失敗した回避を振り直す。起動で人間性−1。'),
  c('onibi','興奮剤腺「鬼火」','onibi',1,'organ','active',10,4800,2,{},'onibi','自動で暴走。HP＋10、重傷無視。射撃＋2・二連射。ヒートと鎮圧班の代償を負う。'),
  c('kamaitachi','腕部刃「鎌鼬」','kamaitachi',1,'arm','builtin',9,2000,1,{},'kamaitachi','射撃にBODYとREFの高い方を使用。装甲兵を1発。隠密直後は先手。'),
  c('nio','強化腕「仁王」','nio',1,'arm','builtin',9,2000,1,{BODY:2},'nio','BODY＋2。BODYで射撃できる。BODY＋BODYで扉を破るとヒート＋4。'),
  c('joro','単分子ワイヤー「女郎蜘蛛」','joro',1,'arm','builtin',8,4300,2,{},'joro','通常兵・群れを1発で2体倒す。装甲兵には威力半減。'),
  c('hammer','腕部擲弾筒「鉄槌」','hammer',1,'arm','active',10,4800,2,{},'hammer','交戦ごと1度、判定なしで敵2体に1発ずつ当てる。起動で人間性−1。'),
  c('oboro','光学迷彩皮膚「朧」','mimic',2,'skin','active',9,4500,2,{stealth:2},'oboro','依頼ごと1度、隠密失敗を成功に変える。起動で人間性−1。'),
  c('interrupt','割り込み端子','interrupt',1,'brain','passive',7,2000,1,{},'interrupt','ネットランナーが現場に干渉。交戦開始時のインターフェース成功で敵1体を1ラウンド停止。'),
  c('yata','照準リンク「八咫」','yata',1,'sense','passive',5,1800,1,{shoot:1},'yata','射撃＋1。スマート武器なら出目1の減算が起きない。'),
  c('heart3','人工心臓「ツヅミ・参」','heart',3,'organ','passive',18,8600,3,{BODY:2,death:3},'heart3','BODY＋2、死亡セーブ＋3。ランで1度、失敗した死亡セーブを取り消す。')
];
// Half of the 26 cyberware families are available initially; credit adds options, never flat strength.
CYBER.filter(x=>['synapse','steel-arm','mikiri','joro','hammer','interrupt'].includes(x.family)).forEach(x=>x.unlock='cyber');
CYBER.filter(x=>x.family==='deck'||x.special==='interrupt'||x.special==='barrier').forEach(x=>x.roles=['net']);

const w = (id,name,price,act,effects,special,description,roles=[])=>({id,name,price,act,roles,effects,special,description});
export const WEAPONS = [
  w('nanami','重拳銃「ナナミ」',800,1,{shoot:1},'pistol','射撃＋1。誰でも扱える信頼性の高い拳銃。'),
  w('yodaka','サイレンサー拳銃「ヨダカ」',1500,1,{shoot:1,stealth:1},'silenced','射撃・隠密＋1。'),
  w('raiden','大口径拳銃「雷電」',2600,2,{shoot:2},'heavy','射撃＋2。1ラウンド1発のみ。二連射は無効。'),
  w('tsubame','連射SMG「燕」',2200,2,{},'smg','1ラウンド2発。ソロと重ならない。狙撃手には−2。'),
  w('smart','スマートSMG',2400,2,{shoot:2},'smart','射撃＋2、装甲兵に−1。八咫と組むと出目1の減算なし。'),
  w('onigawara','散弾銃「鬼瓦」',1800,1,{shoot:-1},'shotgun','通常兵・群れを2体倒す。狙撃手にはさらに−3。'),
  w('ozutsu','大型散弾銃「大筒」',3500,2,{shoot:1},'heavyShotgun','通常兵・群れを2体倒す。BODY5以下では射撃−2。狙撃手に−3。'),
  w('yotaka','突撃銃「夜鷹」',2500,2,{shoot:2,stealth:-1},'assault','射撃＋2、狙撃手にさらに＋2。隠密−1。'),
  w('pierce','徹甲ライフル',2800,2,{shoot:1},'pierce','装甲兵を1発で倒す。ソロ専用。',['solo']),
  w('murasame','単分子刀「村雨」',3000,2,{},'blade','射撃にBODYを使用。装甲兵を1発。狙撃手には−3。'),
  w('hanabi','擲弾銃「花火」',3000,2,{shoot:-1},'grenade','交戦ごと1度、判定なしで敵2体に当たる。発射時ヒート＋2。'),
  w('rail','試作レールガン',5000,2,{shoot:3},'rail','射撃＋3。装甲兵を1発、隠れた狙撃手も狙える。交戦ごと2発まで。'),
  w('namazu','テーザー「ナマズ」',900,1,{shoot:1},'taser','射撃＋1。過剰な暴力のヒートを防ぐ。暴走中は無効。')
];
export const ARMORS = [
  w('jacket','防弾ジャケット',700,1,{armor:2},'jacket','防具上限＋2。身軽な標準装備。'),
  w('mesh','防刃メッシュスーツ',1200,1,{armor:3},'mesh','防具上限＋3。街で生き残るための最低限。'),
  w('heavy-vest','重装甲ベスト',1800,1,{armor:4,evade:-1},'heavy','防具上限＋4、回避−1。'),
  w('absorb','衝撃吸収スーツ',2400,2,{armor:3,evade:-1},'absorb','防具上限＋3、回避−1。貫通しても防具が摩耗しない。'),
  w('hazmat','防護服',1600,1,{armor:2,stealth:-1},'hazmat','防具上限＋2、隠密−1。検疫ガスを無効化。'),
  w('exo','外骨格',4500,2,{armor:5,BODY:1,evade:-2,stealth:-2},'exo','防具上限＋5、BODY＋1。回避・隠密−2。ソロ専用。',['solo']),
  w('poncho','光学迷彩ポンチョ',1600,1,{stealth:2},'camo','隠密＋2。防具上限は増えない。'),
  w('uniform','企業の警備服',1800,1,{persuade:2},'disguise','説得＋2。企業区画上層では隠密＋2。交戦すると効果を失う。'),
  w('coat','ロングコート',1400,1,{armor:2},'coat','防具上限＋2。白蛇会との交渉で説得＋2。'),
  w('hood','ICE遮断フード',1400,1,{interface:1},'ice','インターフェース＋1。黒ICEの逆流を半減。ネットランナー専用。',['net'])
];
export const TOOLS = [
  w('medkit','救急キット',700,1,{medical:1},'medkit','医療＋1。軽量の応急処置用品。'),
  w('lockpick','電子ピック',900,1,{electronics:1},'lockpick','電子＋1。旧式の扉ならこれで十分。'),
  w('scanner','携帯スキャナー',1100,1,{perception:1},'scanner','知覚＋1。罠と待ち伏せの発見を補助。'),
  w('drive-link','運転補助リンク',1300,1,{drive:1},'drive','運転＋1。追撃戦で数秒を買う。')
];

export const BOSSES = {
  act1:{name:'「電気屋」',hp:2,guards:['swarm','swarm'],description:'ハシバが手放した箱の鍵を買い取った、白蛇会の電脳屋。',mechanic:'毎ラウンドICE攻撃。ネットからインターフェース2成功で撃破。',counter:'知覚DV17で隠れ場所を暴く／白蛇会関係＋30なら説得で1,000crの取引。',loot:'deck2'},
  act2:{name:'回収屋の頭「カナメ」',hp:3,guards:['sniper','swarm','swarm'],description:'三社のどれにも雇われる回収屋。名簿に載った人間を回収してきた。',mechanic:'ソロ型の傭兵。2ラウンドで倒せなければ目標を持ち去る。',counter:'続く追撃戦で運転に成功すれば積み荷を取り返せる。',loot:'eye2'},
  mitsukane:{name:'「鋼の番犬」',hp:4,guards:['armored','commander'],description:'ナカガワの警備艇に乗る重装義体兵。手を組んだ相手が最後の敵になる。',mechanic:'テックや徹甲装備がなければ、1発で削る耐久は0.5。指揮官が攻撃を支える。',counter:'知覚でナカガワを暴き、先に落とす。テックか装甲貫通装備を連れていく。',loot:'heart3'},
  verde:{name:'「被検体」',hp:3,guards:['swarm','swarm','swarm'],description:'名簿に載っていた一人。治験管理官が戦闘薬で動かしている。',mechanic:'戦闘薬が毎ラウンド効くため攻撃＋2。検疫部隊が護衛する。',counter:'説得DV18で正気に戻せば撃たずに終わる。その選択は結末に残る。',loot:'onibi'},
  hakuro:{name:'「保守主任」',hp:3,guards:['sniper','sniper'],description:'回線を貸してくれた本人。箱の中身を消去するため、塔の頂上で待つ。',mechanic:'黒ICE三重壁。DV18・19・20、失敗するごとに防具無視の逆流2d6。',counter:'優秀なネットランナーとニューラル防壁。現場から電子DV20で回線を物理切断（3回まで）。',loot:'deck3'}
};

export const NEWS = [
  {id:'rain',title:'酸性雨注意報',text:'雨音が足音を隠す。街の監視も鈍っている。',dv:-1,heat:0,pay:0},
  {id:'inspection',title:'企業合同検問',text:'幹線道路を三社の検問が塞いでいる。',dv:1,heat:2,pay:0},
  {id:'bonus',title:'危険手当の高騰',text:'人手不足で仲介料より高い上乗せが付く。',dv:0,heat:0,pay:0.15},
  {id:'blackout',title:'輪番停電',text:'街区の照明が落ちた。目を凝らして進む夜。',dv:-1,heat:0,pay:0},
  {id:'drone',title:'新型監視ドローン',text:'空に新しいレンズが増えた。',dv:1,heat:1,pay:0},
  {id:'medicine',title:'鎮静剤の流通回復',text:'露店に医療物資が戻る。人々の表情が少し和らいだ。',dv:-1,heat:-2,pay:0},
  {id:'strike',title:'港湾労働者の封鎖',text:'ゲートは閉ざされたが、裏道を知る者は多い。',dv:0,heat:0,pay:0.1},
  {id:'gang',title:'白蛇会の抗争',text:'縄張りを示す白い札が、路地にいくつも貼られている。',dv:1,heat:0,pay:0.1},
  {id:'market',title:'古物の大量流入',text:'企業倉庫の放出品が路地に並ぶ。',dv:0,heat:-1,pay:0},
  {id:'leak',title:'機密流出の噂',text:'買い手と売り手が互いを探している。',dv:0,heat:2,pay:0.15},
  {id:'festival',title:'屋台街の祭り',text:'雑踏に溶け込むには良い夜。',dv:-1,heat:-2,pay:0},
  {id:'lockdown',title:'上層区画の閉鎖',text:'警備の認証コードが更新された。',dv:1,heat:2,pay:0.05},
  {id:'fog',title:'湾岸濃霧',text:'照準も監視カメラも白い闇に包まれる。',dv:0,heat:-1,pay:0},
  {id:'police',title:'鎮圧班の巡回',text:'市警の黒い輸送車が動いている。暴走を見逃すつもりはない。',dv:1,heat:1,pay:0},
  {id:'rescue',title:'ラザロ出動増',text:'救急サイレンだけが、企業境界を自由に越える。',dv:0,heat:0,pay:0.05},
  {id:'bounty',title:'匿名の懸賞',text:'危険な仕事に、名前のない依頼人が金を積んだ。',dv:1,heat:1,pay:0.2},
  {id:'quiet',title:'妙に静かな夜',text:'何も起こらない夜ほど、通信は切らない方がいい。',dv:0,heat:0,pay:0}
];

export const EVENTS = [
  {id:'snake-visit',name:'白蛇会の使者',description:'白い傘の男が、ひと晩だけ人を匿ってほしいと言う。「礼は忘れない」',choices:[{name:'匿う',description:'白蛇会関係＋15、600cr。',effects:{relation:15,cash:600}},{name:'情報を売る',description:'1,200cr。白蛇会関係−20、企業ヒート＋5。',effects:{cash:1200,relation:-20,heat:5}},{name:'関わらない',description:'全員の人間性＋2。',effects:{humanity:2}}]},
  {id:'old-radio',name:'死んだ周波数',description:'壊れたラジオから、ハシバを知る誰かの声が聞こえた。「箱は開けるな」',choices:[{name:'録音する',description:'情報券1枚。',effects:{intel:1}},{name:'声に応える',description:'物語の断片を拾う。企業ヒート＋5。',effects:{fragment:'radio',heat:5}},{name:'電源を落とす',description:'全員の人間性＋3。',effects:{humanity:3}}]},
  {id:'street-clinic',name:'路上の診療',description:'メドテックが足りない、と少年が駆け込んでくる。診療所にはまだ灯りがある。',choices:[{name:'手を貸す',description:'400cr、人間性＋5。',effects:{cash:400,humanity:5}},{name:'薬を買う',description:'600crを払い、全員HP＋15。',effects:{cash:-600,hp:15}},{name:'通り過ぎる',description:'今夜をやり過ごす。',effects:{}}]},
  {id:'unclaimed',name:'持ち主のいない財布',description:'駅のベンチ。濡れた身分証には、まだ幼い子の写真が貼られている。',choices:[{name:'届ける',description:'人間性＋5、白蛇会関係＋5。',effects:{humanity:5,relation:5}},{name:'中身だけ抜く',description:'1,000cr、人間性−3。',effects:{cash:1000,humanity:-3}},{name:'身元を調べる',description:'情報券1枚、物語の断片。',effects:{intel:1,fragment:'wallet'}}]},
  {id:'neon',name:'ネオンからの誘い',description:'「あんたの隊、少し安く使われすぎじゃない？」若いフィクサーが微笑む。',choices:[{name:'情報だけ交換',description:'情報券1枚、企業ヒート＋3。',effects:{intel:1,heat:3}},{name:'隊の手当を上乗せ',description:'600crで忠誠＋15。',effects:{cash:-600,loyalty:15}},{name:'誘いを断つ',description:'全員の忠誠＋3。',effects:{loyalty:3}}]},
  {id:'kurogane',name:'クロガネの縄張り',description:'湾岸の古参が、道路脇で煙草を消す。「通行料か、貸しか。好きな方で払え」',choices:[{name:'通行料を払う',description:'500crで次の仕事の情報券1枚。',effects:{cash:-500,intel:1}},{name:'古い借りを話す',description:'白蛇会関係＋5、忠誠＋3。',effects:{relation:5,loyalty:3}},{name:'別の道を探す',description:'全員HP−3、600crを拾う。',effects:{hp:-3,cash:600}}]},
  {id:'mirror',name:'鏡に映らない',description:'洗面台の鏡に、知らない誰かがいる。仲間は名前を呼び続けた。',choices:[{name:'朝まで話す',description:'全員の人間性＋8。',effects:{humanity:8}},{name:'仕事の準備をする',description:'情報券1枚、人間性＋2。',effects:{intel:1,humanity:2}}]},
  {id:'shelter',name:'屋根の下の約束',description:'避難してきた一家が、残った食事を分けてくれた。',choices:[{name:'護衛代を受け取らない',description:'人間性＋6、忠誠＋5。',effects:{humanity:6,loyalty:5}},{name:'次の仕事を聞く',description:'900crと情報券1枚。',effects:{cash:900,intel:1}}]}
];

export const STORY_RUNNERS = [
  {id:'yoru',name:'ヨル',role:'net',description:'削除された戸籍を探すネットランナー。誰かがまだ本名を覚えている。',quest:'名前のない戸籍',reward:'夜渡り：インターフェース＋2。',effects:{interface:2}},
  {id:'aki',name:'アキ',role:'medic',description:'治験棟で働いていた医師。救えなかった患者の名簿を持つ。',quest:'閉じられた病室',reward:'命綱：医療＋2、死亡セーブ＋1。',effects:{medical:2,death:1}},
  {id:'ren',name:'レン',role:'solo',description:'企業戦争の帰還兵。武器より重い形見を抱えている。',quest:'最後の認識票',reward:'帰還者：射撃＋1、回避＋1。',effects:{shoot:1,evade:1}},
  {id:'nagi',name:'ナギ',role:'driver',description:'湾岸を走る元密輸人。二度と運ばないと決めた積み荷がある。',quest:'海に沈めた荷札',reward:'潮目読み：運転＋2、知覚＋1。',effects:{drive:2,perception:1}},
  {id:'towa',name:'トワ',role:'tech',description:'ミツカネの義体設計者。自分が作った兵器を壊すために来た。',quest:'設計者の責任',reward:'解体屋：電子＋2、BODY＋1。',effects:{electronics:2,BODY:1}}
];

export const UNLOCKS = [
  {id:'corp',name:'前歴：企業の元社員',cost:20,description:'最初から組む社を決める、新しい立ち回り。'},
  {id:'cyber',name:'義体の追加系統',cost:25,description:'痛覚遮断・ニューラル防壁・医療指・記憶補助などが候補に加わる。'},
  {id:'snake',name:'前歴：白蛇会の身内',cost:35,description:'白蛇会との関係＋30、ソロ2人で始める。'},
  ...STORY_RUNNERS.map(x=>({id:x.id,name:`物語つきランナー：${x.name}`,cost:40,description:`${x.description} 路地裏に現れるようになる。`})),
  {id:'jobs',name:'上層区画の追加依頼',cost:50,description:'消える街区・最後の証言者・無音の放送を追加。'},
  {id:'mix',name:'前歴：寄せ集め',cost:60,description:'好きな3ロールを選び、少ない資金で切り抜ける。'}
];
