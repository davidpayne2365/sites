// World generation: shared building blocks, the hub mall, and the region wrapper.
// Districts register themselves in DISTRICTS from js/districts/*.js; each gets the toolkit K.
const DISTRICTS={};
const NAMECAP=768,ACOLS=8,AROWS=96,FH=6,GC=.5;
// collision grids: the hub in world space, each district in its own local frame (x -61..61, z -1..141)
const HUBG={x0:-150,y0:-1,z0:-85,nx:600,ny:30,nz:340},DISTG={x0:-61,y0:-1,z0:-1,nx:244,ny:40,nz:284};
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hsl(h,s,l){h=(((h%360)+360)%360)/360;const f=n=>{const k=(n+h*12)%12,a=s*Math.min(l,1-l);return l-a*Math.max(-1,Math.min(k-3,9-k,1))};return[f(0),f(8),f(4)].map(v=>Math.pow(v,2.2))}
function genWorld(){
let R=rng(19870611);const rnd=(a,b)=>a+(b-a)*R(),pick=a=>a[Math.floor(R()*a.length)],chance=p=>R()<p;
// state of the region being built
let inst,glass,lights,names,fol,leaves,drops,birds,shops,seats,fountains,ESC,NAV,doors,idle,rides,models,slides,boards,G,XF={q:0,ox:0,oz:0},stores=0;const used=new Set();
const cl=(v,n)=>v<0?0:v>n-1?n-1:v;
// local -> world: XF.q quarter turns about +y (same sense as the shader's ry), then the offset
const xd=(x,z)=>{const q=XF.q;return q===0?[x,z]:q===1?[z,-x]:q===2?[-x,-z]:[-z,x]};
const xp=(x,z)=>{const r=xd(x,z);return[r[0]+XF.ox,r[1]+XF.oz]};
const AXM=[[[0,1],[1,1]],[[1,-1],[0,1]],[[0,-1],[1,-1]],[[1,1],[0,-1]]];
const rotFace=f=>{const v=[[0,1],[0,-1],[1,0],[-1,0]][f],[x,z]=xd(v[0],v[1]);return z>.5?0:z<-.5?1:x>.5?2:3};
function mark(x0,y0,z0,x1,y1,z1){const{x0:GX,y0:GY,z0:GZ,nx,ny,nz,d}=G;
 if(x1<GX||z1<GZ||y1<GY||x0>GX+nx*GC||z0>GZ+nz*GC||y0>GY+ny*GC)return;
 const i0=cl(Math.floor((x0-GX)/GC),nx),i1=cl(Math.floor((x1-GX-1e-4)/GC),nx),
       j0=cl(Math.floor((y0-GY)/GC),ny),j1=cl(Math.floor((y1-GY-1e-4)/GC),ny),
       k0=cl(Math.floor((z0-GZ)/GC),nz),k1=cl(Math.floor((z1-GZ-1e-4)/GC),nz);
 for(let k=k0;k<=k1;k++)for(let j=j0;j<=j1;j++){const o=nx*(j+ny*k);for(let i=i0;i<=i1;i++)d[o+i]=1}
}
function markRot(x,y,z,sx,sy,sz,r){
 const c=Math.cos(r),s=Math.sin(r),na=Math.ceil(sx/.2)+1,nb=Math.ceil(sy/.2)+1,nc=Math.ceil(sz/.2)+1;
 for(let a=0;a<na;a++)for(let b=0;b<nb;b++)for(let d=0;d<nc;d++){
  const lx=(a/(na-1)-.5)*sx,ly=(b/(nb-1)-.5)*sy,lz=(d/(nc-1)-.5)*sz;
  const i=Math.floor((c*lx-s*ly+x-G.x0)/GC),j=Math.floor((s*lx+c*ly+y-G.y0)/GC),k=Math.floor((lz+z-G.z0)/GC);
  if(i>=0&&j>=0&&k>=0&&i<G.nx&&j<G.ny&&k<G.nz)G.d[i+G.nx*(j+G.ny*k)]=1}
}
function box(x,y,z,sx,sy,sz,col,o){o=o||{};const r=o.rot||0;let pat=o.pat||0;
 if(!pat&&!o.glass){if(col===C.wood)pat=2;else if(col===C.facade||col===C.ceil)pat=11}
 const[wx,wz]=xp(x,z),q=XF.q,odd=q&1,[nax,sg]=AXM[q][o.ax||0],face=q&&(o.sign??-1)!==-1?rotFace(o.face||0):o.face||0;
 (o.glass?glass:inst).push(wx,y,wz,r*sg,odd?sz:sx,sy,odd?sx:sz,o.e||0,col[0],col[1],col[2],o.s??.12,o.sign??-1,face,pat,nax);
 if(o.solid!==false&&!o.ax){r?markRot(x,y,z,sx,sy,sz,r):mark(x-sx/2,y-sy/2,z-sz/2,x+sx/2,y+sy/2,z+sz/2)}}
function B(x0,y0,z0,x1,y1,z1,col,o){box((x0+x1)/2,(y0+y1)/2,(z0+z1)/2,Math.abs(x1-x0),Math.abs(y1-y0),Math.abs(z1-z0),col,o)}
/* ---------- life: foliage, water, birds (drawn by the free-orientation pipeline) ---------- */
// kind 0 = static part, 4 = leaf (sways); yaw/pitch/roll orient the box's long (z) axis
const part=(x,y,z,sx,sy,sz,col,yaw,pitch,roll,kind,ex=0,ey=0)=>{const[wx,wz]=xp(x,z);(kind===4?leaves:fol).push(wx,y,wz,yaw+XF.q*Math.PI/2,sx,sy,sz,kind,col[0],col[1],col[2],R(),pitch,roll,ex,ey)};
const stick=(x0,y0,z0,x1,y1,z1,w,col,kind=0)=>{const dx=x1-x0,dy=y1-y0,dz=z1-z0,l=Math.hypot(dx,dy,dz);
 part((x0+x1)/2,(y0+y1)/2,(z0+z1)/2,w,w,l,col,Math.atan2(dx,dz),-Math.asin(dy/l),0,kind)};
const BARK=hsl(25,.28,.2);
const seat=(x,z,yaw,y=0)=>{const[a,b]=xp(x,z);seats.push(a,b,yaw+XF.q*Math.PI/2,y)};
const fpush=(x,y,z,big)=>{const[a,b]=xp(x,z);fountains.push({x:a,y,z:b,big})};
// Poly Haven models (js/models.js): yaw about +y, s = scale (number or [x,y,z]); o: tint, sway, pitch, roll, glow, solid
const model=(name,x,y,z,yaw=0,s=1,o={})=>{const m=MODELS.models[name];if(!m)return;const S=typeof s==='number'?[s,s,s]:s,[wx,wz]=xp(x,z),t=o.tint||[1,1,1];
 (models[name]=models[name]||[]).push(wx,y,wz,yaw+XF.q*Math.PI/2,S[0],S[1],S[2],0,t[0],t[1],t[2],o.sway||0,o.pitch||0,o.roll||0,0,o.glow||0);
 if(o.solid){const bb=m.bb,c=Math.abs(Math.cos(yaw)),sn=Math.abs(Math.sin(yaw)),hx=(bb[3]-bb[0])/2*S[0],hz=(bb[5]-bb[2])/2*S[2],ex=hx*c+hz*sn,ez=hx*sn+hz*c;
  mark(x-ex,y+bb[1]*S[1],z-ez,x+ex,y+bb[4]*S[1],z+ez)}};
// foliage is built from photo-textured cards: a trunk plus clusters of leaves, needles or fronds
const leafTint=(k=1)=>[rnd(.78,1.08)*k,rnd(.85,1.1)*k,rnd(.7,1)*k];
const trunk=(x,y,z,h,r,kind='trunk_broad',o={})=>{model(kind,x,y,z,rnd(0,6.28),[r,h,r],o);if(!o.pitch)mark(x-r*.8,y,z-r*.8,x+r*.8,y+h,z+r*.8)};
const crown=(x,y,z,rx,ry,n,hue,big=1,card)=>{const cnt=Math.min(150,Math.round(rx*rx*ry*5)+10),sz=Math.max(1,rx/2.2);
 const kind=card||(hue%3<1.5?'card_broad':'card_jacaranda');
 for(let k=0;k<cnt;k++){let px,py,pz;do{px=rnd(-1,1);py=rnd(-1,1);pz=rnd(-1,1)}while(px*px+py*py+pz*pz>1);
  const sc=rnd(.75,1.25)*sz;model(kind,x+px*rx*.85,y+py*ry*.85-sc*.6,z+pz*rx*.85,rnd(0,6.28),sc,{tint:leafTint(),sway:.5,pitch:rnd(-.35,.35),roll:rnd(-.35,.35)})}};
const tree=(x,y,z,h)=>{const tx=x+rnd(-.15,.15),tz=z+rnd(-.15,.15);trunk(x,y,z,h*.72,.11);
 for(let k=0;k<4;k++){const a=k*1.57+rnd(0,.6);model('trunk_broad',tx,y+h*rnd(.42,.6),tz,a,[.05,h*.35,.05],{pitch:rnd(.6,.9)})}
 crown(tx,y+h*.82,tz,h*.4,h*.27,0,rnd(95,125))};
const shrubs=(x,y,z,rx,rz,n)=>{const cnt=Math.max(2,Math.round(n/22));for(let k=0;k<cnt;k++){const px=x+rnd(-rx,rx)*.8,pz=z+rnd(-rz,rz)*.8;
 model(chance(.75)?'card_shrub':'card_fern',px,y,pz,rnd(0,6.28),rnd(.55,1)*Math.min(1.4,(rx+rz)/1.6+.4),{tint:leafTint(),sway:.4})}};
const palm=(x,z,h)=>{const lean=rnd(0,6.283),tilt=rnd(.03,.09);model('trunk_broad',x,.55,z,lean,[.2,h,.2],{pitch:tilt,tint:[1.05,.95,.85]});mark(x-.25,0,z-.25,x+.25,h,z+.25);
 const tx=x+Math.sin(lean)*Math.sin(tilt)*h,tz=z+Math.cos(lean)*Math.sin(tilt)*h,ty=.55+h*Math.cos(tilt);
 for(let f=0;f<12;f++){const az=f/12*6.283+rnd(-.15,.15);model('card_jacaranda_flat',tx,ty-.2,tz,az,[rnd(1.3,1.7),rnd(1.6,2),1],{pitch:rnd(1.75,2.15),roll:rnd(-.2,.2),tint:leafTint(1.05),sway:.35})}
 for(let f=0;f<5;f++)model('card_jacaranda',tx,ty-.3,tz,rnd(0,6.28),.9,{tint:leafTint(),sway:.3})};
// water: each droplet arcs from a nozzle with its own velocity; level = where it disappears
const jet=(x,y,z,vx,vy,vz,level,n,spread)=>{const[wx,wz]=xp(x,z);for(let k=0;k<n;k++){const[a,b]=xd(vx+rnd(-spread,spread),vz+rnd(-spread,spread));drops.push(wx,y,wz,level,.035,.06,.035,3,.55,.72,.85,k/n+rnd(0,.02),a,b,vy*rnd(.96,1.04),0)}};
const bird=(cx,cy,cz,r,amp,w,col=[.025,.025,.03],sc=0)=>{const[wx,wz]=xp(cx,cz);birds.push(wx,cy,wz,0,r,amp,sc,2,col[0],col[1],col[2],R(),0,0,w,0)};
function light(x,y,z,col,I,r,o){o=o||{};const[wx,wz]=xp(x,z);lights.push({x:wx,y,z:wz,r,c:col.map(v=>v*I),f:0,both:!!o.both})}
function frame(px,pz,ax,az,nx,nz){
 const wx=(u,v)=>px+ax*u+nx*v,wz=(u,v)=>pz+az*u+nz*v;
 const F=(u0,y0,v0,u1,y1,v1,col,o)=>{const uc=(u0+u1)/2,vc=(v0+v1)/2,su=Math.abs(u1-u0),sv=Math.abs(v1-v0);
  box(wx(uc,vc),(y0+y1)/2,wz(uc,vc),ax?su:sv,Math.abs(y1-y0),ax?sv:su,col,o)};
 F.L=(u,y,v,col,I,r,o)=>light(wx(u,v),y,wz(u,v),col,I,r,o);F.w=(u,v)=>[wx(u,v),wz(u,v)];
 return F}
const faceOf=(nx,nz)=>nz===1?1:nz===-1?0:nx===1?3:2;
function addName(t,font,up){names.push({t:up?t.toUpperCase():t,font});return names.length-1}
const C={floor:hsl(38,.16,.8),ceil:hsl(40,.1,.86),facade:hsl(30,.06,.9),trim:hsl(35,.25,.5),steel:hsl(210,.06,.68),dark:hsl(240,.1,.07),
 wood:hsl(28,.45,.32),leaf:hsl(115,.45,.32),pot:hsl(20,.3,.42),white:hsl(40,.2,.95),warm:hsl(36,.75,.82),cool:hsl(205,.35,.85),glass:hsl(200,.15,.6)};
const tint=(a,b,k)=>a.map((v,i)=>v*(1-k)+b[i]*k);

/* ---------- prop helpers ---------- */
const counter=c=>{const{F,fy,D}=c;c.counter=1;F(-1.4,fy,D-2.3,1.4,fy+1,D-1.6,c.accent);F(-1.5,fy+1,D-2.35,1.5,fy+1.06,D-1.55,C.white,{s:.6});
 F(.4,fy+1.06,D-2.05,.8,fy+1.35,D-1.88,C.dark);F(.42,fy+1.1,D-2.07,.78,fy+1.33,D-2.05,hsl(150,.6,.5),{e:1.5,solid:false})};
const sideUnit=(c,sd,v0,v1,h,dep,col,o)=>{const ui=sd<0?-c.hw+.25:c.hw-.25,uo=ui-sd*dep;c.F(Math.min(ui,uo),c.fy,v0,Math.max(ui,uo),c.fy+h,v1,col,o)};
const backUnit=(c,h,dep,col,o)=>c.F(-c.hw+.3,c.fy,c.D-.25-dep,c.hw-.3,c.fy+h,c.D-.25,col,o);
const rack=(c,v,u0,u1,colFn)=>{const{F,fy}=c;F(u0,fy+1.6,v-.03,u1,fy+1.66,v+.03,C.steel,{s:.8});F(u0,fy,v-.03,u0+.06,fy+1.66,v+.03,C.steel);F(u1-.06,fy,v-.03,u1,fy+1.66,v+.03,C.steel);
 for(let u=u0+.25;u<u1-.2;u+=.24)F(u-.05,fy+.72,v-.28,u+.05,fy+1.58,v+.28,colFn(),{s:.03,solid:false})};
const mannequin=(c,u,v,h)=>{const{F,fy}=c;F(u-.25,fy,v-.25,u+.25,fy+.08,v+.25,C.steel);F(u-.15,fy+.08,v-.08,u+.15,fy+.95,v+.08,hsl(h,.3,.3));
 F(u-.22,fy+.95,v-.12,u+.22,fy+1.55,v+.12,hsl(h+180,.5,.55));F(u-.1,fy+1.6,v-.1,u+.1,fy+1.85,v+.1,C.white)};
const glowCase=(c,u0,v0,u1,v1)=>{const{F,fy}=c;F(u0,fy,v0,u1,fy+.85,v1,hsl(20,.4,.12),{s:.5});F(u0+.03,fy+.85,v0+.03,u1-.03,fy+1.05,v1-.03,hsl(45,.35,.85),{e:.9,s:.9})};
const sideCabinets=(c)=>{const{F,fy,hw,D}=c;for(const sd of[-1,1]){const uw=sd<0?-hw+.25:hw-.25,u=uw-sd*.45;
 for(let v=1.2;v<D-1.6;v+=1.05){F(u-.4,fy,v-.42,u+.4,fy+1.85,v+.42,hsl(rnd(0,360),.5,.18));const us=u-sd*.41;
  F(Math.min(us,us-sd*.03),fy+1,v-.3,Math.max(us,us-sd*.03),fy+1.5,v+.3,hsl(rnd(0,360),.7,.55),{e:2,pat:5,solid:false});
  F(Math.min(us,us-sd*.03),fy+1.6,v-.38,Math.max(us,us-sd*.03),fy+1.8,v+.38,hsl(rnd(0,360),.9,.6),{e:3,solid:false})}}};

/* ---------- store categories (all names invented) ---------- */
const CATS={
 apparel:{h:[290,350],fp:2,font:'italic 700 {s} Georgia,serif',a:['Thread','Loom','Stitch','Velvet','Cotton','Linen','Indigo','Hem','Tailor','Weave','Seam','Gingham','Corduroy','Flannel'],b:['& Co.','Outfitters','Closet','Collective','Wardrobe','Supply','Attire','Studio','Clothiers'],
  props(c){const{hw,D,hue}=c;for(const v of[2.6,4.9,7.2])if(v<D-2.2){const gh=hue+rnd(-60,60);rack(c,v,-hw+1.1,hw-1.1,()=>hsl(gh+rnd(-25,25),rnd(.3,.75),rnd(.25,.7)))}
   mannequin(c,-hw+1.2,1.1,hue);mannequin(c,hw-1.2,1.1,hue+40);counter(c)}},
 shoes:{h:[10,50],fp:2,font:'800 {s} "Trebuchet MS",sans-serif',up:1,a:['Stride','Sole','Lace','Heel','Step','Tread','Kick','Pace','Arch','Buckle'],b:['Shoe Co.','Footwear','Sneakers','Boot Room','Soles','Shoe Depot'],
  props(c){const{F,fy,hw,D,hue}=c;for(const sd of[-1,1]){const ui=sd<0?-hw+.25:hw-.25,uo=ui-sd*.45,a=Math.min(ui,uo),b=Math.max(ui,uo);
   for(let k=0;k<4;k++){const y=fy+.45+k*.6;F(a,y,.8,b,y+.04,D-1,C.facade);for(let v=1.05;v<D-1.2;v+=.5)F(a+.08,y+.04,v-.16,b-.08,y+.2,v+.16,hsl(hue+rnd(-90,90),rnd(.2,.8),rnd(.2,.7)),{solid:false})}}
   F(-1.2,fy,3,1.2,fy+.45,3.6,C.wood);F(-1.2,fy,5.6,1.2,fy+.45,6.2,C.wood);counter(c)}},
 tech:{h:[190,230],fp:1,font:'800 {s} "Courier New",monospace',up:1,a:['Pixel','Circuit','Volt','Byte','Quantum','Ion','Signal','Static','Vector','Kilobyte'],b:['Electronics','Tech','Gadgets','Digital','Audio','Computers','Devices'],
  props(c){const{F,fy,hw,D}=c;for(const v of[3,6])if(v<D-2){F(-2,fy,v-.6,2,fy+.85,v+.6,C.white,{s:.5});
    for(const u of[-1.3,0,1.3]){F(u-.25,fy+.85,v-.18,u+.25,fy+.88,v+.18,C.dark);F(u-.25,fy+.88,v+.14,u+.25,fy+1.2,v+.18,hsl(200+rnd(-30,60),.6,.6),{e:1.6,pat:5,solid:false})}}
   for(let r=0;r<2;r++)for(const k of[-1,0,1])F(k*2.2-.95,fy+1.6+r*1.25,D-.32,k*2.2+.95,fy+2.7+r*1.25,D-.25,hsl(rnd(0,360),.6,.55),{e:1.8,pat:5});
   for(const sd of[-1,1])sideUnit(c,sd,.8,D-1,1.8,.45,C.steel,{pat:33})}},
 books:{h:[20,45],fp:2,font:'italic 600 {s} "Times New Roman",Georgia,serif',a:['Dog-Eared','Inkwell','Quill','Chapter','Margin','Folio','Paperback','Bookmark','Lantern','Parchment'],b:['Books','Reads','Bookshop','Pages','Booksellers','& Ink'],
  props(c){const{F,fy,hw,D}=c;for(const sd of[-1,1])sideUnit(c,sd,.6,D-.6,2.4,.45,C.wood,{pat:31});backUnit(c,2.4,.45,C.wood,{pat:31});
   F(-1.4,fy,2.4,-.9,fy+1.5,D-3.2,C.wood,{pat:31});F(.9,fy,2.4,1.4,fy+1.5,D-3.2,C.wood,{pat:31});
   for(const u of[-hw+1.4,hw-1.4]){F(u-.4,fy,1.2,u+.4,fy+.45,1.9,hsl(rnd(0,40),.4,.35));F(u-.4,fy+.45,1.8,u+.4,fy+1,1.9,hsl(rnd(0,40),.4,.3))}counter(c)}},
 toys:{h:[0,360],fp:3,font:'900 {s} "Comic Sans MS","Chalkboard SE",cursive',a:['Wobble','Jumble','Zippy','Bouncy','Marble','Kite','Tiny','Giggle','Rocket','Pogo'],b:['Toys','Toy Box','Games','Fun Shop','Playhouse','Toy Chest'],
  props(c){const{F,fy,hw,D,hue}=c;for(const sd of[-1,1])sideUnit(c,sd,.8,D-1,2,.45,C.white,{pat:33});
   for(const v of[3,5.8])if(v<D-2.4){F(-1.5,fy,v-.7,1.5,fy+.7,v+.7,hsl(hue,.6,.6));for(let k=0;k<10;k++){const s=rnd(.2,.45),u=rnd(-1.3,1.3),w=rnd(-.5,.5);F(u-s/2,fy+.7,v+w-s/2,u+s/2,fy+.7+s,v+w+s/2,hsl(rnd(0,360),.85,.55),{solid:false})}}
   const br=hsl(28,.5,.35);F(-hw+.9,fy,D-2.1,-hw+2.1,fy+1.2,D-.9,br);F(-hw+1.1,fy+1.2,D-1.9,-hw+1.9,fy+1.9,D-1.1,br);F(-hw+1,fy+1.8,D-1.6,-hw+1.25,fy+2.05,D-1.4,br);F(-hw+1.75,fy+1.8,D-1.6,-hw+2,fy+2.05,D-1.4,br);counter(c)}},
 food:{h:[0,50],fp:1,font:'900 {s} Impact,"Arial Black",sans-serif',up:1,a:['Golden','Sizzle','Noodle','Pretzel','Taco','Waffle','Dumpling','Crispy','Cinnamon','Burger','Pizza','Teriyaki','Corndog','Smoothie','Gyro','Lemonade'],b:['Kitchen','Express','Hut','Grill','Bar','Bakery','Stop','Corner','Palace','Stand'],
  props(c){const{F,fy,hw,D,hue}=c;F(-hw+.5,fy,1.2,hw-.5,fy+1.05,1.9,c.accent);F(-hw+.45,fy+1.05,1.15,hw-.45,fy+1.12,1.95,C.steel,{s:.8});
   F(1.2,fy+1.12,1.4,1.6,fy+1.4,1.7,C.dark);for(const k of[-1,0,1])F(k*2.3-1,fy+2.3,D-.32,k*2.3+1,fy+3.3,D-.26,hsl(hue+rnd(-20,20),.4,.75),{e:1.4,pat:5});
   for(let u=-hw+.6;u<hw-.9;u+=1.3)F(u,fy,D-1.3,u+1.1,fy+(chance(.3)?2:1),D-.3,C.steel,{s:.7})}},
 arcade:{h:[260,320],fp:3,font:'900 {s} "Courier New",monospace',up:1,dark:1,a:['Turbo','Hyper','Mega','Retro','Joystick','Laser','Pinball','Power-Up','Neon','High Score'],b:['Arcade','Zone','Game Room','Playland','Galaxy'],
  props(c){const{F,fy,D}=c;sideCabinets(c);for(const v of[3,6])if(v<D-2){F(-.45,fy,v-.7,.45,fy+.9,v+.7,C.dark);F(-.42,fy+.9,v-.67,.42,fy+.95,v+.67,hsl(rnd(0,360),.8,.55),{e:1.6,pat:5,solid:false})}}},
 jewelry:{h:[40,55],fp:3,font:'400 {s} Didot,"Bodoni 72",Georgia,serif',up:1,velvet:1,a:['Lumen','Gilded','Opal','Facet','Lustre','Carat','Sterling','Halo','Topaz','Filigree'],b:['Jewelers','Gems','Fine Jewelry','Diamonds','& Gold'],
  props(c){const{hw,D}=c;for(const sd of[-1,1]){const ui=sd<0?-hw+.3:hw-.3,uo=ui-sd*.7;glowCase(c,Math.min(ui,uo),1.5,Math.max(ui,uo),D-1.5)}glowCase(c,-1,3.4,1,5.4);counter(c)}},
 home:{h:[20,140],fp:2,font:'600 {s} "Trebuchet MS",sans-serif',a:['Hearth','Nook','Willow','Oak','Candle','Cozy','Ember','Cedar','Linden','Meadow'],b:['Home','Living','Goods','Decor','& Things','Interiors'],
  props(c){const{F,fy,hw,D,hue}=c;F(-2,fy,2.3,2,fy+.04,5.6,hsl(hue,.4,.4),{pat:3,solid:false});const so=hsl(hue+150,.3,.45);
   F(-1.4,fy,4.2,1.4,fy+.45,5,so);F(-1.4,fy+.45,4.8,1.4,fy+1,5.05,so);F(-1.6,fy,4.2,-1.4,fy+.7,5.05,so);F(1.4,fy,4.2,1.6,fy+.7,5.05,so);F(-.6,fy,2.8,.6,fy+.4,3.5,C.wood);
   for(const u of[-hw+.9,hw-.9]){F(u-.03,fy,4.5,u+.03,fy+1.5,4.56,C.dark);F(u-.25,fy+1.5,4.3,u+.25,fy+1.85,4.76,C.warm,{e:2.2})}
   if(D>8){F(-1.5,fy,D-3,1.5,fy+.55,D-.6,C.white);F(-1.6,fy,D-.6,1.6,fy+1.3,D-.35,C.wood)}sideUnit(c,-1,.8,4,1.8,.4,C.wood,{pat:33})}},
 music:{h:[160,200],fp:2,font:'italic 800 {s} "Arial Black",sans-serif',a:['Vinyl','Groove','Echo','Tempo','Bassline','Melody','Riff','Treble','Encore','Backbeat'],b:['Records','Music','Sound','Guitars','Tapes','Audio Shop'],
  props(c){const{F,fy,hw,D}=c;F(-2,fy,2.8,-.4,fy+.8,D-3.2,C.wood,{pat:32});F(.4,fy,2.8,2,fy+.8,D-3.2,C.wood,{pat:32});
   for(const sd of[-1,1]){const uw=sd<0?-hw+.25:hw-.25;for(let v=1.2;v<D-1.5;v+=.9){const a=Math.min(uw,uw-sd*.12),b=Math.max(uw,uw-sd*.12),gc=hsl(rnd(0,360),.6,.45);
    F(a,fy+1.2,v-.2,b,fy+1.75,v+.2,gc,{solid:false,s:.7});F(a,fy+1.75,v-.04,b,fy+2.55,v+.04,C.wood,{solid:false})}}counter(c)}},
 beauty:{h:[320,360],fp:1,font:'italic 400 {s} "Brush Script MT","Segoe Script",cursive',pale:1,a:['Bloom','Glow','Petal','Silk','Aura','Blush','Mist','Lotus','Velour','Primrose'],b:['Beauty','Cosmetics','Salon','Scents','Spa','Apothecary'],
  props(c){const{F,fy,D}=c;for(const sd of[-1,1])sideUnit(c,sd,.8,D-1,2,.35,C.white,{pat:33});
   for(const k of[-1,1])F(k*1.5-.7,fy+1,D-.3,k*1.5+.7,fy+2.4,D-.26,hsl(40,.1,.9),{e:.6,s:.95});
   F(-1,fy,3.5,1,fy+.9,5,C.white,{s:.6});for(let k=0;k<12;k++){const u=rnd(-.85,.85),v=rnd(3.6,4.9);F(u-.05,fy+.9,v-.05,u+.05,fy+1.12,v+.05,hsl(rnd(280,400),.6,.6),{solid:false})}counter(c)}},
 sports:{h:[100,140],fp:1,font:'italic 900 {s} "Arial Black",sans-serif',up:1,a:['Summit','Peak','Rally','Sprint','Trail','Victory','Endzone','Ace','Overtime','Breakaway'],b:['Sports','Athletics','Outdoors','Gear','Fitness','Pro Shop'],
  props(c){const{F,fy,hw,D}=c;const jh=[0,220,120,45,280];for(const v of[2.6,4.8])rack(c,v,-hw+1.1,hw-1.1,()=>hsl(pick(jh),.75,.5));
   sideUnit(c,1,.8,D-1,1.6,.5,C.steel);for(let v=1;v<D-1.2;v+=.32)F(hw-.68,fy+1.6,v-.13,hw-.42,fy+1.86,v+.13,chance(.5)?hsl(25,.9,.5):C.white,{solid:false});
   if(D>8)for(const u of[-1.4,1.4]){F(u-.45,fy,D-3.2,u+.45,fy+.25,D-1.2,C.dark);F(u-.45,fy+.25,D-1.3,u+.45,fy+1.3,D-1.2,C.steel);F(u-.35,fy+1.1,D-1.32,u+.35,fy+1.3,D-1.3,hsl(150,.7,.5),{e:1.5,solid:false})}}},
 candy:{h:[300,400],fp:1,font:'900 {s} "Comic Sans MS","Chalkboard SE",cursive',stripes:1,a:['Sugar','Lolli','Fizzy','Gummy','Taffy','Jelly','Cocoa','Sprinkle','Bonbon','Caramel'],b:['Sweets','Candy','Confections','Treats','Shoppe','Candy Co.'],
  props(c){const{F,fy,hw,D}=c;const bin=(u0,v0,u1,v1)=>{F(u0,fy,v0,u1,fy+.9,v1,C.white);F(u0+.03,fy+.9,v0+.03,u1-.03,fy+.97,v1-.03,hsl(rnd(0,360),.9,.6),{e:.35,solid:false})};
   for(const sd of[-1,1]){const ui=sd<0?-hw+.25:hw-.25,uo=ui-sd*.7;for(let v=1;v<D-1.3;v+=.7)bin(Math.min(ui,uo),v,Math.max(ui,uo),v+.62)}
   for(let k=0;k<5;k++)for(const u of[-.8,0])bin(u,3+k*.65,u+.78,3.6+k*.65);counter(c)}},
 pets:{h:[170,210],fp:1,font:'700 {s} Verdana,sans-serif',a:['Paws','Whisker','Fetch','Wag','Fuzzy','Purr','Biscuit','Scamper','Feather'],b:['Pet Supply','Pets','Pet Shop','& Friends','Pet Co.','Aquatics'],
  props(c){const{F,fy,hw,D}=c;for(const sd of[-1,1]){const ui=sd<0?-hw+.25:hw-.25,uo=ui-sd*.6,a=Math.min(ui,uo),b=Math.max(ui,uo);F(a,fy,1.2,b,fy+.8,D-1.5,C.dark);
    F(a,fy+.8,1.3,b,fy+1.9,D-1.6,hsl(190,.7,.5),{e:1.1,pat:8,s:.9});for(let k=0;k<6;k++){const v=rnd(1.6,D-2),y=fy+rnd(1,1.7);F((a+b)/2-.05,y,v-.12,(a+b)/2+.05,y+.08,v+.12,hsl(rnd(0,60),.9,.55),{e:1.2,solid:false})}}
   F(-.5,fy,3,.5,fy+1.6,D-3,C.white,{pat:33});counter(c)}},
};
const SHOPCATS=['apparel','apparel','apparel','shoes','shoes','tech','tech','books','toys','arcade','jewelry','home','music','beauty','beauty','sports','candy','pets','food'];
const NAMES={"apparel":["Harlow & Reed","Northline","Maison Verre","Copper Thread","Ashford Lane","Blue Harbor Co.","Wren & Wilder","Fieldhouse","Marlow Denim","Saltwater Supply","Kestrel","Juniper & Main","Oakhurst","The Common Thread","Larkspur","Sable & Stone","Hollis","Avenue Nine","Rowan Street","Union Mill","Linden & Lace","Westbrook"],"shoes":["Paceline Shoes","Bootmaker & Co.","Kickstand","Heel & Arch","The Shoe Loft","Tread Lightly","Laceworks","Cobble Street Shoes"],"tech":["Voltline","Pixel Point","Circuit Avenue","Nimbus Mobile","Bytewise","Kilowatt","Arcadia Tech","Lumen Labs","Quanta Store","Signal & Co."],"books":["Lantern Books","Folio & Fern","Second Chapter","Inkwell Booksellers","The Margin","Paper Moon Books","Northwind Books"],"toys":["Jumbletown Toys","Kite & Kazoo","Tiny Tumbles","The Marble Jar","Rocket Pop Toys","Wobble & Co."],"food":["Golden Wok","Sizzle Street Grill","Noodle House","Pretzel Twist","Taco Rio","Waffle Corner","Dumpling Den","Crispy Coop","Cinnamon Swirl","Burger Barn","Slice of Napoli","Teriyaki Express","Smoothie Shack","Gyro Grove","Lemon Stand","Bao Bar"],"arcade":["Turbo Zone","Hyperdrive Arcade","Pixel Palace","High Score","Laser Lanes"],"jewelry":["Lumen Fine Jewelry","Gilded Hour","Opaline","Carat & Clasp","Sterling House","Halo Jewelers"],"home":["Hearth & Linen","Willow Home","Cedar & Co.","Nook Living","Ember Candle Co.","Meadow Home"],"music":["Groove Records","Backbeat Guitars","Echo Sound","Vinyl Vault","Encore Music"],"beauty":["Bloom Beauty","Petal & Mist","Glow Bar","Lotus Apothecary","Velour Cosmetics","Silk & Co. Salon"],"sports":["Summit Outfitters","Rally Athletics","Trailhead Sports","Breakaway","Endzone Pro Shop","Overtime Fitness"],"candy":["Sugar Shack","Fizzy Lizzy Sweets","Taffy Town","Bonbon Bar","Lolli & Pop"],"pets":["Paws & Whiskers","Fetch Pet Supply","Wag Street","Fin & Feather Aquatics","Purrfect Pets"]};
const nameFor=(cat,key)=>{const free=(NAMES[key]||[]).filter(n=>!used.has(n));let t;
 if(free.length)t=pick(free);else for(let k=0;k<60;k++){t=pick(cat.a)+' '+pick(cat.b);if(!used.has(t))break}used.add(t);return t};
// fuller shops: lightboxes, pendants, wall racks, folded tables, extra shelving
// real items (Poly Haven models) each kind of shop puts on show
const STOCK={home:['antique_ceramic_vase_01','ceramic_vase_03','brass_candleholders','mantel_clock_01','Lantern_01','carved_wooden_elephant','fancy_picture_frame_01','ceramic_vase_02','alarm_clock_01','desk_lamp_arm_01'],
 tech:['Camera_01','classic_laptop','portable_cassette_player','television_02','vintage_video_camera','boombox','alarm_clock_01'],
 music:['portable_cassette_player','boombox','Ukulele_01','vintage_video_camera'],toys:['chess_set','carved_wooden_elephant','garden_gnome','alarm_clock_01','Lantern_01'],
 books:['stationery_supplies','book_encyclopedia_set_01','desk_lamp_arm_01','mantel_clock_01','fancy_picture_frame_01'],jewelry:['brass_goblets','brass_candleholders','fancy_picture_frame_01','mantel_clock_01'],
 beauty:['antique_ceramic_vase_01','ceramic_vase_03','brass_candleholders'],sports:['metal_toolbox','Drill_01','Lantern_01'],pets:['wooden_bowl_01','jug_01','garden_gnome']};
const FOODS=['croissant','hamburger_buns','strawberry_chocolate_cake','carrot_cake','croissant','food_apple_01','bananas'];
const extras=(c,key)=>{const{F,fy,hw,D,hue}=c;
 // a lit ledge along the back wall with real items on it, facing the door
 const st=STOCK[key];if(st&&!c.big&&hw>=3){const y=key==='books'?fy+2.42:fy+2,v=D-.55,yaw=Math.atan2(-c.nx,-c.nz);if(key!=='books')F(-hw+1,y-.05,v-.25,hw-1,y,v+.25,C.wood,{solid:false});
  let k=Math.floor(R()*st.length);for(let u=-hw+1.5;u<=hw-1.5;u+=.9){const[x,z]=F.w(u,v);model(st[k++%st.length],x,y,z,yaw+rnd(-.3,.3),1)}}
 if(key==='food'&&fy===0&&hw>=3){const yaw=Math.atan2(-c.nx,-c.nz);for(let u=-hw+1;u<=hw-1;u+=.7){const[x,z]=F.w(u,1.55);model(FOODS[Math.floor(R()*FOODS.length)],x,fy+1.12,z,yaw+rnd(-.5,.5),1)}}
 if(!['food','arcade','books','music'].includes(key))F(-hw*.5,fy+2.7,D-.3,hw*.5,fy+4.2,D-.26,hsl(hue+rnd(-40,40),.45,.7),{e:1.1,solid:false});
 for(const v of[D*.38,D*.68])for(const u of[-hw*.45,hw*.45]){F(u-.01,fy+4.45,v-.01,u+.01,fy+5,v+.01,C.dark,{solid:false});F(u-.16,fy+4.25,v-.16,u+.16,fy+4.45,v+.16,C.warm,{e:3,solid:false})}
 if(key==='apparel'||key==='sports'){for(const sd of[-1,1]){const u=sd*(hw-.6);F(u-.02,fy+1.62,1.2,u+.02,fy+1.66,D-2.6,C.steel,{s:.8,solid:false});
   const gh=hue+rnd(-60,60);for(let v=1.3;v<D-2.7;v+=.13)F(u-.26,fy+.75+rnd(0,.15),v-.02,u+.26,fy+1.6,v+.02,hsl(gh+rnd(-40,40),rnd(.25,.75),rnd(.2,.7)),{solid:false})}}
 if(key==='apparel'){F(-.9,fy,1.25,.9,fy+.78,2.05,C.wood);for(let u=-.75;u<.7;u+=.33)for(const v of[1.45,1.8]){const n=2+Math.floor(R()*5),cc=hsl(rnd(0,360),rnd(.2,.6),rnd(.3,.75));F(u,fy+.78,v-.12,u+.28,fy+.78+n*.05,v+.12,cc,{solid:false})}}
 if(key==='jewelry'||key==='music'||key==='home'||key==='beauty')for(let u=-hw+1;u<hw-1;u+=.6)F(u,fy+3,D-.6,u+.5,fy+3.04,D-.3,C.white,{solid:false}),F(u+.05,fy+3.04,D-.55,u+.45,fy+3.04+rnd(.1,.3),D-.35,hsl(rnd(0,360),.5,.55),{solid:false});
};

/* ---------- one store ---------- */
function shop(px,pz,ax,az,nx,nz,w,D,lvl,key,o){o=o||{};
 const cat=CATS[key]||CATS.apparel,fy=lvl*FH,H=lvl?6:5.6,F=frame(px,pz,ax,az,nx,nz),hw=w/2;
 const hue=rnd(cat.h[0],cat.h[1]),neon=hsl(hue,.95,.62),accent=hsl(hue+rnd(-20,20),.55,.42);
 let wallC=hsl(hue+rnd(-20,20),rnd(.1,.35),rnd(.55,.85));if(cat.dark)wallC=hsl(hue,.3,.08);if(cat.velvet)wallC=hsl(hue+300,.45,.18);if(cat.pale)wallC=hsl(hue,.35,.88);
 const wo=cat.stripes?{pat:4}:{pat:11};
 for(const[u0,u1]of[[-hw,-hw+.25],[hw-.25,hw]]){if(o.door){F(u0,fy,0,u1,fy+H,o.door[0],wallC,wo);F(u0,fy,o.door[1],u1,fy+H,D,wallC,wo);F(u0,fy+4.2,o.door[0],u1,fy+H,o.door[1],wallC,wo)}else F(u0,fy,0,u1,fy+H,D,wallC,wo)}
 if(o.back){F(-hw,fy,D-.25,-3,fy+H,D,wallC,wo);F(3,fy,D-.25,hw,fy+H,D,wallC,wo);F(-3,fy+4.2,D-.25,3,fy+H,D,wallC,wo)}else F(-hw,fy,D-.25,hw,fy+H,D,wallC,wo);
 const fc=cat.fp===2?hsl(30,.4,.42):cat.fp===3?hsl(hue,.35,.22):hsl(hue,.08,.85);
 F(-hw,fy,0,hw,fy+.02,D,o.marble?hsl(35,.1,.85):fc,{pat:o.marble?7:[0,12,2,10][cat.fp],s:cat.fp===1?.55:.25,solid:false});
 F(-hw,fy+5,0,hw,fy+H,D,C.ceil);
 const op=o.open||hw-.4;
 F(-hw,fy+4,-.05,hw,fy+5,.3,C.facade);F(-hw,fy,-.1,-op,fy+4,.3,C.facade);F(op,fy,-.1,hw,fy+4,.3,C.facade);
 const sw=o.signW||hw*.82,sh=o.signH||.9,name=o.name||nameFor(cat,key);
 F(-sw,fy+4.08,-.28,sw,fy+4.08+sh,-.06,neon,{e:3.2,sign:addName(name,o.font||cat.font,o.up??cat.up),face:faceOf(nx,nz)});
 const closed=!o.big&&chance(.07);
 const lc=cat.dark?hsl(rnd(250,330),.75,.6):tint(C.warm,neon,.25),I=(cat.dark?4:cat.velvet?6.5:5)*(closed?.35:1);
 if(o.big){for(let u=-hw+4;u<hw-2;u+=7)for(let v=3;v<D-1;v+=6.5){F(u-1.2,fy+4.96,v-.4,u+1.2,fy+5,v+.4,C.white,{e:2.4,solid:false});F.L(u,fy+4.4,v,C.warm,6,9.5)}}
 else for(const v of[D*.3,D*.72]){F(-1.2,fy+4.96,v-.4,1.2,fy+5,v+.4,tint(C.white,lc,.3),{e:closed?.4:2.4,solid:false});F.L(0,fy+4.4,v,lc,I,8.5,{f:closed||chance(.03)})}
 const c={F,fy,hw,D,hue,neon,accent,nx,nz,big:!!o.big};
 if(o.big){for(let v=4;v<D-3;v+=3.2)for(let u=-hw+2;u<hw-6;u+=5.5){const gh=rnd(0,360);rack(c,v,u,u+4,()=>hsl(gh+rnd(-30,30),rnd(.3,.7),rnd(.25,.7)))}
  for(let u=-hw+2;u<hw-3;u+=4.2)if(Math.abs(u+1.4)>op+.5)glowCase(c,u,1.6,u+2.8,2.4);for(let u=-op+1;u<op-.5;u+=2.2)mannequin(c,u,.9,rnd(0,360))}
 else{cat.props(c);extras(c,key)}
 {const[sx0,sz0]=xp(...F.w(0,0)),[wnx,wnz]=xd(nx,nz);shops.push({x:sx0,z:sz0,nx:wnx,nz:wnz,fy,hw,D,key,name,big:!!o.big,closed,counter:!!c.counter,w:(u,v)=>xp(...F.w(u,v))})}
 if(closed)F(-op+.05,fy+2.5,.02,op-.05,fy+4,.14,C.steel,{pat:6,s:.5});
 stores++}

// railings
function rail(x0,z0,x1,z1,y=6){const len=Math.hypot(x1-x0,z1-z0),ax=x1!==x0,th=.08,mx=(x0+x1)/2,mz=(z0+z1)/2;
 box(mx,y+1.05,mz,ax?len:th,.07,ax?th:len,C.steel,{s:.8});box(mx,y+1.0,mz,ax?len:.04,.03,ax?.04:len,C.warm,{e:1.2,solid:false});
 box(mx,y+.08,mz,ax?len:th*1.5,.16,ax?th*1.5:len,C.trim);box(mx,y+.55,mz,ax?len:.02,.8,ax?.02:len,C.glass,{glass:1,solid:false});
 const n=Math.max(1,Math.round(len/1.6));for(let k=0;k<=n;k++)box(x0+(x1-x0)*k/n,y+.55,z0+(z1-z0)*k/n,.06,1,.06,C.steel)}
const ang=Math.atan2(6,10.4),EL=Math.hypot(6,10.4);
const esc=(cx,z,sx,y0=0)=>{const r=sx*ang,cs=Math.cos(r),sn=Math.sin(r),bx=cx-sx*5.2;ESC.push({bx:cx-sx*5.6,tx:cx+sx*5.6,z,sx,y0});
 box(cx,3+y0,z,EL+.6,.45,1.5,hsl(220,.08,.3),{rot:r,s:.6});
 for(const e of[-.72,.72]){box(cx-sn*.65,3+y0+cs*.65,z+e,EL,1,.08,C.glass,{rot:r,glass:1});box(cx-sn*1.17,3+y0+cs*1.17,z+e,EL,.07,.12,hsl(200,.8,.6),{rot:r,e:1.6,solid:false})}
 B(bx-sx*1.2,y0,z-.9,bx,y0+.04,z+.9,C.steel,{s:.8,solid:false})};
const STEEL=hsl(40,.04,.86),GL=hsl(185,.25,.75);
function vault(spanHalf,rise,nSeg,along,c0,c1,ribStep,base=12.4,c2=0){ // along: 'x' (arch in z-y) or 'z' (arch in x-y)
 const R=(spanHalf*spanHalf+rise*rise)/(2*rise),cy=base+rise-R,pm=Math.asin(spanHalf/R),len=Math.abs(c1-c0),cm=(c0+c1)/2,ax=along==='x'?1:0;
 const P=a=>[R*Math.sin(a)+c2,cy+R*Math.cos(a)];
 const put=(s,y,c,ss,sy,sc,col,o)=>ax?box(c,y,s,sc,sy,ss,col,o):box(s,y,c,ss,sy,sc,col,o);
 for(let k=0;k<nSeg;k++){const a0=-pm+2*pm*k/nSeg,a1=a0+2*pm/nSeg,am=(a0+a1)/2,[s0,y0]=P(a0),[s1,y1]=P(a1);
  const sc=(s0+s1)/2,yc=(y0+y1)/2,ch=Math.hypot(s1-s0,y1-y0)+.02,r=Math.atan2(y1-y0,s1-s0),is=Math.sin(am),ic=Math.cos(am);
  put(sc,yc,cm,ch,.03,len,GL,{glass:1,rot:r,ax,solid:false});
  put(s0-.1*Math.sin(a0),y0-.1*Math.cos(a0),cm,.1,.14,len,STEEL,{solid:false,s:.5});
  for(let c=Math.min(c0,c1);c<=Math.max(c0,c1)+.01;c+=ribStep)put(sc-.2*is,yc-.2*ic,c,ch,.34,.16,STEEL,{rot:r,ax,solid:false,s:.5})}
 return s=>cy+Math.sqrt(Math.max(0,R*R-(s-c2)*(s-c2)))}
const W8=hsl(190,.7,.5);
const chairC=[hsl(0,.7,.5),hsl(45,.85,.55),hsl(200,.7,.5),hsl(140,.5,.45)];
const planter=(x,z)=>{B(x-1.2,0,z-1.2,x+1.2,.7,z+1.2,C.pot);B(x-1.1,.7,z-1.1,x+1.1,.75,z+1.1,hsl(25,.4,.18),{solid:false});B(x-.1,.7,z-.1,x+.1,2,z+.1,BARK);
 tree(x,.75,z,rnd(3.6,4.4));shrubs(x,.75,z,1,1,110)};
const fountain=(x,z)=>{B(x-1.7,0,z-1.7,x+1.7,.55,z-1.4,C.facade);B(x-1.7,0,z+1.4,x+1.7,.55,z+1.7,C.facade);B(x-1.7,0,z-1.4,x-1.4,.55,z+1.4,C.facade);B(x+1.4,0,z-1.4,x+1.7,.55,z+1.4,C.facade);
 B(x-1.4,0,z-1.4,x+1.4,.4,z+1.4,W8,{e:1.1,pat:8,solid:false});B(x-.2,0,z-.2,x+.2,1.1,z+.2,C.facade);
 for(let k=0;k<8;k++){const a=k/8*6.283;jet(x+Math.sin(a)*.15,1.1,z+Math.cos(a)*.15,Math.sin(a)*1.5,2.4,Math.cos(a)*1.5,.4,34,.06)}
 jet(x,1.1,z,0,3.6,0,.4,70,.15);light(x,.9,z,W8,3,6);fpush(x,.8,z,0)};
const bench=(x,z,alongX)=>{const a=alongX?1.1:.3,b=alongX?.3:1.1;B(x-a,.42,z-b,x+a,.5,z+b,C.wood);B(x-a+.1,0,z-b+.05,x-a+.2,.42,z+b-.05,C.steel);B(x+a-.2,0,z-b+.05,x+a-.1,.42,z+b-.05,C.steel)};
const kiosk=(x,z)=>{const h=rnd(0,360),k=hsl(h,.5,.4);B(x-1.4,0,z-.9,x+1.4,1,z+.9,k);B(x-1.5,1,z-1,x+1.5,1.06,z+1,C.white,{s:.6});
 for(const[dx,dz]of[[-1.4,-.9],[1.4,-.9],[-1.4,.9],[1.4,.9]])B(x+dx-.04,1.06,z+dz-.04,x+dx+.04,2.6,z+dz+.04,C.steel);
 B(x-1.6,2.6,z-1.1,x+1.6,2.8,z+1.1,hsl(h,.85,.55),{e:1.6});for(let q=0;q<8;q++){const s=rnd(.12,.25),u=rnd(-1.2,1.2),w=rnd(-.7,.7);B(x+u-s/2,1.06,z+w-s/2,x+u+s/2,1.06+s,z+w+s/2,hsl(rnd(0,360),.8,.55),{solid:false})}};

/* ---------- themed districts ---------- */
/* ---------- toolkit for district files ---------- */
// Every district is 120 m wide and 140 m deep in its own frame: you arrive at (0,0) heading +z and can
// leave straight ahead at (0,140) into the next district. A 6 m promenade runs along x=0 (and across at z=70) and is kept clear.
let NK;
const DW=60,DD=140,DH=3.2,MID=DD/2;
const nn=(x,y,z)=>{const k=x.toFixed(1)+','+y+','+z.toFixed(1);if(NK.has(k))return NK.get(k);const[a,b]=xp(x,z);NAV.n.push({x:a,y,z:b});NK.set(k,NAV.n.length-1);return NAV.n.length-1};
const nl=(a,b,e=0)=>{if(a!==b)NAV.l.push([a,b,e])};
const npath=(pts,y=0,loop=false)=>{let pr=-1,first=-1;for(const[x,z]of pts){const i=nn(x,y,z);if(pr>=0)nl(pr,i);else first=i;pr=i}if(loop&&first>=0)nl(pr,first)};
const ring=(cx,cz,rx,rz,n,y=0)=>{const pts=[];for(let k=0;k<n;k++){const a=k/n*6.283;pts.push([cx+Math.cos(a)*rx,cz+Math.sin(a)*rz])}npath(pts,y,true);return pts};
const join=(x0,z0,x1,z1,y=0)=>nl(nn(x0,y,z0),nn(x1,y,z1));
const stand=(x,z,yaw,y=0)=>{const[a,b]=xp(x,z);idle.push(a,y,b,yaw+XF.q*Math.PI/2)};
const ride=(mesh,a,b,c,d)=>{const[wx,wz]=xp(a[0],a[2]);(rides[mesh]=rides[mesh]||[]).push(wx,a[1],wz,(a[3]||0)+XF.q*Math.PI/2,...b,...c,...d)};
const idF=frame(0,0,1,0,0,1),ctx=(fy,hue)=>({F:idF,fy,hw:DW,D:DD,hue,neon:hsl(hue,.95,.62),accent:hsl(hue,.55,.42)});
const T=t=>addName(t,'900 {s} system-ui,sans-serif',1);
// packaged goods with printed labels (js/labels.js). Each kind steps through its designs, so neighbours never match.
let LCNT={};
const lblCode=kind=>{const[b,n]=LABEL_RANGES[kind],st={box:7,can:5,bottle:7,book:9,record:5}[kind];LCNT[kind]=((LCNT[kind]??Math.floor(R()*n))+st)%n;return-(b+LCNT[kind])-2};
const GDIM={box:[.22,.3,.07],can:[.08,.11,.08],bottle:[.08,.28,.08],book:[.17,.25,.03],record:[.31,.31,.015]};
// one item standing on a surface at (x,y,z), its label facing dir (0:+z 1:-z 2:+x 3:-x)
const goods=(kind,x,y,z,dir,s=1)=>{const[w,h,d]=GDIM[kind].map(v=>v*s),ax=dir<2;box(x,y+h/2,z,ax?w:d,h,ax?d:w,hsl(0,0,.78),{pat:30,sign:lblCode(kind),face:dir,solid:false})};
// a row of items along a line, evenly spaced
const goodsRow=(kind,x0,z0,x1,z1,y,dir,n,s=1)=>{for(let k=0;k<n;k++){const t=(k+.5)/n;goods(typeof kind==='string'?kind:pick(kind),x0+(x1-x0)*t,y,z0+(z1-z0)*t,dir,s)}};
function shell(o){
 const H=o.h??10,wc=o.wallCol??C.facade,wp=o.wallPat??11;
 B(-DW,-.4,0,DW,0,DD,o.floor??C.floor,{pat:o.floorPat??12,s:.3});
 const seg=(x0,z0,x1,z1)=>{if(o.glassWalls){B(x0,0,z0,x1,1.1,z1,wc,{pat:wp});B(x0,1.1,z0,x1,H,z1,GL,{glass:1})}else B(x0,0,z0,x1,H,z1,wc,{pat:wp})};
 if(!o.open){for(const z of[0,DD]){const z0=z?DD-.4:0,z1=z?DD:.4;if(z&&o.end){seg(-DW,z0,DW,z1);continue}seg(-DW,z0,-DH,z1);seg(DH,z0,DW,z1);if(H>4.6)B(-DH,4.6,z0,DH,H,z1,wc,{pat:wp})}
  for(const sx of[-1,1]){const x0=sx<0?-DW:DW-.4,x1=sx<0?-DW+.4:DW;seg(x0,0,x1,DD)}}
 const dp=(x,z,dx,dz)=>{const[wx,wz]=xp(x,z),[a,b]=xd(dx,dz);doors.push({x:wx,z:wz,dx:a,dz:b})};
 // one way in (behind you) and one way on (straight ahead): the districts form a single straight line
 dp(0,0,0,-1);if(!o.end)dp(0,DD,0,1);  // o.end: the last area, nothing beyond it
 const sy=o.signY??(H>5?5.2:3.4),SC=hsl(150,.9,.55);
if(!o.end)box(0,sy,DD-1,STOP.next?10:5,.7,.2,SC,{e:3,sign:T(STOP.next?'Next: '+STOP.next+'  →':'Explore →'),face:1,solid:false});
 // a 'you are here' board just inside the entrance
 if(STOP.num){const bx=-5.2,bz=3;B(bx-.08,0,bz-1,bx+.08,2.6,bz+1,C.dark);box(bx+.1,2.25,bz,.03,.32,1.8,hsl(45,.9,.62),{e:2.5,sign:T('You are here'),face:2,solid:false});
  box(bx+.1,1.8,bz,.03,.36,1.8,C.white,{e:2,sign:addName(o.title||'',o.font??'900 {s} Georgia,serif',1),face:2,solid:false});
  box(bx+.1,1.4,bz,.03,.26,1.8,hsl(150,.8,.55),{e:2,sign:T('District '+STOP.num+' of '+STOP.total),face:2,solid:false})}
 if(o.title)box(0,o.titleY??(H>7?7:3.8),12,16,1.8,.2,o.titleCol??hsl(45,.9,.62),{e:3.2,sign:addName(o.title,o.font??'900 {s} Georgia,serif',1),face:1,solid:false});
 if(o.title&&(o.titleY??(H>7?7:3.8))<5){B(-8.2,0,11.8,-7.9,(o.titleY??3.8)+.9,12.2,C.dark);B(7.9,0,11.8,8.2,(o.titleY??3.8)+.9,12.2,C.dark)}
 if(o.roof==='flat'){B(-DW,H,0,DW,H+.4,DD,o.ceil??C.ceil);if(o.panels!==false)for(let x=-48;x<=48;x+=12)for(let z=8;z<DD;z+=12){B(x-.9,H-.05,z-.9,x+.9,H,z+.9,C.white,{e:2.3,solid:false});light(x,H-.6,z,o.lightCol??C.warm,o.lightI??7,13)}}
 if(o.roof==='glass')vault(DW,o.rise??14,24,'z',0,DD,10,H);
 if(!o.open){npath(Array.from({length:41},(_,k)=>[0,1+k*3.45]));npath(Array.from({length:35},(_,k)=>[-59+k*118/34,MID]))}
}
const lamp=(x,z,h=4,col=C.warm,I=5)=>{B(x-.06,0,z-.06,x+.06,h,z+.06,C.dark);B(x-.22,h,z-.22,x+.22,h+.4,z+.22,col,{e:3,solid:false});light(x,h-.2,z,col,I,9)};
const bulbs=(x0,z0,x1,z1,y,n,sag=.8)=>{for(let k=0;k<=n;k++){const t=k/n,x=x0+(x1-x0)*t,z=z0+(z1-z0)*t,yy=y-sag*4*t*(1-t);B(x-.06,yy-.06,z-.06,x+.06,yy+.06,z+.06,hsl([45,0,120,200,300][k%5],.9,.6),{e:4,solid:false})}};
const umbrella=(x,z,col)=>{B(x-.04,0,z-.04,x+.04,2.3,z+.04,C.steel,{solid:false});for(let k=0;k<10;k++){const a=k/10*6.283;part(x+Math.sin(a)*.62,2.25,z+Math.cos(a)*.62,.7,.02,1.25,k%2?col:C.white,a,.32,0,0)}};
const rock=(x,z,s)=>{for(let k=0;k<3;k++)part(x+rnd(-s,s)*.4,s*.25,z+rnd(-s,s)*.4,s*rnd(.6,1),s*rnd(.4,.7),s*rnd(.6,1),hsl(30,.06,rnd(.25,.4)),rnd(0,6.28),rnd(-.3,.3),rnd(-.3,.3),0)};
const conifer=(x,z,h,kind)=>{const card=kind||(rnd(0,1)<.5?'card_fir':'card_pine');trunk(x,0,z,h*.95,h*.02+.12,'trunk_fir');
 for(let l=0;l<11;l++){const t=l/11,y=h*(.16+.8*t),r=h*.27*(1-t)+.5,n=Math.round(5+r*2.2);
  for(let k=0;k<n;k++){const a=k/n*6.283+rnd(0,.5)+l*.7;model(card,x,y,z,a,r/2*rnd(.85,1.15),{pitch:rnd(1.05,1.35),roll:rnd(-.25,.25),tint:leafTint(.95),sway:.25})}}
 model(card,x,h*.94,z,rnd(0,6),.7,{tint:leafTint()})};
const bigTree=(x,z,h,card)=>{const tx=x+rnd(-.3,.3),tz=z+rnd(-.3,.3);trunk(x,0,z,h*.66,.05*h);
 for(let k=0;k<5;k++){const a=k*1.26+rnd(0,.5);model('trunk_broad',tx,h*rnd(.38,.52),tz,a,[.022*h,h*.42,.022*h],{pitch:rnd(.55,.85)})}
 crown(tx,h*.74,tz,h*.42,h*.27,0,rnd(90,128),1,card)};
const flowers=(x,z,rx,rz,n,hue)=>{model('card_grass',x,0,z,rnd(0,6),Math.max(rx,rz)*.9,{tint:leafTint()});for(let k=0;k<n*.35;k++){const px=x+rnd(-rx,rx),pz=z+rnd(-rz,rz),l=rnd(.08,.15);part(px,rnd(.05,.4),pz,l*.8,l*.3,l,rnd(0,1)<.35?hsl(hue+rnd(-25,25),.8,.55):hsl(rnd(95,130),.5,rnd(.12,.25)),rnd(0,6.28),rnd(-1.4,-.3),rnd(-.4,.4),4)}};
const bed=(x,z,w,d,hue)=>{B(x-w,0,z-d,x+w,.35,z+d,hsl(25,.15,.35),{pat:22});B(x-w+.15,.35,z-d+.15,x+w-.15,.38,z+d-.15,hsl(25,.4,.12),{solid:false});flowers(x,z+0,w-.3,d-.3,Math.round(w*d*14),hue)};
const people=(x0,z0,x1,z1,n)=>{for(let k=0;k<n;k++)stand(rnd(x0,x1),rnd(z0,z1),rnd(0,6.28))};
// a rideable water slide: an open trough along the points (local [x,y,z]); walking into the top end rides it
const slide=(pts,col)=>{for(let k=0;k<pts.length-1;k++){const[a,b]=[pts[k],pts[k+1]],dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz),yaw=Math.atan2(dx,dz),pitch=-Math.asin(dy/l),mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,mz=(a[2]+b[2])/2,c=Math.cos(yaw),s=Math.sin(yaw);
  part(mx,my-.05,mz,1.15,.1,l+.08,col,yaw,pitch,0,0);for(const o of[-.6,.6])part(mx+c*o,my+.22,mz-s*o,.08,.5,l+.08,col,yaw,pitch,0,0);
  if(k%3===0&&a[1]>1)stick(a[0],0,a[2],a[0],a[1]-.15,a[2],.16,C.white)}
 slides.push(pts.map(([x,y,z])=>{const[a,b]=xp(x,z);return[a,y,b]}))};
// textured rocks, hedges, grass, logs
const rockB=(x,z,s,y=0)=>{for(let k=0;k<3;k++){const w=s*rnd(.5,1),h=s*rnd(.35,.8);box(x+rnd(-s,s)*.35,y+h/2,z+rnd(-s,s)*.35,w,h,w*rnd(.7,1.2),hsl(30,.05,rnd(.5,.7)),{pat:27,rot:rnd(-.25,.25)})}};
const hedge=(x0,z0,x1,z1,h=1.1)=>{const l=Math.hypot(x1-x0,z1-z0),n=Math.max(2,Math.round(l/.9));for(let k=0;k<=n;k++){const t=k/n;model('card_shrub',x0+(x1-x0)*t,0,z0+(z1-z0)*t,rnd(0,6.28),h*rnd(.85,1.1),{tint:leafTint(.85),sway:.2})}
 const dx=x1-x0,dz=z1-z0;mark(Math.min(x0,x1)-(Math.abs(dz)>Math.abs(dx)?.4:0),0,Math.min(z0,z1)-(Math.abs(dx)>=Math.abs(dz)?.4:0),Math.max(x0,x1)+(Math.abs(dz)>Math.abs(dx)?.4:0),h,Math.max(z0,z1)+(Math.abs(dx)>=Math.abs(dz)?.4:0))};
const grassPatch=(x0,z0,x1,z1,n)=>{for(let k=0;k<n;k++)model('card_grass',rnd(x0,x1),0,rnd(z0,z1),rnd(0,6.28),rnd(.7,1.3),{tint:leafTint(),sway:.4})};
const log=(x,z,len,yaw,r=.35)=>{model('trunk_fir',x,r,z,yaw,[r,len,r],{pitch:Math.PI/2,tint:[.8,.75,.7]});const c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw));mark(x-s*len-r,0,z-c*len-r,x+s*len+r,r*2,z+c*len+r)};
// everything a district file may use (see js/districts/*.js)
// a boarding spot for a fair ride: stand inside radius r of (x,z) and the next seat of that ride that comes within
// 'reach' (and below 'top', if given) carries you round; you are set down at 'out' afterwards. A glowing pad marks it.
const board=(x,z,r,mesh,o={})=>{const[wx,wz]=xp(x,z),[ox,oz]=xp(...(o.out||[x,z-r-1.5]));boards.push({x:wx,z:wz,r,mesh,reach:o.reach??2,top:o.top??99,near:!!o.near,dz:o.dz,laps:o.laps??1,y:o.y??0,out:[ox,oz]});
 for(let k=0;k<20;k++){const a=k/20*6.283;B(x+Math.cos(a)*r-.12,(o.y??0)+.01,z+Math.sin(a)*r-.12,x+Math.cos(a)*r+.12,(o.y??0)+.04,z+Math.sin(a)*r+.12,hsl(150,.9,.55),{e:2.5,solid:false})}};
const K={board,goods,goodsRow,slide,rockB,hedge,grassPatch,log,leafTint,model,trunk,MODELS,B,box,mark,part,stick,crown,tree,shrubs,palm,jet,bird,light,frame,addName,shop,rail,esc,vault,planter,fountain,bench,kiosk,seat,fpush,rack,mannequin,glowCase,counter,hsl,rnd,pick,chance,C,GL,STEEL,W8,BARK,chairC,xp,xd,idF,DW,DD,DH,MID,nn,nl,npath,ring,join,stand,ride,ctx,T,shell,lamp,bulbs,umbrella,rock,conifer,bigTree,flowers,bed,people,get ESC(){return ESC}};

/* ---------- the hub ---------- */
function buildHub(){
/* ---------- structure ---------- */
B(-150,-.4,-85,150,0,85,C.floor,{pat:1,s:.6});
const CEIL=(x0,z0,x1,z1)=>B(x0,12,z0,x1,12.4,z1,C.ceil);
CEIL(-150,26,150,85);CEIL(-150,-85,150,-26);
for(const sd of[-1,1]){CEIL(16*sd,7,150*sd,26);CEIL(16*sd,-26,150*sd,-7);CEIL(120*sd,-7,150*sd,7)}
const US=(x0,z0,x1,z1)=>B(x0,5.6,z0,x1,6,z1,C.floor,{pat:1,s:.6});
for(const sd of[-1,1]){US(-120,3*sd,-16,17*sd);US(16,3*sd,120,17*sd);US(-16,26*sd,16,36*sd);US(-16,22*sd,16,26*sd);US(12*sd,-22,16*sd,22);
 for(const wx of[-60,60]){US(wx-14,17*sd,wx+14,57*sd);US(wx-16,57*sd,wx+16,77*sd)}
 B(16*sd,0,17,16*sd+.3*sd,12,26,C.facade);B(16*sd,0,-26,16*sd+.3*sd,12,-17,C.facade)}
const BR=[-88,-40,40,88];for(const b of BR)US(b-2,-3,b+2,3);
for(const z of[-3,3])for(const[a,b]of[[16,38],[42,86],[90,120],[-120,-90],[-86,-42],[-38,-16]])rail(a,z,b,z);
for(const b of BR)for(const e of[-2,2]){rail(b+e,-3,b+e,-.95);rail(b+e,.95,b+e,3)}
for(const sd of[-1,1]){rail(-12,22*sd,12,22*sd);rail(16*sd,-3,16*sd,3);for(const[a,b]of[[-22,-10.9],[-9.1,-7],[-3,3],[7,9.1],[10.9,22]])rail(12*sd,a,12*sd,b)}
// two upper bridges straight across the food court, so the upper walkway runs straight from end to end
for(const sd of[-1,1]){US(-12,3*sd,12,7*sd);rail(-12,3*sd,12,3*sd);rail(-12,7*sd,12,7*sd);for(let x=-9;x<=9;x+=6){B(x-.9,5.55,5*sd-.35,x+.9,5.6,5*sd+.35,C.white,{e:2.2,solid:false});light(x,5.15,5*sd,C.warm,6,9)}}
// escalators

for(const sx of[1,-1])for(const sz of[1,-1])esc(sx*6.8,sz*10,sx);
for(const b of BR){esc(b-7.2,0,1);esc(b+7.2,0,-1)}
// glass barrel vaults: one along each concourse, a taller one over the court

for(let x=-113;x<=113;x+=14){if(Math.abs(x)<18)continue;light(x,10.8,0,C.warm,7,15,{both:1})}
for(const x of[-8,0,8])for(const z of[-16,-8,0,8,16])light(x,10.5,z,C.warm,7,17,{both:1});

const yCon=vault(7,4.5,12,'x',16,120,6);vault(7,4.5,12,'x',-16,-120,6);
const yCourt=vault(16,7.5,16,'z',-26,26,4);
const roofY=(x,z)=>Math.abs(x)<16?yCourt(x):Math.abs(z)<7?yCon(z):12;
// gables: glass where the vaults meet, plaster at the anchor ends
for(const sd of[-1,1]){
 for(let s=-16;s<16;s+=.5){const h=Math.min(yCourt(s),yCourt(s+.5));box(s+.25,(12.4+h)/2,26*sd,.5,h-12.4,.03,GL,{glass:1,solid:false});
  if(Math.abs(s%2)<.01)box(s,(12.4+yCourt(s))/2,26*sd,.08,yCourt(s)-12.4,.12,STEEL,{solid:false})}
 for(let s=-7;s<7;s+=.5){const h=Math.min(yCon(s),yCon(s+.5));box(16*sd,(12.4+h)/2,s+.25,.03,h-12.4,.5,GL,{glass:1,solid:false});
  B(120*sd,12.4,s,121*sd,Math.max(yCon(s),yCon(s+.5))+.1,s+.5,C.facade,{solid:false});
  if(Math.abs(s%2)<.01)box(16*sd,(12.4+yCon(s))/2,s,.12,yCon(s)-12.4,.08,STEEL,{solid:false})}}
for(let x=-114;x<=114;x+=6){if(Math.abs(x)<17)continue;for(const z of[-5,5]){B(x-.9,5.55,z-.35,x+.9,5.6,z+.35,C.white,{e:2.2,solid:false});
 if(Math.abs(x)%12===6)light(x,5.15,z,C.warm,7,10,{f:chance(.05)})}}
// court: fountain, food court tables, hanging signs

B(-3.5,0,-3.5,3.5,.6,-3.1,C.facade);B(-3.5,0,3.1,3.5,.6,3.5,C.facade);B(-3.5,0,-3.1,-3.1,.6,3.1,C.facade);B(3.1,0,-3.1,3.5,.6,3.1,C.facade);
B(-3.1,0,-3.1,3.1,.45,3.1,W8,{e:1.2,pat:8,solid:false});B(-.6,0,-.6,.6,2.2,.6,C.facade);B(-1.4,2.2,-1.4,1.4,2.4,1.4,C.facade);
B(-1.2,2.4,-1.2,1.2,2.45,1.2,W8,{e:1.4,pat:8,solid:false});B(-.15,2.45,-.15,.15,3.6,.15,hsl(190,.5,.8),{e:2.5,solid:false});
light(0,1.3,-4,W8,5,8);light(0,1.3,4,W8,5,8);
fpush(0,1,0,1);
for(let k=0;k<16;k++){const a=k/16*6.283;jet(Math.sin(a)*1.35,2.43,Math.cos(a)*1.35,Math.sin(a)*.9,.4,Math.cos(a)*.9,.45,26,.08)}
jet(0,3.6,0,0,4.6,0,2.45,140,.25);
for(let k=0;k<12;k++){const a=k/12*6.283+.13;jet(Math.sin(a)*3.25,.6,Math.cos(a)*3.25,-Math.sin(a)*1.5,3.4,-Math.cos(a)*1.5,.45,40,.05)}
for(const sx of[-1,1]){const x=sx*4.6,z=0;B(x-.6,0,z-.6,x+.6,.6,z+.6,C.pot);shrubs(x,.6,z,.5,.5,70);palm(x,z,rnd(8,9.5))}

for(let x=-10.5;x<=10.5;x+=3.5)for(let z=-19.5;z<=19.5;z+=3.25){if((Math.abs(x)<5&&Math.abs(z)<5)||(Math.abs(z)>7.8&&Math.abs(z)<12.2)||Math.abs(Math.abs(z)-6.5)<.1)continue;
 B(x-.55,.72,z-.55,x+.55,.78,z+.55,C.white,{s:.5,solid:false});B(x-.07,0,z-.07,x+.07,.72,z+.07,C.steel,{solid:false});const cc=pick(chairC);
 for(const[dx,dz]of[[-.85,0],[.85,0],[0,-.85],[0,.85]]){B(x+dx-.22,.42,z+dz-.22,x+dx+.22,.48,z+dz+.22,cc,{solid:false});B(x+dx-.04,0,z+dz-.04,x+dx+.04,.42,z+dz+.04,C.steel,{solid:false});
  seat(x+dx*1.08,z+dz*1.08,Math.atan2(-dx,-dz));const bx=x+dx*1.25,bz=z+dz*1.25;B(bx-(dx?.03:.22),.48,bz-(dz?.03:.22),bx+(dx?.03:.22),.95,bz+(dz?.03:.22),cc,{solid:false})}}
const hs=(x,y,z,sx,sz,face,t)=>{box(x,y,z,sx,1.3,sz,hsl(45,.9,.6),{e:3,sign:addName(t,'900 {s} system-ui,sans-serif',1),face,solid:false});const top=roofY(x,z);for(const o of sx>sz?[-sx/2+.5,sx/2-.5]:[-sz/2+.5,sz/2-.5])box(x+(sx>sz?o:0),(y+.65+top)/2,z+(sx>sz?0:o),.02,top-y-.65,.02,C.dark,{solid:false})};
hs(0,9,-21.6,9,.2,0,'Food Court');hs(0,9,21.6,9,.2,1,'Food Court');hs(20,9.6,0,.2,7.5,2,'East Concourse');hs(-20,9.6,0,.2,7.5,3,'West Concourse');
// concourse centre: kiosks, planters, benches
let ki=0;for(let x=-112;x<=112;x+=8){if(Math.abs(x)<20||BR.some(b=>Math.abs(x-b)>1&&Math.abs(x-b)<14))continue;const t=ki++%3;if(t===0)kiosk(x,0);else if(t===1)planter(x,0);else{bench(x,-1.6,1);bench(x,1.6,1)}}
// main concourse stores
for(const lvl of[0,1])for(let x=-120;x<120;x+=8){const cx=x+4;if(Math.abs(cx)<16||Math.abs(Math.abs(cx)-60)<1)continue;
 for(const sd of[-1,1])shop(cx,7*sd,1,0,0,sd,8,10,lvl,pick(SHOPCATS))}
// court stores: food on the ground floor
for(const lvl of[0,1])for(const cx of[-12,-4,4,12])for(const sd of[-1,1])shop(cx,26*sd,1,0,0,sd,8,10,lvl,lvl?pick(SHOPCATS):'food');
// wings
for(const wx of[-60,60])for(const sz of[-1,1]){
 for(const lvl of[0,1])for(let k=0;k<5;k++){const zc=sz*(21+k*8);if(!(k===4&&wx<0))shop(wx-4,zc,0,1,-1,0,8,10,lvl,pick(SHOPCATS));if(!(k===4&&wx>0))shop(wx+4,zc,0,1,1,0,8,10,lvl,pick(SHOPCATS))}
 for(let z=19;z<56;z+=8){const zz=z*sz;B(wx-.9,5.55,zz-.9,wx+.9,5.6,zz+.9,C.white,{e:2.2,solid:false});light(wx,5.15,zz,C.warm,7,10,{f:chance(.06)});
  B(wx-.9,11.55,zz-.9,wx+.9,11.6,zz+.9,C.white,{e:2.2,solid:false});light(wx,11.1,zz,C.warm,8,10,{f:chance(.06)})}
 planter(wx,23*sz);bench(wx,29*sz,0);fountain(wx,35*sz);bench(wx,41*sz,0);planter(wx,47*sz)}
// loop corridors (both levels, lined with shops) so every route carries on
for(const sx of[-1,1])for(const sz of[-1,1]){
 const X=v=>v*sx,Z=v=>v*sz,W=(x0,z0,x1,z1)=>B(X(x0),0,Z(z0),X(x1),12,Z(z1),C.facade);
 B(X(64),5.6,Z(49),X(130),6,Z(57),C.floor,{pat:1,s:.6});B(X(122),5.6,Z(17),X(130),6,Z(49),C.floor,{pat:1,s:.6});
 W(74,48.7,76,49);W(108,48.7,109,49);W(111.2,48.7,122,49);B(X(109),2.5,Z(48.7),X(111.2),12,Z(49),C.facade);W(121.7,17,122,21);W(121.7,45,122,49);W(130,17,130.3,21);W(130,45,130.3,57.3);W(76,57,80,57.3);W(120,57,130.3,57.3);
 for(const lvl of[0,1]){for(const cx of[84,92,100,108,116])shop(X(cx),Z(57),1,0,0,sz,8,10,lvl,pick(SHOPCATS));
  for(const zc of[25,33,41]){shop(X(122),Z(zc),0,1,-sx,0,8,10,lvl,pick(SHOPCATS));shop(X(130),Z(zc),0,1,sx,0,8,10,lvl,pick(SHOPCATS))}
  for(const cx of[80,88,96,104])shop(X(cx),Z(49),1,0,0,-sz,8,10,lvl,pick(SHOPCATS))}
 for(const y of[5.55,11.55]){for(let x=68;x<=124;x+=8){B(X(x)-.9,y,Z(53)-.35,X(x)+.9,y+.05,Z(53)+.35,C.white,{e:2.2,solid:false});light(X(x),y-.4,Z(53),C.warm,7,10)}
  for(let z=21;z<=45;z+=8){B(X(126)-.35,y,Z(z)-.9,X(126)+.35,y+.05,Z(z)+.9,C.white,{e:2.2,solid:false});light(X(126),y-.4,Z(z),C.warm,7,10)}}
 planter(X(96),Z(50.3));planter(X(112),Z(50.3));planter(X(128.5),Z(33))}
// backrooms: a small staff door off each loop corridor leads to a hallway, restrooms and a stockroom
for(const sx of[-1,1])for(const sz of[-1,1]){
 const X=v=>v*sx,Z=v=>v*sz,yw=a=>Math.atan2(Math.sin(a)*sx,Math.cos(a)*sz),Bk=(x0,y0,z0,x1,y1,z1,c,o)=>B(X(x0),y0,Z(z0),X(x1),y1,Z(z1),c,o),M=(n,x,y,z,a,s,o)=>model(n,X(x),y,Z(z),yw(a),s,o);
 const WALL=hsl(45,.12,.72),CEIL=hsl(40,.08,.8),TILE=hsl(190,.1,.88),CY=3.4;
 const wl=(x0,z0,x1,z1)=>Bk(x0,0,z0,x1,CY,z1,WALL,{pat:0});
 // the door: dark frame, a door leaf swung open, a small sign
 Bk(108.9,0,48.6,109,2.5,49.1,C.dark);Bk(111.2,0,48.6,111.3,2.5,49.1,C.dark);Bk(108.9,2.5,48.6,111.3,2.6,49.1,C.dark);
 Bk(109,0,47.2,109.08,2.4,48.6,hsl(210,.15,.45),{solid:false});
 box(X(110.1),2.95,Z(49.12),1.9,.35,.04,hsl(210,.6,.35),{e:1.5,sign:addName('Staff · Restrooms','700 {s} system-ui,sans-serif',1),face:sz>0?0:1,solid:false});
 // hallway down to the back corridor
 wl(107.8,39,108,48.7);wl(112,35.2,112.2,48.7);Bk(107.8,CY,35,112.2,CY+.2,48.7,CEIL);Bk(108,0,35,112,.02,48.6,hsl(30,.1,.55),{pat:7,s:.4,solid:false});
 // back corridor along z 35..39, the restroom (x 98..112) and the stockroom (x 76..96) south of it
 wl(76,38.8,107.8,39);wl(76,19,112.2,19.2);wl(75.8,19,76,39);wl(112,19,112.2,35.2);
 for(const[a,b]of[[76,84],[88.5,103],[105.4,112]])wl(a,34.8,b,35);Bk(84,2.8,34.8,88.5,CY,35,WALL);Bk(103,2.4,34.8,105.4,CY,35,WALL);wl(96.8,19,97.2,34.8);
 Bk(76,CY,19,112,CY+.2,39,CEIL);Bk(76,0,35,108,.02,38.8,hsl(30,.1,.55),{pat:7,s:.4,solid:false});
 for(let x=80;x<=108;x+=7){Bk(x-.7,CY-.05,36.6,x+.7,CY,37.2,C.white,{e:chance(.25)?.6:2,solid:false});light(X(x),CY-.3,Z(36.9),hsl(90,.15,.85),3,6,{f:chance(.4)})}
 for(let z=37;z<=47;z+=5){Bk(109.3,CY-.05,z-.7,110.7,CY,z+.7,C.white,{e:2,solid:false});light(X(110),CY-.3,Z(z),hsl(90,.15,.85),3,6,{f:chance(.3)})}
 stick(X(77),CY-.25,Z(38.4),X(108),CY-.25,Z(38.4),.12,hsl(0,0,.55));stick(X(77),CY-.45,Z(38.5),X(108),CY-.45,Z(38.5),.08,hsl(20,.5,.4));
 M('WetFloorSign_01',100,0,37,rnd(0,6),1);Bk(92,0,38.1,92.6,.5,38.7,hsl(50,.7,.45),{solid:false});
 box(X(104.2),2.9,Z(34.75),2,.3,.04,hsl(200,.5,.4),{e:1.4,sign:addName('Restrooms','700 {s} system-ui,sans-serif',1),face:sz>0?0:1,solid:false});
 box(X(86.2),3.05,Z(34.75),4,.3,.04,hsl(30,.6,.4),{e:1.4,sign:addName('Stockroom','700 {s} system-ui,sans-serif',1),face:sz>0?0:1,solid:false});
 for(let k=0;k<6;k++)Bk(84.05+k*.75,2.15+k*.11,34.82,84.75+k*.75,2.26+k*.11,34.98,hsl(0,0,.5),{solid:false});
 // restroom: tiled floor, stalls with toilets, sinks under a long mirror
 Bk(97.2,0,19.2,112,.02,34.8,TILE,{pat:24,s:.5,solid:false});Bk(97.2,1.2,19.2,97.3,CY,34.8,TILE,{pat:24,solid:false});
 for(let k=0;k<5;k++){const z=20+k*2.6;Bk(109,0,z-.04,112,2,z+.04,hsl(200,.3,.6));
  Bk(110.9,0,z+.95,111.5,.42,z+1.65,C.white,{s:.8});Bk(111.5,.35,z+.9,111.95,.95,z+1.7,C.white,{s:.8});Bk(110.85,.42,z+.9,111.55,.47,z+1.7,hsl(0,0,.95),{s:.9,solid:false});
  Bk(109,.15,z+.04,109.05,2,z+(k%2?2.56:1.2),hsl(200,.3,.6),{solid:false})}
 Bk(109,0,33-.04,112,2,33+.04,hsl(200,.3,.6));
 Bk(97.3,0,22,98.1,.9,32,hsl(30,.2,.3),{pat:7});Bk(97.3,.9,21.9,98.2,.98,32.1,hsl(0,0,.9),{s:.8});
 for(let z=23;z<=31;z+=2){Bk(97.5,.92,z-.3,97.9,.98,z+.3,hsl(0,0,.75),{s:.9,solid:false});stick(X(97.4),.98,Z(z),X(97.65),1.2,Z(z),.05,C.steel)}
 Bk(97.25,1.3,22,97.32,2.6,32,hsl(200,.1,.85),{e:.3,s:1,solid:false});Bk(97.3,2.65,22,97.6,2.75,32,C.white,{e:2.2,solid:false});light(X(98.5),2.5,Z(27),hsl(40,.3,.9),3,7);light(X(105),CY-.3,Z(26),hsl(90,.1,.9),3,8,{f:chance(.5)});
 for(let k=0;k<3;k++)Bk(103+k*1.6,.6,19.25,103.5+k*1.6,1.4,19.6,C.white,{s:.7});
 M('WetFloorSign_01',104,0,30,rnd(0,6),1);
 // stockroom: steel shelving full of stock, crates, barrels, pallets, hanging lamps
 Bk(76,0,19.2,96.8,.02,34.8,hsl(0,0,.45),{pat:7,s:.3,solid:false});
 for(let r=0;r<3;r++)for(let k=0;k<4;k++){const x=79+k*4.4,z=22+r*4.4;for(const u of[-.72,0,.72])M('steel_frame_shelves_02',x+u,0,z,0,1.2,{solid:true});
  for(let j=0;j<6;j++){const bx=x+rnd(-.9,.9),by=pick([.08,.75,1.4]),w=rnd(.3,.55);Bk(bx-w/2,by,z-.25,bx+w/2,by+rnd(.25,.45),z+.25,hsl(32,.45,rnd(.45,.6)),{solid:false})}}
 for(let k=0;k<8;k++)M('wooden_crate_01',rnd(78,95),0,rnd(33,34),rnd(0,.3),1,{solid:true});
 for(let k=0;k<3;k++)M('wooden_crate_01',94,.7*k,21,.2*k,1,{solid:true});
 for(const[x,z]of[[95,24],[95.2,25.2],[94,24.6]])M('Barrel_01',x,0,z,rnd(0,6),1,{solid:true});
 for(const[x,z]of[[93,29],[90,20.5]]){Bk(x-.6,0,z-.5,x+.6,.14,z+.5,C.wood,{pat:23});for(let j=0;j<4;j++)Bk(x-.55+(j%2)*.55,.14+Math.floor(j/2)*.45,z-.45,x+(j%2)*.55,.58+Math.floor(j/2)*.45,z+.45,hsl(32,.45,.5))}
 for(let k=0;k<3;k++){const x=80+k*6.5,z=26.5;M('hanging_industrial_lamp',x,CY-1.2,z,0,1);light(X(x),CY-1.4,Z(z),hsl(40,.5,.85),4,9,{f:k===1})}
 stand(X(87),Z(32),yw(Math.PI/2));stand(X(101),Z(28),yw(-Math.PI/2))}
// living walls facing the food court: photo leaf cards
for(const sd of[-1,1])for(const sz of[-1,1])for(let z=17.6;z<25.6;z+=.85)for(let y=.2;y<11.2;y+=.8)model(chance(.7)?'card_shrub_flat':'card_fern_flat',16*sd-sd*rnd(.04,.2),y+rnd(-.15,.15),z*sz+rnd(-.2,.2),(sd>0?-1:1)*Math.PI/2+rnd(-.3,.3),rnd(.8,1.15),{tint:leafTint(),pitch:rnd(-.25,.25),roll:rnd(-.4,.4),sway:.1});
// birds wheeling above the glass
for(const[cx,cz,n]of[[-70,0,14],[45,4,16],[0,0,12],[-20,8,8]]){const cy=rnd(24,34),w=(chance(.5)?1:-1)*rnd(.12,.22);for(let k=0;k<n;k++)bird(cx+rnd(-4,4),cy+rnd(-2,2),cz+rnd(-4,4),rnd(8,24),rnd(1,3),w*rnd(.85,1.15))}
// anchor department stores
const ANCH=['Grand Meridian','Holloway & Finch','The Emporium','Sterling & Vale','Brightwater','Marlowe’s'],AF='400 {s} Didot,"Bodoni 72",Georgia,serif';
let ai=0;
for(const lvl of[0,1]){ai=0;
 for(const sd of[-1,1]){ai++;
  for(const wx of[-60,60])shop(wx,57*sd,1,0,0,sd,32,20,lvl,'apparel',{big:1,open:6,signW:6,signH:.9,name:ANCH[ai++]+(lvl?' · Upper':''),font:AF,up:1,marble:1})}}

// gate halls (the only ways out of the hub): both ends of the main concourse open straight into a two-storey hall with the gate glowing ahead.
// Walk straight on along the ground floor, or along the upper walkway and down the wide stairs; either way you reach the gate.
const gateHall=sd=>{const X=v=>v*sd,IN=sd<0,GRN=IN?hsl(42,.95,.6):hsl(150,.9,.55),WALLH=hsl(35,.14,.8),MARB=hsl(35,.1,.86),STONE=hsl(35,.08,.82);
 B(X(120.3),0,-17,X(143.8),.03,17,MARB,{pat:7,s:.3,solid:false});
 for(const sz of[-1,1]){const Z=v=>v*sz;
  B(X(120),0,Z(7),X(120.3),12,Z(17),C.facade);
  B(X(120.3),0,Z(16.8),X(122),12,Z(17.1),WALLH,{pat:11});B(X(130),0,Z(16.8),X(143.8),12,Z(17.1),WALLH,{pat:11});
  for(const y0 of[4.2,10.2])B(X(122),y0,Z(16.8),X(130),y0+1.8,Z(17.1),WALLH,{pat:11});
  B(X(143.8),0,Z(3),X(144.1),12,Z(17.1),WALLH,{pat:11});B(X(143.8),5,-3,X(144.1),12,3,WALLH,{pat:11});
  // upper floor: a landing off the walkway and balconies along the side walls (the stairs are in the middle, below)
  B(X(119.9),5.6,Z(3),X(126),6,Z(16.8),C.floor,{pat:1,s:.6});B(X(126),5.6,Z(9.6),X(143.8),6,Z(16.8),C.floor,{pat:1,s:.6});
  rail(X(126),Z(3),X(126),Z(9.6));rail(X(126),Z(9.6),X(143.8),Z(9.6));
  // shop displays under the balcony and up on it, keeping the walkways clear
  const c=ctx(0,rnd(0,360)),c6=ctx(6,rnd(0,360));
  for(const z of[11.6,14])rack(c,Z(z),Math.min(X(129),X(136)),Math.max(X(129),X(136)),()=>hsl(rnd(0,360),rnd(.3,.7),rnd(.3,.7)));
  for(let k=0;k<3;k++)glowCase(c,Math.min(X(138+k*1.8),X(139.4+k*1.8)),Z(11)-.7,Math.max(X(138+k*1.8),X(139.4+k*1.8)),Z(11)+.7);
  for(let k=0;k<5;k++)mannequin(c6,X(128+k*3.2),Z(15.6),rnd(0,360));for(let k=0;k<4;k++)mannequin(c,X(129+k*3.6),Z(16.2),rnd(0,360));
  for(const x of[132,140]){B(X(x)-.9,5.5,Z(13)-.9,X(x)+.9,5.55,Z(13)+.9,C.white,{e:2.2,solid:false});light(X(x),5.1,Z(13),C.warm,6,9)}
  for(const x of[124,134,142]){B(X(x)-.9,11.55,Z(12)-.9,X(x)+.9,11.6,Z(12)+.9,C.white,{e:2.2,solid:false});light(X(x),11,Z(12),C.warm,7,11)}
  planter(X(122.5),Z(13))}
 B(X(119.9),5.6,-3,X(126),6,3,C.floor,{pat:1,s:.6});
 for(let i=0;i<14;i++)B(X(126+i*.6),0,-3,X(126.6+i*.6),5.6-.4*i,3,STONE,{pat:7,s:.4});
 for(const z of[-3.05,3.05]){B(X(126),0,z-.06,X(134.6),5.2,z+.06,STONE,{pat:7,s:.4,solid:false});stick(X(126),7.05,z,X(134.6),1.45,z,.07,C.steel);
  for(let k=0;k<=7;k++){const x=126+k*1.2,y=6-.4*Math.min(13,k*2);stick(X(x),y,z,X(x),y+1.05,z,.05,C.steel)}}
 // the gate: a glowing portal with a big sign above it, seen from all the way down the concourse
 for(const z of[-3.4,3])B(X(143.6),0,z,X(144.1),5.4,z+.4,GRN,{e:3});B(X(143.6),5,-3.4,X(144.1),5.4,3.4,GRN,{e:3});
 const R0=typeof ROUTE!=='undefined'?ROUTE:[],TT=typeof TITLES!=='undefined'?TITLES:{};
 box(X(143.6),8.3,0,.2,2,11,GRN,{e:3.4,sign:addName(IN?'Parking':R0.length?'Next: '+TT[R0[0]]+'  →':'Explore  →','900 {s} system-ui,sans-serif',1),face:sd>0?3:2,solid:false});
 // directory board: the whole route, in order
 if(R0.length){const bx=X(124),bz=-12.5,f=3,fx=bx-.1,lines=['Car Park','Grand Entrance','The Mall','The Grand Gate',...R0.map(t=>TT[t]||t),'Grand Exit'];
  B(bx-.1,0,bz-1.6,bx+.1,4.6,bz+1.6,C.dark);box(fx,4.2,bz,.03,.4,3,hsl(45,.9,.62),{e:2.6,sign:addName('Mall Directory','400 {s} Didot,"Bodoni 72",Georgia,serif',1),face:f,solid:false});
  lines.forEach((t,i)=>{const here=IN?t==='Grand Entrance':t==='The Grand Gate';box(fx,3.7-i*.24,bz,.03,.19,2.8,here?hsl(150,.85,.55):C.white,{e:here?2.6:1.6,sign:T((i+1)+'.  '+t+(here?'   ← you are here':'')),face:f,solid:false})})}
 box(X(120.6),10.6,0,.2,1.1,10,hsl(45,.9,.6),{e:3,sign:addName(IN?'Grand Entrance':'The Grand Gate','400 {s} Didot,"Bodoni 72",Georgia,serif',1),face:sd>0?3:2,solid:false});
 // the west hall is the way in from the parking lot: a welcome sign greets you as you walk in
 if(IN)box(X(121),10.6,0,.2,1.2,14,hsl(45,.9,.62),{e:3,sign:addName('Welcome to Skylight Galleria','400 {s} Didot,"Bodoni 72",Georgia,serif',1),face:3,solid:false});
 for(const x of[130,139]){model('Chandelier_01',X(x),8.2,0,0,3);light(X(x),9.2,0,C.warm,10,16)}
 light(X(141),4,0,GRN,6,10);for(let x=124;x<=140;x+=8)light(X(x),3.5,0,C.warm,5,10);
 for(const sz of[-1,1])bench(X(140),sz*12,1)};
for(const sd of[-1,1]){
 B(144*sd,0,-3.3,150*sd,5,-3,C.facade);B(144*sd,0,3,150*sd,5,3.3,C.facade);B(144*sd,5,-3.3,150*sd,5.4,3.3,C.ceil);
 for(let x=145;x<150;x+=2){B(x*sd-.4,4.95,-.3,x*sd+.4,5,.3,C.white,{e:2.5,solid:false});light(x*sd,4.6,0,C.warm,5,6)}
 doors.push({x:150*sd,z:0,dx:sd,dz:0,theme:sd<0?'lot':undefined});gateHall(sd);
}
return{name:'Skylight Galleria'};
}
const seedOf=t=>{let h=2166136261;for(const c of t)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0};
let hubNames=null,STOP={};
function region(theme,build,xf,gs,seed){
 // shop names: the hub claims its own first; each district then picks from what is left, the same way every time
 used.clear();if(theme!=='hub'&&hubNames)for(const n of hubNames)used.add(n);
 R=rng(seed);LCNT={};XF=xf;inst=[];glass=[];lights=[];names=[];fol=[];leaves=[];drops=[];birds=[];shops=[];seats=[];fountains=[];ESC=[];doors=[];idle=[];rides={};models={};slides=[];boards=[];stores=0;NK=new Map();
 NAV={n:[],l:[]};G={...gs,d:new Uint8Array(gs.nx*gs.ny*gs.nz)};
 const info=build()||{};if(theme==='hub')hubNames=[...used];
 return{theme,xf,gs:G,inst:new Float32Array(inst),glass:new Float32Array(glass),fol:new Float32Array(fol),leaves:new Float32Array(leaves),drops:new Float32Array(drops),birds:new Float32Array(birds),
  shops,seats,fountains,lights,names,ESC,doors,idle,slides,boards,rides:Object.fromEntries(Object.entries(rides).map(([k,v])=>[k,new Float32Array(v)])),models:Object.fromEntries(Object.entries(models).map(([k,v])=>[k,new Float32Array(v)])),nav:NAV,stores,...info}}
return{hub:()=>region('hub',buildHub,{q:0,ox:0,oz:0},HUBG,19870611),
 // every area is built from a fixed seed (from its name), so the map is identical on every visit for everyone
 district:(n,theme,xf,stop={})=>{STOP=stop;return region(theme,()=>DISTRICTS[theme](K),xf,DISTG,seedOf(theme))},themes:Object.keys(DISTRICTS)};
}

