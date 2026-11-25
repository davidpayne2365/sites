// lagoon waterpark: a slide tower with four rideable slides, an island tower over the lazy river, a sandy wave pool and a kids' splash zone
// walk onto the start of any slide (the coloured trough at the top of a tower) and you ride it down
DISTRICTS.waterpark=function(K){
const{slide,rockB,hedge,grassPatch,log,leafTint,model,trunk,MODELS,B,box,mark,part,stick,crown,tree,shrubs,palm,jet,bird,light,frame,addName,shop,rail,esc,vault,planter,fountain,bench,kiosk,seat,fpush,rack,mannequin,glowCase,counter,hsl,rnd,pick,chance,C,GL,STEEL,W8,BARK,chairC,xp,xd,idF,DW,DD,DH,MID,nn,nl,npath,ring,join,stand,ride,ctx,T,shell,lamp,bulbs,umbrella,rock,conifer,bigTree,flowers,bed,people,ESC}=K;
shell({title:'Lagoon Splash',floorPat:24,floor:hsl(40,.2,.85),h:2.6,wallCol:hsl(190,.5,.45),wallPat:0,titleCol:hsl(190,.95,.6),titleY:4.4,signY:3.6});
const WATER=hsl(195,.8,.45),wet=(x0,z0,x1,z1,c=WATER)=>B(x0,-.02,z0,x1,.06,z1,c,{e:.55,pat:8,solid:false});
const pool=(x0,z0,x1,z1)=>{wet(x0,z0,x1,z1);for(const[a,b,c,d]of[[x0-.4,z0-.4,x1+.4,z0],[x0-.4,z1,x1+.4,z1+.4],[x0-.4,z0,x0,z1],[x1,z0,x1+.4,z1]])B(a,0,b,c,.25,d,C.white,{pat:24})};
// smooth curve through control points (Catmull-Rom), n samples per span
const cr=(P,n=6)=>{const out=[P[0]];for(let i=0;i<P.length-1;i++){const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(P.length-1,i+2)];
 for(let k=1;k<=n;k++){const t=k/n,t2=t*t,t3=t2*t;out.push([0,1,2].map(j=>.5*(2*p1[j]+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3)))}}return out};
const splash=(x,z)=>{jet(x,.1,z,0,3,0,.05,30,.9);light(x,1.5,z,hsl(190,.8,.7),2,6)};
const stairs=(x,z0,y1,dir,w=1.1)=>{const n=Math.ceil(y1/.4);for(let i=0;i<n;i++){const z=z0+dir*i*.6,y=y1-i*.4;B(x-w,0,Math.min(z,z+dir*.6),x+w,Math.max(.2,y-.4+.02),Math.max(z,z+dir*.6),hsl(45,.8,.55))}
 for(const s of[-1,1])stick(x+s*(w+.05),y1+1,z0,x+s*(w+.05),1,z0+dir*n*.6,.06,C.white)};
// ----- zone A: sandy beach and wave pool (x -56..-6, z 4..60)
B(-56,0,4,-6,.04,20,hsl(40,.4,.75),{pat:26,solid:false});
pool(-54,20,-8,58);for(let r=0;r<6;r++){const z=24+r*6;for(let x=-52;x<-10;x+=1.5)part(x+rnd(-.3,.3),.09,z+Math.sin(x*.4+r)*.6,1.4,.03,.35,hsl(190,.3,.95),rnd(-.3,.3),0,0,0)}
B(-54,0,58,-8,3,60,hsl(200,.4,.35));box(-31,2.4,57.9,18,1.2,.1,hsl(190,.9,.6),{e:3,sign:T('Wave Pool'),face:1,solid:false});
for(let k=0;k<30;k++)stand(rnd(-52,-10),rnd(22,56),rnd(0,6),-.95);
for(let k=0;k<22;k++){const x=rnd(-52,-10),z=rnd(22,56);if(chance(.5))model('lifebuoy',x,.05,z,rnd(0,6),1.4,{tint:hsl(pick([0,45,200,300]),.85,.6).map(v=>v*1.8)});else part(x,.12,z,.9,.18,.9,hsl(pick([0,50,200,300]),.85,.55),0,0,0,0)}
for(let i=0;i<7;i++){const x=-52+i*7,z=9;B(x-.35,0,z-1,x+.35,.35,z+1,C.white,{solid:false});B(x-.35,.35,z+.6,x+.35,.9,z+1,C.white,{solid:false});umbrella(x+1.3,z+.3,hsl(pick([0,45,200,330]),.8,.5));if(chance(.6))seat(x,z,0,-.1);
 B(x-.4,.04,z+2,x+.4,.06,z+3.6,hsl(pick([0,200,45,280]),.7,.55),{solid:false})}
{const x=-31,z=15;for(const s of[-1,1])B(x+s*5-.06,0,z-.06,x+s*5+.06,2.4,z+.06,C.white);B(x-5,1.6,z-.02,x+5,2.4,z+.02,hsl(0,0,.9),{solid:false});part(x+1,1.4,z+2,.25,.25,.25,hsl(50,.9,.6),0,0,0,0);for(let k=0;k<4;k++)stand(x-3+k*2,z+(k%2?2.5:-2.5),k%2?Math.PI:0)}
for(const x of[-48,-14]){const z=21;B(x-.6,0,z-.6,x+.6,2.4,z+.6,C.white);B(x-.8,2.4,z-.8,x+.8,2.6,z+.8,hsl(0,.8,.5));stand(x,z,Math.PI,2.6);model('lifebuoy',x+.75,1.6,z,Math.PI/2,1.2,{roll:Math.PI/2})}
for(let k=0;k<8;k++)palm(rnd(-55,-8),rnd(4.5,7),rnd(7,10));
// ----- zone B: kids' splash zone, kids' pool and a little slide (x 6..56, z 4..60)
pool(8,8,52,32);for(let i=0;i<6;i++)for(let j=0;j<3;j++)jet(13+i*7,.1,12+j*8,rnd(-.3,.3),rnd(2.5,5),rnd(-.3,.3),.05,18,.2);
for(const[x,z,h]of[[18,20,3],[40,18,3.6]]){stick(x,0,z,x,h,z,.25,hsl(120,.6,.5));part(x,h,z,3,.4,3,hsl(0,.8,.55),0,0,0,0);for(let k=0;k<8;k++){const a=k/8*6.283;jet(x+Math.cos(a)*1.4,h-.2,z+Math.sin(a)*1.4,Math.cos(a)*.3,.3,Math.sin(a)*.3,.05,14,.05)}}
{const x=30,z=12;B(x-2,0,z-2,x+2,.6,z+2,hsl(200,.7,.5));for(const[dx,dz]of[[-2,-2],[2,-2],[-2,2],[2,2]])stick(x+dx,.6,z+dz,x+dx,4,z+dz,.15,hsl(50,.9,.55));part(x,4.6,z,4.6,.3,4.6,hsl(330,.8,.6),0,0,0,0);
 for(let k=0;k<6;k++)B(x-.8,.6+k*.35,z-2.6-k*.5,x+.8,.6+(k+1)*.35,z-2.1-k*.5,hsl(45,.8,.6));box(x,4.95,z,.5,.5,.5,hsl(45,.95,.6),{e:2})}
for(let k=0;k<20;k++)stand(rnd(10,50),rnd(10,30),rnd(0,6),-.3);
pool(8,38,30,58);for(let k=0;k<8;k++)stand(rnd(10,28),rnd(40,56),rnd(0,6),-.6);
{const x=44,z=40;B(x-2,0,z-2,x+2,2.4,z+2,hsl(280,.6,.55));B(x-2.1,2.4,z-2.1,x+2.1,2.6,z+2.1,hsl(45,.9,.6));stairs(x,z-2,2.4,-1,.8);
 slide(cr([[x,2.65,z+1.6],[x,2.5,z+3],[x-3,1.8,z+6],[x-8,.9,z+8],[x-12,.3,z+10]],5),hsl(330,.85,.6));pool(31,44,40,56);splash(x-12,z+10)}
// ----- snack bar and cabanas along the cross walk
{const x=-20,z=MID+6.2;model('CoffeeCart_01',x,0,z,Math.PI,1.1,{solid:true});box(x,3,z+.6,5,.7,.12,hsl(15,.95,.6),{e:3,sign:T('Shaved Ice'),face:1,solid:false});umbrella(x+2.5,z-1.5,hsl(15,.8,.5));for(let k=0;k<3;k++)stand(x-1.5+k*1.5,z-1.8,Math.PI)}
{const x=20,z=MID+6.2;model('CoffeeCart_01',x,0,z,Math.PI,1.1,{solid:true});box(x,3,z+.6,5,.7,.12,hsl(45,.95,.6),{e:3,sign:T('Lagoon Snacks'),face:1,solid:false});for(let k=0;k<4;k++){const tx=x-6+k*4,tz=MID-5;model('modern_coffee_table_01',tx,0,tz,0,1,{solid:true});umbrella(tx,tz,hsl(pick([0,200,45]),.8,.5));seat(tx-.9,tz,Math.PI/2);if(chance(.5))seat(tx+.9,tz,-Math.PI/2)}}
for(const sx of[-1,1])for(let k=0;k<3;k++){const x=sx*(38+k*7),z=MID-5.5;for(const[dx,dz]of[[-1.6,-1.6],[1.6,-1.6],[-1.6,1.6],[1.6,1.6]])stick(x+dx,0,z+dz,x+dx,2.8,z+dz,.07,C.white);
 part(x,2.9,z,3.6,.15,3.6,hsl(pick([200,0,45]),.6,.6),0,0,0,0);for(const s of[-1,1])B(x+s*1.75-.02,.5,z-1.7,x+s*1.75+.02,2.7,z+1.7,C.white,{solid:false});B(x-1.2,0,z-1,x+1.2,.45,z+1,hsl(40,.3,.85));if(chance(.7))seat(x,z,0,.45)}
// ----- zone C: the big slide tower with four slides into a splash pool (x -56..-6, z 78..136)
const tx=-30,tz=108,TY=12;
pool(-54,79,-8,93);
for(const[dx,dz]of[[-4.4,-4.4],[4.4,-4.4],[-4.4,4.4],[4.4,4.4],[0,-4.4],[0,4.4]])B(tx+dx-.25,0,tz+dz-.25,tx+dx+.25,TY,tz+dz+.25,hsl(45,.85,.55));
B(tx-4.6,TY-.4,tz-4.6,tx+4.6,TY,tz+4.6,hsl(200,.5,.5),{pat:24});
part(tx,TY+3.6,tz,10,.2,10,hsl(0,.75,.55),0,0,0,0);for(const[dx,dz]of[[-4.4,-4.4],[4.4,-4.4],[-4.4,4.4],[4.4,4.4]])stick(tx+dx,TY,tz+dz,tx+dx,TY+3.5,tz+dz,.1,C.white);
for(const[x0,z0,x1,z1]of[[tx-4.6,tz+4.6,tx-1.3,tz+4.6],[tx+1.3,tz+4.6,tx+4.6,tz+4.6],[tx+4.6,tz+4.6,tx+4.6,tz+3.8],[tx+4.6,tz+1.2,tx+4.6,tz-1.2],[tx+4.6,tz-3.8,tx+4.6,tz-4.6],[tx+4.6,tz-4.6,tx+1.3,tz-4.6],[tx-1.3,tz-4.6,tx-4.6,tz-4.6],[tx-4.6,tz-4.6,tx-4.6,tz-1.3],[tx-4.6,tz+1.3,tx-4.6,tz+4.6]])rail(x0,z0,x1,z1,TY);
stairs(tx,tz+4.6,TY,1);box(tx,TY+2.6,tz+4.8,6,.8,.1,hsl(190,.95,.6),{e:3,sign:T('Slide Tower'),face:0,solid:false});
light(tx,TY+3,tz,hsl(40,.9,.75),6,12);
const SL=[];
// red: a tight double helix
{const pts=[[tx+4.2,TY+.05,tz-2.5],[tx+6.5,TY-.3,tz-3.2],[-21.5,TY-.6,100.5]],cx=-17,cz=100,r=4.5;for(let k=1;k<=48;k++){const a=Math.PI+k/48*4*Math.PI;pts.push([cx+Math.cos(a)*r,TY-.8-k/48*9.4,cz+Math.sin(a)*r])}
 pts.push([-21.5,1.1,95],[-21.5,.3,89]);SL.push([pts,hsl(0,.85,.55)])}
// green: a long sweeping run around the helix
SL.push([cr([[tx+4.2,TY+.05,tz+2.5],[tx+7,TY-.2,tz+3],[-19,TY-.9,113],[-11,10,113],[-9,8.6,106],[-9.5,6.4,98],[-11,4,92],[-14,2,88],[-19,.6,85],[-25,.3,84]],6),hsl(120,.75,.5)]);
// blue: a serpentine
{const pts=[[tx-4.2,TY+.05,tz],[tx-6.8,TY-.25,tz]];for(let k=0;k<=36;k++){const t=k/36;pts.push([-43+6*Math.cos(t*3*Math.PI),TY-.6-t*11,107-t*18])}SL.push([pts,hsl(210,.85,.55)])}
// yellow: the straight speed drop
{const pts=[[tx,TY+.05,tz-4.2],[tx,TY-.1,tz-6]];for(let k=1;k<=16;k++){const t=k/16;pts.push([tx,(TY-.1)*Math.pow(1-t,1.7)+.3,tz-6-t*16])}pts.push([tx,.3,84]);SL.push([pts,hsl(48,.95,.55)])}
for(const[pts,col]of SL){slide(pts,col);const e=pts[pts.length-1];splash(e[0],e[2])}
for(const[x,z]of[[tx+4.2,tz-2.5],[tx+4.2,tz+2.5],[tx-4.2,tz],[tx,tz-4.2]])box(x,TY+.06,z,.9,.02,.9,hsl(50,.95,.6),{e:2.5,solid:false});
for(let k=0;k<10;k++)stand(rnd(-52,-10),rnd(80,92),rnd(0,6),-.8);for(let k=0;k<8;k++)stand(tx+rnd(-.6,.6),tz+5+k*2.2,Math.PI,TY-.38-Math.floor((.4+k*2.2)/.6)*.4);
for(let k=0;k<5;k++)stand(tx+rnd(-3.5,3.5),tz+rnd(-3.5,3.5),rnd(0,6),TY);
for(let k=0;k<10;k++)palm(rnd(-55,-44),rnd(114,136),rnd(8,12));for(let k=0;k<6;k++)palm(rnd(-20,-8),rnd(120,136),rnd(8,12));
for(let k=0;k<20;k++)rockB(rnd(-55,-8),rnd(95,98)+(chance(.5)?0:rnd(0,38)),rnd(.6,1.6));
// ----- zone D: lazy river around a palm island with its own two-slide tower (x 6..56, z 78..136)
{const cx=30,cz=105;for(let k=0;k<64;k++){const a=k/64*6.283,x=cx+Math.cos(a)*18,z=cz+Math.sin(a)*24;wet(x-2.6,z-2.6,x+2.6,z+2.6)}
 for(let k=0;k<64;k+=2){const a=k/64*6.283;for(const r of[15.2,20.8]){const x=cx+Math.cos(a)*r*(18/18),z=cz+Math.sin(a)*r*(24/18);if(chance(.6))rockB(x,z,rnd(.5,1))}}
 for(let k=0;k<16;k++)ride('tube',[cx,.12,cz,0],[18,0,24,7],[...hsl(k*25,.85,.55),k/16],[.06,1,0,0]);
 B(cx-1.4,.3,cz-27.5,cx+1.4,.55,cz-20.5,C.wood,{pat:23});for(const s of[-1,1])rail(cx+s*1.4,cz-27.5,cx+s*1.4,cz-20.5,.55);
 const IY=7;for(const[dx,dz]of[[-2,-2],[2,-2],[-2,2],[2,2]])B(cx+dx-.2,0,cz+dz-.2,cx+dx+.2,IY,cz+dz+.2,hsl(25,.5,.4),{pat:23});
 B(cx-2.4,IY-.35,cz-2.4,cx+2.4,IY,cz+2.4,C.wood,{pat:23});part(cx,IY+3,cz,6,.2,6,hsl(45,.5,.55),0,0,.0,0);for(const[dx,dz]of[[-2.2,-2.2],[2.2,-2.2],[-2.2,2.2],[2.2,2.2]])stick(cx+dx,IY,cz+dz,cx+dx,IY+3,cz+dz,.1,C.wood);
 for(const s of[-1,1])rail(cx+s*2.4,cz-2.4,cx+s*2.4,cz-1.1,IY),rail(cx+s*2.4,cz+1.1,cx+s*2.4,cz+2.4,IY);rail(cx-2.4,cz+2.4,cx+2.4,cz+2.4,IY);rail(cx-2.4,cz-2.4,cx-1.2,cz-2.4,IY);rail(cx+1.2,cz-2.4,cx+2.4,cz-2.4,IY);
 stairs(cx,cz-2.4,IY,-1,1);
 for(const s of[-1,1]){const pts=cr([[cx+s*2.1,IY+.05,cz],[cx+s*4,IY-.2,cz+.6],[cx+s*8,IY-1.6,cz+5],[cx+s*12,IY-3.6,cz+3],[cx+s*14,IY-5.2,cz-2],[cx+s*17.5,.3,cz-5]],6);slide(pts,s>0?hsl(300,.75,.6):hsl(25,.9,.55));splash(cx+s*17.5,cz-5)}
 for(let k=0;k<7;k++){const a=rnd(.5,2.6),r=rnd(6,11);palm(cx+Math.cos(a)*r*.6,cz+Math.sin(a)*r,rnd(7,11))}shrubs(cx,0,cz+6,6,8,60);
 for(let k=0;k<4;k++)stand(cx+rnd(-.6,.6),cz-3-k*1.6,0,IY-.38-Math.floor((.6+k*1.6)/.6)*.4)}
for(let k=0;k<12;k++){const x=pick([8,52])+rnd(-1,1),z=rnd(80,134);B(x-.35,0,z-1,x+.35,.35,z+1,C.white,{solid:false});if(k%2)umbrella(x+(x<30?1:-1),z,hsl(pick([0,45,200]),.8,.5));if(chance(.5))seat(x,z,0,-.1)}
for(let k=0;k<8;k++)palm(pick([-1,1])*rnd(55,57),rnd(5,135),rnd(7,10));
for(let k=0;k<12;k++)bird(rnd(-40,40),rnd(20,30),rnd(20,120),rnd(6,14),2,(chance(.5)?1:-1)*rnd(.15,.25),[.9,.9,.9]);
people(-55,MID-3,55,MID+3,24);people(-3,5,3,135,16);people(-54,6,-10,18,10);people(8,34,52,37,8);
// hidden: a giant rubber duck in the corner of the kids' pool
{const x=11.5,z=55;B(x-.7,0,z-.5,x+.7,.6,z+.5,hsl(50,.95,.55),{s:.7,solid:false});B(x-.35,.55,z-.65,x+.35,1.1,z-.05,hsl(50,.95,.55),{s:.7,solid:false});B(x-.18,.72,z-.85,x+.18,.82,z-.62,hsl(25,.95,.5),{solid:false});for(const s of[-1,1])B(x+s*.18-.05,.92,z-.66,x+s*.18+.05,1,z-.64,hsl(0,0,.05),{solid:false})}
return{title:'Lagoon Splash',fog:.0015};
};
