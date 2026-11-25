// ice rink under glass: skaters, dasher boards with ads, a giant tree, a cocoa cart and a little winter village
DISTRICTS.rink=function(K){
const{slide,rockB,hedge,grassPatch,log,leafTint,model,trunk,MODELS,B,box,mark,part,stick,crown,tree,shrubs,palm,jet,bird,light,frame,addName,shop,rail,esc,vault,planter,fountain,bench,kiosk,seat,fpush,rack,mannequin,glowCase,counter,hsl,rnd,pick,chance,C,GL,STEEL,W8,BARK,chairC,xp,xd,idF,DW,DD,DH,MID,nn,nl,npath,ring,join,stand,ride,ctx,T,shell,lamp,bulbs,umbrella,rock,conifer,bigTree,flowers,bed,people,ESC}=K;
shell({title:'Glacier Ice Rink',floorPat:28,floor:hsl(210,.1,.95),roof:'glass',h:8,rise:12,glassWalls:1,wallCol:hsl(210,.2,.3),titleCol:hsl(195,.9,.65)});
B(-3.2,0,0,3.2,.03,DD,hsl(30,.1,.55),{pat:22,solid:false});B(-DW,0,MID-3.2,DW,.03,MID+3.2,hsl(30,.1,.55),{pat:22,solid:false});
const cx=0,cz=36,rx=24,rz=28;
B(-rx,0,cz-rz,rx,.04,cz+rz,hsl(200,.15,.95),{pat:13,solid:false});
B(-rx+2,.04,cz-.18,rx-2,.05,cz+.18,hsl(0,.85,.45),{solid:false});for(const s of[-1,1])B(-rx+2,.04,cz+s*9-.18,rx-2,.05,cz+s*9+.18,hsl(220,.85,.45),{solid:false});
for(let k=0;k<48;k++){const a=k/48*6.283;for(const[r,oz]of[[4.5,0],[3.2,-18],[3.2,18]])B(Math.cos(a)*r-.1,.04,cz+oz+Math.sin(a)*r-.1,Math.cos(a)*r+.1,.05,cz+oz+Math.sin(a)*r+.1,hsl(oz?0:220,.85,.45),{solid:false})}
// dasher boards with sponsor panels, glass above them
const ads=['Polar Cola','Summit Bank','Frost Bites','Aurora Air','Nordic Gear','Snowcap Pizza','Ice Cold Ice'];let ai=0;
for(let k=0;k<80;k++){const a0=k/80*6.283,a1=(k+1)/80*6.283,x0=cx+Math.cos(a0)*rx,z0=cz+Math.sin(a0)*rz,x1=cx+Math.cos(a1)*rx,z1=cz+Math.sin(a1)*rz;
 if(Math.abs(x0)<3.5)continue;const mx=(x0+x1)/2,mz=(z0+z1)/2,yaw=Math.atan2(x1-x0,z1-z0),l=Math.hypot(x1-x0,z1-z0)+.05;
 part(mx,.55,mz,.18,1.1,l,k%10<5?C.white:hsl(210,.6,.5),yaw,0,0,0);part(mx,1.75,mz,.04,1.3,l,hsl(200,.2,.85),yaw,0,0,0);mark(mx-.25,0,mz-.25,mx+.25,2.4,mz+.25)
 if(k%5===0&&Math.abs(Math.sin(a0))>.3){const n=Math.cos(a0)>0?2:3;box(mx-Math.cos(a0)*.12,.6,mz-Math.sin(a0)*.12,.05,.7,2.6,hsl(rnd(0,360),.7,.6),{e:1.4,sign:T(ads[ai++%ads.length]),face:n,solid:false})}}
// skaters circle the ice (their own loops); a scoreboard hangs over centre ice
const sk=ring(cx,cz,rx-4,rz-5,26),sk2=ring(cx,cz,rx-9,rz-10,18),sk3=ring(cx,cz,rx-14,rz-15,12);
for(const s of[-1,1])box(cx+s*1.4,12,cz,.12,2,4,C.dark,{});for(const[dx,dz,f]of[[1.5,0,2],[-1.5,0,3]])box(cx+dx,12,cz+dz,.06,1.6,3.6,hsl(0,0,.05),{e:0,solid:false});
for(const[dx,f]of[[1.53,2],[-1.53,3]])box(cx+dx,12.3,cz,.04,.6,3,hsl(15,.95,.55),{e:4,sign:T('HOME 3 : 2 AWAY'),face:f,solid:false});stick(cx,13,cz,cx,20,cz,.06,C.dark);
for(let k=0;k<6;k++)bulbs(-rx,cz-rz+k*11,rx,cz-rz+k*11,9,24,1);
// ice resurfacer parked by the gate
{const x=rx+3,z=cz-10;B(x-1.1,0,z-2,x+1.1,1.3,z+2,hsl(0,.7,.45));B(x-1,1.3,z-.6,x+1,2.2,z+1.4,hsl(200,.3,.85),{glass:1});B(x-1.15,0,z-2.3,x+1.15,.5,z-2,C.dark);for(const[dx,dz]of[[-1.1,-1.3],[1.1,-1.3],[-1.1,1.3],[1.1,1.3]])box(x+dx,.35,z+dz,.3,.7,.7,C.dark)}
// player benches, skate rental, cocoa cart
for(let k=0;k<5;k++){bench(-rx-3,cz-10+k*5,0);if(chance(.6))seat(-rx-3,cz-10+k*5,Math.PI/2,.45)}
{const x=40,z=22;B(x-6,0,z-1,x+6,1.1,z+1,hsl(210,.3,.35));for(let i=0;i<6;i++)model('Shelf_01',x-5+i*2,0,z+3,Math.PI,1.4,{solid:true});for(let i=0;i<30;i++)B(x-5.5+rnd(0,11),rnd(.4,2.4),z+2.8,x-5.3+rnd(0,11),rnd(2.5,2.6),z+3.1,hsl(rnd(0,360),.5,.4),{solid:false});
 box(x,3,z-1.1,8,.8,.12,hsl(195,.9,.6),{e:3,sign:T('Skate Rental'),face:1,solid:false});for(let k=0;k<3;k++)stand(x-3+k*3,z+2,Math.PI);for(let k=0;k<5;k++)stand(x-4+k*2,z-2.4,0)}
{const x=-40,z=22;model('CoffeeCart_01',x,0,z,0,1.1,{solid:true});umbrella(x+2,z,hsl(0,.7,.45));box(x,3,z,4,.6,.12,hsl(25,.9,.6),{e:3,sign:T('Hot Cocoa'),face:1,solid:false});light(x,2.4,z,C.warm,4,6);for(let k=0;k<4;k++)stand(x-2+k*1.3,z-2.2,0)}
// a giant decorated tree and snowy pines
{const tx=0,tz=104;B(tx-3,0,tz-3,tx+3,.5,tz+3,hsl(0,.6,.35));conifer(tx,tz,20,'card_fir');
 for(let k=0;k<160;k++){const y=rnd(2.5,18),r=(20*.27*(1-(y-3)/16)+.4)*rnd(.75,.95),a=rnd(0,6.28);part(tx+Math.sin(a)*r,y,tz+Math.cos(a)*r,.22,.22,.22,hsl(pick([0,45,200,120,300]),.9,.6),0,0,0,0)}
 part(tx,20.6,tz,.8,.8,.15,hsl(50,.95,.6),0,0,.78,0);light(tx,8,tz,C.warm,10,16);ring(tx,tz,7,7,14);join(3.2,tz,tx+7,tz)}
for(let k=0;k<30;k++){const x=pick([-1,1])*rnd(30,57),z=rnd(78,136);conifer(x,z,rnd(6,12),'card_fir')}
for(let k=0;k<14;k++)model('card_fir',pick([-1,1])*rnd(28,56),0,rnd(4,60),rnd(0,6),rnd(.8,1.4),{tint:[1.15,1.2,1.25]});
// winter village: chalets selling treats and gifts
for(const sx of[-1,1])for(let k=0;k<4;k++){const x=sx*16,z=86+k*12;shop(x,z,0,1,sx,0,7,7,0,pick(['candy','food','toys','home']),{});
 const F=frame(x,z,0,1,sx,0);for(const v of[0,7]){const[ex,ez]=F.w(0,v);B(ex-(sx?.15:3.7),5.6,ez-(sx?3.7:.15),ex+(sx?.15:3.7),6.6,ez+(sx?3.7:.15),C.white,{solid:false})}}
for(let k=0;k<10;k++){const x=rnd(-50,-8),z=rnd(110,134);model('modern_coffee_table_01',x,0,z,0,1,{solid:true});umbrella(x,z,hsl(200,.6,.45));seat(x-.9,z,Math.PI/2);if(chance(.5))seat(x+.9,z,-Math.PI/2)}
for(let i=0;i<6;i++)B(28,i*.3,96+i*1.2,52,i*.3+.3,97.2+i*1.2,hsl(210,.3,.5));for(let k=0;k<34;k++)seat(rnd(30,50),96.6+Math.floor(rnd(0,6))*1.2,Math.PI,0);
for(let k=0;k<30;k++)part(rnd(-55,55),rnd(8,20),rnd(5,135),.4,.4,.05,C.white,rnd(0,6),rnd(0,6),0,0);
for(let k=0;k<8;k++)lamp(pick([-1,1])*4.5,rnd(78,135),4,C.warm,5);
people(-55,MID-3,55,MID+3,14);people(-50,4,-30,60,10);people(30,4,50,60,10);
// hidden: a penguin who wandered in, standing by the far boards
{const x=21,z=10;B(x-.22,0,z-.18,x+.22,.75,z+.18,hsl(220,.2,.08));B(x-.16,.1,z-.19,x+.16,.65,z-.17,C.white,{solid:false});B(x-.15,.75,z-.15,x+.15,1,z+.15,hsl(220,.2,.08));B(x-.04,.84,z-.24,x+.04,.88,z-.15,hsl(30,.9,.55),{solid:false});for(const s of[-1,1])B(x+s*.1-.06,0,z-.24,x+s*.1+.06,.03,z-.1,hsl(30,.9,.55),{solid:false})}
return{title:'Glacier Ice Rink',fog:.003};
};
