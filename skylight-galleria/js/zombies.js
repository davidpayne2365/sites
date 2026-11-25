// Zombie mode (index.html?mode=zombies): night has fallen and everyone in the mall has turned. Clear every zone.
// It plays like a looter shooter: guns (js/guns.js) drop from zombies with a rarity, a maker, an element and
// abilities; damage numbers pop off every hit; damaged zombies show a health bar; clearing a zone earns a rare-or-better
// gun and a full heal; rare health potions are hidden around each zone.
// The engine calls makeZombieMode(api) once and zm.update(dt) every frame while you play. People are the engine's
// crowd (region.P): a person with p.zs is moved here (p.x, p.y, p.z, p.yaw, p.pose, p.zsp speed, p.zc colours, p.limb).
// zm.fxB holds the glowing and metal parts this mode draws: your gun, beams, flames, numbers' targets, drops, potions.
function makeZombieMode(api){
 const{P,keys}=api,R=rng(1313),QSZ=new URLSearchParams(location.search);
 const GUN_DROP=.06,POTION_DROP=.03,HIDDEN_POTIONS=0,POTION_HEAL=50,SLOTS=6;
 const TURN=[10,16];                               // seconds before someone pulled down gets up as a zombie
 // zombies never start within 30 m of you (?zclose, for testing, lets them start right in front)
 const MINDIST=QSZ.has('zclose')?3:30;
 let shots=0,hitsN=0,cool=0,firing=false,health=100,hurtT=0,deadT=0,recoil=0,swapT=0,prevE=false,beamSnd=0;
 const inv=[makeGun(R,{type:'pistol',rarity:0,maker:'hammerjack'})];let ci=0;const gun=()=>inv[ci];
 const seeded=new Map(),cleared=new Set(),drops=[],potions=[],fx=[];
 const ZONES=['lot','hub',...(typeof ROUTE!=='undefined'?ROUTE:[]),'exit'];
 const fxB=api.gbuf();let fData=new Float32Array(16*1600),nF=0;

 // ---- HUD
 const css='position:fixed;z-index:5;pointer-events:none;font:600 14px/1.3 system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000';
 const el=(style,html='')=>{const d=document.createElement('div');d.className='zhud';d.style.cssText=css+';'+style;d.innerHTML=html;document.body.appendChild(d);return d};
 const hud={cross:el('left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border:2px solid rgba(255,255,255,.85);border-radius:50%'),
  hp:el('left:16px;bottom:18px;width:220px;height:16px;background:rgba(0,0,0,.5);border-radius:8px;overflow:hidden','<div style="height:100%;width:100%;background:linear-gradient(#ff6a5a,#c81e1e);transition:width .2s"></div>'),
  hpn:el('left:22px;bottom:19px;font-size:12px'),
  gun:el('right:16px;bottom:16px;text-align:right;max-width:46vw'),zone:el('left:50%;top:12px;transform:translateX(-50%);text-align:center'),
  card:el('left:50%;bottom:90px;transform:translateX(-50%);min-width:240px;max-width:86vw;padding:10px 14px;border-radius:10px;background:rgba(10,10,16,.82);display:none;text-align:left;pointer-events:auto'),
  banner:el('left:50%;top:30%;transform:translateX(-50%);text-align:center;font-size:30px;font-weight:800;opacity:0;transition:opacity .4s;width:90vw'),
  red:el('left:0;top:0;right:0;bottom:0;background:radial-gradient(transparent 45%,rgba(200,0,0,.55));opacity:0;transition:opacity .15s'),
  nums:el('left:0;top:0;width:100%;height:100%;overflow:hidden')};
 let bannerT=0;const banner=(t,sub='',s=2.6)=>{hud.banner.innerHTML=t+(sub?`<div style="font-size:16px;font-weight:600;margin-top:6px">${sub}</div>`:'');hud.banner.style.opacity=1;bannerT=s};
 const showHud=v=>{for(const k in hud)if(!['banner','red','card','nums'].includes(k))hud[k].style.display=v?'':'none'};
 // touch: fire, swap, jump, and take (shown on a weapon card)
 if(api.touchMode){const bs='position:fixed;z-index:6;border-radius:50%;border:2px solid rgba(255,255,255,.7);background:rgba(0,0,0,.35);color:#fff;font:700 13px system-ui;touch-action:none';
  const btn=(label,style,down,upf)=>{const b=document.createElement('button');b.className='zhud';b.textContent=label;b.style.cssText=bs+';'+style;b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();down()});
   b.addEventListener('pointerup',e=>{e.preventDefault();e.stopPropagation();upf&&upf()});b.addEventListener('pointercancel',()=>upf&&upf());document.body.appendChild(b);return b};
  const SIDE=api.lefty?'left':'right',UP=api.lefty?44:0,at=(cx,cy,w)=>`${SIDE}:${cx-w/2}px;bottom:${cy-w/2+UP}px;width:${w}px;height:${w}px`;
  btn('JUMP',at(64,70,88),()=>{keys.add('Space');setTimeout(()=>keys.delete('Space'),150)});
  btn('FIRE',at(172,64,64),()=>firing=true,()=>firing=false);btn('SWAP',at(160,128,52),()=>swap(1));
  btn('ZOOM',at(118,170,52),()=>{aimM=true},()=>{aimM=false});btn('LIGHT',at(60,182,52),()=>toggleTorch())}
 hud.card.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(near)take(near)});

 // ---- damage numbers: they pop off where you hit and drift up
 const nums=[];
 function popNum(x,y,z,v,col,big){if(v<.5)return;if(nums.length>60){const o=nums.shift();o.d.remove()}const d=document.createElement('div');
  d.style.cssText=`position:absolute;left:0;top:0;font:900 ${big?24:16}px system-ui,sans-serif;color:${col};text-shadow:0 2px 3px #000,0 0 6px rgba(0,0,0,.6);transform:translate(-50%,-50%);white-space:nowrap`;
  d.textContent=Math.round(v)+(big?'!':'');hud.nums.appendChild(d);nums.push({d,x,y,z,t:0,dx:(R()-.5)*40})}
 function stepNums(dt){for(let i=nums.length-1;i>=0;i--){const n=nums[i];n.t+=dt;const s=api.project(n.x,n.y+n.t*.9,n.z);
   if(!s||n.t>.9){n.d.remove();nums.splice(i,1);continue}n.d.style.left=(s[0]+n.dx*n.t)+'px';n.d.style.top=s[1]+'px';n.d.style.opacity=1-Math.max(0,n.t-.5)/.4}}

 // ---- people and their states. p.zs.st: zombie, eat (feeding on someone), down (pulled down, turning), dead (shot),
 // gone (removed), flee (running from a zombie), cower (stopped, frightened)
 const isZ=p=>p.zs&&(p.zs.st==='zombie'||p.zs.st==='eat');
 const isHuman=p=>!p.fur&&(!p.zs||p.zs.st==='flee'||p.zs.st==='cower');
 const blood=c=>[c[0]*.55+.2,c[1]*.35,c[2]*.35];
 // limbs: left arm, right arm, left leg, right leg (bit 1, 2, 4, 8 of p.limb once blown off); a zombie without a leg crawls
 function turn(p){const z=p.zs||(p.zs={});Object.assign(z,{st:'zombie',hp:100,spd:1+R()*.45,tgt:null,think:R()*.6,atk:0,flash:0,burn:0,acid:0,slow:0,gy:0,t:0,wx:p.x,wz:p.z,lhp:[40,40,50,50],crawl:false,k:Math.floor(R()*4),acc:0,dot:0,dotT:0});
  p.limb=0;p.zc=blood(p.c);p.pose=3}
 // everyone in the zone is a zombie (the full crowd); anyone within 30 m of you starts somewhere further away.
 // Each zone also hides a few rare health potions in quiet corners.
 function seedZone(r){const th=r.theme;if(seeded.get(th)===r)return;seeded.set(th,r);
  if(cleared.has(th)){for(const p of r.P)if(!p.fur)p.zs={st:'gone'};return}
  const rr=rng(seedOfZ(th)),nodes=r.N||[],far=nodes.filter(n=>Math.hypot(n.x-P.x,n.z-P.z)>MINDIST);
  const testLimbs=QSZ.has('zcrawl');let n=0;   // ?zcrawl: some start without a leg or an arm (for testing)
  for(const p of r.P){if(p.fur)continue;turn(p);if(testLimbs){n++;if(n%3===0){p.limb|=4;p.zs.crawl=true;p.zs.spd=.4;p.pose=8}else if(n%3===1)p.limb|=2}
   if(Math.hypot(p.x-P.x,p.z-P.z)<MINDIST&&far.length){const q=far[Math.floor(rr()*far.length)];p.x=q.x+rr()-.5;p.y=q.y;p.z=q.z+rr()-.5}}
  const d0=r.doors[0],quiet=nodes.filter(q=>Math.hypot(q.x-d0.x,q.z-d0.z)>25);
  for(let k=0;k<HIDDEN_POTIONS&&quiet.length;k++){const q=quiet[Math.floor(rr()*quiet.length)];potions.push({x:q.x+rr()-.5,y:q.y,z:q.z+rr()-.5,r})}}
 function seedOfZ(t){let h=2166136261;for(const c of t)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0)+11}

 // ---- quick look-ups: who is near whom (rebuilt a few times a second)
 const CELL=6;let gridH=new Map(),gridZ=new Map(),gridF=new Map(),gridT=0;
 const key=(x,y,z)=>Math.floor(x/CELL)*73856093^Math.floor(z/CELL)*19349663^Math.floor(y/3)*83492791;
 function rebuild(){gridH=new Map();gridZ=new Map();gridF=new Map();const add=(g,p)=>{const k=key(p.x,p.y,p.z);let a=g.get(k);if(!a)g.set(k,a=[]);a.push(p)};
  for(const r of api.LOADED)for(const p of r.P){if(isZ(p))add(gridZ,p);else if(isHuman(p)){add(gridH,p);if(p.zs&&p.zs.st==='flee'&&p.zs.seen)add(gridF,p)}}}
 function nearest(g,x,y,z,max,skip){let best=null,bd=max;const cx=Math.floor(x/CELL),cz=Math.floor(z/CELL),cy=Math.floor(y/3),n=Math.ceil(max/CELL);
  for(let i=-n;i<=n;i++)for(let j=-n;j<=n;j++)for(const dy of[0,-1,1]){const a=g.get((cx+i)*73856093^(cz+j)*19349663^(cy+dy)*83492791);if(!a)continue;
   for(const p of a){if(skip&&skip.has(p))continue;const d=Math.hypot(p.x-x,p.z-z);if(d<bd&&Math.abs(p.y-y)<2.5){bd=d;best=p}}}return best}
 const nearZ=(x,y,z,max,skip)=>nearest(gridZ,x,y,z,max,skip);

 // ---- weapons
 function swap(dir){ci=(ci+dir+inv.length)%inv.length;swapT=.25;cool=Math.max(cool,.2)}
 function select(n){if(inv[n]){ci=n;swapT=.25}}
 function eye(){return[P.x,P.ey??P.y,P.z]}
 // touch aim assist: the gun swings onto the chest of the nearest zombie in front of you (the camera stays yours),
 // and Auto fire shoots whenever it has one locked
 let AY=null,AP=null,aTgt=null,aT=0,autoF=!!api.touchMode;
 const chest=p=>p.y+(p.zs.crawl?.3:1.2*p.s[1]);
 const wrapA=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a};
 function assist(dt){if(!api.touchMode){AY=AP=null;aTgt=null;return}const o=eye(),rng=Math.min(gun().range,32);
  const ok=p=>{if(!p||!isZ(p))return false;const dx=p.x-o[0],dz=p.z-o[2],d=Math.hypot(dx,dz);if(d>rng)return false;
   if(Math.abs(wrapA(Math.atan2(-dx,-dz)-P.yaw))>.8)return false;const v=[dx,chest(p)-o[1],dz],l=Math.hypot(...v);return wallDist(o,v.map(x=>x/l),l)>=l-.4};
  aT-=dt;if(aT<=0||!ok(aTgt)){aT=.15;let best=null,bd=1e9;for(const p of zombiesNear(o,rng)){const d=Math.hypot(p.x-o[0],p.z-o[2]);if(d<bd&&ok(p)){bd=d;best=p}}
   if(best&&(!ok(aTgt)||bd<Math.hypot(aTgt.x-o[0],aTgt.z-o[2])-2))aTgt=best;else if(!ok(aTgt))aTgt=null}
  let ty=P.yaw,tp=P.pitch;if(aTgt){const dx=aTgt.x-o[0],dy=chest(aTgt)-o[1],dz=aTgt.z-o[2];ty=Math.atan2(-dx,-dz);tp=Math.atan2(dy,Math.hypot(dx,dz))}
  const k=Math.min(1,dt*16);if(AY==null){AY=P.yaw;AP=P.pitch}AY=P.yaw+wrapA(AY-P.yaw);AY+=wrapA(ty-AY)*k;AP+=(tp-AP)*k;
  if(!aTgt&&Math.abs(wrapA(AY-P.yaw))<.01&&Math.abs(AP-P.pitch)<.01)AY=AP=null}
 function dirs(cam){const yw=cam||AY==null?P.yaw:AY,pt=cam||AP==null?P.pitch:AP,cy=Math.cos(yw),sy=Math.sin(yw),cp=Math.cos(pt),sp=Math.sin(pt);return{f:[-sy*cp,sp,-cy*cp],r:[cy,0,-sy],u:[sy*sp,cp,cy*sp]}}
 function wallDist(o,d,max){for(let t=.3;t<max;t+=.25){if(api.solid(o[0]+d[0]*t,o[1]+d[1]*t,o[2]+d[2]*t))return t}return max}
 function raySphere(o,d,c,rad){const ox=o[0]-c[0],oy=o[1]-c[1],oz=o[2]-c[2],b=ox*d[0]+oy*d[1]+oz*d[2],cc=ox*ox+oy*oy+oz*oz-rad*rad,h=b*b-cc;if(h<0)return-1;const t=-b-Math.sqrt(h);return t>0?t:-1}
 function zombiesNear(o,range){const a=[];for(const r of api.LOADED)for(const p of r.P)if(isZ(p)&&Math.hypot(p.x-o[0],p.z-o[2])<range+2)a.push(p);return a}
 const rxv=(v,a,py)=>{const c=Math.cos(a),s=Math.sin(a),y=v[1]-py;return[v[0],y*c-v[2]*s+py,y*s+v[2]*c]};
 function bodyParts(p){const crawl=p.zs.crawl,lm=p.limb||0,out=[];
  const arm=(x,ang)=>{const c=Math.cos(ang),s=Math.sin(ang);return[[x,1.47-.31*c,-.31*s],[x,1.47-.6*c,-.6*s]]};
  const ang=crawl?-2.9:-1.3,L=[['head',[0,1.66,.02],.14],['torso',[0,1.2,0],.21],['torso',[0,.93,0],.19]];
  if(!(lm&1))for(const c of arm(-.235,ang))L.push(['la',c,.1]);if(!(lm&2))for(const c of arm(.235,ang))L.push(['ra',c,.1]);
  if(!(lm&4))L.push(['ll',[-.095,.62,0],.11],['ll',[-.095,.25,0],.1]);if(!(lm&8))L.push(['rl',[.095,.62,0],.11],['rl',[.095,.25,0],.1]);
  const cy=Math.cos(p.yaw),sy=Math.sin(p.yaw),[sx,sh,sz]=p.s;
  for(const[part,c0,r]of L){let c=crawl?(v=>{const q=rxv(v,1.5708,0);return[q[0],q[1]+.16,q[2]]})(c0):rxv(c0,.22,.9);
   c=[c[0]*sx,c[1]*sh,c[2]*sz];out.push({part,c:[p.x+cy*c[0]+sy*c[2],p.y+c[1],p.z-sy*c[0]+cy*c[2]],r:r*sh})}
  return out}
 // which zombies a ray hits, nearest first, before it reaches a wall (Ghost Rounds ignore walls)
 function trace(o,d,range,zs,ghost){const wd=ghost?range:wallDist(o,d,range),hits=[];
  for(const p of zs){const vx=p.x-o[0],vy=p.y+1-o[1],vz=p.z-o[2],along=vx*d[0]+vy*d[1]+vz*d[2];if(along<0||along>wd+1)continue;
   if(Math.hypot(vx-d[0]*along,vy-d[1]*along,vz-d[2]*along)>1.4)continue;let best=null;
   for(const b of bodyParts(p)){const t=raySphere(o,d,b.c,b.r);if(t>0&&t<wd&&(!best||t<best.t))best={p,t,part:b.part}}if(best)hits.push(best)}
  hits.sort((a,b)=>a.t-b.t);return{hits,wd}}
 // damage by where you hit: the head takes 4x (more with Deadeye and precise makers), the body 1x, arms and legs 0.7x
 // and are blown off after enough; elements add burning, acid, slowing or extra lightning; abilities add the rest
 let buzzT=0;const buzz=ms=>{if(!api.touchMode||!navigator.vibrate)return;const n=performance.now();if(n-buzzT<70)return;buzzT=n;try{navigator.vibrate(ms)}catch{}};
 const LIMB={la:0,ra:1,ll:2,rl:3},HIT={torso:1,la:.7,ra:.7,ll:.7,rl:.7};
 const has=(g,a)=>g.abil&&g.abil.includes(a);
 function hurt(p,dmg,g,part='torso',at,quiet){const z=p.zs;if(!isZ(p))return 0;const head=part==='head',mult=head?4*g.crit:HIT[part],v=dmg*mult;
  z.hp-=v;z.flash=.12;if(g.elem==='fire')z.burn=4;if(g.elem==='acid')z.acid=3;if(g.elem==='frost')z.slow=4;if(has(g,'shatter'))z.slow=Math.max(z.slow,2.5);
  // limbs: Dismember and the cleaver take them off far more easily
  const lm=(has(g,'dismember')?4:1)*(g.cleave||1);
  if(part in LIMB&&z.hp>0){const i=LIMB[part];z.lhp[i]-=dmg*lm;if(z.lhp[i]<=0&&!(p.limb&(1<<i)))sever(p,i)}
  else if(part==='torso'&&has(g,'dismember')&&!quiet&&z.hp>0&&R()<.2){const i=Math.floor(R()*4);if(!(p.limb&(1<<i)))sever(p,i)}
  if(has(g,'knockback')&&!quiet&&z.hp>0){const dx=p.x-P.x,dz=p.z-P.z,l=Math.hypot(dx,dz)||1,f=g.type==='shotgun'||g.shape?.arc?7:5;z.kb={vx:dx/l*f,vz:dz/l*f,t:.25};z.stag=.6}
  if(has(g,'vortex')&&!quiet&&at)vortexAt(at);
  const pos=at||[p.x,p.y+1.6*p.s[1],p.z],col=head?'#ffd23a':g.elem?ELEMENTS[g.elem].css:'#ffffff';
  if(quiet){z.dot+=v;z.dcol=col}else{popNum(pos[0],pos[1],pos[2],v,col,head);if(head&&g!==ALLY)buzz(14)}
  if(z.hp<=0)kill(p,g);return v}
 function sever(p,i){p.limb|=1<<i;buzz(28);const z=p.zs,cy=Math.cos(p.yaw),sy=Math.sin(p.yaw),side=i%2?1:-1,arm=i<2;
  const lx=side*(arm?.3:.1),ly=arm?1.35:.5,x=p.x+cy*lx,zz=p.z-sy*lx,y=p.y+ly;
  fx.push({k:'gib',a:[x,y,zz],v:[cy*side*2+(R()-.5)*2,2.5+R()*1.5,-sy*side*2+(R()-.5)*2],ground:p.y,size:arm?[.09,.55,.09]:[.13,.8,.13],col:arm?[.16,.22,.11]:p.zc.map(v=>v*.8),yaw:R()*6,pitch:R()*6,spin:6+R()*6,life:6,t:0});
  for(let k=0;k<10;k++)fx.push({k:'gib',a:[x,y,zz],v:[(R()-.5)*3,1+R()*2.5,(R()-.5)*3],ground:p.y,size:[.04,.04,.04],col:[.45,.02,.02],yaw:0,pitch:0,spin:0,life:1.2+R(),t:0});
  if(!arm&&!z.crawl){z.crawl=true;z.spd=.35+R()*.15}}
 // a kill can turn the zombie (Turncoat), shatter it (Shatter, when frozen) or set off a blast (Chain Reaction)
 const chainQ=[],projs=[],ALLY={crit:1,elem:null,abil:[],dmg:18};
 function kill(p,g){const z=p.zs;if(z.st==='dead'||z.st==='ally')return;
  if(g&&has(g,'turncoat')&&R()<.35&&allyCount()<8){z.st='ally';z.t=12;z.hp=100;z.burn=z.acid=z.slow=0;p.zc=[.2,1,.45];popNum(p.x,p.y+2,p.z,0,'#5f5',false);fx.push({k:'vortex',a:[p.x,p.y+1,p.z],col:[.3,1,.5],life:.6,t:0});return}
  z.st='dead';z.t=0;p.pose=4;p.zsp=0;groan(p,true);
  if(g&&has(g,'shatter')&&z.slow>0)shards(p,g);
  if(g&&has(g,'chainreact')&&chainQ.length<40)chainQ.push({at:[p.x,p.y+1,p.z],g,t:.15});
  if(drops.length<40&&R()<GUN_DROP)drops.push({g:makeGun(R),x:p.x,y:p.y,z:p.z,t:0});
  else if(R()<POTION_DROP)potions.push({x:p.x,y:p.y,z:p.z,r:null})}
 const allyCount=()=>{let n=0;for(const r of api.LOADED)for(const p of r.P)if(p.zs&&p.zs.st==='ally')n++;return n};
 function shards(p,g){const gs={...g,abil:g.abil.filter(a=>a!=='shatter'&&a!=='chainreact'),elem:'frost',cleave:1};
  for(let k=0;k<12;k++)fx.push({k:'gib',a:[p.x,p.y+1.1,p.z],v:[(R()-.5)*8,1+R()*3,(R()-.5)*8],ground:p.y,size:[.07,.07,.07],col:[.7,.95,1],yaw:R()*6,pitch:R()*6,spin:10,life:1.2,t:0});
  for(const q of zombiesNear([p.x,0,p.z],3.5))if(q!==p&&Math.hypot(q.x-p.x,q.z-p.z)<3.5)hurt(q,g.dmg*.4+10,gs,'torso',[q.x,q.y+1.4,q.z])}
 function vortexAt(at){fx.push({k:'vortex',a:[...at],col:[.75,.4,1],life:.7,t:0});for(const q of zombiesNear([at[0],0,at[2]],5))if(Math.hypot(q.x-at[0],q.z-at[2])<5)q.zs.pull={x:at[0],z:at[2],t:.7}}
 // explosions hurt every zombie nearby, less towards the edge
 function blast(c,rad,dmg,g){fx.push({k:'boom',a:c,life:.45,t:0,rad});for(let k=0;k<14;k++)fx.push({k:'puff',a:[...c],v:[(R()-.5)*7,R()*4,(R()-.5)*7],life:.5+R()*.3,t:0,col:[1,.5+R()*.3,.1],s0:.15,s1:.6});
  boomSound();for(const p of zombiesNear(c,rad)){const d=Math.hypot(p.x-c[0],p.y+1-c[1],p.z-c[2]);if(d<rad)hurt(p,dmg*(1-d/rad*.6),g,'torso')}}
 function muzzle(side=1){const o=eye(),{f,r,u}=dirs(),k=.46+.3*gun().len*.4;return[o[0]+r[0]*.24*side-u[0]*.17+f[0]*k,o[1]+r[1]*.24*side-u[1]*.17+f[1]*k,o[2]+r[2]*.24*side-u[2]*.17+f[2]*k]}
 // one trigger pull: Twin Fire fires from both hands; every 10th Overcharge shot is a huge blast
 function shoot(){const g=gun();shots++;let oc=false;if(has(g,'overcharge')){g.ocN=(g.ocN||0)+1;if(g.ocN>=10){g.ocN=0;oc=true;boomSound()}}
  const sides=has(g,'twin')?[1,-1]:[1];recoil=Math.min(1,recoil+(oc||g.type==='sniper'||g.type==='launcher'||g.type==='shotgun'||g.shape.arc?1:.5));gunSound(g);
  for(const side of sides)fireFrom(g,side,oc,sides.length>1?.7:1)}
 function fireFrom(g,side,oc,mul){const o=eye(),{f,r,u}=dirs(),muz=muzzle(side),ghost=has(g,'ghost');
  if(g.shape.arc){cleave(g,o,side,oc,mul);return}
  const dmg=g.dmg*mul*(oc?6:1),range=g.range*(oc?1.5:1),pierce=g.pierce+(oc?5:0),zs=zombiesNear(o,range);
  for(let q=0;q<g.pellets;q++){const ja=R()*6.283,jr=oc?0:g.spread*Math.sqrt(R());let d=[f[0]+(r[0]*Math.cos(ja)+u[0]*Math.sin(ja))*jr,f[1]+(r[1]*Math.cos(ja)+u[1]*Math.sin(ja))*jr,f[2]+(r[2]*Math.cos(ja)+u[2]*Math.sin(ja))*jr];
   let l=Math.hypot(...d);d=d.map(v=>v/l);
   // Boomerang: a spinning disc instead of a bullet
   if(has(g,'boomerang')){projs.push({p:[...muz],d,out:true,dist:0,t:0,g,dmg:dmg*1.2,hitA:new Set(),hitB:new Set()});continue}
   // Homing: lock on to the zombie closest to where you aim (within about 11 degrees)
   if(has(g,'homing')){let best=null,ba=.2;for(const p of zs){const v=[p.x-o[0],p.y+1.25-o[1],p.z-o[2]],lv=Math.hypot(...v);if(lv>range)continue;const a=Math.acos(Math.min(1,(v[0]*d[0]+v[1]*d[1]+v[2]*d[2])/lv));
     if(a<ba&&(ghost||wallDist(o,v.map(x=>x/lv),lv)>=lv-.3)){ba=a;best=v.map(x=>x/lv)}}if(best)d=best}
   // the bullet's path: through zombies (up to its pierce), and off walls with Wall Bounce
   let s=[...o],from=muz,left=range,hitsLeft=1+pierce,bounces=has(g,'bounce')?2:0,end=null;
   while(true){const{hits,wd}=trace(s,d,left,zs,ghost);const n=Math.min(hits.length,hitsLeft);let stop=wd;
    for(let k=0;k<n;k++){const h=hits[k],at=[s[0]+d[0]*h.t,s[1]+d[1]*h.t,s[2]+d[2]*h.t];hitsN++;hurt(h.p,dmg,g,h.part,at);stop=h.t;
     const jumps=g.chain+(g.elem==='shock'?1:0)+(has(g,'ricochet')?1:0);let fr=h.p;const done=new Set([h.p]);
     for(let c=0;c<jumps;c++){const nx=nearZ(fr.x,fr.y,fr.z,7,done);if(!nx)break;done.add(nx);fx.push({k:'beam',a:[fr.x,fr.y+1.2,fr.z],b:[nx.x,nx.y+1.2,nx.z],col:g.ecol,life:.14,t:0,w:.02});hurt(nx,dmg*.6,g,'torso');fr=nx}
     if(has(g,'explode'))blast(at,2.5,dmg*.5,g)}
    hitsLeft-=n;end=[s[0]+d[0]*stop,s[1]+d[1]*stop,s[2]+d[2]*stop];
    fx.push({k:'beam',a:from,b:end,col:oc?[1,.95,.8]:ghost?[.85,.8,1]:g.ecol,life:oc?.25:g.type==='sniper'?.15:.05,t:0,w:oc?.07:g.type==='launcher'?.05:.012});
    if(hitsLeft<=0||bounces<=0||stop<wd||wd>=left-.01||ghost)break;
    // bounce: find which side of the wall we hit and mirror the direction
    const b=[s[0]+d[0]*(wd-.25),s[1]+d[1]*(wd-.25),s[2]+d[2]*(wd-.25)],fl=[0,1,2].map(k=>{const q2=[...b];q2[k]+=d[k]*.6;return api.solid(...q2)});
    if(!fl.some(Boolean))fl.fill(true);d=d.map((v,k)=>fl[k]?-v:v);fx.push({k:'spark',a:[...b],col:g.ecol,life:.15,t:0});
    left-=wd;s=b;from=b;bounces--}
   if(g.blast)blast(end,g.blast,dmg,g);if(oc)blast(end,3.5,g.dmg*3,g);fx.push({k:'spark',a:end,col:g.ecol,life:.12,t:0})}}
 // the Plasma Cleaver: a crescent that sweeps out and hits everything in its arc, slicing limbs off
 function cleave(g,o,side,oc,mul){const{f,r,u}=dirs(),R0=g.range*(oc?1.8:1),half=g.shape.arc/2*Math.PI/180*(oc?1.3:1),gc={...g,cleave:2.5},ghost=has(g,'ghost');
  const c0=[o[0]-u[0]*.2,o[1]-u[1]*.2,o[2]-u[2]*.2],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  fx.push({k:'arc',o:c0,f,r,half,R:R0,col:oc?[1,.9,1]:g.ecol,life:.3,t:0,w:oc?.32:.22});
  for(const p of zombiesNear(o,R0+1)){let best=null;const hs=p.zs.crawl?[['head',.5],['torso',.3]]:[['head',1.62],['torso',1.15],['legs',.45]];
   for(const[part,h]of hs){const v=[p.x-c0[0],p.y+h*p.s[1]-c0[1],p.z-c0[2]],a=dot(v,f),b=dot(v,r),c=Math.abs(dot(v,u));
    if(a<=0||Math.hypot(a,b)>R0||Math.atan2(Math.abs(b),a)>half||c>.55)continue;if(!best||c<best.c)best={part,c,v,d:Math.hypot(...v)}}
   if(!best)continue;if(!ghost&&best.d>1&&wallDist(c0,best.v.map(x=>x/best.d),best.d)<best.d-.3)continue;
   const have=k=>['la','ra','ll','rl'].filter((x,i)=>k.includes(x)&&!(p.limb&(1<<i))),pk=a=>a[Math.floor(R()*a.length)];
   let part=best.part;if(part==='legs'){const l=have(['ll','rl']);part=l.length?pk(l):'torso'}else if(part==='torso'&&R()<.4){const l=have(['la','ra']);if(l.length)part=pk(l)}
   const at=[p.x,p.y+1.2,p.z];hitsN++;hurt(p,g.dmg*mul*(oc?4:1),gc,part,at);if(has(g,'explode'))blast(at,2.5,g.dmg*.5,g)}}
 // boomerang discs: out up to 16 m (or until a wall), then back to you, hitting each zombie once each way
 function stepProjs(dt){const o=eye();for(let i=projs.length-1;i>=0;i--){const q=projs[i];q.t+=dt;const a=[...q.p];
   if(q.out){for(let k=0;k<3;k++)q.p[k]+=q.d[k]*22*dt;q.dist+=22*dt;if(q.dist>16||api.solid(...q.p))q.out=false}
   else{const v=[o[0]-q.p[0],o[1]-.3-q.p[1],o[2]-q.p[2]],l=Math.hypot(...v);if(l<1.2||q.t>4){projs.splice(i,1);continue}for(let k=0;k<3;k++)q.p[k]+=v[k]/l*26*dt}
   const set=q.out?q.hitA:q.hitB;for(const p of zombiesNear(q.p,2)){if(set.has(p))continue;const c=[p.x,p.y+1.1,p.z],ab=[q.p[0]-a[0],q.p[1]-a[1],q.p[2]-a[2]],lab=Math.hypot(...ab)||1;
    const t=Math.max(0,Math.min(1,((c[0]-a[0])*ab[0]+(c[1]-a[1])*ab[1]+(c[2]-a[2])*ab[2])/(lab*lab))),cl=[a[0]+ab[0]*t-c[0],a[1]+ab[1]*t-c[1],a[2]+ab[2]*t-c[2]];
    if(Math.hypot(...cl)<.8){set.add(p);hitsN++;hurt(p,q.dmg,q.g,R()<.25?'head':'torso',[p.x,p.y+1.3,p.z])}}}}
 // turncoats: glowing green, they hunt the nearest zombie for 12 s, then fall
 function ally(p,dt){const z=p.zs;z.t-=dt;p.zc=[.2,1,.45];if(z.t<=0){z.st='dead';z.t=0;p.pose=4;p.zsp=0;return}
  const tg=nearZ(p.x,p.y,p.z,20);p.pose=z.crawl?8:3;if(!tg){p.zsp=0;return}const d=Math.hypot(tg.x-p.x,tg.z-p.z);
  if(d>1){step(p,tg.x,tg.z,z.crawl?1:2.4,dt);p.zsp=1}else{p.yaw=Math.atan2(tg.x-p.x,tg.z-p.z);p.zsp=0;z.hit=(z.hit||0)-dt;if(z.hit<=0){z.hit=.5;hurt(tg,ALLY.dmg,ALLY,'torso')}}}
 // beam guns (frost ray, flamethrower) hit continuously while you hold the trigger
 function beamTick(dt){const g=gun(),o=eye(),{f,r,u}=dirs(),muz=muzzle(),zs=zombiesNear(o,g.range),dps=g.dmg*g.rate,ghost=has(g,'ghost');
  const rays=g.beam==='flame'?5:1;for(let q=0;q<rays;q++){const ja=q/rays*6.283,jr=g.beam==='flame'&&q?.09:0;const d0=[f[0]+(r[0]*Math.cos(ja)+u[0]*Math.sin(ja))*jr,f[1]+(r[1]*Math.cos(ja)+u[1]*Math.sin(ja))*jr,f[2]+(r[2]*Math.cos(ja)+u[2]*Math.sin(ja))*jr];
   const l=Math.hypot(...d0),d=d0.map(v=>v/l),{hits,wd}=trace(o,d,g.range,zs,ghost);const end=hits.length?hits[0].t:wd;
   if(hits.length)hurt(hits[0].p,dps*dt/rays,g,hits[0].part,null,true);
   if(g.beam==='frost'&&q===0)fx.push({k:'beam',a:muz,b:[o[0]+d[0]*end,o[1]+d[1]*end,o[2]+d[2]*end],col:[.7,.95,1],life:.04,t:0,w:.03+Math.sin(performance.now()*.03)*.008})}
  if(g.beam==='flame')for(let k=0;k<3;k++){const s=6+R()*4;fx.push({k:'puff',a:[...muz],v:[f[0]*s+(R()-.5)*1.4,f[1]*s+(R()-.5)*1.4+.4,f[2]*s+(R()-.5)*1.4],life:.35+R()*.25,t:0,col:[1,.45+R()*.4,.08],s0:.04,s1:.5})}
  else if(R()<.5)fx.push({k:'puff',a:[...muz],v:[f[0]*3+(R()-.5),f[1]*3+(R()-.5),f[2]*3+(R()-.5)],life:.3,t:0,col:[.8,.95,1],s0:.03,s1:.15});
  beamSnd-=dt;if(beamSnd<0){beamSnd=.12;gunSound(g,true)}}

 // ---- sound (short synthesised shots and low groans; no constant noise)
 const TONE={pistol:420,smg:520,rifle:380,shotgun:240,sniper:180,launcher:110,flamer:90,frost:1400,tesla:900,acid:600};
 function gunSound(g,beam){const A=api.actx;if(!A||A.state!=='running')return;const t0=A.currentTime;if(!beam)api.kick(api.master,t0,g.type==='shotgun'||g.type==='sniper'||g.type==='launcher'?.6:.3);
  const o=A.createOscillator(),gn=A.createGain(),f0=TONE[g.type]||400;o.type=g.elem==='shock'||g.type==='frost'?'sawtooth':beam?'triangle':'square';o.frequency.setValueAtTime(f0,t0);o.frequency.exponentialRampToValueAtTime(beam?f0*.8:90,t0+(beam?.1:.08));
  gn.gain.setValueAtTime(beam?.025:.06,t0);gn.gain.exponentialRampToValueAtTime(.001,t0+.1);o.connect(gn);gn.connect(api.master);o.start(t0);o.stop(t0+.12)}
 function boomSound(){const A=api.actx;if(!A||A.state!=='running')return;const t0=A.currentTime;api.kick(api.master,t0,1);const o=A.createOscillator(),g=A.createGain();o.type='triangle';o.frequency.setValueAtTime(70,t0);o.frequency.exponentialRampToValueAtTime(30,t0+.5);g.gain.setValueAtTime(.25,t0);g.gain.exponentialRampToValueAtTime(.001,t0+.6);o.connect(g);g.connect(api.master);o.start(t0);o.stop(t0+.6)}
 function chime(){const A=api.actx;if(!A||A.state!=='running')return;const t0=A.currentTime;[660,880,1320].forEach((f,i)=>{const o=A.createOscillator(),g=A.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,t0+i*.07);g.gain.linearRampToValueAtTime(.06,t0+i*.07+.02);g.gain.exponentialRampToValueAtTime(.001,t0+i*.07+.4);o.connect(g);g.connect(api.master);o.start(t0+i*.07);o.stop(t0+i*.07+.45)})}
 function groan(p,die){const A=api.actx;if(!A||A.state!=='running')return;const d=Math.hypot(p.x-P.x,p.z-P.z);if(d>14)return;const t0=A.currentTime,o=A.createOscillator(),v=A.createOscillator(),vg=A.createGain(),g=A.createGain(),f=A.createBiquadFilter();
  o.type='sawtooth';o.frequency.value=die?70:85+p.ph*40;v.frequency.value=5;vg.gain.value=6;v.connect(vg);vg.connect(o.frequency);f.type='lowpass';f.frequency.value=500;
  const vol=.05*(1-d/14);g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(vol,t0+.15);g.gain.linearRampToValueAtTime(0,t0+(die?.9:1.4));o.connect(f);f.connect(g);g.connect(api.master);o.start(t0);v.start(t0);o.stop(t0+1.5);v.stop(t0+1.5)}

 // ---- moving people around: walk toward (or away from) a point, step up and down, slide along walls
 const free=(x,y,z)=>!api.solid(x,y+.9,z)&&!api.solid(x,y+1.5,z);
 function step(p,tx,tz,sp,dt){const z=p.zs,dx=tx-p.x,dz=tz-p.z,l=Math.hypot(dx,dz);if(l<.05)return;p.yaw=Math.atan2(dx,dz);let mx=dx/l*sp*dt,mz=dz/l*sp*dt;
  if(!free(p.x+mx,p.y,p.z+mz)){const a=Math.atan2(mx,mz),m=Math.hypot(mx,mz);let ok=false;for(const da of[.8,-.8,1.6,-1.6]){const nx=Math.sin(a+da)*m,nz=Math.cos(a+da)*m;if(free(p.x+nx,p.y,p.z+nz)){mx=nx;mz=nz;ok=true;break}}if(!ok){mx=0;mz=0}}
  p.x+=mx;p.z+=mz;z.gy=(z.gy||0)-dt;if(z.gy<0){z.gy=.3;const g=api.groundAt(p.x,p.y+.6,p.z);if(g>-50&&g<p.y+.7)p.y=g}}
 function zombie(p,dt){const z=p.zs,dP=Math.hypot(P.x-p.x,P.z-p.z),dy=P.feet-p.y;
  z.flash=Math.max(0,z.flash-dt);z.slow=Math.max(0,z.slow-dt);
  // burning and acid keep hurting; their damage shows as numbers twice a second
  if(z.burn>0||z.acid>0){const v=(z.burn>0?12:0)+(z.acid>0?15:0);z.burn-=dt;z.acid-=dt;z.hp-=v*dt;z.dot+=v*dt;z.dcol=z.burn>0?ELEMENTS.fire.css:ELEMENTS.acid.css;z.flash=Math.max(z.flash,.02);if(z.hp<=0){kill(p);return}}
  z.dotT-=dt;if(z.dotT<0&&z.dot>0){z.dotT=.45;if(dP<40)popNum(p.x,p.y+1.7*p.s[1],p.z,z.dot,z.dcol||'#fff');z.dot=0}
  p.zc=z.flash>0?[.7,.05,.03]:z.burn>0?[.9,.35,.05]:z.acid>0?[.45,.85,.2]:z.slow>0?[.45,.7,.95]:blood(p.c);
  if(z.kb){const m=z.kb;m.t-=dt;const nx=p.x+m.vx*dt,nz=p.z+m.vz*dt;if(free(nx,p.y,nz)){p.x=nx;p.z=nz}if(m.t<=0)z.kb=null}
  if(z.pull){const q=z.pull;q.t-=dt;const dx=q.x-p.x,dz=q.z-p.z,l=Math.hypot(dx,dz);if(l>.6){const sp2=Math.min(l,7*dt),nx=p.x+dx/l*sp2,nz=p.z+dz/l*sp2;if(free(nx,p.y,nz)){p.x=nx;p.z=nz}}if(q.t<=0)z.pull=null}
  if(z.stag>0||z.pull){z.stag=Math.max(0,(z.stag||0)-dt);p.zsp=0;return}
  if(z.st==='eat'){z.t+=dt;p.zsp=0;p.pose=5;if(z.t>6){z.st='zombie';p.pose=3}return}
  z.think-=dt;if(z.think<0){z.think=.6;z.tgt=dP<16&&Math.abs(dy)<3?'you':nearest(gridH,p.x,p.y,p.z,28)}
  const sp=z.spd*(z.slow>0?.3:1);let tx,tz,s=sp;
  if(z.tgt==='you'){tx=P.x;tz=P.z}else if(z.tgt&&isHuman(z.tgt)){tx=z.tgt.x;tz=z.tgt.z}
  else{z.t-=dt;if(z.t<0){z.t=3+R()*5;z.wx=p.x+(R()-.5)*16;z.wz=p.z+(R()-.5)*16}tx=z.wx;tz=z.wz;s=sp*.6}
  if(z.tgt==='you'&&dP<1){p.yaw=Math.atan2(P.x-p.x,P.z-p.z)}else step(p,tx,tz,s,dt);p.zsp=z.crawl?.8:Math.min(1.2,s*.9);p.pose=z.crawl?8:3;
  if(z.tgt==='you'&&dP<(z.crawl?1.4:1.2)&&Math.abs(dy)<1.5){z.atk-=dt;if(z.atk<=0){z.atk=1.1;damage(12)}}else z.atk=Math.min(z.atk,.4);
  const h=z.tgt!=='you'&&z.tgt;if(h&&isHuman(h)&&Math.hypot(h.x-p.x,h.z-p.z)<.8&&Math.abs(h.y-p.y)<1){
   h.zs={st:'down',t:0,turn:TURN[0]+R()*(TURN[1]-TURN[0])};h.pose=6;h.zsp=0;h.zc=blood(h.c);h.yaw=p.yaw+Math.PI;z.st='eat';z.t=0;z.tgt=null;groan(p)}}
 function human(p,dt){const z=p.zs;const zz=nearest(gridZ,p.x,p.y,p.z,22);let away=null;
  if(zz)away=[p.x-zz.x,p.z-zz.z];else{const f=nearest(gridF,p.x,p.y,p.z,6);if(f&&f!==p)away=[Math.sin(f.yaw),Math.cos(f.yaw)]}
  if(away){if(!z)p.zs={st:'flee',t:0,run:0};const s=p.zs;s.st='flee';s.t=0;s.seen=!!zz;s.run=(s.run||0)+dt;const l=Math.hypot(...away)||1,sp=(p.base||1.3)*(s.run<8?1.9:1.15);
   step(p,p.x+away[0]/l*4,p.z+away[1]/l*4,sp,dt);p.zsp=Math.min(1.6,sp*.7);p.pose=0}
  else if(z){z.t+=dt;z.run=Math.max(0,(z.run||0)-dt*.5);if(z.t>2.5){z.st='cower';p.pose=7;p.zsp=0}}}

 function damage(n){if(deadT>0)return;health-=n;hurtT=.4;buzz(health<=n?200:45);if(health<=0){health=0;deadT=3;banner('You died','No second chances · starting over from the car park…',9999)}}
 function respawn(){const r=api.CUR||api.HUB,d=r.doors[0],inx=-d.dx||0,inz=-d.dz||0;P.x=d.x+inx*4;P.z=d.z+inz*4;P.y=api.EYE+.1;api.settle();health=100;
  for(const q of r.P)if(isZ(q)&&Math.hypot(q.x-P.x,q.z-P.z)<10){q.x+=(q.x-P.x)*1.5;q.z+=(q.z-P.z)*1.5}}

 // ---- loot: a card for the gun at your feet; E (X on a controller, or tap the card) takes it
 let near=null,cardFor=null;
 const pct=(a,b)=>b?Math.round((a/b-1)*100):0,arrow=v=>v>0?`<span style="color:#7dff8a">▲${v}%</span>`:v<0?`<span style="color:#ff7a7a">▼${-v}%</span>`:'';
 function card(g){const c=gun(),dps=x=>x.dmg*x.pellets*x.rate,acc=x=>Math.round((1-Math.min(.2,x.spread)*4)*100);
  const el2=g.elem?`<span style="color:${ELEMENTS[g.elem].css}">${ELEMENTS[g.elem].name}</span>`:'None';
  return`<div style="font-size:17px;font-weight:800;color:${g.rar.css}">${g.name}</div><div style="font-size:12px;opacity:.8">${g.rar.name} ${GUN_TYPES[g.type].name} · ${g.makerName} — ${g.trait}</div>
  <div style="margin-top:6px;font-size:13px">Damage ${Math.round(g.dmg)}${g.pellets>1?'×'+g.pellets:''} ${arrow(pct(g.dmg*g.pellets,c.dmg*c.pellets))}<br>Fire rate ${g.rate.toFixed(1)}/s ${arrow(pct(g.rate,c.rate))} · DPS ${Math.round(dps(g))} ${arrow(pct(dps(g),dps(c)))}<br>Accuracy ${g.beam?'beam':acc(g)+'%'} · Element ${el2}${g.blast?' · Blast '+g.blast+' m':''}${g.pierce?' · Pierce '+g.pierce:''}</div>
  ${g.abil.map(a=>`<div style="font-size:12px;color:#ffd77a">◆ ${ABILITIES[a].name}: ${ABILITIES[a].tip}</div>`).join('')}
  <div style="margin-top:6px;font-size:12px;opacity:.85">${api.touchMode?'Tap here to take it':'E (or X on a controller) to take it'}${inv.length>=SLOTS?' · replaces your current gun':''}</div>`}
 function take(d){const i=drops.indexOf(d);if(i<0)return;drops.splice(i,1);
  if(inv.length<SLOTS){inv.push(d.g);ci=inv.length-1}else{const old=inv[ci];inv[ci]=d.g;drops.push({g:old,x:P.x,y:P.feet,z:P.z,t:0})}
  swapT=.25;chime();banner(`<span style="color:${d.g.rar.css}">${d.g.name}</span>`,`${d.g.rar.name} ${GUN_TYPES[d.g.type].name} · unlimited ammo`,2.2);near=null}

 // ---- the forge: pick one aspect from every gun you hold and they combine into one gun (and the rest break).
 // Open it any time with Q (Y on a controller, FORGE on a phone); the game doesn't pause, so find somewhere safe.
 let autoBtn=null;const autoB=()=>{if(autoBtn){autoBtn.textContent=autoF?'AUTO ON':'AUTO OFF';autoBtn.style.color=autoF?'#7f7':'#fff'}};
 // sniper zoom (right mouse, LT or RB) and the flashlight (F, R3 or the LIGHT button)
 let aimM=false,aimP=false,zoomK=0,torchOn=false;const isSniper=()=>gun().type==='sniper';
 const scopeEl=el('left:0;top:0;width:100vw;height:100vh;opacity:0;background:radial-gradient(circle at 50% 50%,transparent 0,transparent 34vmin,rgba(0,0,0,.92) 35vmin);display:block');
 scopeEl.innerHTML='<div style="position:absolute;left:50%;top:15vh;width:1px;height:70vh;background:rgba(0,0,0,.8)"></div><div style="position:absolute;top:50%;left:calc(50% - 35vmin);width:70vmin;height:1px;background:rgba(0,0,0,.8)"></div>';
 const toggleTorch=()=>{torchOn=!torchOn;banner('',torchOn?'Flashlight on':'Flashlight off',.8)};
 let forgeOpen=false,sel=null,cur2={row:0,col:0},forgeMsg='';const MAXAB=3;
 const forgeEl=el('left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,94vw);max-height:84vh;overflow:auto;padding:14px 16px;border-radius:12px;background:rgba(10,10,18,.9);border:1px solid rgba(255,255,255,.15);display:none;pointer-events:auto;text-shadow:none');
 const x2=v=>'×'+v.toFixed(2);
 function aspects(g){const T=g.shape,A=[{k:'frame',label:'Frame',tip:`${g.rar.name} ${GUN_TYPES[g.type].name} by ${g.makerName}: the body of the new gun (its type, pellets, range and built-in traits).`},
  {k:'dmg',label:'Damage '+x2(g.base.dmg/T.dmg),tip:`Damage roll ${x2(g.base.dmg/T.dmg)} (vs a plain ${T.name}), put on whichever Frame you choose.`},
  {k:'rate',label:'Fire rate '+x2(g.base.rate/T.rate),tip:`Fire rate roll ${x2(g.base.rate/T.rate)} (vs a plain ${T.name}), put on whichever Frame you choose.`},
  {k:'skin',label:'Skin',tip:`The ${g.makerName} finish of this gun.`}];
  if(g.elem)A.push({k:'elem',v:g.elem,label:ELEMENTS[g.elem].name,tip:`${ELEMENTS[g.elem].name} element on every shot.`});
  for(const a of g.abil)A.push({k:'abil',v:a,label:ABILITIES[a].name,tip:ABILITIES[a].tip+'.'});return A}
 const isSel=(r,a)=>a.k==='abil'?sel.abil.some(x=>x[0]===r&&x[1]===a.v):sel[a.k]===r;
 function forged(){if(inv.length<2)return{err:'You need at least two guns to forge'};if(sel.frame==null)return{err:'Pick a Frame from one of your guns'};
  const fg=inv[sel.frame],T=fg.shape,g={...fg,base:{...fg.base},abil:[]};g.rarity=Math.max(...inv.map(x=>x.rarity));g.rar=RARITIES[g.rarity];g.col=g.rar.col;
  if(sel.dmg!=null){const s2=inv[sel.dmg];g.base.dmg=T.dmg*s2.base.dmg/s2.shape.dmg}
  if(sel.rate!=null){const s2=inv[sel.rate];g.base.rate=T.rate*s2.base.rate/s2.shape.rate}
  if(sel.skin!=null){const s2=inv[sel.skin];g.skin=s2.skin;g.tint=s2.tint}
  if(sel.elem!=null&&!g.beam&&!T.elem)g.elem=inv[sel.elem].elem;
  for(const[,a]of sel.abil)if(!g.abil.includes(a)&&fitsGun(g,a))g.abil.push(a);
  applyAbilities(g);g.ocN=0;g.ecol=g.elem?ELEMENTS[g.elem].col:g.shape.arc?[1,.4,1]:g.col;
  g.name=`Forged ${g.makerName} ${GUN_TYPES[g.type].name}`;g.parts=gunParts(g,R);return{g}}
 function drawForge(){const res=forged(),focus=cur2.row<inv.length?aspects(inv[cur2.row])[cur2.col]:null,fg=sel.frame!=null?inv[sel.frame]:null;
  const chip=(r,c,a)=>{const on=isSel(r,a),cur=cur2.row===r&&cur2.col===c,g=inv[r],bad=a.k==='abil'&&fg&&!fitsGun(fg,a.v);
   return`<span data-r="${r}" data-c="${c}" style="display:inline-block;margin:3px 4px 0 0;padding:${api.touchMode?'9px 13px':'4px 9px'};border-radius:6px;cursor:pointer;font-size:${api.touchMode?15:13}px;background:${on?g.rar.css:'rgba(255,255,255,.08)'};color:${on?'#111':'#eee'};opacity:${bad?.4:1};text-decoration:${bad?'line-through':'none'};outline:${cur?'2px solid #fff':'none'}">${a.k==='abil'?'◆ ':''}${a.label}</span>`};
  const ftip=focus?focus.tip+(focus.k==='abil'&&fg&&!fitsGun(fg,focus.v)?` <span style="color:#f88">(doesn't work on a ${GUN_TYPES[fg.type].name} frame)</span>`:''):'';
  forgeEl.innerHTML=`<div style="font-size:20px;font-weight:800">Forge</div><div style="font-size:12px;opacity:.75;margin-bottom:8px">Build one gun from the guns you carry: pick a <b>Frame</b>, then take <b>Damage</b>, <b>Fire rate</b>, <b>Skin</b>, an element and up to ${MAXAB} <b>abilities</b> from any of them. Anything you don't pick comes from the Frame. Forging breaks all your guns into the new one. The game keeps going.</div>`+
   inv.map((g,r)=>`<div style="margin:6px 0;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.04)"><div style="font-weight:700;color:${g.rar.css}">${r+1}. ${g.name}</div>${aspects(g).map((a,c)=>chip(r,c,a)).join('')}</div>`).join('')+
   `<div style="min-height:34px;margin-top:6px;font-size:13px;color:#ffd77a">${forgeMsg?`<span style="color:#f88">${forgeMsg}</span>`:ftip}</div>`+
   `<div style="margin-top:4px;font-size:13px">${res.err?`<span style="opacity:.8">${res.err}</span>`:`Result: <b style="color:${res.g.rar.css}">${res.g.name}</b> · ${Math.round(res.g.dmg)}${res.g.pellets>1?'×'+res.g.pellets:''} dmg · ${res.g.rate.toFixed(1)}/s${res.g.elem?' · '+ELEMENTS[res.g.elem].name:''}${res.g.abil.length?' · '+res.g.abil.map(a=>ABILITIES[a].name).join(', '):''} · ${res.g.abil.length}/${MAXAB} abilities`}</div>`+
   `<div data-forge="1" style="margin-top:10px;padding:9px;border-radius:8px;text-align:center;font-weight:800;cursor:pointer;background:${res.err?'rgba(255,255,255,.08)':'linear-gradient(#ffe39a,#ff9a1f)'};color:${res.err?'#888':'#2a1300'};outline:${cur2.row===inv.length?'2px solid #fff':'none'}">FORGE</div>`+
   `<div style="margin-top:6px;font-size:11px;opacity:.65;text-align:center">${api.touchMode?'Tap to pick or unpick, then Forge':'Click, or arrows + Enter · d-pad + A on a controller · Q / B to close'}</div>`}
 function setForge(v){if(v&&inv.length<2){banner('Forge','You need at least two guns to forge',1.8);return}forgeOpen=v;forgeEl.style.display=v?'':'none';firing=false;
  if(v){sel={frame:ci,dmg:null,rate:null,skin:null,elem:null,abil:[]};forgeMsg='';cur2={row:0,col:0};drawForge();if(document.pointerLockElement)document.exitPointerLock()}}
 function forgeAct(){if(cur2.row>=inv.length){const res=forged();if(res.g){inv.splice(0,inv.length,res.g);ci=0;setForge(false);chime();banner(`<span style="color:${res.g.rar.css}">${res.g.name}</span>`,'Your guns were forged into one',2.4)}return}
  const r=cur2.row,a=aspects(inv[r])[cur2.col];forgeMsg='';
  if(a.k==='abil'){const i=sel.abil.findIndex(x=>x[1]===a.v);if(i>=0&&sel.abil[i][0]===r)sel.abil.splice(i,1);else if(i>=0)sel.abil[i][0]=r;else if(sel.abil.length>=MAXAB)forgeMsg=`You can take up to ${MAXAB} abilities. Unpick one first.`;else sel.abil.push([r,a.v])}
  else sel[a.k]=sel[a.k]===r?null:r;drawForge()}
 function forgeMove(dr,dc){const rows=inv.length+1;cur2.row=(cur2.row+dr+rows)%rows;if(cur2.row<inv.length){const n=aspects(inv[cur2.row]).length;cur2.col=Math.max(0,Math.min(n-1,cur2.col+dc))}drawForge()}
 forgeEl.addEventListener('pointerdown',e=>{e.stopPropagation();const t=e.target.closest('[data-r],[data-forge]');if(!t)return;e.preventDefault();
  if(t.dataset.forge){cur2.row=inv.length}else{cur2.row=+t.dataset.r;cur2.col=+t.dataset.c}forgeAct()});
 addEventListener('keydown',e=>{if(e.code==='KeyQ'&&!e.repeat){setForge(!forgeOpen);return}if(!forgeOpen)return;
  const m={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.code];if(m){keys.delete(e.code);forgeMove(...m);e.preventDefault()}
  if(e.code==='Enter'||e.code==='NumpadEnter')forgeAct();if(e.code==='Escape')setForge(false)});
 addEventListener('keyup',e=>{if(forgeOpen&&e.code.startsWith('Arrow'))keys.delete(e.code)});
 let padF=[],padRepF=0;
 function forgePad(dt){const gp=[...(navigator.getGamepads?.()||[])].find(g=>g&&g.connected);if(!gp)return;const b=gp.buttons.map(x=>x.pressed),ed=i=>b[i]&&!padF[i];
  if(ed(3))setForge(!forgeOpen);
  if(forgeOpen){padRepF-=dt;const d=[[12,-1,0],[13,1,0],[14,0,-1],[15,0,1]].find(([i])=>b[i]);if(d&&padRepF<=0){padRepF=.2;forgeMove(d[1],d[2])}else if(!d)padRepF=0;if(ed(0))forgeAct();if(ed(1))setForge(false)}
  padF=b}
 if(api.touchMode){for(const[lab,bot,dn,up]of[['AUTO',16,()=>{autoF=!autoF;autoB()},null]]){const b=document.createElement('button');b.className='zhud';b.textContent=lab;
   b.style.cssText=`position:fixed;z-index:6;${api.lefty?'left':'right'}:${bot}px;top:12px;padding:8px 12px;border-radius:8px;border:2px solid rgba(255,255,255,.7);background:rgba(0,0,0,.35);color:#fff;font:800 12px system-ui;touch-action:none`;
   if(lab==='AUTO')autoBtn=b;b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();dn()});if(up)for(const ev of['pointerup','pointercancel'])b.addEventListener(ev,up);document.body.appendChild(b)}autoB()}
 if(api.touchMode){const b=document.createElement('button');b.className='zhud';b.textContent='FORGE';b.style.cssText='position:fixed;z-index:6;'+(api.lefty?'left':'right')+':104px;top:12px;padding:8px 12px;border-radius:8px;border:2px solid rgba(255,255,255,.7);background:rgba(0,0,0,.35);color:#ffd77a;font:800 12px system-ui;touch-action:none';
  b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();setForge(!forgeOpen)});document.body.appendChild(b)}

 // ---- every frame
 // ---- the helicopter: at the far end of the Grand Exit car park; reach it and it flies you away
 let escaped=false,reached=false,heli=null,flyT=0;
 function findHeli(){const r=api.LOADED.find(q=>q.theme==='exit');if(!r){heli=null;return}if(heli&&heli.r===r)return;const d=r.doors[0],ix=-d.dx,iz=-d.dz;
  heli={r,x:d.x+ix*122,z:d.z+iz*122,y:0,yaw:Math.atan2(ix,iz),fx:ix,fz:iz}}
 function flyStep(dt){flyT+=dt;const h=heli,t=flyT,up=Math.min(1,t/4);h.y=up*up*14+Math.max(0,t-4)*4;const fwd=Math.max(0,t-3.5)*Math.max(0,t-3.5)*1.2;
  h.x+=h.fx*fwd*dt;h.z+=h.fz*fwd*dt;P.x=h.x-h.fx*.3;P.z=h.z-h.fz*.3;P.feet=h.y+.55;P.ey=P.feet+1.15;P.y=P.ey;P.vx=P.vz=P.vy=0;
  if(t>9&&!escaped){escaped=true;chime();banner('You escaped Skylight Galleria!','Thanks for playing · press Esc for the menu',9999)}}
 let zoneLast='',gunLast='',groanT=0,countT=0,frameNo=0;const count=new Map();
 function update(dt){const t=performance.now()/1000;
  for(const r of api.LOADED)seedZone(r);
  if(deadT>0){deadT-=dt;if(deadT<=0){deadT=99;location.reload()}}
  cool-=dt;swapT=Math.max(0,swapT-dt);recoil=Math.max(0,recoil-dt*6);hurtT=Math.max(0,hurtT-dt);
  gridT-=dt;if(gridT<0){gridT=.2;rebuild()}
  assist(dt);if((firing||(autoF&&aTgt&&!forgeOpen))&&deadT<=0&&swapT<=0){if(gun().beam)beamTick(dt);else if(cool<=0){shoot();cool=1/gun().rate}}
  frameNo++;
  const FAR=api.phone?55:90;for(const r of api.LOADED)for(const p of r.P){const dd=Math.hypot(p.x-P.x,p.z-P.z);if(dd>FAR)continue;const z=p.zs;
   if(!z){if(!p.fur&&gridZ.size)human(p,dt);continue}
   if(isZ(p)){if(dd>40){z.acc=(z.acc||0)+dt;if(((frameNo+z.k)&3)!==0)continue;zombie(p,Math.min(.2,z.acc));z.acc=0}else zombie(p,dt)}
   else if(z.st==='down'){z.t+=dt;if(z.t>z.turn)turn(p)}
   else if(z.st==='dead'){z.t+=dt;if(z.t>4)p.y-=dt*.25;if(z.t>7)z.st='gone'}
   else if(z.st==='ally')ally(p,dt);
   else if(z.st==='flee'||z.st==='cower')human(p,dt)}
  for(let i=chainQ.length-1;i>=0;i--){const c=chainQ[i];c.t-=dt;if(c.t<=0){chainQ.splice(i,1);blast(c.at,3,30+c.g.dmg*.5,c.g)}}
  stepProjs(dt);
  // guns on the floor: the nearest one within reach shows its card
  near=null;let nd=2.2;for(let i=drops.length-1;i>=0;i--){const d=drops[i];d.t+=dt;if(d.t>180){drops.splice(i,1);continue}const dd=Math.hypot(d.x-P.x,d.z-P.z);if(dd<nd&&Math.abs(d.y-P.feet)<1.5){nd=dd;near=d}}
  if(api.touchMode&&near&&!near.seen){near.seen=true;const D=x=>x.dmg*x.pellets*x.rate;if(D(near.g)>D(gun())*1.25&&near.g.rarity>=gun().rarity){take(near);near=null}}
  if(near!==cardFor){cardFor=near;hud.card.style.display=near?'':'none';if(near)hud.card.innerHTML=card(near.g)}
  const e=keys.has('KeyE');if(e&&!prevE&&near)take(near);prevE=e;
  // health potions
  for(let i=potions.length-1;i>=0;i--){const q=potions[i];if(q.r&&!api.LOADED.includes(q.r)){potions.splice(i,1);continue}
   if(health<100&&Math.hypot(q.x-P.x,q.z-P.z)<1.2&&Math.abs(q.y-P.feet)<1.5){potions.splice(i,1);health=Math.min(100,health+POTION_HEAL);chime();banner('<span style="color:#ff5a6a">Health potion</span>',`+${POTION_HEAL} health`,1.6)}}
  // counts per zone, and the reward for clearing one: a rare-or-better gun and a full heal
  countT-=dt;if(countT<0){countT=.4;for(const r of api.LOADED){let zs=0,down=0,hum=0;for(const p of r.P){if(isZ(p))zs++;else if(p.zs&&p.zs.st==='down')down++;else if(isHuman(p))hum++}count.set(r.theme,{zs,down,hum});
}
    if(api.CUR&&api.CUR.theme==='exit'&&!reached){reached=true;chime();banner('The helicopter is waiting!','Get to the helipad at the far end of the car park',5)}}
  groanT-=dt;if(groanT<0){groanT=2+R()*3;const a=zombiesNear([P.x,0,P.z],14);if(a.length)groan(a[Math.floor(R()*a.length)])}
  // HUD
  const CUR=api.CUR,c=CUR&&count.get(CUR.theme),title=CUR?(CUR.theme==='hub'?'The Mall':(typeof TITLES!=='undefined'&&TITLES[CUR.theme])||CUR.title||CUR.theme):'';
  const line=!c?'':cleared.has(CUR.theme)?'cleared':`${c.zs} zombies${c.down?` · ${c.down} turning`:''}${c.hum?` · ${c.hum} people left`:''}`;
  const zl=`${title}${c?` · ${c.zs} zombies here`:''}<br><span style="font-size:12px;opacity:.85">${escaped?'You escaped!':reached?'Get to the helicopter':'Get through the mall to the Grand Exit'}</span>`;if(zl!==zoneLast){hud.zone.innerHTML=zl;zoneLast=zl}
  hud.hp.firstChild.style.width=health+'%';hud.hpn.textContent=Math.ceil(health)+' / 100';
  const g=gun(),gl=`<div style="font-size:18px;font-weight:800;color:${g.rar.css}">${g.name} <span style="opacity:.8;color:#fff">∞</span></div><div style="font-size:12px;opacity:.85">${g.rar.name} ${GUN_TYPES[g.type].name} · ${g.makerName}${g.elem?' · '+ELEMENTS[g.elem].name:''}${g.abil.length?' · '+g.abil.map(a=>ABILITIES[a].name).join(', '):''}${has(g,'overcharge')?' · <b style="color:#fff">Overcharge '+(g.ocN||0)+'/10</b>':''}</div>
   <div style="margin-top:4px">${inv.map((x,i)=>`<span style="display:inline-block;min-width:18px;margin-left:3px;padding:1px 4px;border-radius:4px;font-size:11px;background:${i===ci?x.rar.css:'rgba(0,0,0,.5)'};color:${i===ci?'#111':x.rar.css};border:1px solid ${x.rar.css}">${i+1}</span>`).join('')}</div>`;
  if(gl!==gunLast){hud.gun.innerHTML=gl;gunLast=gl}
  hud.red.style.opacity=hurtT>0?1:0;if(bannerT>0){bannerT-=dt;if(bannerT<=0)hud.banner.style.opacity=0}
  for(const e2 of fx){e2.t+=dt;if((e2.k==='gib'||e2.k==='puff')&&e2.v){if(e2.k==='gib')e2.v[1]-=9.8*dt;else e2.v=e2.v.map(v=>v*(1-dt*2.5));for(let j=0;j<3;j++)e2.a[j]+=e2.v[j]*dt;
    if(e2.k==='gib'){e2.yaw+=e2.spin*dt;e2.pitch+=e2.spin*.7*dt;if(e2.a[1]<e2.ground+e2.size[1]*.3){e2.a[1]=e2.ground+e2.size[1]*.3;e2.v=e2.v.map(v=>v*.4);e2.v[1]=0;e2.spin*=.5;e2.pitch=1.5708}}}}
  for(let i=fx.length-1;i>=0;i--)if(fx[i].t>fx[i].life)fx.splice(i,1);
  findHeli();if(heli&&!flyT&&deadT<=0&&Math.hypot(heli.x-P.x,heli.z-P.z)<4&&Math.abs(P.feet-heli.y)<2){flyT=.001;firing=false;banner('Get in!','',2)}
  forgePad(dt);zoomK+=((isSniper()&&(aimM||aimP)&&!forgeOpen&&deadT<=0?1:0)-zoomK)*Math.min(1,dt*12);scopeEl.style.opacity=zoomK>.5?Math.min(1,(zoomK-.5)*3):0;
  stepNums(dt);write(t)}

 // ---- parts to draw: your gun (metal finishes), beams, flames, blasts, health bars, dropped guns, potions
 function write(t){nF=0;const part=(x,y,z,yaw,sx,sy,sz,col,pitch,em,pat=0)=>{if(nF>=1600)return;fData.set([x,y,z,yaw,sx,sy,sz,8,col[0],col[1],col[2],0,pitch,0,em,pat],nF*16);nF++};
  const DARK=[.22,.22,.25];
  const drawGun=(g,at,yaw,pitch,sc)=>{for(const[f,u,r,w,h,l,m]of g.parts){const p=at(f*sc,u*sc,r*sc);
    if(m==='b')part(...p,yaw,w*sc,h*sc,l*sc,g.tint,pitch,0,g.skin);else if(m==='d')part(...p,yaw,w*sc,h*sc,l*sc,DARK,pitch,0,41);
    else part(...p,yaw,w*sc,h*sc,l*sc,m==='g'?g.col:g.ecol,pitch,m==='g'?1.6:2.2)}};
  if(deadT<=0&&zoomK<.6){const o=eye(),C=dirs(true),{f,r,u}=dirs(),k=.46-recoil*.06-swapT*.6,dn=.2+swapT*.4,p0=[o[0]+C.r[0]*.24-C.u[0]*dn+C.f[0]*k,o[1]+C.r[1]*.24-C.u[1]*dn+C.f[1]*k,o[2]+C.r[2]*.24-C.u[2]*dn+C.f[2]*k];
   drawGun(gun(),(df,du,dr)=>[p0[0]+f[0]*df+u[0]*du+r[0]*dr,p0[1]+f[1]*df+u[1]*du+r[1]*dr,p0[2]+f[2]*df+u[2]*du+r[2]*dr],AY??P.yaw,(AP??P.pitch)+recoil*.08,1);
   // Twin Fire: a mirrored copy in the left hand
   if(has(gun(),'twin')){const q0=[p0[0]-r[0]*.48,p0[1]-r[1]*.48,p0[2]-r[2]*.48];drawGun(gun(),(df,du,dr)=>[q0[0]+f[0]*df+u[0]*du-r[0]*dr,q0[1]+f[1]*df+u[1]*du-r[1]*dr,q0[2]+f[2]*df+u[2]*du-r[2]*dr],AY??P.yaw,(AP??P.pitch)+recoil*.08,1)}}
  for(const e of fx){const a=1-e.t/e.life;
   if(e.k==='gib'){part(...e.a,e.yaw,...e.size,e.col,e.pitch,0);continue}
   if(e.k==='puff'){const s=e.s0+(e.s1-e.s0)*(e.t/e.life);part(...e.a,e.t*7,s,s,s,e.col,e.t*5,3.5*a);continue}
   if(e.k==='arc'){const n=18,k0=e.t/e.life,rr=1+(e.R-1)*Math.pow(k0,.6);for(let k=0;k<n;k++){const a=-e.half+(k+.5)/n*2*e.half,ca=Math.cos(a),sa=Math.sin(a);
     const d=[0,1,2].map(i=>e.f[i]*ca+e.r[i]*sa),tg=[0,1,2].map(i=>-e.f[i]*sa+e.r[i]*ca);
     part(e.o[0]+d[0]*rr,e.o[1]+d[1]*rr,e.o[2]+d[2]*rr,Math.atan2(-tg[0],-tg[2]),e.w*(1-k0*.5),.05,rr*2*e.half/n*1.1,e.col,Math.asin(Math.max(-1,Math.min(1,tg[1]))),5*(1-k0))}continue}
   if(e.k==='vortex'){const k0=e.t/e.life;for(let k=0;k<10;k++){const a=k/10*6.283+t*9,rr=1.8*(1-k0)+.15;part(e.a[0]+Math.cos(a)*rr,e.a[1]+Math.sin(a*1.7)*.4,e.a[2]+Math.sin(a)*rr,a,.08,.08,.08,e.col,0,3.5)}continue}
   if(e.k==='boom'){const s=e.rad*(.3+e.t/e.life*.9);part(...e.a,0,s,s,s,[1,.55,.15],0,5*a);continue}
   if(e.k==='beam'){const[x0,y0,z0]=e.a,[x1,y1,z1]=e.b,dx=x1-x0,dy=y1-y0,dz=z1-z0,l=Math.hypot(dx,dy,dz);if(l<.01)continue;const w=e.w||.012;
    part((x0+x1)/2,(y0+y1)/2,(z0+z1)/2,Math.atan2(-dx,-dz),w,w,l,e.col,Math.asin(dy/l),4*a);continue}
   part(...e.a,t*20,e.k==='flash'?.1:.07,e.k==='flash'?.1:.07,e.k==='flash'?.1:.07,e.col,t*13,(e.k==='flash'?8:3)*a)}
  for(const q of projs){const g=q.g,a=t*25;part(...q.p,a,.45,.03,.12,g.ecol,0,3.5);part(...q.p,a+1.5708,.45,.03,.12,g.ecol,0,3.5)}
  // health bars over zombies you've hurt
  const {r:cr}=dirs();let bars=0;for(const r of api.LOADED)for(const p of r.P){if(bars>50)break;if(!isZ(p)||p.zs.hp>=100)continue;const d=Math.hypot(p.x-P.x,p.z-P.z);if(d>30)continue;bars++;
   const fr=Math.max(0,p.zs.hp/100),y=p.y+(p.zs.crawl?.75:2.05*p.s[1]),off=-(1-fr)*.25;
   part(p.x,y,p.z,P.yaw,.52,.07,.01,[.05,.05,.05],0,0);part(p.x+cr[0]*off,y,p.z+cr[2]*off,P.yaw,.5*fr,.05,.02,fr>.5?[.25,1,.3]:fr>.25?[1,.8,.2]:[1,.2,.15],0,2)}
  // guns on the floor turn slowly; rare and better ones send up a beam of their colour
  for(const d of drops){const a=t*1.1+d.x,fw=[-Math.sin(a),0,-Math.cos(a)],rt=[Math.cos(a),0,-Math.sin(a)],y=d.y+.55+Math.sin(t*2+d.z)*.06;
   drawGun(d.g,(df,du,dr)=>[d.x+fw[0]*df+rt[0]*dr,y+du,d.z+fw[2]*df+rt[2]*dr],a,0,1.6);
   for(let k=0;k<8;k++){const b=k/8*6.283;part(d.x+Math.cos(b)*.45,d.y+.03,d.z+Math.sin(b)*.45,b,.1,.02,.04,d.g.col,0,2.5)}
   if(d.g.rarity>=2)part(d.x,d.y+1.6,d.z,0,.03,3.2,.03,d.g.col,0,1.4)}
  // health potions: a glowing red flask
  for(const q of potions){if(q.r&&!api.LOADED.includes(q.r))continue;const y=q.y+.35+Math.sin(t*2.5+q.x)*.05;
   part(q.x,y,q.z,t,.16,.2,.16,[1,.12,.15],0,2.4);part(q.x,y+.15,q.z,t,.06,.1,.06,[.8,.9,1],0,.5);part(q.x,y+.22,q.z,t,.07,.04,.07,[.45,.3,.15],0,0);
   for(let k=0;k<6;k++){const b=k/6*6.283+t;part(q.x+Math.cos(b)*.3,q.y+.03,q.z+Math.sin(b)*.3,b,.07,.02,.03,[1,.2,.25],0,2)}}
  // the helicopter and its helipad
  if(heli){const h=heli,fw=[h.fx,0,h.fz],rt=[h.fz,0,-h.fx],at=(f,u,r)=>[h.x+fw[0]*f+rt[0]*r,h.y+u,h.z+fw[2]*f+rt[2]*r],yaw=Math.atan2(-fw[0],-fw[2]),BODY=[.15,.3,.2],DK=[.05,.05,.06];
   if(!flyT||h.y<.5)for(let k=0;k<24;k++){const b=k/24*6.283;part(heli.x+Math.cos(b)*6,.03,heli.z+Math.sin(b)*6,b,.9,.03,.15,[1,.85,.2],0,1.2)}
   part(...at(0,1.3,0),yaw,2.2,1.9,4.2,BODY,0,0,43);part(...at(1.7,1.45,0),yaw,1.9,1.3,1.2,[.12,.18,.25],0,.3);part(...at(-3.8,1.75,0),yaw,.35,.4,3.8,BODY,0,0,43);
   part(...at(-5.6,2.4,0),yaw,.12,1.2,.7,BODY,0,0,43);for(const s of[-1,1]){part(...at(0,.1,s*1.05),yaw,.1,.1,4,DK,0,0);part(...at(.9,.45,s*1.05),yaw,.08,.7,.08,DK,0,0);part(...at(-.9,.45,s*1.05),yaw,.08,.7,.08,DK,0,0)}
   part(...at(0,2.35,0),yaw,.25,.35,.25,DK,0,0);const spin=t*(flyT?30:6);for(const k of[0,1.5708])part(...at(0,2.55,0),spin+k,.25,.04,11,DK,0,0);
   part(...at(-5.6,2.6,.2),yaw,.05,1.4,.12,DK,spin,0);part(...at(-5.9,1.9,0),yaw,.12,.12,.12,[1,.1,.1],0,4);part(...at(2.2,.9,0),yaw,.2,.15,.1,[1,1,.9],0,5)}
  fxB.set(fData.subarray(0,nF*16))}

 // for automated tests: nearest live zombie and counts
 const debug=()=>{const a=zombiesNear([P.x,0,P.z],500).map(p=>({x:p.x,y:p.y,z:p.z,hp:p.zs.hp,st:p.zs.st,d:Math.hypot(p.x-P.x,p.z-P.z)})).sort((p,q)=>p.d-q.d);
  let limbs=0,crawl=0;for(const r of api.LOADED)for(const p of r.P){if(p.limb)limbs++;if(p.zs&&p.zs.crawl&&isZ(p))crawl++}
  return{alive:a.length,limbs,crawl,near:a[0],health,gun:gun().name,guns:inv.length,drops:drops.length,potions:potions.length,shots,hits:hitsN,nums:nums.length}};
 // for automated tests: give yourself a gun of a type and rarity (?zgun=flamer etc. does it at the start)
 const give=(type,rarity=2)=>{inv.push(makeGun(R,{type,rarity}));ci=inv.length-1};if(QSZ.get('zgun'))give(QSZ.get('zgun'),+(QSZ.get('zrar')||2));
 if(QSZ.get('zab')){const g=gun();g.abil=QSZ.get('zab').split(',');applyAbilities(g)}
 showHud(true);banner('Zombie Mode','Fight your way through the mall to the Grand Exit',4);
 return{zoom:()=>zoomK,aim:v=>{aimM=v},padAim:v=>{aimP=v},sniper:isSniper,torch:()=>torchOn,toggleTorch,forgeOpen:()=>forgeOpen,gun,allies:allyCount,flying:()=>flyT>0,flyStep,debug,give,update,fxB,fire:v=>{firing=v},swap,select,setHud:showHud,
  // one speed: quick on your feet, no need to hold anything to run
  walk:5,run:5,jump:7.4}}
