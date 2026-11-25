// the way in and the way out. These two are not in the rotation of themed districts:
// 'lot' is where you start, outside the mall's grand entrance; 'exit' comes after every district has been seen.
(()=>{
// a parked car: body, tinted cabin, wheels, lights. nose: +1 faces +z, -1 faces -z
const car=(K,x,z,nose,col)=>{const{B}=K,hsl=K.hsl,L=4.4,W=.9,DARK=hsl(220,.15,.1),GLASS=hsl(205,.25,.16),kind=K.rnd(0,1);
 const z0=z-L/2,z1=z+L/2,f=v=>z+nose*v,cab=kind<.25?[-1.6,1.3]:kind<.6?[-1.1,.9]:[-.9,.6],hi=kind<.25?1.75:1.45;
 B(x-W,.32,z0,x+W,.95,z1,col,{s:.8});
 B(x-W+.08,.95,Math.min(f(cab[0]),f(cab[1])),x+W-.08,hi,Math.max(f(cab[0]),f(cab[1])),GLASS,{s:.95});
 B(x-W+.1,hi-.04,Math.min(f(cab[0]+.15),f(cab[1]-.1)),x+W-.1,hi+.02,Math.max(f(cab[0]+.15),f(cab[1]-.1)),col,{s:.8,solid:false});
 for(const sx of[-1,1])for(const v of[-1.4,1.4])B(x+sx*W-.14,0,f(v)-.33,x+sx*W+.14,.64,f(v)+.33,DARK,{solid:false});
 for(const sx of[-.62,.62]){B(x+sx-.18,.66,f(2.19)-.02,x+sx+.18,.8,f(2.19)+.02,hsl(50,.3,.92),{e:.8,solid:false});B(x+sx-.18,.7,f(-2.19)-.02,x+sx+.18,.82,f(-2.19)+.02,hsl(0,.85,.4),{e:.9,solid:false})}};
const CARC=K=>{const h=K.hsl,r=K.rnd(0,1);return r<.22?h(0,0,K.rnd(.82,.92)):r<.42?h(0,0,K.rnd(.06,.12)):r<.6?h(210,.05,K.rnd(.45,.6)):h(K.pick([0,210,220,140,30,350,200]),K.rnd(.45,.75),K.rnd(.25,.45))};
const ASPH=K=>K.hsl(220,.04,.21);
// rows of parking spaces from z0 to z1 (back-to-back pairs with driving aisles), leaving the walkway at x=0 clear
function parkingRows(K,z0,z1,fill){const{B,box,rnd,chance,hsl,C,lamp,model,leafTint,bigTree,npath}=K;
 const LINE=hsl(50,.1,.9),SW=2.7,DEPTH=5.2,AISLE=7;
 for(let z=z0;z+2*DEPTH<=z1;z+=2*DEPTH+AISLE){
  for(const side of[-1,1])for(let k=0;k<20;k++){const x=side*(5+SW/2+k*SW);if(Math.abs(x)>57)continue;
   for(const half of[0,1]){const zc=z+DEPTH/2+half*DEPTH;B(x+SW/2-.06,0,zc-DEPTH/2+.2,x+SW/2+.06,.04,zc+DEPTH/2-.2,LINE,{solid:false});
    if(chance(fill))car(K,x+rnd(-.12,.12),zc+rnd(-.15,.15),half?1:-1,CARC(K))}}
  B(-57,0,z+DEPTH-.1,-4.2,.15,z+DEPTH+.1,hsl(40,.05,.6),{solid:false});B(4.2,0,z+DEPTH-.1,57,.15,z+DEPTH+.1,hsl(40,.05,.6),{solid:false});
  // a planted island at the end of each row, with a light pole
  for(const sx of[-1,1]){const x=sx*3.6;B(x-.6,0,z+.4,x+.6,.18,z+2*DEPTH-.4,hsl(40,.08,.62));B(x-.5,.18,z+.5,x+.5,.2,z+2*DEPTH-.5,hsl(100,.35,.2),{solid:false});
   model('card_shrub',x,.2,z+DEPTH-2.5,rnd(0,6),.9,{tint:leafTint()});model('card_shrub',x,.2,z+DEPTH+2.5,rnd(0,6),.9,{tint:leafTint()})}
  for(const x of[-31,31]){lamp(x,z+DEPTH,8,C.warm,4)}
  npath([[-56,z+2*DEPTH+AISLE/2],[0,z+2*DEPTH+AISLE/2],[56,z+2*DEPTH+AISLE/2]])}}
// a tall tree line hides the edges of the world
function treeLine(K,z0,z1,x){const{bigTree,conifer,rnd,chance}=K;for(let z=z0;z<z1;z+=rnd(5,7)){const xx=x+rnd(-1,1);if(chance(.5))bigTree(xx,z,rnd(10,14));else conifer(xx,z,rnd(12,18))}}

DISTRICTS.lot=function(K){
const{B,box,part,stick,light,model,leafTint,planter,bench,lamp,npath,people,stand,hsl,rnd,pick,chance,C,GL,T,addName,shell,bigTree,conifer,hedge,DW,DD}=K;
shell({open:true,end:true,floor:ASPH(K),floorPat:0});
const STONE=hsl(38,.12,.8),GLD=hsl(45,.9,.62);
// the mall's front: a wide stone facade with a tall glass entrance, a canopy and the name in lights
B(-95,0,-1.5,-3,18,.3,STONE,{pat:11});B(3,0,-1.5,95,18,.3,STONE,{pat:11});B(-3,5,-1.5,3,18,.3,STONE,{pat:11});
for(let x=-90;x<=90;x+=6){if(Math.abs(x)<14)continue;B(x-.5,0,.3,x+.5,17,.7,hsl(38,.1,.72),{pat:11});for(const y of[4,9.5])B(x+1,y,.28,x+5,y+3.4,.32,hsl(205,.3,.3),{s:.95,solid:false})}
for(const[a,b,y0]of[[-14,-3.2,0],[3.2,14,0],[-3.2,3.2,5]])B(a,y0,.3,b,15.5,.5,hsl(195,.25,.55),{glass:1,solid:false});for(let x=-14;x<=14;x+=2)B(x-.08,Math.abs(x)<3.3?5:0,.3,x+.08,15.5,.6,hsl(40,.05,.85),{solid:false});for(const y of[5,10,15.5])B(-14,y-.1,.3,14,y+.1,.6,hsl(40,.05,.85),{solid:false});
for(const sx of[-1,1])B(sx*3.2-.15,0,.2,sx*3.2+.15,5,.7,hsl(45,.7,.55),{e:1.5,solid:false});B(-3.35,4.85,.2,3.35,5.15,.7,hsl(45,.7,.55),{e:1.5,solid:false});
box(0,16.6,.9,30,2.2,.3,GLD,{e:3.5,sign:addName('SKYLIGHT GALLERIA','400 {s} Didot,"Bodoni 72",Georgia,serif',1),face:0,solid:false});
B(-16,6,.3,16,6.5,9,hsl(40,.05,.88),{s:.6});for(const x of[-15,-5,5,15])B(x-.3,0,8.4,x+.3,6,9,STONE,{pat:11});for(let x=-14;x<=14;x+=4){B(x-.6,5.95,3,x+.6,6,5,C.white,{e:2.5,solid:false});light(x,5.5,4,C.warm,6,10)}
for(const x of[-40,-25,25,40]){stick(x,0,10,x,14,10,.12,hsl(0,0,.8));part(x+.9,12.8,10,1.6,1,.03,hsl(pick([210,0,45]),.75,.5),0,0,0,0)}
// sidewalk and drop-off lane in front, a crosswalk, planters and benches
B(-DW,0,.3,DW,.18,12,hsl(40,.06,.66),{pat:7,s:.25});for(let x=-2.5;x<=2.5;x+=1.25)B(x-.3,0,12.2,x+.3,.02,19,C.white,{solid:false});
for(const x of[-30,-20,20,30]){planter(x,7);bench(x+4.5,7,1)}for(let x=-50;x<=50;x+=4)if(Math.abs(x)>10)B(x-.15,.18,11.4,x+.15,1,11.7,hsl(45,.8,.5));
for(let k=0;k<3;k++){const x=-48+k*2.2;B(x-.6,.18,4,x+.6,1.05,5.6,hsl(0,0,.6),{solid:false})}
// the car park, lit with tall lamps, and a tree line all round
parkingRows(K,20,134,.62);
treeLine(K,4,138,-58.5);treeLine(K,4,138,58.5);for(let x=-56;x<=56;x+=rnd(5,7))if(Math.abs(x)>6)(chance(.5)?bigTree:conifer)(x,138.5,rnd(11,16));
// the path to the doors, and people coming and going
npath(Array.from({length:30},(_,k)=>[0,2+k*4.4]));npath([[-30,10],[0,10],[30,10]]);
people(-20,3,20,10,14);for(let k=0;k<6;k++)stand(rnd(-50,50),rnd(24,130),rnd(0,6));
// hidden: a garden gnome standing in one of the entrance planters
model('garden_gnome',-30.4,.72,6.6,.4,.9);
return{title:'Skylight Galleria',fog:.0012};
};

DISTRICTS.exit=function(K){
const{B,box,part,stick,light,model,leafTint,planter,bench,lamp,npath,people,stand,hsl,rnd,pick,chance,C,GL,T,addName,shell,vault,fountain,bigTree,conifer,DW,DD}=K;
shell({open:true,end:true,floor:ASPH(K),floorPat:0});
const STONE=hsl(38,.12,.82),GLD=hsl(45,.9,.62),HW=26,HD=58,HH=14;
// the grand exit hall: marble floor, columns, a glass vault, and a glass wall with the doors out
B(-HW,0,0,HW,.02,HD,hsl(35,.1,.86),{pat:7,s:.3,solid:false});
B(-HW,0,0,-3.2,HH,.4,STONE,{pat:11});B(3.2,0,0,HW,HH,.4,STONE,{pat:11});B(-3.2,4.6,0,3.2,HH,.4,STONE,{pat:11});
for(const sx of[-1,1]){B(sx*HW-.2,0,0,sx*HW+.2,HH,HD,STONE,{pat:11});for(let z=6;z<HD;z+=8){B(sx*(HW-1.2)-.6,0,z-.6,sx*(HW-1.2)+.6,HH,z+.6,hsl(38,.1,.9),{pat:7});B(sx*(HW-.3)-.05,3,z+2,sx*(HW-.3)+.05,8,z+5,hsl(205,.3,.35),{e:.5,solid:false})}}
for(const sx of[-1,1])B(sx*14,HH,0,sx*HW,HH+.4,HD,C.ceil);B(-14,HH,0,14,HH+.4,4,C.ceil);B(-14,HH,HD-4,14,HH+.4,HD,C.ceil);vault(14,6,16,'z',4,HD-4,4,HH+.4);
for(let z=8;z<HD-4;z+=10){model('Chandelier_01',-10,HH-4.5,z,0,3);model('Chandelier_01',10,HH-4.5,z,0,3);light(-10,HH-3.5,z,C.warm,10,16);light(10,HH-3.5,z,C.warm,10,16)}
for(const sx of[-1,1]){fountain(sx*9,20);fountain(sx*9,40);for(const z of[10,30,50]){planter(sx*16,z);bench(sx*20,z,0)}}
// the glass front with three pairs of doors, and the sign over them
for(let x=-HW;x<HW;x+=2){const door=[-10,0,10].some(c=>Math.abs(x-c)<2.1);B(x-.06,door?4:0,HD-.3,x+.06,HH,HD+.1,hsl(40,.05,.85),{solid:false})}
for(const[a,b]of[[-HW,-12],[-8,-2],[2,8],[12,HW]])B(a,0,HD-.25,b,HH,HD,hsl(195,.25,.55),{glass:1});B(-HW,4,HD-.25,HW,HH,HD,hsl(195,.25,.55),{glass:1,solid:false});
for(const x of[-10,0,10]){B(x-2,0,HD-.3,x-1.95,3.9,HD+.1,C.dark,{solid:false});B(x+1.95,0,HD-.3,x+2,3.9,HD+.1,C.dark,{solid:false});B(x-2,3.9,HD-.3,x+2,4,HD+.1,C.dark,{solid:false})}
box(0,7.5,HD-.5,22,1.6,.15,GLD,{e:3.2,sign:addName('Thank you for visiting','400 {s} Didot,"Bodoni 72",Georgia,serif',1),face:1,solid:false});
box(0,5.2,HD-.5,8,.8,.15,hsl(150,.9,.55),{e:3,sign:T('EXIT'),face:1,solid:false});
// outside: the building's back facade, a canopy, the sidewalk, then the car park under the open sky
for(const sx of[-1,1])B(sx*HW,0,HD-.4,sx*95,16,HD+.3,STONE,{pat:11});B(-HW,HH,HD-.4,HW,16,HD+.3,STONE,{pat:11});
box(0,15,HD+.5,22,1.6,.3,GLD,{e:3.5,sign:addName('SKYLIGHT GALLERIA','400 {s} Didot,"Bodoni 72",Georgia,serif',1),face:0,solid:false});
B(-16,6,HD+.3,16,6.5,HD+8,hsl(40,.05,.88),{s:.6});for(const x of[-15,-5,5,15])B(x-.3,0,HD+7.4,x+.3,6,HD+8,STONE,{pat:11});for(let x=-14;x<=14;x+=4){B(x-.6,5.95,HD+3,x+.6,6,HD+5,C.white,{e:2.5,solid:false});light(x,5.5,HD+4,C.warm,6,10)}
B(-DW,0,HD+.3,DW,.18,HD+11,hsl(40,.06,.66),{pat:7,s:.25});for(let x=-2.5;x<=2.5;x+=1.25)B(x-.3,0,HD+11.2,x+.3,.02,HD+18,C.white,{solid:false});
for(let x=-50;x<=50;x+=4)if(Math.abs(x)>10)B(x-.15,.18,HD+10.4,x+.15,1,HD+10.7,hsl(45,.8,.5));
parkingRows(K,HD+20,134,.7);
treeLine(K,HD+2,138,-58.5);treeLine(K,HD+2,138,58.5);for(let x=-56;x<=56;x+=rnd(5,7))(chance(.5)?bigTree:conifer)(x,138.5,rnd(11,16));
// a few shoppers heading to their cars with bags
npath(Array.from({length:30},(_,k)=>[0,2+k*4.4]));
people(-20,10,20,50,18);people(-20,HD+2,20,HD+10,10);for(let k=0;k<6;k++)stand(rnd(-50,50),rnd(HD+22,130),rnd(0,6));
// hidden: the founder's marble bust, in the far corner of the exit hall
B(HW-2.6,0,HD-3.6,HW-1.4,1.2,HD-2.4,hsl(38,.1,.9),{pat:7});model('marble_bust_01',HW-2,1.2,HD-3,-2.4,1.3);box(HW-2,.7,HD-3.62,.9,.18,.02,hsl(45,.8,.6),{e:1.5,sign:T('The Founder'),face:1,solid:false});
return{title:'Grand Exit',fog:.0012};
};
})();
