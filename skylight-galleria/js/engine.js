/* ============================== ENGINE ============================== */
(async()=>{
const $=id=>document.getElementById(id),body=document.body,cv=$('c'),bar=$('b'),msg=$('s');
const QS=new URLSearchParams(location.search);
// game mode: '' (walk around) or 'zombies' (js/zombies.js); ZM is set once the world is built
let MODE=QS.get('mode')==='zombies'?'zombies':'';let ZM=null;
const coarse=matchMedia('(pointer:coarse)').matches;
// touch settings (menu): look speed, gyro aim, steer with the stick, left-handed layout
const TS={sens:1,gyro:false,steer:true,lefty:false,ink:false};try{Object.assign(TS,JSON.parse(localStorage.skyMallTouch||'{}'))}catch{}
const saveTS=()=>{try{localStorage.skyMallTouch=JSON.stringify(TS)}catch{}};
// phones (and small tablets) get their own fast path: Super low by default, a shorter view, half the crowd,
// smaller textures and a resolution that adjusts itself to hold the frame rate. ?phone=1 / ?phone=0 forces it.
const PHONE=QS.has('phone')?QS.get('phone')!=='0':coarse&&Math.min(screen.width,screen.height)<900,DKEY=PHONE?'skyMallDetailPhone':'skyMallDetail';
let detail=PHONE?-1:coarse?1:2;try{const d=localStorage[DKEY];if(d!=null)detail=+d}catch{}
const PH_DRAW=95,PH_FOG=.035;let phScale=Math.min(devicePixelRatio||1,1.5);const phMax=phScale;
if(QS.has('d'))detail=+QS.get('d');
// detail: -1 super low (flat shapes, one pass, no effects), 0 low, 1 medium, 2 high
const SCALE=[.5,.75,1],BLV=6,tick=()=>new Promise(r=>setTimeout(r,16));
const prog=v=>bar.style.transform=`scaleX(${v})`;
const fail=t=>{body.classList.add('e');msg.textContent=t};
if(!navigator.gpu)return fail('This mall needs WebGPU. Open it in the latest Chrome or Edge on desktop, or Chrome on Android.');
let adapter,device;
try{adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});device=await adapter.requestDevice()}catch(e){}
if(!device)return fail('WebGPU is turned off or unsupported on this device. Try the latest Chrome.');
device.lost.then(i=>{console.error('device lost',i.reason,i.message);if(i.reason!=='destroyed')fail('The graphics device was lost. Reload the page to re-enter.')});
device.addEventListener?.('uncapturederror',e=>console.error('WebGPU:',e.error.message));
// ?snap=N renders off-screen and exposes frame N as a PNG (used for automated screenshots)
const SNAP=QS.has('snap'),SK=new Set((QS.get('skip')||'').split(',')),ctx=SNAP?null:cv.getContext('webgpu'),fmt=SNAP?'rgba8unorm':navigator.gpu.getPreferredCanvasFormat();if(!SNAP)ctx.configure({device,format:fmt,alphaMode:'opaque'});
const GU=GPUBufferUsage,TU=GPUTextureUsage,TB=TU.TEXTURE_BINDING,RA=TU.RENDER_ATTACHMENT,CD=TU.COPY_DST;

// photographs: sky + fifteen scanned materials, fetched while the mall is built
const NMAT=25,FILES=['sky.jpg',...[...Array(NMAT).keys()].map(i=>`m${i}_a.jpg`),...[...Array(NMAT).keys()].map(i=>`m${i}_n.jpg`)];
let loaded=0;const IMG=n=>fetch('assets/'+n).then(r=>{if(!r.ok)throw Error(n);return r.blob()}).then(b=>createImageBitmap(b,{colorSpaceConversion:'none'})).then(b=>{prog(.05+.3*(++loaded/FILES.length));return b});
const assetP=Promise.all(FILES.map(IMG));
const MODEL_FILES=[...Array(MODELS.layers).keys()].flatMap(i=>[`../models/tex/L${i}_a.webp`,`../models/tex/L${i}_n.jpg`]);
const modelP=Promise.all([fetch('models/geometry.bin').then(r=>{if(!r.ok)throw Error('models/geometry.bin');return r.arrayBuffer()}),...MODEL_FILES.map(IMG)]);modelP.catch(()=>{});
assetP.catch(()=>{});
prog(.05);await tick();
// choose the game before the mall is built (the photos keep downloading meanwhile); ?mode=mall / ?mode=zombies skips this
if(!QS.has('mode')&&!SNAP){MODE=await new Promise(res=>{let last='';try{last=localStorage.skyMallMode||''}catch{}
 const box=document.createElement('div');box.id='pick';box.innerHTML='<p style="margin:.2em 0 .6em;letter-spacing:.12em;text-transform:uppercase;font-size:.8em;color:#ffb3d6">Choose how to play</p><button data-m="">Explore the mall</button><button data-m="zombies">Zombie Mode</button><p style="font-size:.7em;opacity:.7;margin-top:.8em">Click or tap · arrows + Enter · d-pad + A</p>';
 $('l').prepend(box);const B=[...box.querySelectorAll('button')];let i=last==='zombies'?1:0,prev=[];
 const hi=()=>B.forEach((b,j)=>b.classList.toggle('padsel',j===i));hi();
 const done=m=>{clearInterval(iv);removeEventListener('keydown',kd);box.remove();try{localStorage.skyMallMode=m}catch{}res(m)};
 B.forEach(b=>b.onclick=()=>done(b.dataset.m));
 const kd=e=>{if(/Arrow(Up|Left)/.test(e.code)){i=0;hi()}else if(/Arrow(Down|Right)/.test(e.code)){i=1;hi()}else if(e.code==='Enter'||e.code==='Space')done(B[i].dataset.m);else if(e.code==='Digit1')done('');else if(e.code==='Digit2')done('zombies')};addEventListener('keydown',kd);
 const iv=setInterval(()=>{const gp=[...(navigator.getGamepads?.()||[])].find(g=>g&&g.connected);if(!gp)return;const b=gp.buttons.map(x=>x.pressed),ax=gp.axes[1]||0,ax0=gp.axes[0]||0;
  if((b[12]||b[14]||ax<-.5||ax0<-.5)&&i!==0){i=0;hi()}if((b[13]||b[15]||ax>.5||ax0>.5)&&i!==1){i=1;hi()}if(b[0]&&!prev[0])done(B[i].dataset.m);prev=b},60)})}
msg.textContent=MODE?'Raising the dead…':'Opening the doors…';

const WORLD=genWorld(),HUB=WORLD.hub();msg.textContent='Stocking '+HUB.stores+' stores…';await tick();
const buf=(data,usage)=>{const b=device.createBuffer({size:Math.max(16,data.byteLength+3&~3),usage:usage|GU.COPY_DST});device.queue.writeBuffer(b,0,data);return b};
// a vertex buffer that grows when the world does
function gbuf(usage){return{b:null,cap:0,n:0,usage,set(data,stride=16){const need=Math.max(64,data.byteLength);if(need>this.cap){this.b?.destroy();this.cap=Math.ceil(need*1.3/256)*256;this.b=device.createBuffer({size:this.cap,usage:this.usage|GU.COPY_DST})}if(data.byteLength)device.queue.writeBuffer(this.b,0,data);this.n=data.length/stride}}}

// cube
const cv6=[],ci6=[];for(const n of[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){const u=n[0]?[0,1,0]:[1,0,0],v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]],b=cv6.length/6;
 for(const[a,c]of[[-1,-1],[1,-1],[1,1],[-1,1]])cv6.push(n[0]*.5+u[0]*a*.5+v[0]*c*.5,n[1]*.5+u[1]*a*.5+v[1]*c*.5,n[2]*.5+u[2]*a*.5+v[2]*c*.5,...n);ci6.push(b,b+1,b+2,b,b+2,b+3)}
const cubeVB=buf(new Float32Array(cv6),GU.VERTEX),cubeIB=buf(new Uint16Array([...ci6,0,0]),GU.INDEX);
// meshes for the free-orientation pipeline: boxes tagged with a part id (pos, normal, part); boxes may be rotated (x, then y)
function partMesh(parts){const v=[],ix=[];for(const[cx,cy,cz,sx,sy,sz,pid,rx=0,ry=0]of parts){const b=v.length/7,cr=Math.cos(rx),sr=Math.sin(rx),cy2=Math.cos(ry),sy2=Math.sin(ry);
  const R=(x,y,z)=>{const y1=y*cr-z*sr,z1=y*sr+z*cr;return[cy2*x+sy2*z1,y1,-sy2*x+cy2*z1]};
  for(let k=0;k<24;k++){const o=k*6,[px,py,pz]=R(cv6[o]*sx,cv6[o+1]*sy,cv6[o+2]*sz),[nx,ny,nz]=R(cv6[o+3],cv6[o+4],cv6[o+5]);v.push(cx+px,cy+py,cz+pz,nx,ny,nz,pid)}
  for(const i of ci6)ix.push(b+i)}
 const big=v.length/7>65535;return{vb:buf(new Float32Array(v),GU.VERTEX),ib:buf(big?new Uint32Array(ix):new Uint16Array(ix.length%2?[...ix,0]:ix),GU.INDEX),n:ix.length,fmt:big?'uint32':'uint16'}}
// smooth capsule-ish parts (centre, half-size, part id): a superellipsoid rounded along its long axis
function roundMesh(parts){const v=[],ix=[];for(const[cx,cy,cz,rx,ry,rz,pid,lo]of parts){const SEG=lo?7:10,RING=lo?5:8,b=v.length/7;
  for(let r=0;r<=RING;r++){const th=r/RING*Math.PI,sy=Math.cos(th),sr=Math.sin(th),k=Math.pow(sr,.45);
   for(let q=0;q<=SEG;q++){const ph=q/SEG*2*Math.PI,x=Math.cos(ph)*k,z=Math.sin(ph)*k,nx=x/rx,ny=sy/ry,nz=z/rz,nl=Math.hypot(nx,ny,nz)||1;
    v.push(cx+x*rx,cy+sy*ry,cz+z*rz,nx/nl,ny/nl,nz/nl,pid)}}
  for(let r=0;r<RING;r++)for(let q=0;q<SEG;q++){const a=b+r*(SEG+1)+q,c=a+SEG+1;ix.push(a,a+1,c,a+1,c+1,c)}}
 return{vb:buf(new Float32Array(v),GU.VERTEX),ib:(()=>{const u=v.length/7>65535?new Uint32Array(ix):new Uint16Array(ix.length%2?[...ix,0]:ix);return buf(u,GU.INDEX)})(),n:ix.length,fmt:v.length/7>65535?'uint32':'uint16'}}
const ringParts=(n,R,y,x,size,pid,axis)=>Array.from({length:n},(_,k)=>{const a=k/n*6.2832,l=2*Math.PI*R/n+.05;
 return axis==='x'?[x,R*Math.sin(a),R*Math.cos(a),size,size,l,pid,a+Math.PI/2,0]:[R*Math.cos(a),y,R*Math.sin(a),size,size,l,pid,0,-a]});
const MESH={unit:partMesh([[0,0,0,1,1,1,0]]),
 // a pointed leaf, folded along its midrib (drawn double-sided)
 leaf:{vb:buf(new Float32Array([0,0,.5,0,1,0,0,-.5,.25,0,-.3,.95,0,0,0,-.5,0,1,0,0,.5,.25,0,.3,.95,0,0,0,-.08,0,0,1,0,0]),GU.VERTEX),ib:buf(new Uint16Array([0,1,2,0,2,3,0,4,2,0,2,1]),GU.INDEX),n:12},
 person:roundMesh([[0,1.19,0,.19,.33,.12,0],[0,1.43,0,.21,.07,.13,0],[0,1.53,0,.05,.06,.05,1],[0,1.66,.005,.095,.122,.105,1],[0,1.615,.03,.075,.06,.075,1],
  [-.095,.47,0,.075,.46,.08,2],[.095,.47,0,.075,.46,.08,3],[-.235,1.16,0,.05,.3,.055,4],[.235,1.16,0,.05,.3,.055,5],[0,1.728,-.014,.102,.075,.112,6],
  [-.095,.045,.04,.06,.045,.13,2],[.095,.045,.04,.06,.045,.13,3],[0,.95,0,.185,.12,.115,7],
  [-.036,1.676,.091,.018,.011,.012,8,1],[.036,1.676,.091,.018,.011,.012,8,1],[-.036,1.676,.1,.0085,.0085,.005,9,1],[.036,1.676,.1,.0085,.0085,.005,9,1],
  [-.038,1.703,.094,.022,.0055,.01,6,1],[.038,1.703,.094,.022,.0055,.01,6,1],[0,1.652,.104,.011,.024,.017,1,1],[0,1.612,.094,.026,.0075,.01,10,1],
  [-.097,1.665,0,.012,.03,.022,1,1],[.097,1.665,0,.012,.03,.022,1,1],[0,1.6,-.055,.112,.16,.072,11],[0,1.6,.06,.085,.055,.05,12,1],
  // optional extras, shown or hidden per person in the shader: bags (13 right, 14 left), coat (15), hat (16), glasses (17), backpack (18), bun (19)
  [.272,.64,.01,.035,.15,.12,13],[-.272,.64,.01,.035,.15,.12,14],[0,.74,0,.205,.2,.125,15],[0,1.795,-.01,.1,.04,.11,16],[0,1.765,.075,.1,.008,.065,16,1],
  [0,1.683,.101,.062,.009,.004,17,1],[0,1.22,-.118,.14,.2,.06,18],[0,1.735,-.105,.045,.045,.045,19]]),
 bird:partMesh([[0,0,0,.09,.07,.3,0],[0,.03,.17,.06,.06,.08,0],[-.21,0,0,.34,.015,.15,1],[.21,0,0,.34,.015,.15,2],[0,0,-.2,.1,.01,.1,0]]),
 // rides
 ferris:partMesh([...ringParts(40,14,0,-.9,.28,2,'x'),...ringParts(40,14,0,.9,.28,2,'x'),...ringParts(40,14.25,0,-.9,.12,1,'x'),...ringParts(40,14.25,0,.9,.12,1,'x'),
  ...Array.from({length:16},(_,k)=>{const a=k/16*6.2832;return[[-.9,7*Math.sin(a),7*Math.cos(a),.14,.14,14,2,-a,0],[.9,7*Math.sin(a),7*Math.cos(a),.14,.14,14,2,-a,0]]}).flat(),[0,0,0,2.4,.7,.7,2]]),
 gondola:partMesh([[0,-1.5,0,1.5,1.3,1.5,0],[0,-.75,0,1.7,.15,1.7,1],[0,-.4,0,.12,.8,.12,2],[0,-2.2,0,1.55,.12,1.55,0]]),
 carousel:partMesh([...ringParts(28,6.6,.35,0,.35,2,'y'),...Array.from({length:12},(_,k)=>[0,.32,0,13,.1,1.2,0,0,k/12*Math.PI]),...ringParts(28,6.8,4.6,0,.3,1,'y'),
  ...Array.from({length:16},(_,k)=>[Math.cos(k/16*6.2832)*3.4,4.9+.9,Math.sin(k/16*6.2832)*3.4,.35,.08,7.2,0,-.3,-k/16*6.2832+Math.PI/2]),[0,3,0,1.2,6,1.2,2],
  ...Array.from({length:20},(_,k)=>{const a=k/20*6.2832,R=k%2?4.2:5.6;return[R*Math.cos(a),2.6,R*Math.sin(a),.06,4.2,.06,2]})]),
 horse:partMesh([[0,0,0,.34,.42,1.1,0],[0,.45,.55,.24,.55,.3,0,-.5,0],[0,.68,.82,.2,.22,.42,0],[-.1,-.45,.4,.08,.5,.08,0],[.1,-.45,.4,.08,.5,.08,0],[-.1,-.45,-.4,.08,.5,.08,0],[.1,-.45,-.4,.08,.5,.08,0],[0,.3,0,.38,.12,.5,1]]),
 car:partMesh([[0,.35,0,1.3,.7,2.2,0],[0,.75,-.4,1.2,.3,.25,2],[0,.75,.6,1.2,.3,.25,2],[-.35,.95,0,.22,.22,.22,1],[.35,.95,0,.22,.22,.22,1]]),
 drop:partMesh([...ringParts(16,1.8,0,0,.5,0,'y'),...ringParts(16,1.85,.5,0,.12,1,'y'),...Array.from({length:12},(_,k)=>{const a=k/12*6.2832;return[2.2*Math.cos(a),.2,2.2*Math.sin(a),.5,.8,.5,0]})]),
 tube:partMesh(ringParts(12,.6,0,0,.26,0,'y')),
 jelly:roundMesh([[0,0,0,.28,.18,.28,1],[0,-.25,0,.05,.35,.05,1],[.12,-.3,0,.03,.3,.03,1],[-.12,-.3,0,.03,.3,.03,1],[0,-.3,.12,.03,.3,.03,1]]),
 fish:roundMesh([[0,0,0,.07,.11,.26,0],[0,0,-.27,.015,.1,.09,1],[0,.09,-.02,.01,.06,.1,0],[.05,.03,.17,.02,.02,.02,2,1],[-.05,.03,.17,.02,.02,.02,2,1]])};
MESH.mermaid=roundMesh([[0,.05,.95,.11,.13,.12,3],[0,.09,.86,.14,.13,.2,4],[0,.06,.55,.12,.06,.38,4],[0,0,.82,.05,.05,.06,3],[0,0,.5,.17,.12,.28,3],[0,-.06,.6,.16,.07,.08,5],
  [-.21,0,.6,.05,.05,.3,3],[.21,0,.6,.05,.05,.3,3],[0,0,.15,.16,.11,.22,0],[0,0,-.25,.12,.09,.26,0],[0,0,-.55,.08,.06,.2,1],[0,0,-.8,.26,.02,.15,1]]);
MESH.narwhal=roundMesh([[0,0,0,.45,.42,1.4,0],[0,.02,1.25,.36,.33,.4,0],[0,.06,2.25,.03,.03,.95,2],[-.42,-.15,.7,.26,.04,.15,0],[.42,-.15,.7,.26,.04,.15,0],[0,0,-1.45,.18,.15,.35,1],[0,0,-1.78,.52,.04,.2,1],[.2,.12,1.45,.04,.04,.04,2,1],[-.2,.12,1.45,.04,.04,.04,2,1]]);
MESH.turtle=roundMesh([[0,0,0,.45,.18,.55,0],[0,-.05,0,.42,.08,.5,5],[0,0,.62,.12,.1,.16,3],[-.45,-.05,.25,.35,.03,.15,1],[.45,-.05,.25,.35,.03,.15,1],[-.3,-.05,-.4,.15,.03,.1,3],[.3,-.05,-.4,.15,.03,.1,3]]);
MESH.manta=roundMesh([[0,0,0,1.25,.07,.75,0],[-1,0,-.1,.5,.04,.4,1],[1,0,-.1,.5,.04,.4,1],[0,0,-1,.03,.03,.7,0],[0,-.04,.6,.4,.03,.15,2]]);
const RIDEKIND=['ferris','gondola','carousel','horse','car','drop','tube','jelly','fish','mermaid','narwhal','turtle','manta'];

/* ---------- regions: the hub plus districts that stream in and out ---------- */
const PR=rng(4242),rn=(a,b)=>a+(b-a)*PR(),pk=a=>a[Math.floor(PR()*a.length)];
const SHIRTS=[[0,.65,.45],[210,.55,.4],[120,.35,.35],[45,.8,.55],[0,0,.92],[0,0,.08],[330,.5,.6],[190,.6,.45],[25,.6,.5],[270,.35,.45],[160,.3,.6],[0,0,.55]];
const SWIM=[[200,.8,.5],[350,.8,.5],[50,.9,.55],[160,.7,.45]];
const shirt=(pal=SHIRTS)=>{const[h,s0,l]=pk(pal);return hsl(h+rn(-12,12),Math.min(1,s0*rn(.8,1.2)),Math.min(.95,l*rn(.85,1.15)))};
function person(list,x,y,z,yaw,pose,speed,pal){const kid=PR()<.08,h=kid?rn(.55,.7):rn(.9,1.08);
 const p={x,y,z,yaw,ty:yaw,pose,speed,base:speed,s:[rn(.9,1.08)*(kid?.85:1),h,rn(.95,1.05)],c:shirt(pal),ph:PR(),off:0,wait:0,turn:rn(3,12)};list.push(p);return p}
const invXd=(q,x,z)=>q===0?[x,z]:q===1?[-z,x]:q===2?[-x,-z]:[z,-x];
const XD=(q,x,z)=>q===0?[x,z]:q===1?[z,-x]:q===2?[-x,-z]:[-z,x];
function prepRegion(r){
 if(r.theme==='hub'){r.bb=[-150,150,-85,85]}
 else{const c=[[-60,0],[60,0],[-60,140],[60,140]].map(([x,z])=>{const[a,b]=XD(r.xf.q,x,z);return[a+r.xf.ox,b+r.xf.oz]});
  r.bb=[Math.min(...c.map(v=>v[0])),Math.max(...c.map(v=>v[0])),Math.min(...c.map(v=>v[1])),Math.max(...c.map(v=>v[1]))]}
 r.doors.forEach(d=>d.link=null);r.loadedOnce=true;
 r.slides=(r.slides||[]).map(p=>{const L=[0];for(let i=1;i<p.length;i++)L.push(L[i-1]+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1],p[i][2]-p[i-1][2]));return{p,L}});
 buildCrowd(r);if(PHONE&&r.P.length>12)r.P=r.P.filter((_,i)=>i%2===0);return r}
// crowd for a region: a walking map (nodes + links), wanderers, diners/seated, shoppers in stores, staff
function buildCrowd(r){const N=[],P=[];r.N=N;r.P=P;
 const nd=(x,y,z)=>{for(let i=N.length-1;i>=0;i--){const n=N[i];if(Math.abs(n.x-x)<.3&&n.y===y&&Math.abs(n.z-z)<.3)return i}N.push({x,y,z,nb:[],shop:null});return N.length-1};
 const lk=(a,b,esc=0)=>{if(a===b||N[a].nb.some(e=>e.to===b))return;N[a].nb.push({to:b,esc});N[b].nb.push({to:a,esc})};
 const chain=(pts,y)=>{let pr=-1;for(const[x,z]of pts){const i=nd(x,y,z);if(pr>=0)lk(pr,i);pr=i}};
 if(r.theme==='hub'){const BRG=[-88,-40,40,88],rng4=(lo,hi,extra)=>{const st=new Set();for(let x=lo;x<=hi+.01;x+=4)st.add(+x.toFixed(2));for(const x of extra)if(x>=lo&&x<=hi)st.add(x);return[...st].sort((a,b)=>a-b)};
for(const sd of[-1,1]){
 chain(rng4(-116,116,[-62.5,-57.5,57.5,62.5,-8.75,8.75,-1.75,1.75,...BRG.flatMap(b=>[b-14,b+14])]).map(x=>[x,4.9*sd]),0);
 for(const s2 of[-1,1]){chain(rng4(16.5,118,[57.5,62.5,40,88]).map(x=>[x*s2,5*sd]),6);lk(nd(16.5*s2,6,5*sd),nd(14*s2,6,5*sd))}
 chain([-24,-21,-16,-10,-5,0,5,10,16,21,24].map(z=>[14*sd,z]),6);chain([-14,-9,-4,0,4,9,14].map(x=>[x,24*sd]),6);chain([-14,-9,-4,0,4,9,14].map(x=>[x,5*sd]),6);
 chain([[8.75*sd,4.9],[8.75*sd,0],[8.75*sd,-4.9]],0);
 for(const wx of[-60,60])for(const y of[0,6]){const zl=y?5:4.9,zs=[17,21,25,26,29,33,37,41,45,49,53];
  for(const o of[-2.5,2.5])chain([[wx+o,zl*sd],...zs.map(z=>[wx+o,z*sd])],y);
  for(const z of[26,53])lk(nd(wx-2.5,y,z*sd),nd(wx+2.5,y,z*sd));
  // loop corridor round to the department store's side door, then out its front
  const sx=Math.sign(wx),cx=[64,68,76,84,92,100,108,116,124,126].map(x=>[x*sx,54*sd]);
  chain([[wx+2.5*sx,53*sd],...cx,...[45,37,29,21,19,12,6.2].map(z=>[125*sx,z*sd]),[119*sx,6.2*sd]],y);
  lk(nd(119*sx,y,6.2*sd),nd((y?118:116)*sx,y,zl*sd))}}
// into the gate halls at both ends: along the ground floor, and down the wide stairs from the upper walkway
for(const sx of[-1,1])for(const sd of[-1,1]){chain([[116*sx,4.9*sd],[124*sx,5.5*sd],[136*sx,5.5*sd],[141*sx,1.5*sd]],0);
 lk(nd(119*sx,6,6.2*sd),nd(125.6*sx,6,1.6*sd));lk(nd(125.6*sx,6,1.6*sd),nd(135*sx,0,1.6*sd));lk(nd(135*sx,0,1.6*sd),nd(141*sx,0,1.5*sd))}
for(const e of r.ESC){const b=nd(e.bx,0,e.z),t=nd(e.tx,6,e.z);lk(b,t,1);
 if(Math.abs(e.z)>1){const sd=Math.sign(e.z);chain([[e.bx,e.z],[e.sx*1.9,8.6*sd],[e.sx*1.75,4.9*sd]],0);lk(t,nd(14*e.sx,6,e.z))}
 else{const br=BRG.reduce((a,b)=>Math.abs(b-e.tx)<Math.abs(a-e.tx)?b:a);for(const sd of[-1,1])lk(b,nd(br-14*e.sx,0,4.9*sd));const m=nd(br,6,0);lk(t,m);for(const sd of[-1,1])lk(m,nd(br,6,5*sd))}}
}
 else{const base=N.length;for(const n of r.nav.n)N.push({x:n.x,y:n.y,z:n.z,nb:[],shop:null});for(const[a,b,e]of r.nav.l)lk(base+a,base+b,e)}
 const ROUTE=N.length;
 for(const sh of r.shops){if(sh.closed||sh.big||PR()<.25)continue;const[ix,iz]=sh.w(0,sh.D*.42),[fx,fz]=sh.w(0,-1.3);let best=-1,bd=7;
  for(let i=0;i<ROUTE;i++){const n=N[i];if(n.y!==sh.fy)continue;const d=Math.hypot(n.x-fx,n.z-fz);if(d<bd){bd=d;best=i}}
  if(best<0)continue;const f=nd(fx,sh.fy,fz),inn=nd(ix,sh.fy,iz);N[inn].shop=sh;lk(best,f);lk(f,inn)}
 const walkers=r.theme==='hub'?440:Math.min(140,Math.round(ROUTE*.7)),ice=r.theme==='rink',pal=r.theme==='waterpark'?SWIM:SHIRTS;
 for(let k=0;k<walkers&&ROUTE;k++){let a,tries=0;do{a=Math.floor(PR()*ROUTE)}while(!N[a].nb.length&&++tries<50);if(!N[a].nb.length)continue;const e=pk(N[a].nb);
  const n=N[a],p=person(P,n.x,n.y,n.z,0,0,ice?rn(2.2,3.4):rn(1,1.45),pal);p.g={from:a,to:e.to,esc:e.esc,t:PR()};p.off=rn(-.45,.45)}
 for(let k=0;k<r.seats.length;k+=4)if(PR()<(r.theme==='hub'?.45:.6))person(P,r.seats[k],r.seats[k+3],r.seats[k+1],r.seats[k+2],2,0,pal);
 for(let k=0;k<r.idle.length;k+=4)person(P,r.idle[k],r.idle[k+1],r.idle[k+2],r.idle[k+3],1,0,pal);
 // the rare Bigfoot walks a hidden loop
 if(r.bigfoot){const pts=r.bigfoot,first=N.length;for(const[x,z]of pts)N.push({x,y:0,z,nb:[],shop:null});for(let i=0;i<pts.length;i++)lk(first+i,first+(i+1)%pts.length);
  const b=person(P,pts[0][0],0,pts[0][1],0,0,.55);b.fur=true;b.c=[.11,.07,.045];b.s=[1.3,1.38,1.3];b.g={from:first,to:first+1,esc:0,t:0};b.off=0}
 for(const sh of r.shops){if(sh.closed)continue;const n=sh.big?Math.floor(rn(4,9)):Math.floor(rn(0,3.2));
  for(let k=0;k<n;k++){const[x,z]=sh.w(rn(-sh.hw+1.3,sh.hw-1.3),rn(1,sh.D*(sh.big?.8:.55)));person(P,x,sh.fy,z,rn(0,6.283),1,0)}
  if(sh.counter){const[x,z]=sh.w(0,sh.D-1.15);person(P,x,sh.fy,z,Math.atan2(-sh.nx,-sh.nz),1,0)}}}
prepRegion(HUB);
let LOADED=[HUB],CUR=HUB,PPL=[],dirty=true,districtCount=0;
const SPECIAL=['lot','exit'];let themed=0;
// the fixed order of the line of districts lives in js/route.js
const ORDER=ROUTE.filter(t=>WORLD.themes.includes(t)&&!SPECIAL.includes(t));
// districts come one after another in a straight line; after all of them, the grand exit (and nothing beyond it)
function spawnAt(from,door,theme){const n=districtCount++,th=theme||door.theme||(themed<ORDER.length?ORDER[themed]:'exit');const num=SPECIAL.includes(th)?0:++themed;
 const q=door.dz>.5?0:door.dx>.5?1:door.dz<-.5?2:3;
 const next=SPECIAL.includes(th)?'':themed<ORDER.length?TITLES[ORDER[themed]]:TITLES.exit;
 const r=prepRegion(WORLD.district(n,th,{q,ox:door.x,oz:door.z},{next,num,total:ORDER.length}));r.doors[0].link=from;door.link=r;r.num=num;LOADED.push(r);dirty=true;return r}
function enter(r){CUR=r;const keep=new Set([r,...r.doors.map(d=>d.link).filter(Boolean)]);
 for(const o of LOADED)if(!keep.has(o)){for(const d of o.doors)if(d.link&&keep.has(d.link)){/* forget the way back */}
  for(const k of keep)for(const d of k.doors)if(d.link===o)d.link=null}
 LOADED=LOADED.filter(o=>keep.has(o));dirty=true;regionChanged=true;showTitle(r)}
const inside=(r,x,z)=>x>=r.bb[0]&&x<=r.bb[1]&&z>=r.bb[2]&&z<=r.bb[3];
function regionAt(x,z){for(const r of LOADED)if(r!==HUB&&inside(r,x,z))return r;return LOADED.includes(HUB)&&inside(HUB,x,z)?HUB:null}
let regionChanged=true;
const SHOPS=()=>LOADED.flatMap(r=>r.shops);

/* ---------- world buffers, rebuilt whenever districts load or unload ---------- */
const instB=gbuf(GU.VERTEX),glassB=gbuf(GU.VERTEX),folB=gbuf(GU.VERTEX),leafB=gbuf(GU.VERTEX),dropB=gbuf(GU.VERTEX),birdB=gbuf(GU.VERTEX),pplB=gbuf(GU.VERTEX);
const rideB=Object.fromEntries(RIDEKIND.map(k=>[k,gbuf(GU.VERTEX)]));
// draw only what the camera can see. Static instances are grouped into 16 m cells when an area loads; each frame
// only cells inside the view are drawn. Shadows, sky light and reflections still use everything, so nothing looks different.
const CELL=16,NOCULL=QS.has('nocull');
function cellSort(data,bounds){const n=data.length/16,key=new Float64Array(n),bb=new Float32Array(n*7);
 for(let i=0;i<n;i++){const b=bounds(data,i*16);bb.set(b,i*7);key[i]=b[6]>CELL*.75?-1:(Math.floor(data[i*16]/CELL)+4096)*8192+Math.floor(data[i*16+2]/CELL)+4096}
 const ord=Array.from({length:n},(_,i)=>i).sort((a,b)=>key[a]-key[b]),out=new Float32Array(data.length),cells=[];let cur=null;
 ord.forEach((src,dst)=>{out.set(data.subarray(src*16,src*16+16),dst*16);const b=bb.subarray(src*7,src*7+7);
  if(!cur||cur.k!==key[src]){cur={k:key[src],first:dst,n:0,b:Array.from(b.subarray(0,6)),r:b[6]};cells.push(cur)}
  cur.n++;for(let j=0;j<3;j++){cur.b[j]=Math.min(cur.b[j],b[j]);cur.b[j+3]=Math.max(cur.b[j+3],b[j+3])}cur.r=Math.max(cur.r,b[6])});
 return{out,cells}}
const sphere=(x,y,z,r)=>[x-r,y-r,z-r,x+r,y+r,z+r,r];
const boxBounds=(d,o)=>sphere(d[o],d[o+1],d[o+2],.5*Math.hypot(d[o+4],d[o+5],d[o+6])+.05);
const FR=new Float32Array(24);
function setFrustum(m){const R=i=>[m[i],m[4+i],m[8+i],m[12+i]],r0=R(0),r1=R(1),r2=R(2),r3=R(3);
 [r3.map((v,k)=>v+r0[k]),r3.map((v,k)=>v-r0[k]),r3.map((v,k)=>v+r1[k]),r3.map((v,k)=>v-r1[k]),r2,r3.map((v,k)=>v-r2[k])].forEach((q,i)=>FR.set(q,i*4))}
function inView(b){if(NOCULL)return true;for(let i=0;i<24;i+=4){const a=FR[i],c=FR[i+1],d=FR[i+2];if(a*(a>0?b[3]:b[0])+c*(c>0?b[4]:b[1])+d*(d>0?b[5]:b[2])+FR[i+3]<0)return false}return true}
const DRAWN={tris:0};
function drawCells(p,cells,ni){let s=-1,e=-1;const far=PHONE&&detail<0;for(const c of cells){if(!inView(c.b))continue;if(far){const b=c.b,d=Math.hypot(Math.max(b[0]-P.x,0,P.x-b[3]),Math.max(b[2]-P.z,0,P.z-b[5]));if(d>PH_DRAW)continue;
   if(d>30&&c.r<20){const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw),dx=(b[0]+b[3])/2-P.x,dz=(b[2]+b[5])/2-P.z;if(Math.abs(dx*fz-dz*fx)>24)continue}}DRAWN.tris+=c.n*ni/3;if(c.first===e)e+=c.n;else{if(s>=0)p.drawIndexed(ni,e-s,0,0,s);s=c.first;e=c.first+c.n}}if(s>=0)p.drawIndexed(ni,e-s,0,0,s)}
let instCells=[],glassCells=[];
const cat=(key,fix)=>{const n=LOADED.reduce((s,r)=>s+(r[key]?.length||0),0),out=new Float32Array(n);let o=0;for(const r of LOADED){const a=r[key];if(!a)continue;out.set(a,o);if(fix)fix(out,o,a.length,r);o+=a.length}return out};
let lightBuf=null,gridBuf=null,LGRID=[0,0,6,1,1],sceneBG=null,pplData=new Float32Array(0),NP=0;
const LC=6,MAXL=32,STRIDE=33;
function buildLights(){const all=LOADED.flatMap(r=>r.lights);let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const r of LOADED){x0=Math.min(x0,r.bb[0]);x1=Math.max(x1,r.bb[1]);z0=Math.min(z0,r.bb[2]);z1=Math.max(z1,r.bb[3])}
 const LOX=Math.floor(x0)-6,LOZ=Math.floor(z0)-6,LCOLS=Math.ceil((x1-LOX)/LC)+2,LROWS=Math.ceil((z1-LOZ)/LC)+2,NC=LCOLS*LROWS;
 const lb=new Float32Array(Math.max(1,all.length)*8),lists=Array.from({length:2*NC},()=>[]);
 all.forEach((L,i)=>{lb.set([L.x,L.y,L.z,L.r,...L.c,L.f],i*8);const lv=L.both?[0,1]:[L.y>5.99?1:0];
  for(let gz=Math.max(0,Math.floor((L.z-L.r-LOZ)/LC));gz<=Math.min(LROWS-1,Math.floor((L.z+L.r-LOZ)/LC));gz++)
  for(let gx=Math.max(0,Math.floor((L.x-L.r-LOX)/LC));gx<=Math.min(LCOLS-1,Math.floor((L.x+L.r-LOX)/LC));gx++){
   const cx=LOX+gx*LC,cz=LOZ+gz*LC,dx=Math.max(cx-L.x,0,L.x-cx-LC),dz=Math.max(cz-L.z,0,L.z-cz-LC),d=dx*dx+dz*dz;if(d<L.r*L.r)for(const l of lv)lists[l*NC+gz*LCOLS+gx].push([d,i])}});
 const ga=new Uint32Array(2*NC*STRIDE);lists.forEach((a,k)=>{a.sort((p,q)=>p[0]-q[0]);const n=Math.min(MAXL,a.length);ga[k*STRIDE]=n;for(let j=0;j<n;j++)ga[k*STRIDE+1+j]=a[j][1]});
 lightBuf?.destroy();gridBuf?.destroy();lightBuf=buf(lb,GU.STORAGE);gridBuf=buf(ga,GU.STORAGE);LGRID=[LOX,LOZ,LC,LCOLS,LROWS];return all.length}
// sign atlas: every loaded region's shop names and signs
const AW=detail<=0?1024:2048,AH=AW*3,amips=Math.floor(Math.log2(AH))+1;
const atlas=device.createTexture({size:[AW,AH],format:'rgba8unorm',mipLevelCount:amips,usage:TB|CD|RA});
const atlasC=document.createElement('canvas');atlasC.width=AW;atlasC.height=AH;
// printed labels for packaged goods (js/labels.js), drawn once
const LBW=detail<=0?1024:2048,lmips=Math.floor(Math.log2(LBW))+1,lblT=device.createTexture({size:[LBW,LBW],format:'rgba8unorm-srgb',mipLevelCount:lmips,usage:TB|CD|RA});
{const lc=makeLabels(LBW);let prev=lc;for(let l=0;l<lmips;l++){const w=Math.max(1,LBW>>l);let src=lc;if(l){src=document.createElement('canvas');src.width=src.height=w;const g2=src.getContext('2d');g2.imageSmoothingQuality='high';g2.drawImage(prev,0,0,w,w)}
 device.queue.copyExternalImageToTexture({source:src},{texture:lblT,mipLevel:l},[w,w]);prev=src}}
function buildAtlas(){const g=atlasC.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,AW,AH);g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';
 const cw=AW/ACOLS,ch=AH/AROWS;let slot=0;
 for(const r of LOADED){r.signBase=slot;for(const n of r.names){if(slot>=NAMECAP)break;const x=(slot%ACOLS)*cw,y=Math.floor(slot/ACOLS)*ch;let s=ch*.62;g.font=n.font.replace('{s}',s+'px');
  const m=g.measureText(n.t).width;if(m>cw*.9){s*=cw*.9/m;g.font=n.font.replace('{s}',s+'px')}g.fillText(n.t,x+cw/2,y+ch*.53);slot++}}
 let prev=atlasC;for(let l=0;l<amips;l++){const w=Math.max(1,AW>>l),h=Math.max(1,AH>>l);let src=atlasC;
  if(l){src=document.createElement('canvas');src.width=w;src.height=h;const g2=src.getContext('2d');g2.imageSmoothingQuality='high';g2.drawImage(prev,0,0,w,h)}
  device.queue.copyExternalImageToTexture({source:src},{texture:atlas,mipLevel:l},[w,h]);prev=src}}
let NLIGHTS=0;
function rebuildWorld(){
 buildAtlas();
 {const ci=cellSort(cat('inst',(out,o,len,r)=>{for(let i=o+12;i<o+len;i+=16)if(out[i]>=0)out[i]=Math.min(NAMECAP-1,out[i]+r.signBase)}),boxBounds);instB.set(ci.out);instCells=ci.cells;
  const cg=cellSort(cat('glass'),boxBounds);glassB.set(cg.out);glassCells=cg.cells}
 folB.set(cat('fol'));leafB.set(cat('leaves'));dropB.set(cat('drops'));birdB.set(cat('birds'));
 for(const k of RIDEKIND)rideB[k].set(cat2(k));
 buildModels();
 PPL=LOADED.flatMap(r=>r.P);NP=PPL.length;pplData=new Float32Array(NP*16);pplB.set(pplData);
 NLIGHTS=buildLights();makeSceneBG();shadowPass();dirty=false}
const cat2=k=>{const n=LOADED.reduce((s,r)=>s+(r.rides?.[k]?.length||0),0),out=new Float32Array(n);let o=0;for(const r of LOADED){const a=r.rides?.[k];if(a){out.set(a,o);o+=a.length}}return out};

/* ---------- crowd stepping ---------- */
const angLerp=(a,b,k)=>{let d=(b-a+Math.PI)%(2*Math.PI);if(d<0)d+=2*Math.PI;return a+(d-Math.PI)*k};
// in zombie mode a person who is infected, down or fleeing (p.zs) is moved by js/zombies.js; everyone else keeps shopping
function stepPeople(dt,t){let i=0;for(const r of LOADED){const N=r.N;for(const p of r.P){
  if(PHONE&&Math.abs(p.x-P.x)+Math.abs(p.z-P.z)>70)continue;
  if(p.zs){if(p.zs.st==='gone')continue}
  else if(p.g){const g=p.g;let A=N[g.from],Bn=N[g.to];
   if(p.wait>0){p.wait-=dt;p.pose=1;p.speed=0;if(Bn.shop)p.ty=Math.atan2(Bn.shop.nx,Bn.shop.nz)+Math.sin(t*.3+p.ph*9)*.8;if(p.wait<=0)p.pose=0}
   else{const len=Math.max(.01,Math.hypot(Bn.x-A.x,Bn.y-A.y,Bn.z-A.z)),sp=g.esc?.6:p.base;p.speed+=(sp-p.speed)*Math.min(1,dt*3);p.pose=g.esc?1:0;
    g.t+=p.speed*dt/len;
    if(g.t>=1){if(Bn.shop)p.wait=rn(3,10);else if(!g.esc&&PR()<.04&&p.base<2)p.wait=rn(2,5);
     let opts=Bn.nb.filter(e=>e.to!==g.from);if(!opts.length)opts=Bn.nb;const plain=opts.filter(e=>!N[e.to].shop&&!N[e.to].nb.some(q=>N[q.to].shop));
     const e=(plain.length&&PR()<.8)?pk(plain):pk(opts);g.from=g.to;g.to=e.to;g.esc=e.esc;g.t=0;A=N[g.from];Bn=N[g.to]}}
   const k=Math.min(1,g.t),dx=Bn.x-A.x,dz=Bn.z-A.z,lh=Math.hypot(dx,dz)||1,o=g.esc||Bn.shop||A.shop?0:p.off;
   p.x=A.x+dx*k+dz/lh*o;p.z=A.z+dz*k-dx/lh*o;p.y=A.y+(Bn.y-A.y)*k+(g.esc?.2:0);
   if(!(p.wait>0))p.ty=Math.atan2(dx,dz);p.yaw=angLerp(p.yaw,p.ty,Math.min(1,dt*5))}
  else if(p.pose===1){p.turn-=dt;if(p.turn<0){p.turn=rn(3,12);p.ty=p.yaw+rn(-1.6,1.6)}p.yaw=angLerp(p.yaw,p.ty,Math.min(1,dt*2))}
  if(NOCULL||inView(sphere(p.x,p.y+1,p.z,1.4)))pplData.set([p.x,p.y,p.z,p.yaw,p.s[0],p.s[1],p.s[2],1,(p.zc||p.c)[0],(p.zc||p.c)[1],(p.zc||p.c)[2],p.ph,p.fur?1:0,p.limb||0,p.zs?p.zsp||0:p.g&&p.pose===0?Math.min(p.speed,1.6):0,p.pose],i++*16)}}
 pplB.n=i;if(i)device.queue.writeBuffer(pplB.b,0,pplData,0,i*16)}

// photo textures
let bms;try{bms=await assetP}catch(e){return fail('Could not load the photo textures ('+e.message+'). Check your connection and reload.')}
msg.textContent='Hanging the sky…';await tick();
async function texArray(list,format,TS){const TM=Math.log2(TS)+1,t=device.createTexture({size:[TS,TS,list.length],format,mipLevelCount:TM,usage:TB|CD|RA});
 for(let l=0;l<list.length;l++)for(let m=0;m<TM;m++){const s=Math.max(1,TS>>m),b=await createImageBitmap(list[l],{resizeWidth:s,resizeHeight:s,resizeQuality:'high'});
  device.queue.copyExternalImageToTexture({source:b},{texture:t,mipLevel:m,origin:[0,0,l]},[s,s]);b.close()}
 return t}
// surface photos: full size on High, half size otherwise (a quarter of the memory, for phones)
const MTS=PHONE?256:detail>=2?1024:512,albT=await texArray(bms.slice(1,1+NMAT),'rgba8unorm-srgb',MTS),nrT=await texArray(bms.slice(1+NMAT),'rgba8unorm',MTS);
// Poly Haven models and foliage cards
let mres;try{mres=await modelP}catch(e){return fail('Could not load the 3D models ('+e.message+'). Check your connection and reload.')}
const MS_=PHONE?128:detail===2?512:256,mAlbT=await texArray(mres.slice(1).filter((_,i)=>i%2===0),'rgba8unorm-srgb',MS_),mNrT=await texArray(mres.slice(1).filter((_,i)=>i%2===1),'rgba8unorm',MS_);
const mVB=buf(new Float32Array(mres[0],0,MODELS.vbytes/4),GU.VERTEX),mIB=buf(new Uint32Array(mres[0],MODELS.vbytes,MODELS.ibytes/4),GU.INDEX);
const skyBm=bms[0],skyTex=device.createTexture({size:[skyBm.width,skyBm.height],format:'rgba8unorm',usage:TB|CD|RA});
device.queue.copyExternalImageToTexture({source:skyBm},{texture:skyTex},[skyBm.width,skyBm.height]);
prog(.5);msg.textContent='Letting the daylight in…';await tick();

// sun: rotate the photographed sky so the sun shines along the concourse
const sunAz=20*Math.PI/180,beta=sunAz-Math.atan2(SKY.sunDir[2],SKY.sunDir[0]);
const SUN=[SKY.sunDir[0]*Math.cos(beta)-SKY.sunDir[2]*Math.sin(beta),SKY.sunDir[1],SKY.sunDir[0]*Math.sin(beta)+SKY.sunDir[2]*Math.cos(beta)];
const SKYSCALE=3.2,SUNSCALE=5.5;
// night: Milky Way core toward the west end, the full moon where the sun was (so its shadows line up)
const galAz=Math.PI,betaN=galAz-Math.atan2(SKY.galaxy[2],SKY.galaxy[0]),NGAIN=.55,MOONC=[.5,.62,.95].map(v=>v*1.3);
const BRIDGES=[-88,-40,40,88];let nightK=0,nightOverride=null;
const dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
// the sun's shadow map covers the region you are in (casters from everything loaded)
function lightMat(){const f=SUN.map(v=>-v);let r=[1-f[0]*f[0],-f[0]*f[1],-f[0]*f[2]];const rl=Math.hypot(...r);r=r.map(v=>v/rl);
 const uu=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
 const rec=CUR===HUB?[-124,124,0,21,-27,27]:[CUR.bb[0],CUR.bb[1],0,36,CUR.bb[2],CUR.bb[3]];
 let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;
 for(const x of[rec[0],rec[1]])for(const y of[rec[2],rec[3]])for(const z of[rec[4],rec[5]]){const p=[x,y,z],a=dot3(r,p),b=dot3(uu,p);x0=Math.min(x0,a);x1=Math.max(x1,a);y0=Math.min(y0,b);y1=Math.max(y1,b);z1=Math.max(z1,dot3(f,p))}
 for(const R of LOADED)for(const x of[R.bb[0],R.bb[1]])for(const y of[-1,40])for(const z of[R.bb[2],R.bb[3]])z0=Math.min(z0,dot3(f,[x,y,z]));
 z0-=1;z1+=1;const sx=2/(x1-x0),cx=(x1+x0)/2,sy=2/(y1-y0),cy=(y1+y0)/2,sz=1/(z1-z0);
 return[r[0]*sx,uu[0]*sy,f[0]*sz,0,r[1]*sx,uu[1]*sy,f[1]*sz,0,r[2]*sx,uu[2]*sy,f[2]*sz,0,-cx*sx,-cy*sy,-z0*sz,1]}

// uniforms
const ubuf=device.createBuffer({size:624,usage:GU.UNIFORM|GU.COPY_DST}),pbuf=device.createBuffer({size:16,usage:GU.UNIFORM|GU.COPY_DST});
const ub=new Float32Array(156);ub[152]=PHONE?1:0;
ub.set([0,0,6,1,1,1,ACOLS,AROWS,.0016,.05,.045,.042,...SUN,1,...SKY.sunE.map(v=>v*SUNSCALE),QS.has('vol')?+QS.get('vol'):.0022,-150,-1,-85,1,SKY.K,SKYSCALE,Math.cos(-beta),Math.sin(-beta)],68);
SKY.sh.forEach((c,i)=>ub.set(c,104+i*4));ub.set([1,0,0,0],144);

// shared sampling state
const lin=device.createSampler({magFilter:'linear',minFilter:'linear',mipmapFilter:'linear',maxAnisotropy:8,addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});
const clampS=device.createSampler({magFilter:'linear',minFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge',addressModeW:'clamp-to-edge'});
const rep=device.createSampler({magFilter:'linear',minFilter:'linear',mipmapFilter:'linear',maxAnisotropy:16,addressModeU:'repeat',addressModeV:'repeat'});
const cmpS=device.createSampler({compare:'less',magFilter:'linear',minFilter:'linear'});

// sky visibility and ambient occlusion, baked on the GPU for the region you are in
const visPipe=await device.createComputePipelineAsync({layout:'auto',compute:{module:device.createShaderModule({code:VIS_WGSL}),entryPoint:'main'}});
let visTex=device.createTexture({size:[1,1,1],dimension:'3d',format:'rgba8unorm',usage:TB|TU.STORAGE_BINDING});
function bakeVis(r){const g=r.gs,vx=Math.ceil(g.nx/2),vy=Math.ceil(g.ny/2),vz=Math.ceil(g.nz/2);
 const occ=device.createTexture({size:[g.nx,g.ny,g.nz],dimension:'3d',format:'r8uint',usage:TB|CD});
 device.queue.writeTexture({texture:occ},g.d,{bytesPerRow:g.nx,rowsPerImage:g.ny},[g.nx,g.ny,g.nz]);
 visTex.destroy();visTex=device.createTexture({size:[vx,vy,vz],dimension:'3d',format:'rgba8unorm',usage:TB|TU.STORAGE_BINDING});
 const rays=QS.has('rays')?[+QS.get('rays'),4]:[[10,20,32][Math.max(0,detail)],[8,12,16][Math.max(0,detail)]];
 const vb=buf(new Float32Array([rays[0],rays[1],r===HUB?1:0,0,g.x0,g.y0,g.z0,0,g.nx,g.ny,g.nz,0]),GU.UNIFORM);
 const e=device.createCommandEncoder(),c=e.beginComputePass();c.setPipeline(visPipe);
 c.setBindGroup(0,device.createBindGroup({layout:visPipe.getBindGroupLayout(0),entries:[{binding:0,resource:occ.createView()},{binding:1,resource:visTex.createView()},{binding:2,resource:{buffer:vb}}]}));
 c.dispatchWorkgroups(Math.ceil(vx/4),Math.ceil(vy/4),Math.ceil(vz/4));c.end();device.queue.submit([e.finish()]);device.queue.onSubmittedWorkDone().then(()=>{occ.destroy();vb.destroy()});
 const q=r.xf.q,a=q===0?1:q===2?-1:0,b=q===1?-1:q===3?1:0;ub.set([a,b,r.xf.ox,r.xf.oz],144);ub.set([g.x0,g.y0,g.z0,1],88)}
prog(.7);msg.textContent='Polishing the marble…';await tick();

const VBUF=[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'}]},
 {arrayStride:64,stepMode:'instance',attributes:[0,1,2,3].map(k=>({shaderLocation:2+k,offset:k*16,format:'float32x4'}))}];
const VSF=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,FSS=GPUShaderStage.FRAGMENT;
const BGL=device.createBindGroupLayout({entries:[
 {binding:0,visibility:VSF,buffer:{type:'uniform'}},{binding:1,visibility:FSS,buffer:{type:'read-only-storage'}},{binding:2,visibility:FSS,buffer:{type:'read-only-storage'}},
 {binding:3,visibility:FSS,texture:{}},{binding:4,visibility:FSS,sampler:{}},{binding:5,visibility:FSS,texture:{viewDimension:'2d-array'}},{binding:6,visibility:FSS,texture:{viewDimension:'2d-array'}},
 {binding:7,visibility:FSS,texture:{sampleType:'depth'}},{binding:8,visibility:FSS,sampler:{type:'comparison'}},{binding:9,visibility:FSS,texture:{viewDimension:'3d'}},
 {binding:10,visibility:FSS,texture:{}},{binding:11,visibility:FSS,sampler:{}},{binding:12,visibility:FSS,texture:{viewDimension:'2d-array'}},{binding:13,visibility:FSS,texture:{viewDimension:'2d-array'}},{binding:14,visibility:FSS,texture:{}}]});
const PL=device.createPipelineLayout({bindGroupLayouts:[BGL]});
const sceneMod=device.createShaderModule({code:SCENE_WGSL}),shMod=device.createShaderModule({code:SHADOW_WGSL});
const TG=[{format:'rgba16float'},{format:'rgba16float'},{format:'rgba8unorm'}],MS={count:4};
const[scenePipe,skyPipe,glassPipe,shPipe]=await Promise.all([
 device.createRenderPipelineAsync({layout:PL,vertex:{module:sceneMod,entryPoint:'vs',buffers:VBUF},fragment:{module:sceneMod,entryPoint:'fs',targets:TG},
  primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'},multisample:MS}),
 device.createRenderPipelineAsync({layout:PL,vertex:{module:sceneMod,entryPoint:'vsSky'},fragment:{module:sceneMod,entryPoint:'fsSky',targets:TG},
  primitive:{topology:'triangle-list'},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'less-equal'},multisample:MS}),
 device.createRenderPipelineAsync({layout:PL,vertex:{module:sceneMod,entryPoint:'vs',buffers:VBUF},fragment:{module:sceneMod,entryPoint:'fsGlass',targets:[
  {format:'rgba16float',blend:{color:{srcFactor:'one',dstFactor:'src-alpha',operation:'add'},alpha:{srcFactor:'zero',dstFactor:'one',operation:'add'}}},{format:'rgba16float',writeMask:0},{format:'rgba8unorm',writeMask:0}]},
  primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'less'},multisample:MS}),
 device.createRenderPipelineAsync({layout:'auto',vertex:{module:shMod,entryPoint:'vs',buffers:VBUF},primitive:{topology:'triangle-list',cullMode:'none'},
  depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less',depthBias:3,depthBiasSlopeScale:3}})]);
const VBUF2=[{arrayStride:28,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32'}]},
 {arrayStride:64,stepMode:'instance',attributes:[0,1,2,3].map(k=>({shaderLocation:3+k,offset:k*16,format:'float32x4'}))}];
// model vertices are packed in 16 bytes (tools/build_lods.mjs): position+layer float16x4, normal snorm8x4, uv float16x2
const VBUF3=[{arrayStride:16,attributes:[{shaderLocation:0,offset:0,format:'float16x4'},{shaderLocation:1,offset:8,format:'snorm8x4'},{shaderLocation:2,offset:12,format:'float16x2'}]},
 {arrayStride:64,stepMode:'instance',attributes:[0,1,2,3].map(k=>({shaderLocation:4+k,offset:k*16,format:'float32x4'}))}];
const[modelPipe,modelShPipe]=await Promise.all([
 device.createRenderPipelineAsync({layout:PL,vertex:{module:sceneMod,entryPoint:'vsModel',buffers:VBUF3},fragment:{module:sceneMod,entryPoint:'fsModel',targets:TG},
  primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'},multisample:MS}),
 device.createRenderPipelineAsync({layout:'auto',vertex:{module:shMod,entryPoint:'vsModelA',buffers:VBUF3},fragment:{module:shMod,entryPoint:'fsModelA',targets:[]},primitive:{topology:'triangle-list',cullMode:'none'},
  depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less',depthBias:3,depthBiasSlopeScale:3}})]);
// every model's instances live in one buffer, in runs per model
const modelB=gbuf(GU.VERTEX);let MRUNS=[];
function buildModels(){const names=new Set();for(const r of LOADED)for(const k in r.models||{})names.add(k);
 let total=0;const runs=[];for(const k of names){const n=LOADED.reduce((s,r)=>s+(r.models?.[k]?.length||0),0)/16;if(n&&MODELS.models[k]){runs.push({k,m:MODELS.models[k],first:total,n,card:k.startsWith('card_')});total+=n}}
 const out=new Float32Array(total*16);for(const R of runs){const part=new Float32Array(R.n*16);let o=0;for(const r of LOADED){const a=R.k&&r.models?.[R.k];if(a){part.set(a,o);o+=a.length}}
  const b=R.m.bb,ext=Math.hypot(Math.max(-b[0],b[3]),Math.max(-b[1],b[4]),Math.max(-b[2],b[5]));
  const cs=cellSort(part,(d,o)=>sphere(d[o],d[o+1],d[o+2],ext*Math.max(d[o+4],d[o+5],d[o+6])+.4));out.set(cs.out,R.first*16);R.cells=cs.cells;for(const c of R.cells)c.first+=R.first;
  R.lv=[{i0:R.m.i0,in:R.m.in},...(R.m.lod||[])]}
 modelB.set(out);MRUNS=runs}
// how far away each lighter version takes over, in multiples of the object's size (it is then too small for the difference to show)
const LODK=[26,100];
const drawModels=(p,shadow)=>{if(!modelB.n)return;p.setVertexBuffer(0,mVB);p.setVertexBuffer(1,modelB.b);p.setIndexBuffer(mIB,'uint32');
 if(shadow){for(const R of MRUNS)p.drawIndexed(R.m.in,R.n,R.m.i0,R.m.v0,R.first);return}
 for(const R of MRUNS){let s=-1,e=-1,L=null;const flush=()=>{if(s>=0){p.drawIndexed(L.in,e-s,L.i0,R.m.v0,s);DRAWN.tris+=(e-s)*L.in/3}};
  for(const c of R.cells){if(!inView(c.b))continue;const b=c.b,dx=Math.max(b[0]-P.x,0,P.x-b[3]),dy=Math.max(b[1]-P.y,0,P.y-b[4]),dz=Math.max(b[2]-P.z,0,P.z-b[5]),d=Math.hypot(dx,dy,dz),S=2*c.r;
   const lv=R.lv[NOCULL?0:Math.min(R.lv.length-1,d<S*LODK[0]?0:d<S*LODK[1]?1:2)];
   if(lv===L&&c.first===e)e+=c.n;else{flush();L=lv;s=c.first;e=c.first+c.n}}flush()}};
const[dynPipe,dynShPipe]=await Promise.all([
 device.createRenderPipelineAsync({layout:PL,vertex:{module:sceneMod,entryPoint:'vsDyn',buffers:VBUF2},fragment:{module:sceneMod,entryPoint:'fs',targets:TG},
  primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'},multisample:MS}),
 device.createRenderPipelineAsync({layout:shPipe.getBindGroupLayout?'auto':'auto',vertex:{module:shMod,entryPoint:'vsDyn',buffers:VBUF2},primitive:{topology:'triangle-list',cullMode:'none'},
  depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less',depthBias:3,depthBiasSlopeScale:3}})]);
const lowPipe=(vs,buffers,cull)=>device.createRenderPipelineAsync({layout:PL,vertex:{module:sceneMod,entryPoint:vs,buffers},fragment:{module:sceneMod,entryPoint:'fsLow',targets:[{format:fmt}]},
 primitive:{topology:'triangle-list',cullMode:cull},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});
const[sceneLow,dynLow]=await Promise.all([lowPipe('vs',VBUF,'back'),lowPipe('vsDyn',VBUF2,'none')]);
// ink mode (Super low): the frame is drawn off screen, then turned black and white with black outlines wherever
// depth or brightness jumps (edges of shapes, people, shop fronts)
const INK_WGSL=`@group(0)@binding(0)var col:texture_2d<f32>;@group(0)@binding(1)var dep:texture_depth_2d;@group(0)@binding(2)var<uniform>k:vec4f;
@vertex fn vs(@builtin(vertex_index)i:u32)->@builtin(position)vec4f{return vec4f(f32(i32(i&1u)*4-1),f32(i32(i>>1u)*4-1),0.,1.);}
fn lin(p:vec2i)->f32{let d=textureLoad(dep,p,0);return k.y*k.z/(k.z-d*(k.z-k.y));}
fn lum(p:vec2i)->f32{return dot(textureLoad(col,p,0).rgb,vec3f(.299,.587,.114));}
@fragment fn fs(@builtin(position)fc:vec4f)->@location(0)vec4f{
 let mx=vec2i(textureDimensions(col))-1;let p=vec2i(fc.xy);let s=i32(k.x);let c=lin(p);let l0=lum(p);var e=0.;var el=0.;
 for(var j=0;j<4;j++){let o=select(select(vec2i(0,s),vec2i(0,-s),j==3),select(vec2i(s,0),vec2i(-s,0),j==1),j<2);let q=clamp(p+o,vec2i(0),mx);
  let d=lin(q);e=max(e,abs(d-c)/max(min(d,c),.05));el=max(el,abs(lum(q)-l0));}
 var edge=max(smoothstep(.03,.07,e),smoothstep(.06,.14,el))*(1.-smoothstep(60.,95.,c));
 let t=smoothstep(.12,.8,l0);var g=mix(.16,1.,floor(t*4.+.5)/4.*.75+t*.25);g=mix(g,1.,smoothstep(35.,95.,c));if(textureLoad(dep,p,0)>=.99999){g=1.;}
 return vec4f(vec3f(g*(1.-edge))*vec3f(1.,.985,.95),1.);}`;
const inkPipe=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:device.createShaderModule({code:INK_WGSL}),entryPoint:'vs'},fragment:{module:device.createShaderModule({code:INK_WGSL}),entryPoint:'fs',targets:[{format:fmt}]},primitive:{topology:'triangle-list'}}),inkU=device.createBuffer({size:16,usage:GU.UNIFORM|GU.COPY_DST});
const inkOn=()=>QS.has('ink')?QS.get('ink')!=='0':coarse&&TS.ink;
const drawDyn=(p,mesh,g)=>{if(!g.n)return;p.setVertexBuffer(0,mesh.vb);p.setIndexBuffer(mesh.ib,mesh.fmt||'uint16');p.setVertexBuffer(1,g.b);p.drawIndexed(mesh.n,g.n)};
const fsPipe=(code,ep,targets)=>{const m=device.createShaderModule({code});return device.createRenderPipelineAsync({layout:'auto',vertex:{module:m,entryPoint:'vs'},fragment:{module:m,entryPoint:ep,targets},primitive:{topology:'triangle-list'}})};
const ADD={color:{srcFactor:'one',dstFactor:'one',operation:'add'},alpha:{srcFactor:'one',dstFactor:'one',operation:'add'}},H16={format:'rgba16float'};
const[fxPipe,combPipe,down0Pipe,downPipe,upPipe,finalPipe]=await Promise.all([fsPipe(FX_WGSL,'fs',[H16,H16]),fsPipe(COMBINE_WGSL,'fs',[H16]),
 fsPipe(BLOOM_WGSL,'fsDown0',[H16]),fsPipe(BLOOM_WGSL,'fsDown',[H16]),fsPipe(BLOOM_WGSL,'fsUp',[{format:'rgba16float',blend:ADD}]),fsPipe(FINAL_WGSL,'fs',[{format:fmt}])]);


const SHW=detail>0?4096:2048,shTex=device.createTexture({size:[SHW,SHW/2],format:'depth32float',usage:TB|RA}),shV=shTex.createView();
const modelShBG=device.createBindGroup({layout:modelShPipe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ubuf}},{binding:1,resource:mAlbT.createView({dimension:'2d-array'})},{binding:2,resource:rep}]});
const shBG=device.createBindGroup({layout:shPipe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ubuf}}]}),dynShBG=device.createBindGroup({layout:dynShPipe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ubuf}}]});
function shadowPass(){ub.set(lightMat(),48);if(SK.has('shadow'))return;device.queue.writeBuffer(ubuf,0,ub);const e=device.createCommandEncoder(),p=e.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:shV,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});
 p.setPipeline(shPipe);p.setBindGroup(0,shBG);p.setVertexBuffer(0,cubeVB);p.setVertexBuffer(1,instB.b);p.setIndexBuffer(cubeIB,'uint16');if(instB.n)p.drawIndexed(36,instB.n);
 p.setPipeline(dynShPipe);p.setBindGroup(0,dynShBG);drawDyn(p,MESH.unit,folB);drawDyn(p,MESH.leaf,leafB);p.setPipeline(modelShPipe);p.setBindGroup(0,modelShBG);drawModels(p,true);p.end();device.queue.submit([e.finish()])}
function makeSceneBG(){sceneBG=device.createBindGroup({layout:BGL,entries:[{binding:0,resource:{buffer:ubuf}},{binding:1,resource:{buffer:lightBuf}},{binding:2,resource:{buffer:gridBuf}},
 {binding:3,resource:atlas.createView()},{binding:4,resource:lin},{binding:5,resource:albT.createView({dimension:'2d-array'})},{binding:6,resource:nrT.createView({dimension:'2d-array'})},
 {binding:7,resource:shV},{binding:8,resource:cmpS},{binding:9,resource:visTex.createView()},{binding:10,resource:skyTex.createView()},{binding:11,resource:rep},{binding:12,resource:mAlbT.createView({dimension:'2d-array'})},{binding:13,resource:mNrT.createView({dimension:'2d-array'})},{binding:14,resource:lblT.createView()}]})}
const bg=(pipe,list)=>device.createBindGroup({layout:pipe.getBindGroupLayout(0),entries:list.map((r,i)=>({binding:i,resource:r}))});

let T=null;
function resize(){
 const low=detail<0,lim=device.limits.maxTextureDimension2D,k=low?(PHONE?phScale:Math.min(devicePixelRatio||1,2)):Math.min(devicePixelRatio||1,2)*SCALE[detail];
 const W=Math.min(lim,Math.max(16,Math.round(innerWidth*k))),H=Math.min(lim,Math.max(16,Math.round(innerHeight*k)));
 const ink=low&&inkOn();if(T&&T.W===W&&T.H===H&&T.low===low&&T.ink===ink)return;if(T)T.list.forEach(t=>t.destroy());
 if(low){cv.width=W;cv.height=H;const list=[],d=device.createTexture({size:[W,H],format:'depth24plus',usage:RA|TB});list.push(d);T={W,H,list,low,ink,depthV:d.createView()};
  if(ink){const c=device.createTexture({size:[W,H],format:fmt,usage:RA|TB});list.push(c);T.inkV=c.createView();T.inkBG=bg(inkPipe,[T.inkV,T.depthV,{buffer:inkU}]);device.queue.writeBuffer(inkU,0,new Float32Array([Math.max(1,Math.round(H/480)),.05,900,0]))}
  if(SNAP){T.snapTex=device.createTexture({size:[W,H],format:fmt,usage:RA|TU.COPY_SRC});list.push(T.snapTex)}return}
 cv.width=W;cv.height=H;const list=[],mk=(w,h,f,u,sc=1)=>{const t=device.createTexture({size:[w,h],format:f,usage:u,sampleCount:sc});list.push(t);return t.createView()};
 const hw=Math.max(1,W>>1),hh=Math.max(1,H>>1);
 const t={W,H,list,mC:mk(W,H,'rgba16float',RA,4),mG:mk(W,H,'rgba16float',RA,4),mA:mk(W,H,'rgba8unorm',RA,4),depthV:mk(W,H,'depth24plus',RA,4),
  hdrV:mk(W,H,'rgba16float',RA|TB),gbV:mk(W,H,'rgba16float',RA|TB),axV:mk(W,H,'rgba8unorm',RA|TB),fxR:mk(hw,hh,'rgba16float',RA|TB),fxV:mk(hw,hh,'rgba16float',RA|TB),litV:mk(W,H,'rgba16float',RA|TB)};
 const dv=[];let w=W,h=H;for(let i=0;i<BLV;i++){w=Math.max(1,w>>1);h=Math.max(1,h>>1);dv.push(mk(w,h,'rgba16float',RA|TB))}
 t.dv=dv;if(SNAP){t.snapTex=device.createTexture({size:[W,H],format:fmt,usage:RA|TU.COPY_SRC});list.push(t.snapTex)}
 t.fxBG=bg(fxPipe,[{buffer:ubuf},t.gbV,t.axV,t.hdrV,shV,cmpS,clampS,skyTex.createView(),rep]);
 t.combBG=bg(combPipe,[{buffer:ubuf},t.hdrV,t.gbV,t.axV,t.fxR,t.fxV,clampS]);
 t.downBG=dv.map((_,i)=>bg(i?downPipe:down0Pipe,[i?dv[i-1]:t.litV,clampS]));
 t.upBG=dv.map((_,i)=>i<BLV-1?bg(upPipe,[dv[i+1],clampS]):null);
 const DBG=QS.get('dbg');t.finalBG=bg(finalPipe,[DBG?{hdr:t.hdrV,fxr:t.fxR,fxv:t.fxV,gb:t.gbV,ax:t.axV}[DBG]:t.litV,dv[0],clampS,{buffer:pbuf},dv[BLV-1]]);
 T=t}
resize();addEventListener('resize',resize);



/* ---------- player ---------- */
// collision: ask every loaded region whose grid covers the point (in its own frame); outside them all is solid
const solid=(x,y,z)=>{let any=false;for(const r of LOADED){if(x<r.bb[0]-1.5||x>r.bb[1]+1.5||z<r.bb[2]-1.5||z>r.bb[3]+1.5)continue;
  const[lx,lz]=invXd(r.xf.q,x-r.xf.ox,z-r.xf.oz),g=r.gs,i=Math.floor((lx-g.x0)/GC),j=Math.floor((y-g.y0)/GC),k=Math.floor((lz-g.z0)/GC);
  if(i<0||k<0||i>=g.nx||k>=g.nz)continue;any=true;if(j<0)return 1;if(j>=g.ny)continue;if(g.d[i+g.nx*(j+g.ny*k)])return 1}
 return any?0:1};
const hit=(x,y,z)=>{if(y>40||y<.5)return true;for(const dy of[-.9,-.45,0,.25])for(const dx of[-.3,.3])for(const dz of[-.3,.3])if(solid(x+dx,y+dy,z+dz))return true;return false};
// first person on foot: gravity, step-up onto ramps and escalators, walls and railings block you. F toggles flying.
const EYE=1.65,STEP=.55;let fly=false,grounded=true,stepDist=0,bobPh=0;
const groundAt=(x,top,z)=>{for(let y=top;y>top-14;y-=.25){if(solid(x,y,z)){const r=regionAt(x,z)||CUR;return Math.floor((y-r.gs.y0)/GC)*GC+r.gs.y0+GC}}return -50};
const blocked=(x,feet,z)=>{for(const dy of[.65,1.1,1.6])for(const dx of[-.25,.25])for(const dz of[-.25,.25])if(solid(x+dx,feet+dy,z+dz))return true;return false};
const VIEWS=[[-30,1.7,-6,-Math.PI/2-.04,.04],[-1.75,1.7,-21,Math.PI,.32],[14,7.7,-19,Math.PI*.75,-.05],[-100,7.7,5,-Math.PI/2,.1],[60,1.7,19,Math.PI,0],[100,1.7,-4.5,-Math.PI/2,.04]];
const P={x:0,y:0,z:0,yaw:0,pitch:0,vx:0,vy:0,vz:0};window.__P=P;
const view=i=>{if(CUR!==HUB)backToHub();const v=VIEWS[i];P.x=v[0];P.y=v[1];P.z=v[2];P.yaw=v[3];P.pitch=v[4];P.vx=P.vy=P.vz=0;settle?.()};
function backToHub(){themed=0;for(const d of HUB.doors)d.link=null;LOADED=[HUB];CUR=null;dirty=true;
 P.x=-30;P.y=1.7;P.z=-6;P.yaw=-Math.PI/2-.04;P.pitch=.04;P.vx=P.vz=0;settle()}
// title card as you walk into a new district
let titleT=0;function showTitle(r){const el=$('t');if(!el)return;el.textContent=r===HUB?'Skylight Galleria':r.title+(r.num?'  ·  District '+r.num:'');el.classList.add('on');clearTimeout(titleT);titleT=setTimeout(()=>el.classList.remove('on'),3500)}
const keys=new Set(),ptrs=new Map();let primary=null,playing=false,stats=false,muted=false;
cv.addEventListener('contextmenu',e=>e.preventDefault());
// controls: mouse look (click to capture the pointer) and WASD; on phones hold to walk, drag to look, two fingers to run
const touchMode=coarse;let touches=0,lookId=null,moveId=null,joy0=null;const joyV={x:0,y:0},JR=58,pend={x:0,y:0};
// stop pinch-zoom, double-tap zoom and page scrolling while playing
document.addEventListener('gesturestart',e=>e.preventDefault());document.addEventListener('touchmove',e=>{if(playing)e.preventDefault()},{passive:false});
document.addEventListener('dblclick',e=>e.preventDefault());
// touch: a thumbstick appears wherever your left thumb lands (left side of the screen); the rest of the screen looks around
const gyroR={y:0,p:0};let gyroT=0;
addEventListener('devicemotion',e=>{const rr=e.rotationRate,now=performance.now(),dt=Math.min(.05,(now-gyroT)/1000);gyroT=now;if(!TS.gyro||!playing||!rr||rr.alpha==null)return;
 const D=Math.PI/180,a=rr.alpha*D,b=rr.beta*D,c=rr.gamma*D,ang=((screen.orientation&&screen.orientation.angle)??(window.orientation||0)+360)%360;
 let y,p;if(ang===90){y=b;p=c}else if(ang===270){y=-b;p=-c}else if(ang===180){y=-c;p=b}else{y=c;p=-b}gyroR.y+=y*dt;gyroR.p+=p*dt});
const askGyro=()=>{try{if(typeof DeviceMotionEvent!=='undefined'&&DeviceMotionEvent.requestPermission)DeviceMotionEvent.requestPermission().catch(()=>{})}catch{}};
const stickB=document.createElement('div'),stickK=document.createElement('div');
stickB.style.cssText=`position:fixed;z-index:5;width:${JR*2}px;height:${JR*2}px;margin:-${JR}px 0 0 -${JR}px;border-radius:50%;border:2px solid rgba(255,255,255,.45);background:rgba(0,0,0,.18);pointer-events:none;left:${JR+34}px;top:calc(100vh - ${JR+60}px);opacity:.45;display:none`;setTimeout(()=>stickHome(),0);
stickK.style.cssText='position:absolute;left:50%;top:50%;width:50px;height:50px;margin:-25px 0 0 -25px;border-radius:50%;background:rgba(255,255,255,.55);border:2px solid rgba(255,255,255,.8)';
stickB.appendChild(stickK);document.body.appendChild(stickB);
const stickHome=()=>{stickB.style.left=TS.lefty?`calc(100vw - ${JR+34}px)`:(JR+34)+'px';stickB.style.top=`calc(100vh - ${JR+60}px)`;stickB.style.opacity=.45;stickK.style.transform=''};
const look=(dx,dy,k)=>{P.yaw-=dx*k;P.pitch=Math.max(-1.45,Math.min(1.45,P.pitch-dy*k))};
const locked=()=>document.pointerLockElement===cv;
const lockMouse=()=>{try{const r=cv.requestPointerLock?.();if(r&&r.catch)r.catch(()=>{})}catch{}};
cv.addEventListener('pointerdown',e=>{if(!playing)return;try{cv.setPointerCapture(e.pointerId)}catch{}ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(e.pointerType==='touch'){if(moveId===null&&e.clientX>18&&e.clientX<innerWidth-18){moveId=e.pointerId;joy0={x:e.clientX,y:e.clientY,lx:e.clientX};return}
  touches++;if(lookId===null)lookId=e.pointerId;return}
 if(!locked())lockMouse()});
cv.addEventListener('pointermove',e=>{if(e.pointerId===moveId){const ax=v=>{const a=Math.abs(v),DZ=14;return a<DZ?0:Math.sign(v)*Math.min(1,(a-DZ)/(JR-DZ))};joyV.y=ax(e.clientY-joy0.y);
  if(TS.steer){pend.x+=e.clientX-joy0.lx;joy0.lx=e.clientX;joyV.x=0}else joyV.x=ax(e.clientX-joy0.x);return}
 if(e.pointerType!=='touch'&&locked())return;const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
 if(e.pointerType==='touch'&&e.pointerId!==lookId)return;if(e.pointerType==='touch'){pend.x+=dx;pend.y+=dy;return}look(dx,dy,.004)});
document.addEventListener('mousemove',e=>{if(playing&&locked())look(e.movementX||0,e.movementY||0,.0022*(ZM?1-ZM.zoom()*.65:1))});
document.addEventListener('mousedown',e=>{if(ZM&&playing&&locked()&&e.button===0)ZM.fire(true);if(ZM&&playing&&e.button===2)ZM.aim(true)});document.addEventListener('mouseup',e=>{if(ZM&&e.button===0)ZM.fire(false);if(ZM&&e.button===2)ZM.aim(false)});
addEventListener('wheel',e=>{if(ZM&&playing)ZM.swap(e.deltaY>0?1:-1)},{passive:true});
const up=e=>{if(e.pointerId===moveId){moveId=null;joyV.x=joyV.y=0;ptrs.delete(e.pointerId);stickHome();return}if(ptrs.delete(e.pointerId)&&e.pointerType==='touch')touches=Math.max(0,touches-1);if(e.pointerId===lookId){lookId=null;for(const[id]of ptrs){if(id!==moveId){lookId=id;break}}}};
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
const goFull=()=>{try{const d=document.documentElement,r=(d.requestFullscreen||d.webkitRequestFullscreen)?.call(d,{navigationUI:'hide'});if(r&&r.catch)r.catch(()=>{})}catch{}};
$('fs').onclick=()=>{if(document.fullscreenElement||document.webkitFullscreenElement){(document.exitFullscreen||document.webkitExitFullscreen)?.call(document)}else goFull()};
document.addEventListener('pointerlockchange',()=>{if(!locked()&&playing&&!(ZM&&ZM.forgeOpen()))pause()});
addEventListener('keydown',e=>{if(e.repeat)return;const c=e.code;
 if(c==='Escape'){if(ZM&&ZM.forgeOpen())return;playing?pause():body.classList.contains('r')&&play();return}
 if(!playing)return;keys.add(c);
 if(c==='KeyM')setMute(!muted);if(c==='KeyH'){stats=!stats;if(!stats)$('i').textContent=''}
 if(ZM&&/^Digit[1-7]$/.test(c))ZM.select(+c[5]-1);else if(/^Digit[1-6]$/.test(c))view(+c[5]-1);if(c==='KeyF'&&!ZM){fly=!fly;if(!fly)settle()}if(c==='KeyF'&&ZM)ZM.toggleTorch();if(c==='KeyR')backToHub();if(c==='KeyN')nightOverride=nightOverride===null?(nightK>.5?0:1):nightOverride?0:1});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();ptrs.clear();primary=null;touches=0;lookId=null;moveId=null;joyV.x=joyV.y=0;stickHome()});


function settle(){P.feet=P.y-EYE;const g=groundAt(P.x,P.feet+STEP,P.z);if(g>-50)P.feet=g;P.ey=P.feet+EYE;P.vy=0}
// water slides: walk into the top and ride to the splash pool
function rideStart(){for(const r of LOADED)for(const s of r.slides||[]){const a=s.p[0];if(Math.hypot(P.x-a[0],P.z-a[2])<1.2&&Math.abs(P.feet-a[1])<1.4){P.ride={s,d:0,v:3};return true}}return false}
// fair rides: stand on a boarding pad and the next seat carries you round (the same motion the shader draws).
// Look around freely; Space hops off early. Seat positions follow the ride formulas in shaders.js (dynXf, kind 7).
window.__boards=()=>LOADED.flatMap(r=>(r.boards||[]).map(b=>({x:b.x,z:b.z,mesh:b.mesh})));window.__carry=()=>P.carry&&{mesh:P.carry.b.mesh,end:P.carry.end};
const SEAT={gondola:-2.1,horse:.25,car:.4,tube:.1,drop:-.3};
function seatPos(r,mesh,i,tt){const a=r.rides[mesh],o=i*16,th=tt*a[o+12]+a[o+11]*6.2831853,bx=a[o+4],by=a[o+5],bz=a[o+6],dy=a[o+13];
 const off=dy<.5?[0,bx*Math.sin(th),bx*Math.cos(th)]:dy<1.5?[bx*Math.cos(th),by*Math.sin(a[o+14]*th+a[o+11]*3),bz*Math.sin(th)]:[0,by*(.5+.5*Math.sin(th)),0];
 const c=Math.cos(a[o+3]),s=Math.sin(a[o+3]);return[a[o]+c*off[0]+s*off[2],a[o+1]+off[1],a[o+2]-s*off[0]+c*off[2]]}
const rideClock=()=>(performance.now()/1000)%1000;
function boardCheck(){for(const r of LOADED)for(const b of r.boards||[]){if(Math.hypot(P.x-b.x,P.z-b.z)>b.r)continue;const a=r.rides?.[b.mesh];if(!a)continue;const tt=rideClock();let best=-1,bd=b.reach;
  for(let i=0;i<a.length/16;i++){if(b.dz!==undefined&&Math.abs(a[i*16+14]-b.dz)>.01)continue;const p=seatPos(r,b.mesh,i,tt);if(p[1]>b.top)continue;const d=b.near?Math.hypot(p[0]-P.x,p[2]-P.z):Math.hypot(p[0]-b.x,p[2]-b.z);if(d<bd){bd=d;best=i}}
  if(best<0)continue;const sp=Math.abs(a[best*16+12])||.1,lap=Math.min(90,2*Math.PI/sp);
  const p=seatPos(r,b.mesh,best,tt),side=b.mesh==='drop'?(()=>{const dx=P.x-p[0],dz=P.z-p[2],l=Math.hypot(dx,dz)||1;return[dx/l*2.3,dz/l*2.3]})():[0,0];
  P.carry={r,b,i:best,end:tt+lap*b.laps,side};return true}
 return false}
function carryStep(){const C=P.carry,tt=rideClock();if(tt>=C.end||tt<C.end-200||keys.has('Space')){P.x=C.b.out[0];P.z=C.b.out[1];P.y=EYE+1;P.carry=null;P.jumped=true;settle();return}
 const p=seatPos(C.r,C.b.mesh,C.i,tt);P.x=p[0]+C.side[0];P.z=p[2]+C.side[1];P.feet=p[1]+(SEAT[C.b.mesh]??0);P.ey=P.feet+1.05;P.y=P.ey;P.vx=P.vz=P.vy=0}
function rideStep(dt){const R=P.ride,s=R.s,p=s.p,L=s.L;let i=0;while(i<L.length-2&&L[i+1]<R.d)i++;
 const a=p[i],b=p[i+1],seg=Math.max(.01,L[i+1]-L[i]),k=Math.min(1,(R.d-L[i])/seg),slope=(a[1]-b[1])/seg;
 R.v=Math.max(3,Math.min(13,R.v+dt*(slope*14-.8)));R.d+=R.v*dt;
 P.x=a[0]+(b[0]-a[0])*k;P.z=a[2]+(b[2]-a[2])*k;P.feet=a[1]+(b[1]-a[1])*k+.05;P.ey=P.feet+1.05;P.y=P.ey;
 const ty=Math.atan2(-(b[0]-a[0]),-(b[2]-a[2]));P.yaw=angLerp(P.yaw,ty,Math.min(1,dt*6));P.pitch+=(-.35-P.pitch)*Math.min(1,dt*2);
 if(R.d>=L[L.length-1]){const dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;P.vx=dx/l*R.v*.5;P.vz=dz/l*R.v*.5;P.vy=2;grounded=false;P.ride=null}}
// game controllers (standard mapping): left stick or d-pad walks, right stick looks, A jumps / hops off a ride,
// RB, RT or a stick click runs, B flies down, Y toggles flying, X day and night, Back returns to the concourse, Start opens the menu
const PADKEYS={0:'Space',1:'KeyC',2:'KeyN',3:'KeyF',8:'KeyR'};let padPrev=[],padMove=[0,0],padRun=false;
const padKey=(type,code)=>dispatchEvent(new KeyboardEvent(type,{code,key:code}));
// the menu with a controller: d-pad or left stick moves between the buttons (left/right along the detail row), A presses
let menuSel=0,menuRep=0;
function menuPad(b,gp,dt){if(!body.classList.contains('r'))return;const rows=[[$('d')],[$('zm')],[...$('q').querySelectorAll('button')]];
 const ax=gp.axes[0]||0,ay=gp.axes[1]||0,up=b[12]||ay<-.5,down=b[13]||ay>.5,left=b[14]||ax<-.5,right=b[15]||ax>.5;
 let row=menuSel<1?0:menuSel<2?1:2,col=row<2?0:menuSel-2;menuRep-=dt;
 if((up||down||left||right)&&menuRep<=0){menuRep=.22;if(up)row=Math.max(0,row-1);if(down)row=Math.min(2,row+1);if(row===2){if(left)col=Math.max(0,col-1);if(right)col=Math.min(rows[2].length-1,col+1)}}
 else if(!(up||down||left||right))menuRep=0;
 if(row===2&&col===0&&menuSel<2)col=rows[2].findIndex(x=>x.classList.contains('on'));menuSel=row<2?row:2+Math.max(0,col);
 const el=row<2?rows[row][0]:rows[2][Math.max(0,col)];for(const r of rows)for(const x of r)x.classList.toggle('padsel',x===el);
 if(b[0]&&!padPrev[0])el.click()}
function readPad(dt){padMove=[0,0];padRun=false;const gp=[...(navigator.getGamepads?.()||[])].find(g=>g&&g.connected);if(!gp)return;
 const b=gp.buttons.map(x=>x.pressed||x.value>.5),dz=v=>Math.abs(v||0)<.15?0:(v-Math.sign(v)*.15)/.85,edge=i=>b[i]&&!padPrev[i];
 if(edge(9))padKey('keydown','Escape');
 if(!playing)menuPad(b,gp,dt);else for(const x of document.querySelectorAll('.padsel'))x.classList.remove('padsel');
 if(playing){for(const[i,c0]of Object.entries(PADKEYS)){const code=ZM&&i==='2'?'KeyE':ZM&&i==='3'?'':c0;if(!code)continue;if(edge(i))padKey('keydown',code);if(!b[i]&&padPrev[i])padKey('keyup',code)}
  const dp=!(ZM&&ZM.forgeOpen());padMove=[-dz(gp.axes[1])+(dp&&b[12]?1:0)-(dp&&b[13]?1:0),dz(gp.axes[0])+(dp&&b[15]?1:0)-(dp&&b[14]?1:0)];padRun=ZM?!!b[10]:!!(b[5]||b[7]||b[10]);if(ZM){const sn=ZM.sniper();ZM.fire(!ZM.forgeOpen()&&!!(b[7]||(!sn&&b[6])));ZM.padAim(sn&&!!(b[6]||b[5]));if(edge(4))ZM.swap(-1);if(edge(5)&&!sn)ZM.swap(1);if(edge(11))ZM.toggleTorch()}
  const zk=ZM?1-ZM.zoom()*.65:1;P.yaw-=dz(gp.axes[2])*2.6*dt*zk;P.pitch=Math.max(-1.45,Math.min(1.45,P.pitch-dz(gp.axes[3])*2*dt*zk))}
 padPrev=b}
function update(dt){
 readPad(dt);
 if(pend.x||pend.y){const a=Math.min(1,dt*30),dx=pend.x*a,dy=pend.y*a;pend.x-=dx;pend.y-=dy;if(Math.abs(pend.x)<.01)pend.x=0;if(Math.abs(pend.y)<.01)pend.y=0;look(dx,0,.006*TS.sens*(ZM?1-ZM.zoom()*.65:1))}
 if(touchMode&&playing&&!P.ride)P.pitch+=(0-P.pitch)*Math.min(1,dt*6);
 // steer with the stick: pushing it sideways slowly turns the view that way (while no finger is looking)
 if(gyroR.y||gyroR.p){const g=TS.sens*(ZM?1-ZM.zoom()*.5:1);P.yaw+=gyroR.y*g;P.pitch=touchMode?P.pitch:Math.max(-1.45,Math.min(1.45,P.pitch+gyroR.p*g));gyroR.y=gyroR.p=0}
 const k=c=>keys.has(c)?1:0,cy=Math.cos(P.yaw),sy=Math.sin(P.yaw),cp=Math.cos(P.pitch),sp=Math.sin(P.pitch);
 const fwd=[-sy*cp,sp,-cy*cp],rt=[cy,0,-sy];
 let f=0,s=0,vu=0,fast=keys.has('ShiftLeft')||keys.has('ShiftRight');
 if(playing){f=k('KeyW')+k('ArrowUp')-k('KeyS')-k('ArrowDown')-joyV.y;s=k('KeyD')+k('ArrowRight')-k('KeyA')-k('ArrowLeft')+(touchMode&&TS.steer?0:joyV.x);vu=k('KeyE')+k('Space')-k('KeyQ')-k('KeyC');if((touchMode&&TS.steer?Math.abs(joyV.y):Math.hypot(joyV.x,joyV.y))>.92)fast=true;f+=padMove[0];s+=padMove[1];if(padRun)fast=true}
 f=Math.max(-1,Math.min(1,f));s=Math.max(-1,Math.min(1,s));
 if(ZM&&ZM.flying()){ZM.flyStep(dt);const c2=Math.cos(P.yaw),s2=Math.sin(P.yaw),c3=Math.cos(P.pitch),s3=Math.sin(P.pitch);return{fwd:[-s2*c3,s3,-c2*c3]}}
 if(P.carry&&!fly){carryStep();const c2=Math.cos(P.yaw),s2=Math.sin(P.yaw),c3=Math.cos(P.pitch),s3=Math.sin(P.pitch);return{fwd:[-s2*c3,s3,-c2*c3]}}
 if(P.ride&&!fly){rideStep(dt);const c2=Math.cos(P.yaw),s2=Math.sin(P.yaw),c3=Math.cos(P.pitch),s3=Math.sin(P.pitch);return{fwd:[-s2*c3,s3,-c2*c3]}}
 if(fly){
  let wx=fwd[0]*f+rt[0]*s,wy=fwd[1]*f+vu,wz=fwd[2]*f+rt[2]*s;const l=Math.hypot(wx,wy,wz);
  const spd=fast?11:4.2;if(l>1){wx/=l;wy/=l;wz/=l}
  const a=Math.min(1,dt*(l?4:3));P.vx+=(wx*spd-P.vx)*a;P.vy+=(wy*spd-P.vy)*a;P.vz+=(wz*spd-P.vz)*a;
  const stuck=hit(P.x,P.y,P.z);
  const tryMove=(ax,v)=>{const n={x:P.x,y:P.y,z:P.z};n[ax]+=v*dt;if(stuck||!hit(n.x,n.y,n.z))P[ax]=n[ax];else P['v'+ax]*=-.1};
  tryMove('x',P.vx);tryMove('y',P.vy);tryMove('z',P.vz);P.feet=P.y-EYE;P.ey=P.y;
  return{fwd}}
 // walking: move along the floor, whatever the head's pitch
 const hx=-sy,hz=-cy;let wx=hx*f+rt[0]*s,wz=hz*f+rt[2]*s;const l=Math.hypot(wx,wz);if(l>1){wx/=l;wz/=l}
 const spd=ZM?(fast?ZM.run:ZM.walk):(fast?5.2:2.3),a=Math.min(1,dt*(l?6:8));P.vx+=(wx*spd-P.vx)*a;P.vz+=(wz*spd-P.vz)*a;
 const ox=P.x,oz=P.z,stuck=blocked(P.x,P.feet,P.z);
 for(const ax of['x','z']){const n={x:P.x,z:P.z};n[ax]+=P['v'+ax]*dt;
  const g=groundAt(n.x,P.feet+STEP,n.z);
  if(stuck||(!blocked(n.x,Math.max(P.feet,g),n.z)&&g>-50)){P.x=n.x;P.z=n.z}else P['v'+ax]=0}
 // gravity, landing, stepping up and down
 const g=groundAt(P.x,P.feet+STEP,P.z);
 if(grounded&&P.feet-g<STEP+.05&&P.feet-g>-STEP-.05){P.feet=g;P.vy=0}
 else{P.vy-=18*dt;P.feet+=P.vy*dt;if(P.feet<=g){P.feet=g;P.vy=0}}
 grounded=P.feet-g<.03;
 if(grounded&&playing&&rideStart())return{fwd};
 if(grounded&&playing&&boardCheck())return{fwd};
 if(grounded&&playing&&keys.has('Space')&&!P.jumped){P.vy=ZM?ZM.jump:5.4;P.feet+=.02;grounded=false;P.jumped=true}if(!keys.has('Space'))P.jumped=false;
 // eye height eases over steps; a light bob while walking
 const moved=Math.hypot(P.x-ox,P.z-oz);if(grounded){bobPh+=moved*Math.PI/.75;stepDist+=moved}
 const target=P.feet+EYE+Math.sin(bobPh)*.025*Math.min(1,moved/dt/2);
 P.ey+=(target-P.ey)*Math.min(1,dt*(grounded?14:30));P.y=P.ey;
 return{fwd}}


/* ---------- audio: muzak, shop music, district backgrounds ---------- */
let actx=null,master=null,muzG=null,noiseBuf=null,ambG=null,ambNext=0,ambStep=0;const SPK=[];
// each district's own background sound (all synthesised, no voices). muz: how loud the mall music stays;
// the rest are events per second, or a tune. No constant hiss of any kind.
const AMB={hub:{muz:.3},dept:{muz:.3},market:{},aquarium:{},arboretum:{},
 forest:{},rink:{tune:'waltz'},cinema:{muz:.08,bleep:2.2},amusement:{tune:'organ',bleep:.5},
 waterpark:{},lot:{},exit:{}};
const ORGAN=[72,76,79,84,83,79,76,79,74,77,81,86,84,81,77,74,72,76,79,84,86,84,81,79,77,76,74,71,72,0,0,0],WALTZ=[[48,64,67,72],[43,62,65,71],[45,64,69,72],[43,62,67,71]];
function amb(kind,t0){const o=actx.createOscillator(),g=actx.createGain();g.connect(ambG);
 if(kind==='chirp'){o.type='sine';const f=2400+Math.random()*1800,n=2+Math.floor(Math.random()*3);for(let k=0;k<n;k++){const t=t0+k*.11;o.frequency.setValueAtTime(f,t);o.frequency.linearRampToValueAtTime(f*1.35,t+.06);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.025,t+.01);g.gain.linearRampToValueAtTime(0,t+.07)}o.connect(g);o.start(t0);o.stop(t0+n*.11+.1);return}
 if(kind==='bleep'){o.type='square';o.frequency.value=[523,659,784,1047,1319,880][Math.floor(Math.random()*6)];g.gain.setValueAtTime(.014,t0);g.gain.exponentialRampToValueAtTime(.001,t0+.09);o.connect(g);o.start(t0);o.stop(t0+.1);return}
}
function ambTick(now){const A=AMB[CUR?CUR.theme:'hub']||{};muzG.gain.setTargetAtTime(A.muz??0,now,1.5);
 if(ambNext<now)ambNext=now;
 while(ambNext<now+.4){const t0=ambNext;for(const k of['chirp','bleep'])if(A[k]&&Math.random()<A[k]*.125)amb(k,t0+Math.random()*.12);
  if(A.tune==='organ'&&ambStep%2===0){const m=ORGAN[(ambStep/2)%ORGAN.length];if(m){tone(ambG,mf(m),t0,.22,.03,'square');tone(ambG,mf(m-12),t0,.22,.02,'triangle')}if(ambStep%8===0)tone(ambG,mf(48+(ambStep%32?7:0)),t0,.3,.04,'triangle')}
  if(A.tune==='waltz'&&ambStep%3===0){const beat=(ambStep/3)%3,ch=WALTZ[Math.floor(ambStep/9)%4];if(beat===0)tone(ambG,mf(ch[0]),t0,.5,.05,'triangle');else for(const m of ch.slice(1))tone(ambG,mf(m),t0,.3,.016,'sine')}
  ambStep++;ambNext+=.125}}
const STY={apparel:{bpm:122,w:'sawtooth',cut:900,kick:1,hat:1,bass:1,arp:0,pad:1},shoes:{bpm:120,w:'sawtooth',cut:1100,kick:1,hat:1,bass:1},
 sports:{bpm:128,w:'sawtooth',cut:1600,kick:1,hat:1,bass:1,arp:1},tech:{bpm:110,w:'square',cut:1500,kick:1,arp:1,pad:1},arcade:{bpm:142,w:'square',cut:3500,arp:1,lead:1,hat:1},
 toys:{bpm:132,w:'square',cut:2600,lead:1,kick:1},candy:{bpm:126,w:'triangle',cut:3000,lead:1,kick:1,hat:1},books:{bpm:70,w:'sine',cut:2000,pad:1,arp:1,soft:1},
 jewelry:{bpm:78,w:'triangle',cut:1800,pad:1,soft:1,bass:1},home:{bpm:92,w:'triangle',cut:2400,arp:1,soft:1},music:{bpm:116,w:'sawtooth',cut:2200,kick:1,hat:1,bass:1,power:1},
 beauty:{bpm:84,w:'triangle',cut:1300,pad:1,kick:1,soft:1},food:{bpm:104,w:'triangle',cut:3200,arp:1,kick:1,bass:1},pets:{bpm:100,w:'triangle',cut:2800,arp:1,lead:1}};
const PROGS=[[[57,60,64],[53,57,60],[60,64,67],[55,59,62]],[[60,64,67],[57,60,64],[62,65,69],[55,59,62]],[[62,65,69],[58,62,65],[60,64,67],[57,61,64]],[[64,67,71],[60,64,67],[62,65,69],[59,62,66]]];
const mf=m=>440*2**((m-69)/12);
function tone(dest,f,t0,dur,vol,type,att=.01){const o=actx.createOscillator(),g=actx.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(vol,t0+att);g.gain.setTargetAtTime(0,t0+dur*.6,dur*.25);o.connect(g);g.connect(dest);o.start(t0);o.stop(t0+dur*2+.1)}
function kick(dest,t0,v){const o=actx.createOscillator(),g=actx.createGain();o.frequency.setValueAtTime(140,t0);o.frequency.exponentialRampToValueAtTime(42,t0+.12);g.gain.setValueAtTime(v,t0);g.gain.exponentialRampToValueAtTime(.001,t0+.25);o.connect(g);g.connect(dest);o.start(t0);o.stop(t0+.3)}
function hat(dest,t0,v){const s=actx.createBufferSource(),f=actx.createBiquadFilter(),g=actx.createGain();s.buffer=noiseBuf;f.type='highpass';f.frequency.value=7000;g.gain.setValueAtTime(v,t0);g.gain.exponentialRampToValueAtTime(.001,t0+.05);s.connect(f);f.connect(g);g.connect(dest);s.start(t0,Math.random());s.stop(t0+.07)}
function playStep(sp){const st=sp.st,t0=sp.next,i=sp.step%16,bar=Math.floor(sp.step/16),ch=sp.prog[bar%4],d=sp.dest,beat=60/st.bpm;
 if(st.kick&&(st.soft?(i===0||i===10):i%4===0))kick(d,t0,st.soft?.35:.55);
 if(st.hat&&i%4===2)hat(d,t0,.12);
 if(st.bass&&(i===0||i===6||i===8||i===14))tone(d,mf(ch[0]-24),t0,beat*.45,.22,'triangle');
 if(st.pad&&i===0)for(const m of ch)tone(d,mf(m),t0,beat*4,.05,st.w,.25);
 if(st.power&&i%8===0)for(const m of[ch[0]-12,ch[0]-5,ch[0]])tone(d,mf(m),t0,beat*1.8,.06,'sawtooth');
 if(st.arp&&i%2===0)tone(d,mf(ch[(i/2)%3]+12+(i%8===6?12:0)),t0,beat*.4,.07,st.w);
 if(st.lead&&i%2===0&&Math.random()<.6)tone(d,mf(ch[Math.floor(Math.random()*3)]+24),t0,beat*.35,.05,'square');
 sp.step++;sp.next+=beat/4}
const panner=(x,y,z,ref,roll)=>{const p=actx.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=ref;p.maxDistance=80;p.rolloffFactor=roll;
 if(p.positionX){p.positionX.value=x;p.positionY.value=y;p.positionZ.value=z}else p.setPosition(x,y,z);return p};
function startAudio(){if(actx){actx.resume();return}try{actx=new(window.AudioContext||window.webkitAudioContext)()}catch{return}
 const comp=actx.createDynamicsCompressor();master=actx.createGain();master.gain.value=muted?0:.9;master.connect(comp);comp.connect(actx.destination);
 noiseBuf=actx.createBuffer(1,actx.sampleRate*2,actx.sampleRate);{const nd=noiseBuf.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1}
 // background muzak
 muzG=actx.createGain();muzG.gain.value=.3;muzG.connect(master);
 ambG=actx.createGain();ambG.gain.value=1;ambG.connect(master);
 const lp=actx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1700;
 const dl=actx.createDelay(1),fb=actx.createGain(),wet=actx.createGain();dl.delayTime.value=.37;fb.gain.value=.4;wet.gain.value=.35;
 lp.connect(muzG);lp.connect(dl);dl.connect(fb);fb.connect(dl);dl.connect(wet);wet.connect(muzG);
 const CH=[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,65]];let ci=0,next=actx.currentTime+.2;
 const note=(m,t0,dur,vol,type)=>{const o=actx.createOscillator(),g=actx.createGain();o.type=type;o.frequency.value=mf(m);g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(vol,t0+.35);g.gain.setTargetAtTime(0,t0+dur-.5,.3);o.connect(g);g.connect(lp);o.start(t0);o.stop(t0+dur+1.5)};
 // crowd murmur, loudness follows how many people are near you
 // three shop speakers that follow the nearest open shops
 for(let k=0;k<3;k++){const g=actx.createGain(),f=actx.createBiquadFilter(),pn=panner(0,-100,0,2.5,1.6);g.gain.value=0;f.type='lowpass';f.connect(g);g.connect(pn);pn.connect(master);SPK.push({g,f,pn,dest:f,shop:null,st:null,step:0,next:0,prog:null})}
 setInterval(()=>{if(!actx||actx.state!=='running')return;const now=actx.currentTime;
  while(next<now+1){const c=CH[ci++%4];c.forEach(m=>note(m,next,4.2,.03,'triangle'));note(c[0]-12,next,4.2,.05,'sine');
   for(let q=0;q<4;q++)if(Math.random()<.55)note(c[Math.floor(Math.random()*4)]+12,next+q+Math.random()*.2,.9,.03,'sine');next+=4}
  for(const sp of SPK)if(sp.shop){if(sp.next<now)sp.next=now+.05;while(sp.next<now+.25)playStep(sp)}
  ambTick(now)},60)}
function setMute(v){muted=v;if(master)master.gain.setTargetAtTime(v?0:.9,actx.currentTime,.1)}
let audT=0;
function audioFrame(fwd){if(!actx||actx.state!=='running')return;const L=actx.listener,now=actx.currentTime;
 if(L.positionX){L.positionX.value=P.x;L.positionY.value=P.y;L.positionZ.value=P.z;L.forwardX.value=fwd[0];L.forwardY.value=fwd[1];L.forwardZ.value=fwd[2];L.upX.value=0;L.upY.value=1;L.upZ.value=0}
 else{L.setPosition(P.x,P.y,P.z);L.setOrientation(fwd[0],fwd[1],fwd[2],0,1,0)}
 if(now-audT<.25)return;audT=now;
 const near=SHOPS().filter(s=>!s.closed&&Math.abs(s.fy+1.7-P.y)<3).map(s=>[Math.hypot(s.x-P.x,s.z-P.z),s]).filter(a=>a[0]<16).sort((a,b)=>a[0]-b[0]).slice(0,3).map(a=>a[1]);
 muzG.gain.setTargetAtTime(near.length?.12:.3,now,1);
 for(const sp of SPK)if(sp.shop&&!near.includes(sp.shop)){sp.g.gain.setTargetAtTime(0,now,.25);sp.shop=null}
 for(const sh of near)if(!SPK.some(sp=>sp.shop===sh)){const sp=SPK.find(q=>!q.shop);if(!sp)break;
  const[x,z]=sh.w(0,1.5),pn=sp.pn;if(pn.positionX){pn.positionX.value=x;pn.positionY.value=sh.fy+3;pn.positionZ.value=z}else pn.setPosition(x,sh.fy+3,z);
  sp.shop=sh;sp.st=STY[sh.key]||STY.apparel;sp.prog=PROGS[(sh.name.length+sh.key.length)%4];sp.step=0;sp.next=now+.1;sp.f.frequency.value=sp.st.cut*(sh.big?.8:1);
  sp.g.gain.cancelScheduledValues(now);sp.g.gain.setValueAtTime(0,now);sp.g.gain.setTargetAtTime(sh.big?.5:.8,now+.1,.4)}}


/* ---------- menu ---------- */
// detail buttons: Super low, Low, Medium, High (detail -1 to 2)
const qb=[...$('q').querySelectorAll('button')];
if(touchMode){const tq=$('tq');tq.style.display='';const B=[...tq.querySelectorAll('button')];
 const draw=()=>{$('tsv').textContent=TS.sens.toFixed(1)+'×';B[2].textContent='Gyro '+(TS.gyro?'on':'off');B[3].textContent='Swipe '+(TS.steer?'turns':'strafes');B[4].textContent='Left hand '+(TS.lefty?'on':'off');B[5].textContent='Ink '+(TS.ink?'on':'off');B[6].textContent='FPS '+(stats?'on':'off');B[6].classList.toggle('on2',stats);
  B.slice(2).forEach((b,i)=>b.classList.toggle('on2',[TS.gyro,TS.steer,TS.lefty,TS.ink][i]))};B[6].onclick=()=>{stats=!stats;if(!stats)$('i').textContent='';draw()};B[5].onclick=()=>{TS.ink=!TS.ink;if(TS.ink&&detail>=0)setDetail(-1);saveTS();draw();resize()};
 B[0].onclick=()=>{TS.sens=Math.max(.4,+(TS.sens-.1).toFixed(1));saveTS();draw()};B[1].onclick=()=>{TS.sens=Math.min(2.5,+(TS.sens+.1).toFixed(1));saveTS();draw()};
 B[2].onclick=()=>{TS.gyro=!TS.gyro;if(TS.gyro)askGyro();saveTS();draw()};B[3].onclick=()=>{TS.steer=!TS.steer;saveTS();draw()};
 B[4].onclick=()=>{TS.lefty=!TS.lefty;saveTS();location.reload()};draw()}
const setDetail=d=>{if(detail<0&&d>=0)regionChanged=true;detail=d;qb.forEach((b,i)=>b.classList.toggle('on',i-1===d));try{localStorage[DKEY]=d}catch{}resize()};setDetail(detail);
qb.forEach((b,i)=>b.onclick=()=>setDetail(i-1));
function play(){playing=true;body.classList.add('g');startAudio();if(touchMode)goFull();else lockMouse();cv.focus?.()}
function pause(){playing=false;body.classList.remove('g');keys.clear();ptrs.clear();primary=null;touches=0;lookId=null;moveId=null;joyV.x=joyV.y=0;stickHome();stickB.style.display='none';if(locked())document.exitPointerLock()}
$('d').onclick=play;$('o').onclick=pause;


/* ---------- render loop ---------- */
function inv4(m){const a=m,r=new Array(16);
 const b00=a[0]*a[5]-a[1]*a[4],b01=a[0]*a[6]-a[2]*a[4],b02=a[0]*a[7]-a[3]*a[4],b03=a[1]*a[6]-a[2]*a[5],b04=a[1]*a[7]-a[3]*a[5],b05=a[2]*a[7]-a[3]*a[6],
  b06=a[8]*a[13]-a[9]*a[12],b07=a[8]*a[14]-a[10]*a[12],b08=a[8]*a[15]-a[11]*a[12],b09=a[9]*a[14]-a[10]*a[13],b10=a[9]*a[15]-a[11]*a[13],b11=a[10]*a[15]-a[11]*a[14];
 const d=1/(b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06);
 r[0]=(a[5]*b11-a[6]*b10+a[7]*b09)*d;r[1]=(a[2]*b10-a[1]*b11-a[3]*b09)*d;r[2]=(a[13]*b05-a[14]*b04+a[15]*b03)*d;r[3]=(a[10]*b04-a[9]*b05-a[11]*b03)*d;
 r[4]=(a[6]*b08-a[4]*b11-a[7]*b07)*d;r[5]=(a[0]*b11-a[2]*b08+a[3]*b07)*d;r[6]=(a[14]*b02-a[12]*b05-a[15]*b01)*d;r[7]=(a[8]*b05-a[10]*b02+a[11]*b01)*d;
 r[8]=(a[4]*b10-a[5]*b08+a[7]*b06)*d;r[9]=(a[1]*b08-a[0]*b10-a[3]*b06)*d;r[10]=(a[12]*b04-a[13]*b02+a[15]*b00)*d;r[11]=(a[9]*b02-a[8]*b04-a[11]*b00)*d;
 r[12]=(a[5]*b07-a[4]*b09-a[6]*b06)*d;r[13]=(a[0]*b09-a[1]*b07+a[2]*b06)*d;r[14]=(a[13]*b01-a[12]*b03-a[14]*b00)*d;r[15]=(a[8]*b03-a[9]*b01+a[10]*b00)*d;return r}

const pp=new Float32Array(4),VP=new Array(16);
let DRAWN_LAST=0;const CPU=[0,0,0,0];let phT=0,phN=0,last=performance.now(),fpsT=0,fpsN=0,fps=0,frames=0,fogK=[.0016,.05,.045,.042];
// streaming: districts appear ahead of you, a minute's walk apart, and what you have left behind is dropped
function stream(){const r=regionAt(P.x,P.z);if(r&&r!==CUR)enter(r);if(!CUR)return;
 let built=false;for(const d of CUR.doors){if(d.link)continue;if(Math.hypot(P.x-d.x,P.z-d.z)<85){spawnAt(CUR,d);built=true;if(PHONE)break}}
 if(PHONE&&built)return;
 if(dirty)rebuildWorld();if(regionChanged){regionChanged=false;if(detail>=0)bakeVis(CUR);makeSceneBG();if(detail>=0)shadowPass()}}
function frame(now){
 const dt=Math.min(.05,(now-last)/1000);last=now;fpsT+=dt;fpsN++;if(fpsT>.5){fps=Math.round(fpsN/fpsT);fpsT=fpsN=0}
 if(PHONE&&T.low&&playing){phT+=dt;phN++;if(phT>2){const f=phN/phT;phT=phN=0;const ns=f<48?Math.max(.6,phScale-.15):f>57?Math.min(phMax,phScale+.05):phScale;if(Math.abs(ns-phScale)>.01){phScale=ns;resize()}}}
 const c0=performance.now();stream();const c1=performance.now();
 const{fwd}=update(dt),t=now/1000;
 const e=[P.x,P.y,P.z],upv=[0,1,0],r=[fwd[1]*upv[2]-fwd[2]*upv[1],fwd[2]*upv[0]-fwd[0]*upv[2],fwd[0]*upv[1]-fwd[1]*upv[0]],rl=Math.hypot(...r);r[0]/=rl;r[1]/=rl;r[2]/=rl;
 const uu=[r[1]*fwd[2]-r[2]*fwd[1],r[2]*fwd[0]-r[0]*fwd[2],r[0]*fwd[1]-r[1]*fwd[0]];
 const V=[r[0],uu[0],-fwd[0],0,r[1],uu[1],-fwd[1],0,r[2],uu[2],-fwd[2],0,-dot3(r,e),-dot3(uu,e),dot3(fwd,e),1];
 const asp=T.W/T.H,fy=1/Math.tan((asp<1?78:68)*(ZM?1-ZM.zoom()*.72:1)*Math.PI/360),n=.05,fr=900;
 const Pm=[fy/asp,0,0,0,0,fy,0,0,0,0,fr/(n-fr),-1,0,0,n*fr/(n-fr),0];
 for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=Pm[k*4+i]*V[j*4+k];VP[j*4+i]=s}
 setFrustum(VP);window.__drawn=DRAWN_LAST=DRAWN.tris;DRAWN.tris=0;const c2=performance.now();stepPeople(dt,t%1000);audioFrame(fwd);const c3=performance.now();if(ZM&&playing)ZM.update(dt);const c4=performance.now();
 ub.set(VP,0);ub.set(V,16);ub.set(inv4(VP),32);ub.set([P.x,P.y,P.z,t%1000],64);ub.set([T.W,T.H,1/T.W,1/T.H,fy/asp,fy,n,fr],96);ub.set([fwd[0],fwd[1],fwd[2],ZM&&ZM.torch()?2.6:0],148);ub.set(LGRID.slice(0,4),68);ub[72]=LGRID[4];
 // day and night: in the hub they swap under each bridge; every district has its own
 const zone=BRIDGES.filter(b=>P.x>b).length,nightT=PHONE?0:nightOverride??(CUR===HUB||!CUR?(zone%2?1:0):(CUR.night?1:0));nightK+=(nightT-nightK)*Math.min(1,dt/1.2);
 const nk=nightK*nightK*(3-2*nightK);
 for(let i=0;i<3;i++)ub[84+i]=SKY.sunE[i]*SUNSCALE*(1-nk)+MOONC[i]*nk;ub[87]=.0022*(1-nk)+.003*nk;
 SKY.sh.forEach((c,i)=>{for(let j=0;j<3;j++)ub[104+i*4+j]=c[j]*(1-nk)+SKY.shN[i][j]*NGAIN/SKYSCALE*nk});
 ub.set([nk,SKY.KN*NGAIN,Math.cos(-betaN),Math.sin(-betaN)],140);ub[73]=1-.45*nk;
 const fg=[CUR&&CUR.fog||.0016,...(CUR&&CUR.fogCol||[.05,.045,.042])];for(let i=0;i<4;i++){fogK[i]+=(fg[i]-fogK[i])*Math.min(1,dt);ub[76+i]=fogK[i]}if(PHONE&&T.low)ub[76]=Math.max(ub[76],PH_FOG);
 device.queue.writeBuffer(ubuf,0,ub);
 pp.set([QS.has('dbg')?0:.045,(QS.has('ex')?+QS.get('ex'):1.15)*(1-.5*nk),t%97,QS.has('dbg')||QS.has('ex')?1:0]);device.queue.writeBuffer(pbuf,0,pp);
 const enc=device.createCommandEncoder();
 let cur;
 if(T.low){cur=SNAP?T.snapTex:ctx.getCurrentTexture();const nk2=nightK,sc=PHONE?[.62*(1-nk2)+.13*nk2,.7*(1-nk2)+.14*nk2,.82*(1-nk2)+.19*nk2]:[.62*(1-nk2)+.03*nk2,.7*(1-nk2)+.04*nk2,.82*(1-nk2)+.07*nk2];
  const q=enc.beginRenderPass({colorAttachments:[{view:T.ink?T.inkV:cur.createView(),clearValue:{r:sc[0]**2.2,g:sc[1]**2.2,b:sc[2]**2.2,a:1},loadOp:'clear',storeOp:'store'}],depthStencilAttachment:{view:T.depthV,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:T.ink?'store':'discard'}});
  q.setBindGroup(0,sceneBG);q.setVertexBuffer(0,cubeVB);q.setVertexBuffer(1,instB.b);q.setIndexBuffer(cubeIB,'uint16');if(instB.n){q.setPipeline(sceneLow);drawCells(q,instCells,36)}
  q.setPipeline(dynLow);drawDyn(q,MESH.person,pplB);for(const k of RIDEKIND)drawDyn(q,MESH[k],rideB[k]);if(ZM)drawDyn(q,MESH.unit,ZM.fxB);q.end();
  if(T.ink){const q2=enc.beginRenderPass({colorAttachments:[{view:cur.createView(),loadOp:'clear',clearValue:{r:1,g:1,b:1,a:1},storeOp:'store'}]});q2.setPipeline(inkPipe);q2.setBindGroup(0,T.inkBG);q2.draw(3);q2.end()}}
 else{
 let p=enc.beginRenderPass({colorAttachments:[
   {view:T.mC,resolveTarget:T.hdrV,clearValue:{r:0,g:0,b:0,a:1},loadOp:'clear',storeOp:'discard'},
   {view:T.mG,resolveTarget:T.gbV,clearValue:{r:0,g:0,b:6e4,a:0},loadOp:'clear',storeOp:'discard'},
   {view:T.mA,resolveTarget:T.axV,clearValue:{r:1,g:0,b:0,a:0},loadOp:'clear',storeOp:'discard'}],
  depthStencilAttachment:{view:T.depthV,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'discard'}});
 p.setBindGroup(0,sceneBG);p.setVertexBuffer(0,cubeVB);p.setVertexBuffer(1,instB.b);p.setIndexBuffer(cubeIB,'uint16');if(!SK.has('scene')&&instB.n){p.setPipeline(scenePipe);drawCells(p,instCells,36)}
 p.setPipeline(dynPipe);drawDyn(p,MESH.unit,folB);drawDyn(p,QS.has('leafbox')?MESH.unit:MESH.leaf,leafB);drawDyn(p,MESH.unit,dropB);drawDyn(p,MESH.person,pplB);if(ZM)drawDyn(p,MESH.unit,ZM.fxB);drawDyn(p,MESH.bird,birdB);
 for(const k of RIDEKIND)drawDyn(p,MESH[k],rideB[k]);
 p.setPipeline(modelPipe);drawModels(p,false);
 if(!SK.has('sky')){p.setPipeline(skyPipe);p.draw(3)}
 if(glassB.n&&!SK.has('glass')){p.setPipeline(glassPipe);p.setVertexBuffer(0,cubeVB);p.setIndexBuffer(cubeIB,'uint16');p.setVertexBuffer(1,glassB.b);drawCells(p,glassCells,36)}
 p.end();
 p=enc.beginRenderPass({colorAttachments:[{view:T.fxR,loadOp:'clear',clearValue:{r:0,g:0,b:0,a:0},storeOp:'store'},{view:T.fxV,loadOp:'clear',clearValue:{r:0,g:0,b:0,a:0},storeOp:'store'}]});
 if(!SK.has('fx')){p.setPipeline(fxPipe);p.setBindGroup(0,T.fxBG);p.draw(3)}p.end();
 const fsPass=(view,load,pipe,b)=>{const q=enc.beginRenderPass({colorAttachments:[{view,loadOp:load?'load':'clear',clearValue:{r:0,g:0,b:0,a:1},storeOp:'store'}]});q.setPipeline(pipe);q.setBindGroup(0,b);q.draw(3);q.end()};
 fsPass(T.litV,0,combPipe,T.combBG);
 for(let i=0;i<BLV;i++)fsPass(T.dv[i],0,i?downPipe:down0Pipe,T.downBG[i]);
 for(let i=BLV-2;i>=0;i--)fsPass(T.dv[i],1,upPipe,T.upBG[i]);
  cur=SNAP?T.snapTex:ctx.getCurrentTexture();fsPass(cur.createView(),0,finalPipe,T.finalBG)}
 let snapBuf=null;const bpr=Math.ceil(T.W*4/256)*256;
 if(SNAP&&frames===+QS.get('snap')){snapBuf=device.createBuffer({size:bpr*T.H,usage:GU.COPY_DST|GU.MAP_READ});enc.copyTextureToBuffer({texture:cur},{buffer:snapBuf,bytesPerRow:bpr},[T.W,T.H])}
 device.queue.submit([enc.finish()]);
 if(snapBuf){const W=T.W,H=T.H;snapBuf.mapAsync(GPUMapMode.READ).then(()=>{const src=new Uint8Array(snapBuf.getMappedRange()),c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d'),im=g.createImageData(W,H);
  const bgr=fmt.startsWith('bgra');for(let y=0;y<H;y++)for(let x=0;x<W;x++){const s=y*bpr+x*4,d=(y*W+x)*4;im.data[d]=src[s+(bgr?2:0)];im.data[d+1]=src[s+1];im.data[d+2]=src[s+(bgr?0:2)];im.data[d+3]=255}
  g.putImageData(im,0,0);window.__snap=c.toDataURL('image/png')})}
 {const a=Math.min(1,dt*2);const ms=[c1-c0,c3-c2,c4-c3,performance.now()-c0];CPU.forEach((v,k)=>CPU[k]=v+(ms[k]-v)*a)}
 if(stats)$('i').textContent=`${fps} fps · ${T.W}×${T.H} · ${Math.round(DRAWN_LAST/1000)}k triangles\nCPU ${CPU[3].toFixed(1)} ms of ${(1000/Math.max(1,fps)).toFixed(1)} ms per frame (world ${CPU[0].toFixed(1)} · crowd ${CPU[1].toFixed(1)} · zombies ${CPU[2].toFixed(1)})${CPU[3]>.75*1000/Math.max(1,fps)?' → processor-bound':' → graphics-bound'}\n${CUR?(CUR===HUB?'Skylight Galleria':CUR.title):'—'} · ${LOADED.length} areas loaded · ${districtCount} districts found\n${NP} people · ${instB.n+glassB.n+folB.n+leafB.n+dropB.n} objects · ${modelB.n} models · ${NLIGHTS} lights\nx ${P.x.toFixed(1)}  y ${P.y.toFixed(1)}  z ${P.z.toFixed(1)}`;
 window.__dbg={inst:instB.n,glass:glassB.n,fol:folB.n,leaf:leafB.n,drop:dropB.n,bird:birdB.n,ppl:pplB.n,regions:LOADED.map(r=>r.theme+':'+(r.leaves?.length/16))};window.__frames=++frames;window.__where=CUR?(CUR===HUB?'hub':CUR.theme):'none';window.__found=districtCount;
 requestAnimationFrame(frame)}
// first build
rebuildWorld();bakeVis(HUB);makeSceneBG();shadowPass();regionChanged=false;
view(QS.has('v')?+QS.get('v'):0);
if(QS.has('yaw'))P.yaw=+QS.get('yaw');if(QS.has('night')){nightOverride=+QS.get('night');nightK=nightOverride}if(QS.has('pitch'))P.pitch=+QS.get('pitch');if(QS.has('pos')){const q=QS.get('pos').split(',').map(Number);P.x=q[0];P.y=q[1];P.z=q[2]}settle();
// you start outside, in the parking lot, facing the mall's grand entrance
if(!QS.has('v')&&!QS.has('pos')&&!QS.has('dist')){const r=spawnAt(HUB,HUB.doors.find(d=>d.theme==='lot'));const[wx,wz]=XD(r.xf.q,0,70);P.x=wx+r.xf.ox;P.z=wz+r.xf.oz;P.y=1.7;
 const[fx,fz]=XD(r.xf.q,0,-1);P.yaw=Math.atan2(-fx,-fz);P.pitch=.06;rebuildWorld();enter(r);stream();settle();nightK=0}
// ?dist=theme opens a district straight away at the east gate (for testing and screenshots)
if(QS.has('dist')){const d=HUB.doors.find(d=>!d.theme),r=spawnAt(HUB,d,QS.get('dist'));const lz=+(QS.get('dz')||12),lx=+(QS.get('dx')||0);const[wx,wz]=XD(r.xf.q,lx,lz);P.x=wx+r.xf.ox;P.z=wz+r.xf.oz;P.y=1.7;
 const[fx,fz]=XD(r.xf.q,0,1);P.yaw=Math.atan2(-fx,-fz)+(+(QS.get('turn')||0));if(QS.has('pitch'))P.pitch=+QS.get('pitch');rebuildWorld();enter(r);stream();settle();nightK=r.night?1:0}
prog(1);await tick();
body.classList.remove('l');body.classList.add('r');
if(QS.has('go'))play();
// zombie mode: the menu's mode button switches between the two; the mode itself lives in js/zombies.js
if(MODE==='zombies'){ZM=makeZombieMode({P,keys,get LOADED(){return LOADED},get CUR(){return CUR},HUB,solid,groundAt,settle,EYE,touchMode,phone:PHONE,lefty:touchMode&&TS.lefty,gbuf:()=>gbuf(GU.VERTEX),
 get actx(){return actx},get master(){return master},kick,
 // world position -> CSS pixels on screen (for damage numbers), or null when behind you
 project:(x,y,z)=>{const cx=VP[0]*x+VP[4]*y+VP[8]*z+VP[12],cy=VP[1]*x+VP[5]*y+VP[9]*z+VP[13],cw=VP[3]*x+VP[7]*y+VP[11]*z+VP[15];if(cw<=.05)return null;return[(cx/cw*.5+.5)*innerWidth,(.5-cy/cw*.5)*innerHeight]}});window.__zm=ZM;
 // always night in zombie mode
 nightOverride=1;nightK=1;$('d').textContent='Start Zombie Mode';body.classList.add('zmode');$('zm').textContent='Back to normal mode'}
$('zm').onclick=()=>{try{localStorage.skyMallMode=MODE?'':'zombies'}catch{}location.search=MODE?'?mode=mall':'?mode=zombies'};
requestAnimationFrame(frame);
})();
