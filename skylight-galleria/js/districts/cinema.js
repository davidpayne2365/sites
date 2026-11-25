// cinema: a lobby split into a concession hall, an arcade and a lounge, then two auditoriums you can walk into
DISTRICTS.cinema=function(K){
const{slide,rockB,hedge,grassPatch,log,leafTint,model,trunk,MODELS,B,box,mark,part,stick,crown,tree,shrubs,palm,jet,bird,light,frame,addName,shop,rail,esc,vault,planter,fountain,bench,kiosk,seat,fpush,rack,mannequin,glowCase,counter,hsl,rnd,pick,chance,C,GL,STEEL,W8,BARK,chairC,xp,xd,idF,DW,DD,DH,MID,nn,nl,npath,ring,join,stand,ride,ctx,T,shell,lamp,bulbs,umbrella,rock,conifer,bigTree,flowers,bed,people,ESC}=K;
const RED=hsl(350,.55,.36),WALLC=hsl(350,.22,.34),GOLD=hsl(45,.95,.6);
shell({title:'Paramount Lights',floorPat:3,floor:hsl(350,.5,.36),roof:'flat',h:10,wallCol:WALLC,wallPat:0,ceil:hsl(30,.1,.22),panels:false,titleCol:GOLD});
for(let k=0;k<260;k++){const x=rnd(-58,58),z=rnd(2,138);B(x-.03,9.9,z-.03,x+.03,9.95,z+.03,hsl(45,.4,.9),{e:6,solid:false})}
for(let x=-56;x<=56;x+=8)for(let z=6;z<DD;z+=14)light(x,8.5,z,hsl(30,.5,.8),10,16);
// warm ceiling coves over the lobby and sconces along every wall
for(let x=-52;x<=52;x+=13)for(let z=8;z<64;z+=11){B(x-1.4,9.85,z-1.4,x+1.4,9.9,z+1.4,hsl(40,.6,.8),{e:2.4,solid:false});light(x,9.2,z,hsl(38,.6,.8),10,16)}
for(let z=6;z<DD;z+=8)for(const sx of[-1,1]){B(sx*59.5-.1,3.2,z-.25,sx*59.5+.1,3.7,z+.25,hsl(40,.8,.7),{e:3,solid:false});light(sx*58.8,3.4,z,hsl(35,.8,.7),3,7)}
const films=['The Last Orbit','Midnight Carousel','Paper Lanterns','Velvet Storm','Neon Harbor','Echoes of June','The Glass Garden','Starfall Express','Little Giants','Tidebreak','The Quiet Map','Ember Road'];
// partitions split the lobby into three rooms (with wide doorways)
for(const sx of[-1,1]){for(const[a,b]of[[4,22],[30,48],[56,64]])B(sx*24-.2,0,a,sx*24+.2,10,b,WALLC);B(sx*24-.2,4.5,22,sx*24+.2,10,30,WALLC);B(sx*24-.2,4.5,48,sx*24+.2,10,56,WALLC);
 for(const z of[26,52])box(sx*(24-.25*sx),5.2,z,.1,.8,6,GOLD,{e:3,sign:T(sx<0?'Arcade':'Lounge'),face:sx<0?3:2,solid:false})}
// concession hall: counters, popcorn machines, menu boards, a gold carpet runner, ropes and posters
B(-14,0,24,-4,1.1,27,RED);B(-14.2,1.1,23.8,-3.8,1.2,27.2,C.white,{s:.7});for(let k=0;k<4;k++)box(-12.5+k*2.6,3,28.6,2.2,1.2,.1,hsl(rnd(0,360),.7,.55),{e:2,solid:false});
B(-13.5,1.2,25,-12,2.6,26.2,hsl(45,.9,.65),{e:2.5,glass:1});model('CashRegister_01',-8,1.2,25.5,Math.PI,1);model('CashRegister_01',-5,1.2,25.5,Math.PI,1);for(let k=0;k<3;k++)stand(-11+k*3,28,Math.PI);
for(const sx of[-1,1])for(const z of[34,46]){const x=sx*12;model('CoffeeCart_01',x,0,z,sx>0?-Math.PI/2:Math.PI/2,1.1,{solid:true});B(x-1.2,1.1,z-.6,x+1.2,2.3,z+.6,hsl(45,.9,.65),{e:1.6,glass:1});light(x,2.6,z,hsl(40,.9,.7),4,7);stand(x+sx*1.6,z,sx>0?-Math.PI/2:Math.PI/2)}
for(let k=0;k<3;k++){const x=6+k*5;B(x-1.6,0,16,x+1.6,2.6,18,hsl(350,.5,.3));B(x-1.5,1.2,15.95,x+1.5,2.2,16,C.glass,{glass:1});stand(x,17.2,Math.PI)}
B(-2.2,0,4,2.2,.02,64,hsl(350,.6,.3),{pat:3,solid:false});for(const s of[-1,1])B(s*2.2-.08,0,4,s*2.2+.08,.025,64,hsl(45,.7,.45),{e:.3,solid:false});
for(let z=8;z<62;z+=4)for(const sx of[-1,1]){B(sx*3.2-.06,0,z-.06,sx*3.2+.06,1,z+.06,GOLD,{e:.8,solid:false});B(sx*3.2-.04,.85,z,sx*3.2+.04,.9,z+4,hsl(350,.8,.35),{solid:false})}
for(let z=10;z<62;z+=8)for(const sx of[-1,1]){const x=sx*6;box(x,1.6,z,.12,2.4,1.6,hsl(rnd(0,360),.7,.55),{e:2,pat:5});box(x,3.05,z,.14,.4,1.8,GOLD,{e:2.5,sign:T(films[Math.floor(rnd(0,12))]),face:sx>0?3:2,solid:false});B(x-.3,0,z-.9,x+.3,.2,z+.9,C.dark)}
for(let x=-22;x<=22;x+=2)B(x-.15,7.6,MID-3.5,x+.15,7.9,MID-3.4,GOLD,{e:x%4?4:1,pat:5,solid:false});
// arcade wing (left): rows of glowing cabinets, a claw machine, a prize counter
for(let row=0;row<3;row++)for(let k=0;k<7;k++){const x=-30-row*9,z=8+k*7.5,hue=rnd(0,360);
 for(const s of[-1,1]){const xx=x+s*1.2;B(xx-.5,0,z-.45,xx+.5,1.9,z+.45,hsl(hue,.5,.15));B(xx-(s>0?.52:.48),1.05,z-.35,xx+(s>0?.48:.52),1.55,z+.35,hsl(hue+rnd(-40,40),.8,.55),{e:2.2,pat:5,solid:false});B(xx-.52,1.65,z-.42,xx+.52,1.85,z+.42,hsl(hue,.9,.6),{e:3,solid:false})}
 if(chance(.6))stand(x-1.2-.9,z,Math.PI/2);light(x,4,z,hsl(hue,.9,.6),3,6)}
{const x=-50,z=60;B(x-1.2,0,z-1.2,x+1.2,1,z+1.2,hsl(300,.6,.4));B(x-1.1,1,z-1.1,x+1.1,2.6,z+1.1,C.glass,{glass:1});for(let k=0;k<20;k++)part(x+rnd(-.9,.9),1.1+rnd(0,.3),z+rnd(-.9,.9),.25,.25,.25,hsl(rnd(0,360),.8,.6),0,0,0,0)}
// lounge (right): sofas, armchairs, coffee tables, plants, screens playing trailers
for(let i=0;i<3;i++)for(let j=0;j<3;j++){const x=32+i*9,z=12+j*17;model('Sofa_01',x,0,z,0,1,{solid:true});model('CoffeeTable_01',x,0,z+2.2,0,1,{solid:true});model('ArmChair_01',x+2.6,0,z+2.6,-1.5,1,{solid:true});model('ArmChair_01',x-2.6,0,z+2.6,1.5,1,{solid:true});
 if(chance(.7))seat(x,z+.3,0,.05);if(chance(.5))seat(x+2.6,z+2.6,-1.5,.05);model('planter_pot_clay',x+4,0,z,0,1.2);model('card_shrub',x+4,.55,z,0,.9,{tint:leafTint()})}
for(let z=10;z<62;z+=13){box(DW-.6,3.6,z,.1,2.2,3.8,hsl(200,.5,.5),{e:2,pat:5,solid:false});model('Television_01',DW-1.4,0,z+4,-Math.PI/2,1.6)}
// two auditoriums
for(const sx of[-1,1]){const xi=sx*8,xo=sx*58,z0=80,z1=136,mx=(xi+xo)/2;
 B(Math.min(xi,xi+sx*.4),0,z0,Math.max(xi,xi+sx*.4),10,z1-12,WALLC);B(Math.min(xi,xi+sx*.4),0,z1-6,Math.max(xi,xi+sx*.4),10,z1,WALLC);B(Math.min(xi,xo),0,z0,Math.max(xi,xo),10,z0+.4,WALLC);
 box(xi+sx*.3,5.6,z1-9,.15,.8,4,GOLD,{e:3,sign:T(films[sx>0?2:7]),face:sx>0?2:3,solid:false});
 box(mx,4.6,z1-.6,Math.abs(xo-xi)*.8,6.5,.1,hsl(200,.5,.6),{e:3,pat:5,solid:false});light(mx,4,z1-6,hsl(210,.6,.7),9,24);
 for(let z=z0+6;z<z1-8;z+=12)light(mx,8.5,z,hsl(35,.5,.8),8,18);
 for(let r=0;r<9;r++){const z=z1-12-r*4.2,y=r*.42;B(Math.min(xi,xo)+sx*.4,0,z-2.1,Math.max(xi,xo)-sx*.4,y,z+2.1,RED);
  for(let x=Math.min(xi,xo)+3;x<Math.max(xi,xo)-3;x+=.9){if(Math.abs(x-mx)<1.2)continue;B(x-.36,y,z-.3,x+.36,y+.45,z+.3,hsl(350,.7,.35),{solid:false});B(x-.36,y+.45,z+.25,x+.36,y+1,z+.35,hsl(350,.7,.35),{solid:false});if(chance(.5))seat(x,z,0,y)}}
 for(let k=0;k<6;k++){const z=z0+4+k*8;B(xo-sx*.6-.1,1,z-.15,xo-sx*.6+.1,1.6,z+.15,GOLD,{e:3,solid:false})}
 npath([[0,z1-9],[xi+sx*2,z1-9],[mx,z1-9],[mx,z0+4]],0)}
// back corridor between the auditoriums: movie posters
for(let z=80;z<130;z+=7)for(const sx of[-1,1])box(sx*7.6,2.4,z,.1,2.6,1.8,hsl(rnd(0,360),.7,.55),{e:1.8,pat:5,solid:false});
people(-22,MID-3,22,MID+3,20);people(-3,5,3,75,16);people(-50,6,-28,60,10);
// hidden: a ghost watching from the back row of the left theatre
{const x=-55,z=90.4,y=3.36;box(x,y+.75,z,.55,1.3,.35,hsl(200,.2,.97),{glass:1,solid:false});box(x,y+1.55,z,.4,.4,.38,hsl(200,.2,.97),{glass:1,solid:false});for(const s of[-1,1])B(x+s*.1-.04,y+1.55,z-.2,x+s*.1+.04,y+1.62,z-.18,hsl(190,.8,.7),{e:3,solid:false});light(x,y+1.2,z,hsl(190,.6,.8),1.5,4)}
return{title:'Paramount Lights',night:1,fog:.002};
};
