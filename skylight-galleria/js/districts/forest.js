// forest boardwalk: walls of tall pines, a raised boardwalk, a stream, a lookout tower and a dense understory
DISTRICTS.forest=function(K){
const{slide,rockB,hedge,grassPatch,log,leafTint,model,trunk,MODELS,B,box,mark,part,stick,crown,tree,shrubs,palm,jet,bird,light,frame,addName,shop,rail,esc,vault,planter,fountain,bench,kiosk,seat,fpush,rack,mannequin,glowCase,counter,hsl,rnd,pick,chance,C,GL,STEEL,W8,BARK,chairC,xp,xd,idF,DW,DD,DH,MID,nn,nl,npath,ring,join,stand,ride,ctx,T,shell,lamp,bulbs,umbrella,rock,conifer,bigTree,flowers,bed,people,ESC}=K;
shell({title:'Whispering Pines',floorPat:21,floor:hsl(30,.3,.5),h:2.4,wallCol:hsl(28,.3,.25),wallPat:23,titleCol:hsl(100,.6,.55),titleY:4.2,signY:3.4});
const bw=(x0,z0,x1,z1)=>B(x0,0,z0,x1,.45,z1,C.wood,{pat:23});
bw(-2.2,0,2.2,DD);bw(-DW,MID-2.2,DW,MID+2.2);
for(const s of[-1,1]){for(const[a,b]of[[3,MID-2.4],[MID+2.4,DD-1]])rail(s*2.2,a,s*2.2,b,.45);for(const[a,b]of[[-DW+1,-2.4],[2.4,DW-1]])rail(a,MID+s*2.2,b,MID+s*2.2,.45)}
// a stream winding through, crossed by the boardwalk, with rocks along its banks
const sx=z=>-22+Math.sin(z*.06)*10;
for(let z=0;z<DD;z+=2){const x=sx(z);B(x-2,-.02,z,x+2,.06,z+2,hsl(180,.45,.28),{e:.35,pat:8,solid:false});for(const s of[-1,1]){if(chance(.55))rockB(x+s*rnd(2.4,3.2),z+1,rnd(.5,1.1));if(chance(.4))model('card_grass',x+s*2.6,0,z+1,rnd(0,6),rnd(1,1.5),{tint:leafTint(),sway:.5})}}
// walls of tall trees around the edges, and a dense forest inside
const clear=(x,z)=>Math.abs(x)<4.5||Math.abs(z-MID)<4.5||Math.abs(x-sx(z))<4||Math.hypot(x-28,z-104)<7;
for(let z=3;z<DD;z+=4.5)for(const s of[-1,1])if(Math.abs(z-MID)>5){conifer(s*rnd(55,58),z+rnd(-1,1),rnd(20,30));if(chance(.7))conifer(s*rnd(49,53),z+rnd(-2,2),rnd(16,24))}
for(let x=-52;x<=52;x+=4.5)if(Math.abs(x)>5){conifer(x+rnd(-1,1),rnd(2,4),rnd(18,28));conifer(x+rnd(-1,1),DD-rnd(2,4),rnd(18,28))}
let n=0;for(let k=0;k<800&&n<120;k++){const x=rnd(-47,47),z=rnd(8,132);if(clear(x,z))continue;n++;if(chance(.65))conifer(x,z,rnd(12,22),chance(.5)?'card_fir':'card_pine');else bigTree(x,z,rnd(9,14))}
// understory: ferns, shrubs, moss, rocks, fallen logs, mushrooms
for(let k=0;k<420;k++){const x=rnd(-56,56),z=rnd(2,138);if(clear(x,z))continue;model(chance(.55)?'card_fern':chance(.5)?'card_shrub':'card_grass',x,0,z,rnd(0,6.28),rnd(.8,1.6),{tint:leafTint(.9),sway:.35})}
for(let k=0;k<40;k++){const x=rnd(-50,50),z=rnd(5,135);if(clear(x,z))continue;model('moss_01',x,0,z,rnd(0,6.28),rnd(1.5,3))}
for(let k=0;k<26;k++){const x=rnd(-50,50),z=rnd(5,135);if(clear(x,z))continue;rockB(x,z,rnd(.8,2.2))}
for(let k=0;k<14;k++){const x=rnd(-46,46),z=rnd(8,132);if(clear(x,z))continue;log(x,z,rnd(5,9),rnd(0,6.28),rnd(.3,.5))}
for(let k=0;k<60;k++){const x=rnd(-50,50),z=rnd(5,135);if(clear(x,z))continue;for(let j=0;j<3;j++){const mx=x+rnd(-.4,.4),mz=z+rnd(-.4,.4),h=rnd(.08,.2);part(mx,h/2,mz,.04,h,.04,hsl(40,.2,.85),0,0,0,0);part(mx,h,mz,.14,.05,.14,hsl(pick([0,15,35,45]),.7,.4),0,0,0,0)}}
// lookout tower: climb the stairs for a view over the trees
{const cx=28,cz=104,H=9;for(const[dx,dz]of[[-2,-2],[2,-2],[-2,2],[2,2]])B(cx+dx-.18,0,cz+dz-.18,cx+dx+.18,H+1.2,cz+dz+.18,C.wood,{pat:23});
 B(cx-2.6,H,cz-2.6,cx+2.6,H+.3,cz+2.6,C.wood,{pat:23});for(const s of[-1,1])rail(cx-2.6,cz+s*2.6,cx+2.6,cz+s*2.6,H+.3);rail(cx-2.6,cz-2.6,cx-2.6,cz+2.6,H+.3);rail(cx+2.6,cz-2.6,cx+2.6,cz+.9,H+.3);
 for(let k=0;k<21;k++){const y=k*.45,z=cz-3.6+k*.3;B(cx+2.65,0,z,cx+4.2,Math.min(y+.45,H+.3),z+.32,C.wood,{pat:23})}
 part(cx,H+1.6,cz,6,.2,6,hsl(25,.4,.3),0,0,0,0);light(cx,H+1,cz,C.warm,4,8);npath([[4.5,cz],[cx+3.4,cz+2]],0)}
// lanterns, benches, a picnic clearing
for(let z=8;z<DD;z+=10)if(Math.abs(z-MID)>5)for(const s of[-1,1]){B(s*2.4-.05,.45,z-.05,s*2.4+.05,1.6,z+.05,C.dark);B(s*2.4-.15,1.6,z-.15,s*2.4+.15,1.9,z+.15,hsl(40,.9,.6),{e:3,solid:false});light(s*2.4,1.7,z,C.warm,3,7)}
for(let k=0;k<8;k++){const z=10+k*16;if(Math.abs(z-MID)<6)continue;bench(3.6,z,0);if(chance(.6))seat(3.6,z,-Math.PI/2,.45)}
{const cx=34,cz=36;for(let k=0;k<4;k++){const x=cx+(k%2)*7-3,z=cz+Math.floor(k/2)*6-3;model('WoodenTable_02',x,0,z,rnd(0,.3),1.1,{solid:true});bench(x,z+1.2,1);bench(x,z-1.2,1);seat(x,z+1.2,Math.PI);seat(x,z-1.2,0)}
 B(cx-1,0,cz+8,cx+1,.4,cz+10,hsl(25,.2,.3),{pat:27});part(cx,.5,cz+9,.3,.3,.3,hsl(25,.9,.55),0,0,0,0);light(cx,1,cz+9,hsl(25,.9,.6),4,7);npath([[4.5,cz],[cx,cz]],0)}
for(let k=0;k<25;k++)bird(rnd(-50,50),rnd(24,34),rnd(10,130),rnd(5,15),2,(chance(.5)?1:-1)*rnd(.15,.3));
for(let k=0;k<50;k++)bird(rnd(-50,50),rnd(.8,2.5),rnd(10,130),rnd(.5,2),.4,(chance(.5)?1:-1)*rnd(.5,1),[.9,.95,.4]);
people(-1.5,5,1.5,135,26);people(-55,MID-1.5,55,MID+1.5,16);
// hidden: a garden gnome among the ferns, well off the boardwalk
model('garden_gnome',-41,0,58,1.1,1.1);model('card_fern',-40.4,0,58.6,0,1.2,{tint:leafTint(.9)});
return{title:'Whispering Pines',fog:.012,fogCol:[.05,.07,.06]};
};
