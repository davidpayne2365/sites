// grand department store: three floors of named departments around a skylit atrium
DISTRICTS.dept=function(K){
const{goods,goodsRow,slide,rockB,hedge,grassPatch,log,leafTint,model,trunk,MODELS,B,box,mark,part,stick,crown,tree,shrubs,palm,jet,bird,light,frame,addName,shop,rail,esc,vault,planter,fountain,bench,kiosk,seat,fpush,rack,mannequin,glowCase,counter,hsl,rnd,pick,chance,C,GL,STEEL,W8,BARK,chairC,xp,xd,idF,DW,DD,DH,MID,nn,nl,npath,ring,join,stand,ride,ctx,T,shell,lamp,bulbs,umbrella,rock,conifer,bigTree,flowers,bed,people,ESC}=K;
const H=18;shell({title:'Hartwell & Co.',floorPat:7,floor:hsl(35,.1,.85),roof:'flat',h:H,panels:false,titleCol:hsl(45,.8,.62),font:'400 {s} Didot,"Bodoni 72",Georgia,serif'});
const AX=14,AZ0=48,AZ1=92;
for(const y of[6,12]){B(-DW,y-.4,0,DW,y,AZ0,C.floor,{pat:12});B(-DW,y-.4,AZ1,DW,y,DD,C.floor,{pat:12});B(-DW,y-.4,AZ0,-AX,y,AZ1,C.floor,{pat:12});B(AX,y-.4,AZ0,DW,y,AZ1,C.floor,{pat:12});
 for(const s of[-1,1]){rail(-AX,s>0?AZ1:AZ0,AX,s>0?AZ1:AZ0,y);rail(s*AX,AZ0,s*AX,AZ1-8.5,y)}}
for(const y of[6,12,H])for(let x=-54;x<=54;x+=12)for(let z=8;z<DD;z+=12){if(y<H&&Math.abs(x)<AX+2&&z>AZ0&&z<AZ1)continue;B(x-.9,y-.45,z-.9,x+.9,y-.4,z+.9,C.white,{e:2.3,solid:false});light(x,y-.9,z,C.warm,6,12)}
vault(AX,6,12,'z',AZ0,AZ1,4,H);B(-AX,H,AZ0-.01,AX,H+.01,AZ0,C.ceil);
for(const y0 of[0,6]){const z=AZ1-4;esc(y0?-6.8:6.8,z,y0?-1:1,y0)}
// landings so the escalators meet the floors: the first lands on the east side of floor 2; a walkway across the
// back of the atrium leads to the foot of the second, which lands on the west side of floor 3
{const ez=AZ1-4,FL=(x0,y,z0,x1,z1)=>B(x0,y-.4,z0,x1,y,z1,C.floor,{pat:12});
 FL(12.2,6,ez-1.4,AX,ez+1.4);FL(-AX,12,ez-1.4,-12.2,ez+1.4);
 FL(-AX,6,AZ1-3,AX,AZ1);FL(-3.2,6,ez-1.4,1,AZ1-3);
 rail(-AX,AZ1-3,-3.2,AZ1-3,6);rail(1,AZ1-3,12.2,AZ1-3,6);rail(1,ez-1.4,1,AZ1-3,6);rail(-3.2,ez-1.4,-1.9,ez-1.4,6);
 rail(12.2,ez-1.4,AX,ez-1.4,6);rail(-AX,ez-1.4,-12.2,ez-1.4,12);
 for(const[x,y]of[[13,6],[-13,12],[-1.6,6]]){B(x-.5,y+2.6,ez-.05,x+.5,y+3,ez+.05,hsl(45,.8,.6),{e:2.5,solid:false})}}
for(let k=0;k<4;k++)model('Chandelier_01',0,H-4.2-k%2*1.5,AZ0+8+k*9,k*.6,2.4);for(let k=0;k<4;k++)light(0,H-5,AZ0+8+k*9,C.warm,10,18);
// a marble fountain with a sculpture under the atrium
B(-4,0,MID-4,4,.6,MID+4,hsl(40,.1,.85),{pat:7});B(-3.6,.45,MID-3.6,3.6,.55,MID+3.6,hsl(190,.6,.5),{e:.6,pat:8,solid:false});model('bronze_whale_statue',0,.6,MID,.5,1.4);
for(let k=0;k<8;k++){const a=k/8*6.283;jet(Math.cos(a)*3.2,.6,MID+Math.sin(a)*3.2,-Math.cos(a)*1.2,2.6,-Math.sin(a)*1.2,.55,30,.05)}fpush(0,1,MID,1);
// departments: each floor has its own mix, signed, with low partitions between them
const D={fashion:'Fashion',beauty:'Beauty',home:'Home & Living',tech:'Electronics',books:'Books & Music',shoes:'Shoes',toys:'Toys',kitchen:'Kitchen'};
const plan=[[['fashion',-1,24],['beauty',1,24],['kitchen',-1,52],['shoes',1,52],['toys',-1,88],['beauty',1,88],['shoes',-1,116],['fashion',1,116]],
 [['home',-1,24],['tech',1,24],['home',-1,52],['books',1,52],['tech',-1,88],['home',1,88],['home',-1,116],['books',1,116]],
 [['toys',-1,24],['books',1,24],['toys',-1,52],['kitchen',1,52],['fashion',-1,88],['home',1,88],['fashion',-1,116],['home',1,116]]];
plan.forEach((row,fl)=>{const fy=fl*6;for(const[kind,sx,z0]of row){const x0=sx*36,c=ctx(fy,rnd(0,360)),zs=z0<MID?-1:1;
 box(x0,fy+4.6,z0-zs*13.8,14,1.1,.15,hsl(45,.75,.62),{e:2.4,sign:T(D[kind]),face:z0<MID?0:1,solid:false});
 for(const s of[-1,1])B(x0-16,fy,z0+s*14,x0+16,fy+1.1,z0+s*14+.2,hsl(35,.15,.7),{pat:7});
 const R=(x,z)=>[x0+x,z0+z];
 if(kind==='fashion'){for(let v=-9;v<=9;v+=3.6)rack(c,z0+v,x0-12,x0-2,()=>hsl(rnd(0,360),rnd(.3,.7),rnd(.3,.7)));for(let i=0;i<5;i++)mannequin(c,x0+4+i*2.2,z0+rnd(-8,8),rnd(0,360));
  B(x0+3,fy,z0-11,x0+13,fy+.3,z0-9,hsl(0,0,.15),{s:.8});for(let i=0;i<4;i++)mannequin(c,x0+4.5+i*2.4,z0-10,rnd(0,360))}
 else if(kind==='beauty'){for(let i=0;i<3;i++)for(let j=0;j<3;j++){glowCase(c,x0-11+i*8,z0-9+j*7,x0-5+i*8,z0-7.6+j*7);goodsRow('bottle',x0-10.7+i*8,z0-8.3+j*7,x0-5.3+i*8,z0-8.3+j*7,fy+1.05,1,14,1)}for(let i=0;i<4;i++)model('ceramic_vase_02',x0-12+i*7,fy+1.05,z0+11,rnd(0,6),1.2)}
 else if(kind==='home'){for(let i=0;i<3;i++){const[x,z]=R(-10+i*10,-6);model('Sofa_01',x,fy,z,0,1,{solid:true});model('CoffeeTable_01',x,fy,z+2.2,0,1,{solid:true});model('ArmChair_01',x+2.4,fy,z+2.6,-1.4,1,{solid:true});model('planter_pot_clay',x-2.2,fy,z,0,1);model('card_shrub',x-2.2,fy+.45,z,0,.8,{tint:leafTint()});if(chance(.5))seat(x,z+.3,0,fy+.05)}
  for(let i=0;i<3;i++){const[x,z]=R(-10+i*10,6);model('modern_coffee_table_01',x,fy,z,0,1.2,{solid:true});model('Ottoman_01',x+1.5,fy,z,0,1,{solid:true});model(pick(['ceramic_vase_02','antique_ceramic_vase_01','brass_candleholders','mantel_clock_01','carved_wooden_elephant','Lantern_01','ceramic_vase_03']),x,fy+.45,z,rnd(0,6),1)}}
 else if(kind==='tech'){for(let i=0;i<4;i++){const x=x0-11+i*7;B(x-1.6,fy,z0-9,x+1.6,fy+1,z0+9,C.white,{s:.6});for(let z=z0-8;z<z0+9;z+=2.6)model(pick(['Television_01','television_02','boombox','classic_laptop','Camera_01','portable_cassette_player','vintage_video_camera']),x,fy+1,z,Math.PI/2+rnd(-.2,.2),1)}
  for(let z=z0-9;z<z0+10;z+=3)B(x0+sx*-14.8,fy+1.6,z-1.2,x0+sx*-14.6,fy+3,z+1.2,hsl(200+rnd(-40,40),.6,.55),{e:1.8,pat:5,solid:false})}
 else if(kind==='books'){for(let i=0;i<5;i++)for(let j=0;j<2;j++)model('wooden_bookshelf_worn',x0-12+i*6,fy,z0-5+j*10,j?Math.PI:0,1,{solid:true});
  for(let i=0;i<3;i++){const[x,z]=R(-8+i*8,0);model('ArmChair_01',x,fy,z,rnd(0,6),1,{solid:true});if(chance(.6))seat(x,z,rnd(0,6),fy+.1)}model('Ukulele_01',x0+10,fy+1.2,z0+9,0,1.4);
  for(const dx of[-4,4]){const[x,z]=R(dx,0);B(x-.9,fy,z-.5,x+.9,fy+.78,z+.5,C.wood,{pat:2});goodsRow('book',x-.8,z-.22,x+.8,z-.22,fy+.78,1,7,1.3);goodsRow('book',x-.8,z+.22,x+.8,z+.22,fy+.78,0,7,1.3)}}
 else if(kind==='shoes'){for(let i=0;i<4;i++)for(let j=0;j<2;j++)model('Shelf_01',x0-12+i*7,fy,z0-8+j*16,j?Math.PI:0,1.6,{solid:true});for(let i=0;i<4;i++){const[x,z]=R(-9+i*6,0);model('Ottoman_01',x,fy,z,0,1.2,{solid:true})}}
 else if(kind==='toys'){for(let i=0;i<4;i++){const x=x0-11+i*7;B(x-1.5,fy,z0-9,x+1.5,fy+1.2,z0+9,hsl(rnd(0,360),.6,.6));goodsRow('box',x-.8,z0-8.6,x-.8,z0+8.6,fy+1.2,3,24,1.5);goodsRow('box',x+.8,z0-8.6,x+.8,z0+8.6,fy+1.2,2,24,1.5);goodsRow('box',x,z0-8.6,x,z0+8.6,fy+1.2,pick([2,3]),14,2.2)}model('wooden_crate_01',x0+12,fy,z0+8,0,1,{solid:true})}
 else if(kind==='kitchen'){for(let i=0;i<4;i++){const x=x0-11+i*7;B(x-1.6,fy,z0-9,x+1.6,fy+.95,z0+9,hsl(30,.3,.4),{pat:2});for(let z=z0-8;z<z0+9;z+=2.2)model(pick(['brass_pan_01','pot_enamel_01','jug_01','vintage_electric_kettle','tea_set_01','wooden_bowl_01','brass_goblets','wooden_cutting_board']),x,fy+.95,z,rnd(0,6),1);goodsRow(['can','bottle','can'],x-1.3,z0-8.7,x-1.3,z0+8.7,fy+.95,3,40,1.4);goodsRow(['bottle','can','box'],x+1.3,z0-8.7,x+1.3,z0+8.7,fy+.95,2,34,1.4)}}
 {const[x,z]=R(sx*-11,zs*-12);B(x-1.6,fy,z-.5,x+1.6,fy+1,z+.5,hsl(30,.3,.3),{pat:2});model('CashRegister_01',x,fy+1,z,zs>0?Math.PI:0,1);stand(x,z+(zs>0?-1.1:1.1),zs>0?0:Math.PI,fy)}
 for(let k=0;k<6;k++)stand(x0+rnd(-12,12),z0+rnd(-10,10),rnd(0,6),fy)}
 if(fy){npath([[-AX-2,AZ0-2],[-AX-2,AZ1+2],[AX+2,AZ1+2],[AX+2,AZ0-2]],fy,true);npath([[0,AZ0-2],[-AX-2,AZ0-2]],fy);npath([[0,AZ0-2],[AX+2,AZ0-2]],fy);npath([[0,AZ1+2],[0,DD-4]],fy);npath([[0,4],[0,AZ0-2]],fy);npath([[-56,MID],[-AX-2,MID]],fy);npath([[AX+2,MID],[56,MID]],fy)}});
for(const e of ESC){const y0=e.y0;nl(nn(e.bx,y0,e.z),nn(e.tx,y0+6,e.z),1);join(e.bx,e.z,e.bx,e.z+(e.sx>0?2:-2),y0);join(e.tx,e.z,AX+2*(e.tx>0?1:-1),AZ1+2,y0+6)}
for(const e of ESC)nl(nn(e.bx,e.y0,e.z),nn(0,e.y0,e.z<MID?e.z:AZ1+2));
for(let k=0;k<12;k++){const x=pick([-1,1])*rnd(16,56),z=pick([4,136]);model('planter_pot_clay',x,0,z,0,1.6);model('card_jacaranda',x,.7,z,rnd(0,6),1.3,{tint:leafTint()})}
people(-3,5,3,135,24);people(-55,MID-2,55,MID+2,16);
// hidden: a huddle of garden gnomes facing the corner, top floor, far back
for(let k=0;k<7;k++){const a=k/7*3.1+.2;model('garden_gnome',57-Math.cos(a)*1.6,12,136.5-Math.sin(a)*1.6,Math.atan2(57-(57-Math.cos(a)*1.6),136.5-(136.5-Math.sin(a)*1.6)),1)}
return{title:'Hartwell & Co.',fog:.002};
};
