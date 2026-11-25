// arboretum: a giant glass conservatory split into four garden rooms
DISTRICTS.arboretum=function(K){
const{slide,rockB,hedge,grassPatch,log,leafTint,model,trunk,MODELS,B,box,mark,part,stick,crown,tree,shrubs,palm,jet,bird,light,frame,addName,shop,rail,esc,vault,planter,fountain,bench,kiosk,seat,fpush,rack,mannequin,glowCase,counter,hsl,rnd,pick,chance,C,GL,STEEL,W8,BARK,chairC,xp,xd,idF,DW,DD,DH,MID,nn,nl,npath,ring,join,stand,ride,ctx,T,shell,lamp,bulbs,umbrella,rock,conifer,bigTree,flowers,bed,people,ESC}=K;
shell({title:'The Arboretum',floorPat:20,floor:hsl(95,.35,.5),roof:'glass',h:9,rise:16,glassWalls:1,wallCol:hsl(30,.2,.35),wallPat:22,titleCol:hsl(120,.7,.55)});
const path=(x0,z0,x1,z1)=>B(x0,0,z0,x1,.03,z1,C.floor,{pat:22,solid:false});
path(-3.2,0,3.2,DD);path(-DW,MID-3.2,DW,MID+3.2);
// hedges line the promenades, with gaps into each garden
for(const sx of[-1,1]){for(const[a,b]of[[4,28],[42,64],[76,98],[112,136]])hedge(sx*4.2,a,sx*4.2,b,1.2);for(const[a,b]of[[6,22],[36,56]])for(const sz of[-1,1])hedge(sx*a,MID+sz*4.2,sx*b,MID+sz*4.2,1.2)}
for(let z=10;z<DD;z+=14)for(const sx of[-1,1])if(Math.abs(z-MID)>6)lamp(sx*3.6,z,4,C.warm,5);
// trees along the glass walls make the space feel enclosed
for(let z=6;z<DD;z+=7)for(const sx of[-1,1])if(Math.abs(z-MID)>7)bigTree(sx*rnd(54,57),z+rnd(-2,2),rnd(11,16),chance(.5)?'card_jacaranda':'card_broad');
for(let x=-50;x<=50;x+=8)if(Math.abs(x)>7){bigTree(x+rnd(-2,2),rnd(3,5),rnd(9,13));bigTree(x+rnd(-2,2),DD-rnd(3,5),rnd(9,13))}
// --- lily pond garden (front left) ---
{const cx=-31,cz=35;
 B(cx-13,-.02,cz-10,cx+13,.4,cz-9.6,hsl(30,.1,.6),{pat:27});B(cx-13,-.02,cz+9.6,cx+13,.4,cz+10,hsl(30,.1,.6),{pat:27});B(cx-13,-.02,cz-9.6,cx-12.6,.4,cz+9.6,hsl(30,.1,.6),{pat:27});B(cx+12.6,-.02,cz-9.6,cx+13,.4,cz+9.6,hsl(30,.1,.6),{pat:27});
 B(cx-12.6,0,cz-9.6,cx+12.6,.12,cz+9.6,hsl(170,.45,.3),{e:.45,pat:8,solid:false});
 for(let k=0;k<45;k++)part(cx+rnd(-11.5,11.5),.14,cz+rnd(-8.5,8.5),rnd(.5,.9),.02,rnd(.5,.9),hsl(rnd(95,125),.5,rnd(.2,.3)),rnd(0,6.28),0,0,0);
 for(let k=0;k<10;k++)part(cx+rnd(-11,11),.24,cz+rnd(-8,8),.16,.1,.16,hsl(rnd(320,360),.7,.75),0,0,0,0);
 for(let k=0;k<14;k++)ride('fish',[cx+rnd(-6,6),.06,cz+rnd(-4,4),0],[rnd(3,8),.02,rnd(2,6),5],[...hsl(pick([20,30,0,45]),.9,.55),k/14],[(chance(.5)?1:-1)*rnd(.2,.4),rnd(1.1,1.6),.7,0]);
 B(cx-1.3,.35,cz-10.4,cx+1.3,.5,cz+10.4,C.wood,{pat:23});rail(cx-1.3,cz-9.8,cx-1.3,cz+9.8,.45);rail(cx+1.3,cz-9.8,cx+1.3,cz+9.8,.45);npath([[cx,cz-24],[cx,cz-11],[cx,cz+11],[cx,cz+24]],0);
 for(let k=0;k<7;k++){const x=cx+7+k*.9,z=cz+3+Math.sin(k)*1.2;B(x-.45,0,z-.45,x+.45,.2,z+.45,hsl(30,.05,.6),{pat:27})}
 // waterfall over a rock wall
 for(let k=0;k<6;k++)rockB(cx-11+k*.8,cz+7.5+rnd(-.5,.5),rnd(1.6,2.6),k%2?.3:0);for(let k=0;k<4;k++)rockB(cx-9+rnd(-1,1),cz+8,1.6,rnd(1.5,2.6));
 jet(cx-9,3,cz+7.2,.05,0,-.9,.12,90,.15);jet(cx-7.5,2.6,cz+7.2,.05,0,-.8,.12,70,.15);fpush(cx-8,1,cz+7,1);
 for(let k=0;k<26;k++)model('card_grass',cx+pick([-1,1])*rnd(11,12.5),0,cz+rnd(-9,9),rnd(0,6.28),rnd(1,1.6),{tint:leafTint(),sway:.5});
 for(let k=0;k<6;k++)bigTree(cx+pick([-1,1])*rnd(15,18),cz-14+k*5.6,rnd(9,13),'card_jacaranda');
 for(let k=0;k<5;k++)bench(cx+(k-2)*5,cz-12.5,1);people(cx-12,cz-14,cx+12,cz-12,6)}
// --- palm house (front right) ---
{const cx=31,cz=35;
 for(let k=0;k<14;k++){const a=k/14*6.283+rnd(-.1,.1),r=rnd(9,17);palm(cx+Math.cos(a)*r,cz+Math.sin(a)*r*.9,rnd(8,14))}
 for(let k=0;k<70;k++){const x=cx+rnd(-20,20),z=cz+rnd(-22,22);if(Math.hypot(x-cx,z-cz)<6)continue;model(chance(.5)?'card_fern':'card_shrub',x,0,z,rnd(0,6.28),rnd(1,2),{tint:leafTint(1.05),sway:.5})}
 fountain(cx,cz);bed(cx,cz-9,4,1.5,330);bed(cx,cz+9,4,1.5,20);
 for(let k=0;k<12;k++)bird(cx+rnd(-6,6),rnd(1.5,4),cz+rnd(-6,6),rnd(1,3),.6,(chance(.5)?1:-1)*rnd(.6,1.1),hsl(pick([0,45,190,280,120]),.9,.55));
 ring(cx,cz,12,12,18);join(3.2,cz,cx-12,cz);people(cx-14,cz-14,cx+14,cz+14,8)}
// --- rose garden with a gazebo (back left) ---
{const cx=-31,cz=105;
 for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++)if(Math.abs(i)+Math.abs(j)>1&&(i+j)%2===0)bed(cx+i*6,cz+j*6,1.9,1.9,pick([350,340,20,45,300]));
 for(const s of[-1,1]){hedge(cx-22,cz+s*22,cx+22,cz+s*22,1.4);hedge(cx+s*22,cz-22,cx+s*22,cz+22,1.4)}
 // gazebo
 for(let k=0;k<8;k++){const a=k/8*6.283;B(cx+Math.cos(a)*4-.12,0,cz+Math.sin(a)*4-.12,cx+Math.cos(a)*4+.12,3.2,cz+Math.sin(a)*4+.12,C.white)}
 B(cx-4.3,0,cz-4.3,cx+4.3,.3,cz+4.3,C.white,{pat:27});for(let k=0;k<8;k++){const a=k/8*6.283+.39;part(cx+Math.cos(a)*2.2,3.9,cz+Math.sin(a)*2.2,3.4,.12,4.6,hsl(150,.3,.75),a+Math.PI/2,.55,0,0)}
 light(cx,3,cz,C.warm,6,9);for(let k=0;k<4;k++){const a=k/4*6.283+.4;bench(cx+Math.cos(a)*2.8,cz+Math.sin(a)*2.8,Math.abs(Math.cos(a))<.5)}
 for(const[dx,dz]of[[-14,-14],[14,-14],[-14,14],[14,14]]){B(cx+dx-.4,0,cz+dz-.4,cx+dx+.4,1,cz+dz+.4,C.white,{pat:27});model('ceramic_vase_02',cx+dx,1,cz+dz,rnd(0,6),2.2,{solid:true})}
 npath([[cx,cz-22],[cx,cz-5],[cx-5,cz],[cx,cz+5],[cx+5,cz],[cx,cz-5]],0);join(-3.2,cz,cx+5,cz);people(cx-18,cz-18,cx+18,cz+18,10)}
// --- old forest grove (back right), where something large lives ---
let foot=null;
{const cx=31,cz=105;
 for(let k=0;k<26;k++){const x=cx+rnd(-22,22),z=cz+rnd(-24,24);if(Math.abs(x-(cx-6))<2.5)continue;chance(.4)?conifer(x,z,rnd(14,22)):bigTree(x,z,rnd(10,16))}
 for(let k=0;k<90;k++)model(chance(.6)?'card_fern':'card_shrub',cx+rnd(-24,24),0,cz+rnd(-26,26),rnd(0,6.28),rnd(.8,1.6),{tint:leafTint(.9),sway:.3});
 for(let k=0;k<16;k++)model('moss_01',cx+rnd(-22,22),0,cz+rnd(-24,24),rnd(0,6.28),rnd(1,2.5));
 for(let k=0;k<8;k++)rockB(cx+rnd(-20,20),cz+rnd(-22,22),rnd(.8,2));for(let k=0;k<5;k++)log(cx+rnd(-18,18),cz+rnd(-20,20),rnd(4,7),rnd(0,6.28));
 for(let k=0;k<30;k++){const x=cx+rnd(-20,20),z=cz+rnd(-22,22);part(x,.08,z,.05,.16,.05,hsl(30,.2,.85),0,0,0,0);part(x,.18,z,.16,.06,.16,hsl(pick([0,20,40]),.7,.45),0,0,0,0)}
 npath([[cx-6,cz-26],[cx-6,cz-8],[cx-6,cz+8],[cx-6,cz+26]],0);join(3.2,MID,cx-6,cz-26);
 {foot=[];const bx=cx+rnd(4,12),bz=cz+rnd(4,14);for(let k=0;k<10;k++){const a=k/10*6.283;foot.push(xp(bx+Math.cos(a)*rnd(5,8),bz+Math.sin(a)*rnd(5,9)))}}}
grassPatch(-56,4,-5,66,140);grassPatch(5,4,56,66,140);grassPatch(-56,74,-5,136,120);grassPatch(5,74,56,136,60);
for(let k=0;k<26;k++)bird(rnd(-40,40),rnd(30,40),rnd(20,120),rnd(8,20),2,(chance(.5)?1:-1)*rnd(.12,.2));
people(-3,5,3,135,10);people(-55,MID-2,55,MID+2,10);
return{title:'The Arboretum',fog:.0035,bigfoot:foot};
};
