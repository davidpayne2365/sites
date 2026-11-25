// amusement park at night: Ferris wheel, carousel, coaster, drop tower, bumper cars, teacups and a midway of booths
DISTRICTS.amusement=function(K){
const{board,slide,rockB,hedge,grassPatch,log,leafTint,model,trunk,MODELS,B,box,mark,part,stick,crown,tree,shrubs,palm,jet,bird,light,frame,addName,shop,rail,esc,vault,planter,fountain,bench,kiosk,seat,fpush,rack,mannequin,glowCase,counter,hsl,rnd,pick,chance,C,GL,STEEL,W8,BARK,chairC,xp,xd,idF,DW,DD,DH,MID,nn,nl,npath,ring,join,stand,ride,ctx,T,shell,lamp,bulbs,umbrella,rock,conifer,bigTree,flowers,bed,people,ESC}=K;
shell({title:'Starlight Fair',floorPat:22,floor:hsl(30,.1,.5),h:3,wallCol:hsl(0,.5,.3),wallPat:0,titleCol:hsl(330,.9,.6),titleY:5,signY:4});
B(-DW,0,0,DW,.02,DD,hsl(100,.3,.45),{pat:20,solid:false});B(-4,.02,0,4,.04,DD,hsl(30,.1,.55),{pat:22,solid:false});B(-DW,.02,MID-4,DW,.04,MID+4,hsl(30,.1,.55),{pat:22,solid:false});
for(const sx of[-1,1])for(let z=4;z<DD;z+=8)if(Math.abs(z-MID)>5){const X=sx*(DW-.3);B(X-.1,3,z-.1,X+.1,5,z+.1,C.steel);B(X-.25,5,z-.25,X+.25,5.4,z+.25,hsl(z*7,.9,.6),{e:4,solid:false})}
// light arches over the midway
for(let z=8;z<DD;z+=16){if(Math.abs(z-MID)<8)continue;for(const sx of[-1,1])B(sx*4.2-.12,0,z-.12,sx*4.2+.12,5.2,z+.12,hsl(45,.8,.6),{e:1.5});
 for(let k=0;k<=12;k++){const a=k/12*Math.PI;B(Math.cos(a)*4.2-.1,5.2+Math.sin(a)*1.6-.1,z-.1,Math.cos(a)*4.2+.1,5.2+Math.sin(a)*1.6+.1,z+.1,hsl(k*30,.9,.6),{e:4,solid:false})}light(0,5,z,hsl(45,.9,.7),6,10)}
for(let z=6;z<DD;z+=10)if(Math.abs(z-MID)>6){bulbs(-4,z,4,z,5.6,8,.5);lamp(-4.6,z,4.5,hsl(45,.9,.6),5);lamp(4.6,z,4.5,hsl(45,.9,.6),5)}
// the midway: game booths and snack stands right along the walk
const games=['Ring Toss','Duck Pond','Hoop Shot','Balloon Darts','Lucky Wheel','Cotton Candy','Popcorn','Funnel Cakes','Skee Ball','Strongman','Fish Bowl','Prize Grab'];
const booth=(x,z,nx,nz,name,hue)=>{const F=frame(x,z,Math.abs(nz),Math.abs(nx),nx,nz),face=nz===1?1:nz===-1?0:nx===1?3:2;
 F(-2.4,0,0,2.4,1,1.1,hsl(hue,.6,.4));F(-2.5,0,2.5,2.5,3,2.7,hsl(hue+20,.5,.3));F(-2.6,3,-.5,2.6,3.2,2.8,hsl(hue+30,.8,.5));
 for(const u of[-2.4,2.4])F(u-.08,1,-.08,u+.08,3,.08,C.white);for(let j=0;j<10;j++)F(-2.6+j*.52,3.2,-.6,-2.6+j*.52+.52,3.6,-.4,j%2?C.white:hsl(hue,.9,.55),{solid:false});
 for(let j=0;j<16;j++){const u=rnd(-2.1,2.1),y=rnd(1.3,2.8);F(u-.14,y,2.3,u+.14,y+.32,2.5,hsl(rnd(0,360),.8,.6),{solid:false})}
 const[sx,sz]=F.w(0,-.45);box(sx,3.95,sz,Math.abs(nz)?4:.12,.6,Math.abs(nz)?.12:4,hsl(hue,.9,.6),{e:3,sign:T(name),face,solid:false});
 const[lx,lz]=F.w(0,1.4);light(lx,2.6,lz,hsl(hue,.9,.7),5,7);const[px,pz]=F.w(0,1.8);stand(px,pz,Math.atan2(-nx,-nz))};
let gi=0;for(const sx of[-1,1])for(let z=10;z<DD-6;z+=12){if(Math.abs(z-MID)<9)continue;booth(sx*6.6,z,sx,0,games[gi++%games.length],rnd(0,360))}
for(let k=0;k<6;k++){const x=(k<3?-1:1)*(14+(k%3)*13),zs=k%2?-1:1;booth(x,MID+zs*5.4,0,zs,games[gi++%games.length],rnd(0,360))}
// ferris wheel
{const cx=-32,cz=34,hub=17,Rw=14;for(const s of[-1,1]){stick(cx+s*1.5,0,cz-6,cx+s*.8,hub,cz,.35,C.steel);stick(cx+s*1.5,0,cz+6,cx+s*.8,hub,cz,.35,C.steel)}
 ride('ferris',[cx,hub,cz,Math.PI/2],[1,1,1,6],[1,.9,.95,0],[.08,0,0,0]);
 for(let k=0;k<16;k++)ride('gondola',[cx,hub,cz,Math.PI/2],[Rw,0,Rw,7],[...hsl(k*22.5,.8,.55),k/16],[.08,0,0,0]);
 B(cx-4,0,cz-8,cx+4,.4,cz-6,hsl(0,.6,.4));board(cx,cz-7,2.4,'gondola',{reach:9,top:4,y:.4,out:[cx+5.5,cz-10]});npath([[cx,cz-9],[-4,cz-9]]);light(cx,hub,cz,hsl(300,.9,.6),12,20);for(let k=0;k<12;k++)stand(cx-3+k*.5,cz-9.5,0)}
// carousel
{const cx=32,cz=30;B(cx-7.5,0,cz-7.5,cx+7.5,.3,cz+7.5,hsl(45,.6,.4),{solid:false});ride('carousel',[cx,0,cz,0],[1,1,1,6],[1,.85,.9,0],[.35,1,0,0]);
 for(let k=0;k<20;k++)ride('horse',[cx,.9,cz,0],[k%2?4.2:5.6,.35,k%2?4.2:5.6,7],[...hsl(k*37,.5,.8),k/20],[.35,1,6,0]);
 light(cx,6,cz,hsl(45,.9,.6),14,16);ring(cx,cz,10,10,14);join(4,cz,cx-10,cz);board(cx,cz,7,'horse',{near:1,reach:2.2,laps:2,y:.3,out:[cx-9.5,cz]})}
// teacups: a spinning floor of spinning cups
{const cx=46,cz=54;B(cx-6,0,cz-6,cx+6,.25,cz+6,hsl(300,.5,.6),{solid:false});ride('carousel',[cx,0,cz,0],[.8,.4,.8,6],[.9,.6,.9,0],[-.25,1,0,0]);
 for(let k=0;k<8;k++)ride('tube',[cx,.6,cz,0],[k%2?2.6:4.3,0,k%2?2.6:4.3,7],[...hsl(k*45,.8,.6),k/8],[-.25,1,0,0]);light(cx,4,cz,hsl(300,.9,.7),8,10);board(cx,cz,5.5,'tube',{near:1,reach:2.2,laps:2,y:.25,out:[cx-7.5,cz]})}
// roller coaster
{const cx=-30,cz=104,rx=22,rz=26;for(let k=0;k<96;k++){const a0=k/96*6.283,a1=(k+1)/96*6.283,y=a=>7+4*Math.sin(3*a);
  const[x0,z0,x1,z1]=[cx+Math.cos(a0)*rx,cz+Math.sin(a0)*rz,cx+Math.cos(a1)*rx,cz+Math.sin(a1)*rz];
  for(const o of[-.6,.6]){const nx=Math.cos(a0)*o,nz=Math.sin(a0)*o;stick(x0+nx,y(a0),z0+nz,x1+nx,y(a1),z1+nz,.12,hsl(0,.8,.5))}
  if(k%4===0)stick(x0,0,z0,x0,y(a0)-.2,z0,.25,C.steel);if(k%6===0)B(x0-.08,y(a0)-.3,z0-.08,x0+.08,y(a0)-.15,z0+.08,hsl(k*15,.9,.6),{e:4,solid:false})}
 for(let t=0;t<2;t++)for(let k=0;k<6;k++)ride('car',[cx,7.35,cz,0],[rx,4,rz,7],[...hsl(200+t*120,.8,.5),t*.5+k*.012],[.45,1,3,0]);
 B(cx-3,0,cz-rz-3,cx+3,1.2,cz-rz+1,hsl(200,.4,.4));board(cx,cz-rz-1,2.4,'car',{reach:4,dz:3,y:1.2,laps:2,out:[cx,cz-rz-5]});for(let k=0;k<10;k++)stand(cx-2+k*.45,cz-rz-4,Math.PI)}
// drop tower
{const cx=24,cz=100;B(cx-.8,0,cz-.8,cx+.8,34,cz+.8,hsl(220,.3,.5));B(cx-1.2,34,cz-1.2,cx+1.2,35,cz+1.2,hsl(0,.9,.55),{e:3,solid:false});
 ride('drop',[cx,3,cz,0],[1,24,1,7],[1,.3,.4,0],[.35,2,0,0]);light(cx,30,cz,hsl(0,.9,.6),14,24);ring(cx,cz,7,7,12);join(4,cz,cx-7,cz);board(cx-3.6,cz,1.6,'drop',{reach:4,top:4.5,out:[cx-7,cz]})}
// bumper cars
{const cx=44,cz=120;B(cx-10,0,cz-9,cx+10,.12,cz+9,hsl(220,.3,.2),{s:.8});for(const s of[-1,1]){B(cx-10,0,cz+s*9,cx+10,.6,cz+s*9+s*.3,hsl(45,.8,.5));B(cx+s*10,0,cz-9,cx+s*10+s*.3,.6,cz+9,hsl(45,.8,.5))}
 B(cx-10,4.5,cz-9,cx+10,4.7,cz+9,hsl(0,.6,.4),{solid:false});for(let x=-8;x<=8;x+=4)for(let z=-7;z<=7;z+=7)B(cx+x-.2,4.4,cz+z-.2,cx+x+.2,4.5,cz+z+.2,C.white,{e:4,solid:false});
 for(const[dx,dz]of[[-10,-9],[10,-9],[-10,9],[10,9]])B(cx+dx-.15,0,cz+dz-.15,cx+dx+.15,4.5,cz+dz+.15,C.steel);
 for(let k=0;k<12;k++)ride('car',[cx+rnd(-3,3),.15,cz+rnd(-2,2),0],[rnd(3,7),0,rnd(3,6),7],[...hsl(rnd(0,360),.85,.55),rnd(0,1)],[(chance(.5)?1:-1)*rnd(.25,.6),1,0,0]);
 light(cx,4,cz,hsl(200,.9,.7),8,14);board(cx,cz,7,'car',{near:1,reach:2.2,dz:0,y:.12,out:[cx-12,cz]})}
// food carts and picnic tables
for(let k=0;k<6;k++){const x=-14-k*7,z=MID+16+(k%2)*4;model('CoffeeCart_01',x,0,z,rnd(0,6.28),1,{solid:true});umbrella(x+1.6,z,hsl(rnd(0,360),.7,.5));light(x,2.5,z,C.warm,4,6);stand(x,z-1.4,0)}
for(let k=0;k<8;k++){const x=-14-(k%4)*9,z=MID+28+Math.floor(k/4)*6;model('WoodenTable_02',x,0,z,0,1.1,{solid:true});for(const s of[-1,1]){bench(x,z+s*1.2,1);if(chance(.7))seat(x+rnd(-.6,.6),z+s*1.2,s>0?Math.PI:0)}}
for(let k=0;k<40;k++)part(rnd(-50,50),rnd(5,9),rnd(10,130),.35,.45,.35,hsl(rnd(0,360),.9,.6),0,0,0,0);
people(-55,MID-3,55,MID+3,40);people(-3,5,3,135,30);people(-55,5,-10,65,12);people(10,75,55,135,12);
// hidden: a golden elephant on the very top of the drop tower
model('carved_wooden_elephant',24,35,100,.6,1.6,{tint:[2.2,1.7,.5],glow:.4});
return{title:'Starlight Fair',night:1,fog:.004};
};
