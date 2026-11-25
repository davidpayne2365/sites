// aquarium: two walk-through tunnels (a coral reef, then arctic waters) and a gallery of tanks between them
DISTRICTS.aquarium=function(K){
const{slide,rockB,hedge,grassPatch,log,leafTint,model,trunk,MODELS,B,box,mark,part,stick,crown,tree,shrubs,palm,jet,bird,light,frame,addName,shop,rail,esc,vault,planter,fountain,bench,kiosk,seat,fpush,rack,mannequin,glowCase,counter,hsl,rnd,pick,chance,C,GL,STEEL,W8,BARK,chairC,xp,xd,idF,DW,DD,DH,MID,nn,nl,npath,ring,join,stand,ride,ctx,T,shell,lamp,bulbs,umbrella,rock,conifer,bigTree,flowers,bed,people,ESC}=K;
const WALL=hsl(215,.45,.08);
shell({title:'Deep Blue Aquarium',floorPat:3,floor:hsl(220,.5,.12),roof:'flat',h:8,wallCol:WALL,wallPat:0,ceil:hsl(215,.4,.06),panels:false,titleCol:hsl(190,.9,.55),font:'italic 900 {s} Georgia,serif'});
const fishSchool=(x,y,z,rx,rz,n,hue,size,speed)=>{for(let k=0;k<n;k++)ride('fish',[x+rnd(-1,1),y+rnd(-.5,.5),z+rnd(-2,2),0],[rx+rnd(-.8,.8),rnd(.2,.7),rz+rnd(-1,1),5],[...hsl(hue+rnd(-12,12),.85,rnd(.4,.65)),k/n*.25+rnd(0,.05)],[speed*rnd(.9,1.1),size*rnd(.85,1.15),rnd(.3,.9),0])};
const tunnel=(z0,z1,arctic)=>{
 const WATER=arctic?hsl(190,.35,.55):hsl(195,.8,.35),SEABED=arctic?hsl(200,.1,.85):hsl(30,.4,.6);
 B(-16,0,z0,-3.6,7.6,z1,WATER,{glass:1,e:.2,solid:false});B(3.6,0,z0,16,7.6,z1,WATER,{glass:1,e:.2,solid:false});B(-3.6,4.1,z0,3.6,7.6,z1,WATER,{glass:1,e:.2,solid:false});
 B(-16.4,0,z0,-16,8,z1,WALL);B(16,0,z0,16.4,8,z1,WALL);B(-3.65,0,z0,-3.45,1,z1,C.dark);B(3.45,0,z0,3.65,1,z1,C.dark);
 vault(3.55,3.1,12,'z',z0,z1,3,.9);B(-16,7.55,z0,16,7.6,z1,arctic?hsl(190,.4,.8):hsl(195,.8,.6),{e:1.6,pat:8,solid:false});
 // seabed: mounds of sand or snow, rock reefs, kelp and coral
 for(const sx of[-1,1]){B(sx*3.8,0,z0,sx*15.9,.7,z1,SEABED,{pat:arctic?28:29,solid:false});
  for(let z=z0+2;z<z1-1;z+=rnd(3,5))rockB(sx*rnd(5,14),z,rnd(1.4,3.4),.5);
  for(let k=0;k<40;k++){const x=sx*rnd(4.5,15),z=rnd(z0+1,z1-1);
   if(arctic)part(x,rnd(.8,2.4),z,rnd(.6,1.6),rnd(.8,2.4),rnd(.6,1.6),hsl(195,.2,rnd(.8,.95)),rnd(0,6),rnd(-.3,.3),rnd(-.3,.3),0);
   else if(chance(.45))model('card_fern',x,.6,z,rnd(0,6.28),[1,rnd(2.6,4.5),1],{tint:[.55,.75,.3],sway:1.2});
   else model('card_shrub',x,.6,z,rnd(0,6.28),rnd(.6,1.2),{tint:hsl(pick([340,15,280,45,190]),.8,.6).map(v=>v*3),sway:.4})}}
 for(let z=z0+3;z<z1;z+=6)light(0,3.6,z,arctic?hsl(190,.4,.85):hsl(195,.9,.6),6,9);
 if(!arctic){
  for(let s=0;s<20;s++)fishSchool(rnd(-1,1),rnd(4.4,7),rnd(z0+12,z1-12),rnd(6,12),rnd(8,(z1-z0)/2-3),Math.round(rnd(8,18)),pick([45,15,200,330,170,280,60]),rnd(.6,1.6),(chance(.5)?1:-1)*rnd(.25,.55));
  for(const sx of[-1,1])for(let s=0;s<7;s++)fishSchool(sx*rnd(8,11),rnd(1.2,3.6),rnd(z0+10,z1-10),rnd(2.5,3.6),rnd(6,12),10,pick([45,15,330,60,190]),rnd(.4,.8),(chance(.5)?1:-1)*rnd(.4,.8));
  ride('fish',[0,6.4,(z0+z1)/2,0],[9,.6,(z1-z0)/2-6,5],[.32,.34,.38,0],[.12,6,.3,0]);                       // shark
  for(let k=0;k<3;k++)ride('manta',[rnd(-2,2),rnd(5.6,6.8),(z0+z1)/2,0],[rnd(8,11),.6,(z1-z0)/2-8,5],[.12,.13,.16,rnd(0,1)],[.08*(k%2?1:-1),1,.2,0]);
  for(let k=0;k<5;k++)ride('turtle',[pick([-1,1])*rnd(7,10),rnd(1.6,3.2),rnd(z0+12,z1-12),0],[rnd(2,3),.4,rnd(6,10),5],[.25,.32,.14,rnd(0,1)],[(chance(.5)?1:-1)*rnd(.08,.14),1,.25,0]);
  ride('mermaid',[0,5.4,(z0+z1)/2,0],[8,.8,(z1-z0)/2-7,5],[.1,.55,.5,0],[.07,1,.35,0]);
 }else{
  for(let k=0;k<3;k++)ride('narwhal',[rnd(-1,1),rnd(4.8,6.4),(z0+z1)/2,0],[rnd(7,10),.5,(z1-z0)/2-6-k*3,5],[.55,.56,.58,k/3],[.06*(k%2?1:-1),1,.2,0]);
  for(let s=0;s<8;s++)fishSchool(rnd(-1,1),rnd(4.4,7),rnd(z0+10,z1-10),rnd(6,11),rnd(8,20),14,pick([200,210,190]),rnd(.5,.9),(chance(.5)?1:-1)*rnd(.3,.5));
  ride('mermaid',[0,6,(z0+z1)/2,0],[7,.6,(z1-z0)/2-10,5],[.15,.35,.6,.5],[-.06,1,.35,0]);
 }};
tunnel(8,63,false);tunnel(77,132,true);
box(0,6.5,72.2,10,1,.2,hsl(190,.9,.6),{e:3,sign:T('Arctic Waters →'),face:0,solid:false});
// gallery between the tunnels: wall tanks, jellyfish columns, a touch pool, statues and a gift shop
for(const sx of[-1,1]){
 for(let x=18;x<56;x+=9){const X=sx*x;
  for(const zs of[-1,1]){const z=MID+zs*6.6;B(X-3.6,0,z-(zs>0?0:2.2),X+3.6,.9,z+(zs>0?2.2:0),WALL);B(X-3.5,.9,z-(zs>0?0:2.2),X+3.5,4.6,z+(zs>0?2.2:0),hsl(rnd(170,220),.8,.4),{glass:1,e:.4});
   rockB(X+rnd(-2,2),z+zs*1.1,.9,.9);model('card_shrub',X+rnd(-2,2),.9,z+zs*1.1,rnd(0,6),.6,{tint:hsl(rnd(0,360),.8,.6).map(v=>v*3),sway:.4});
   for(let k=0;k<10;k++)ride('fish',[X,rnd(1.4,4),z+zs*1.1,0],[rnd(1,2.6),.2,rnd(.3,.8),5],[...hsl(rnd(0,360),.9,.6),k/10],[(chance(.5)?1:-1)*rnd(.6,1.2),rnd(.3,.6),.8,0]);
   light(X,4,z,hsl(rnd(170,220),.9,.6),4,6)}}
 for(let k=0;k<3;k++){const X=sx*(22+k*12),Z=MID+(k%2?-14:14);B(X-1.2,0,Z-1.2,X+1.2,6,Z+1.2,hsl(250,.6,.25),{glass:1,e:.4});light(X,3,Z,hsl(280,.9,.6),5,7);
  for(let j=0;j<12;j++)ride('jelly',[X+rnd(-.6,.6),rnd(.8,5.2),Z+rnd(-.6,.6),0],[.3,.5,.3,7],[...hsl(rnd(280,330),.8,.65),rnd(0,1)],[.5,2,1,0])}
 B(sx*30-.6,0,MID-22,sx*30+.6,1.2,MID-20.8,C.dark);model(sx>0?'bronze_whale_statue':'bronze_shark_statue',sx*30,1.2,MID-21.4,sx>0?0:Math.PI,sx>0?1.2:1.6,{solid:true});
 for(let k=0;k<3;k++)bench(sx*(14+k*12),MID-3.6,1);
}
// touch pool
{const x=-44,z=MID+20;B(x-5,0,z-3,x+5,.8,z+3,hsl(200,.3,.35),{pat:27});B(x-4.6,.6,z-2.6,x+4.6,.75,z+2.6,hsl(190,.7,.45),{e:.4,pat:8,solid:false});
 for(let k=0;k<14;k++)part(x+rnd(-4,4),.77,z+rnd(-2,2),.3,.04,.3,hsl(pick([10,30,280]),.8,.55),rnd(0,6),0,0,0);people(x-5,z-4.5,x+5,z-3.5,4)}
shop(44,MID+20,1,0,0,1,10,8,0,'toys',{name:'Reef Gift Shop'});
for(let x=-56;x<=56;x+=8){if(Math.abs(x)<5)continue;B(x-1,7.9,MID-.6,x+1,8,MID+.6,hsl(195,.9,.6),{e:2,solid:false});light(x,7,MID,hsl(195,.9,.7),5,10)}
people(-3,10,3,130,46);people(-56,MID-2,56,MID+2,30);
// hidden: a sunken treasure chest, spilling gold, in the far corner
{const x=-55,z=135;model('wooden_crate_01',x,0,z,.4,1.6,{tint:[.7,.55,.4],solid:true});for(let k=0;k<26;k++)B(x+rnd(-1.4,1.4)-.05,rnd(0,.25),z+rnd(-1.2,1.2)-.05,x+rnd(-1.4,1.4)+.05,rnd(.26,.3),z+rnd(-1.2,1.2)+.05,hsl(45,.95,.55),{e:.6,s:.9,solid:false});light(x,1,z,hsl(45,.9,.6),3,5)}
return{title:'Deep Blue Aquarium',night:1,fog:.01,fogCol:[.0,.02,.05]};
};
