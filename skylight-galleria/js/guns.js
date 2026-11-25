// Guns for Zombie Mode, in the spirit of a looter shooter: every gun is rolled from a type, a maker, a rarity,
// an element and a few abilities, and is built from parts (finished with Poly Haven metal, see shaders.js pats 40-45).
// makeGun(rand, {type, rarity, minRarity}) returns a gun; GUN_TYPES, GUN_MAKERS, RARITIES and ABILITIES describe the pool.
const GUN_TYPES={
 pistol:  {name:'Pistol',dmg:26,rate:4,pellets:1,spread:.015,range:70,len:1},
 smg:     {name:'SMG',dmg:11,rate:12,pellets:1,spread:.045,range:55,len:1.1,mag:1},
 rifle:   {name:'Assault Rifle',dmg:17,rate:8,pellets:1,spread:.025,range:85,len:1.45,mag:1,stock:1},
 shotgun: {name:'Shotgun',dmg:11,rate:1.3,pellets:9,spread:.09,range:28,len:1.35,stock:1,double:1},
 sniper:  {name:'Sniper Rifle',dmg:150,rate:1,pellets:1,spread:0,range:160,pierce:2,crit:1.5,len:1.75,stock:1,scope:1},
 launcher:{name:'Launcher',dmg:110,rate:.8,pellets:1,spread:.005,range:90,blast:4,len:1.4,tube:1},
 flamer:  {name:'Flamethrower',dmg:5,rate:20,beam:'flame',range:10,elem:'fire',len:1.4,tank:1},
 frost:   {name:'Frost Ray',dmg:3.2,rate:20,beam:'frost',range:35,elem:'frost',len:1.2,tank:1},
 tesla:   {name:'Tesla Coil',dmg:36,rate:2.5,pellets:1,spread:.01,range:45,chain:3,elem:'shock',len:1.1,coil:1},
 acid:    {name:'Acid Sprayer',dmg:9,rate:7,pellets:2,spread:.05,range:30,elem:'acid',len:1.2,tank:1},
 // a wide glowing crescent that sweeps out and cleaves through everything in a 75° arc, slicing limbs off
 plasma:  {name:'Plasma Cleaver',dmg:45,rate:1.6,pellets:1,spread:0,range:9,arc:75,len:1.25,emitter:1}};
// makers (all invented): each has its own metal finish, colour and habit
const GUN_MAKERS=[
 {id:'hammerjack',name:'Hammerjack',skin:44,tint:[.85,.45,.3],trait:'Hits hard, fires slow',mod:{dmg:1.35,rate:.75}},
 {id:'vexley',name:'Vexley',skin:42,tint:[.45,.7,1],trait:'Always elemental',mod:{elemental:1,dmg:.95}},
 {id:'torrin',name:'Torrin',skin:43,tint:[.6,.75,.45],trait:'Fast and loose',mod:{rate:1.35,spread:1.3}},
 {id:'kessler',name:'Kessler',skin:41,tint:[.55,.57,.62],trait:'Precise; deadly headshots',mod:{spread:.55,crit:1.6}},
 {id:'brightwork',name:'Brightwork',skin:45,tint:[1,.65,.3],trait:'Explosive rounds',mod:{ability:'explode'}},
 {id:'scrapline',name:'Scrapline',skin:40,tint:[.8,.8,.75],trait:'Unpredictable extras',mod:{extra:1}}];
const RARITIES=[
 {id:'common',name:'Common',col:[.85,.85,.85],css:'#e0e0e0',mul:1,abil:0,w:48},
 {id:'uncommon',name:'Uncommon',col:[.3,1,.35],css:'#58f06a',mul:1.15,abil:0,w:28},
 {id:'rare',name:'Rare',col:[.3,.6,1],css:'#4ea0ff',mul:1.3,abil:1,w:15},
 {id:'epic',name:'Epic',col:[.75,.35,1],css:'#c066ff',mul:1.5,abil:2,elem:1,w:7},
 {id:'legendary',name:'Legendary',col:[1,.55,.1],css:'#ff9a1f',mul:1.85,abil:3,elem:1,w:2}];
const ELEMENTS={fire:{name:'Fire',col:[1,.45,.1],css:'#ff8a3a',word:'Scorching'},frost:{name:'Frost',col:[.6,.9,1],css:'#9fe6ff',word:'Frozen'},
 shock:{name:'Shock',col:[.5,.7,1],css:'#7fb0ff',word:'Shocking'},acid:{name:'Acid',col:[.5,1,.25],css:'#8cff5a',word:'Corrosive'}};
const ABILITIES={ricochet:{name:'Ricochet',tip:'Bullets bounce to another zombie',word:'Bouncing'},pierce:{name:'Pierce',tip:'Shots pass through 2 more zombies',word:'Piercing'},
 explode:{name:'Explosive',tip:'Hits explode',word:'Volatile'},
 split:{name:'Split',tip:'Every shot splits in three',word:'Splitting'},crit:{name:'Deadeye',tip:'Headshots do far more damage',word:'Deadeye'},
 rapid:{name:'Rapid',tip:'Fires much faster',word:'Hasty'},heavy:{name:'Heavy',tip:'Much more damage per shot',word:'Heavy'},
 homing:{name:'Homing',tip:'Bullets lock on to the nearest zombie near your aim',word:'Seeking'},
 chainreact:{name:'Chain Reaction',tip:'Zombies you kill explode, and the blasts can set off more',word:'Cascading'},
 turncoat:{name:'Turncoat',tip:'Some zombies you kill get back up and fight for you for 12 s',word:"Traitor's"},
 vortex:{name:'Vortex',tip:'Hits pull nearby zombies into a tight clump',word:'Gravity'},
 shatter:{name:'Shatter',tip:'Hits chill; frozen zombies burst into ice shards that hit others',word:'Shattering'},
 boomerang:{name:'Boomerang',tip:'Fires a spinning disc that flies out and comes back, hitting both ways',word:'Returning'},
 bounce:{name:'Wall Bounce',tip:'Bullets ricochet off walls, up to twice',word:'Rebounding'},
 overcharge:{name:'Overcharge',tip:'Every 10th shot is a huge charged blast',word:'Overcharged'},
 knockback:{name:'Knockback',tip:'Hits shove zombies back and stagger them',word:'Thumping'},
 dismember:{name:'Dismember',tip:'Limbs come off much more easily',word:"Butcher's"},
 ghost:{name:'Ghost Rounds',tip:'Bullets pass through walls',word:'Phantom'},
 twin:{name:'Twin Fire',tip:'A second gun in your other hand fires with you',word:'Twin'}};
// which abilities make sense on which guns: beams and the cleaver can't use the per-bullet ones
const NOT_ON_BEAM=['split','ricochet','pierce','explode','homing','boomerang','bounce','overcharge','twin','knockback','vortex'];
const NOT_ON_ARC=['split','ricochet','pierce','homing','boomerang','bounce'];
const fitsGun=(g,a)=>!(g.beam&&NOT_ON_BEAM.includes(a))&&!(g.shape&&g.shape.arc&&NOT_ON_ARC.includes(a));
const LEGEND_NAMES=['Clearance Sale','The Mall Cop','Food Court Fury','Black Friday','Last Call','Lost & Found','Store Credit','Escalator','Final Markdown','Closing Time','Gift Wrap','Price Check'];
// stats = the gun's base roll with its abilities applied (used again when guns are forged together)
function applyAbilities(g){Object.assign(g,g.base);const M={homing:.85,chainreact:.9,turncoat:.9,vortex:.85,shatter:.9,bounce:.9,ghost:.85};
 for(const a of g.abil){if(a==='pierce')g.pierce+=2;if(a==='split')g.pellets*=3,g.spread=Math.max(g.spread,.03)*1.3;if(a==='crit')g.crit*=1.8;if(a==='rapid')g.rate*=1.5;if(a==='heavy')g.dmg*=1.5,g.rate*=.85;
  if(M[a])g.dmg*=M[a];if(a==='boomerang')g.rate*=.75;if(a==='knockback')g.rate*=.9;if(a==='twin')g.rate*=.9}}
function makeGun(rand,o={}){
 const pick=a=>a[Math.floor(rand()*a.length)];
 const types=Object.keys(GUN_TYPES),type=o.type||pick(types),T=GUN_TYPES[type],M=o.maker?GUN_MAKERS.find(m=>m.id===o.maker):pick(GUN_MAKERS);
 let ri=o.rarity!==undefined?o.rarity:(()=>{const lo=o.minRarity||0,ws=RARITIES.map((r,i)=>i<lo?0:r.w),sum=ws.reduce((a,b)=>a+b,0);let x=rand()*sum;for(let i=0;i<ws.length;i++){x-=ws[i];if(x<0)return i}return ws.length-1})();
 const Rr=RARITIES[ri],g={type,maker:M.id,makerName:M.name,trait:M.trait,rarity:ri,rar:Rr,skin:M.skin,tint:M.tint,beam:T.beam,len:T.len,shape:T,
  dmg:T.dmg*Rr.mul*(M.mod.dmg||1)*(.9+rand()*.2),rate:T.rate*(M.mod.rate||1)*(T.beam?1:.92+rand()*.16),pellets:T.pellets||1,spread:(T.spread||0)*(M.mod.spread||1),
  range:T.range,pierce:T.pierce||0,chain:T.chain||0,blast:T.blast||0,crit:(T.crit||1)*(M.mod.crit||1),elem:T.elem||null,abil:[]};
 // element: guaranteed for Vexley, epic and legendary guns; a chance otherwise
 if(!g.elem&&!g.beam&&(M.mod.elemental||Rr.elem||rand()<.15))g.elem=pick(Object.keys(ELEMENTS));
 let n=Rr.abil+(M.mod.extra?1:0)+(ri===1&&rand()<.3?1:0);const pool=Object.keys(ABILITIES).filter(a=>fitsGun(g,a));
 if(M.mod.ability&&fitsGun(g,M.mod.ability))g.abil.push(M.mod.ability);
 while(n-->0){const a=pick(pool);if(!g.abil.includes(a))g.abil.push(a)}
 g.base={dmg:g.dmg,rate:g.rate,pellets:g.pellets,spread:g.spread,pierce:g.pierce,crit:g.crit};applyAbilities(g);
 g.col=Rr.col;g.ecol=g.elem?ELEMENTS[g.elem].col:T.arc?[1,.4,1]:Rr.col;
 const word=g.abil.length?ABILITIES[g.abil[0]].word:g.elem?ELEMENTS[g.elem].word:'';
 g.name=ri===4?`“${pick(LEGEND_NAMES)}”`:`${word?word+' ':''}${M.name} ${T.name}`;
 g.id=Math.floor(rand()*1e9).toString(36);g.parts=gunParts(g,rand);return g}
// the 3D build: [forward, up, right, width, height, length, material] in metres; materials:
// b = body (the maker's metal), d = dark metal, g = rarity glow, e = element glow
function gunParts(g,rand){const L=g.len,S=g.shape,P=[],add=(f,u,r,w,h,l,m)=>P.push([f,u,r,w,h,l,m]);
 const thick=g.maker==='hammerjack'?1.25:g.maker==='vexley'?.85:1;
 add(0,0,0,.05*thick,.065*thick,.18*L,'b');                                 // receiver
 add(.02,.035*thick,0,.052*thick,.01,.16*L,'g');                            // rarity stripe along the top
 if(S.tube){add(.12,.01,0,.085,.085,.42,'b');add(.34,.01,0,.095,.095,.04,'d')}
 else if(S.double){add(.12*L+.05,.01,-.013,.022,.022,.24*L,'d');add(.12*L+.05,.01,.013,.022,.022,.24*L,'d')}
 else add(.1*L+.06,.012,0,.024,.024,(.16+.1*(L-1))*L+(g.maker==='kessler'?.08:0),'d');
 add(-.06,-.075,0,.035,.09,.04,'d');                                        // grip
 if(S.mag)add(.04,-.075,0,.03,.08,.04,'d');
 if(S.stock)add(-.16*L,-.012,0,.04,.055,.12,'b');
 if(S.scope||g.maker==='kessler'){add(.01,.06,0,.024,.024,.13,'d');add(.08,.06,0,.026,.026,.01,'e')}
 if(S.tank){add(-.02,-.055,.045,.05,.05,.11,'e');add(.08,-.02,0,.03,.03,.05,'d')}
 if(S.coil)for(let k=0;k<4;k++)add(.14+k*.04,.012,0,.05,.05,.012,'e');
 if(S.emitter){add(.17,.01,0,.16,.02,.05,'e');for(const s of[-1,1])add(.12,.01,s*.07,.012,.05,.12,'e');add(.07,.01,0,.06,.06,.08,'b')}
 if(g.maker==='hammerjack')add(.1*L+.16,.012,0,.04,.04,.04,'d');            // muzzle brake
 if(g.maker==='vexley')for(const s of[-1,1])add(.02,0,s*.035,.006,.04,.12,'e'); // fins
 if(g.maker==='torrin')add(.05,.045,0,.02,.012,.14*L,'d');                  // rail
 if(g.maker==='brightwork')add(0,0,.027,.004,.03,.14,'g');                  // hazard stripe
 if(g.maker==='scrapline')for(let k=0;k<2;k++)add(rand()*.1-.05,.03+rand()*.02,(rand()-.5)*.05,.02,.02,.04,'d');
 if(g.elem&&!S.tank&&!S.coil)add(.08,-.035,0,.03,.015,.06,'e');              // element core
 return P}
