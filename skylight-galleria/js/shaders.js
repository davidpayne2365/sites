/* ============================== SHADERS ============================== */
//WGSL-START
const COMMON=`
struct U{vp:mat4x4f,view:mat4x4f,ivp:mat4x4f,lvp:mat4x4f,cam:vec4f,grid:vec4f,misc:vec4f,fog:vec4f,sun:vec4f,sunC:vec4f,vis:vec4f,skyp:vec4f,scr:vec4f,proj:vec4f,sh:array<vec4f,9>,nite:vec4f,rgn:vec4f,fl:vec4f,ph:vec4f};
@group(0)@binding(0)var<uniform>u:U;
// the player's flashlight: a wide cone from the eye (fl.xyz = direction, fl.w = brightness)
fn torch(wp:vec3f,N:vec3f)->f32{if(u.fl.w<=0.){return 0.;}let d=u.cam.xyz+vec3f(0.,-.15,0.)-wp;let d2=dot(d,d);let Ld=d*inverseSqrt(max(d2,1e-4));
 let cs=dot(-Ld,u.fl.xyz);let cone=smoothstep(.72,.9,cs)*.7+smoothstep(.9,.97,cs)*.3;return u.fl.w*cone*max(dot(N,Ld),0.)/(1.+d2*.045);}
const PI=3.14159265;
fn ss(a:f32,b:f32,x:f32)->f32{let t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
fn h31(p:vec3f)->f32{var q=fract(p*vec3f(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
fn vn(p:vec3f)->f32{let i=floor(p);let f=fract(p);let w=f*f*(3.-2.*f);
 return mix(mix(mix(h31(i),h31(i+vec3f(1.,0.,0.)),w.x),mix(h31(i+vec3f(0.,1.,0.)),h31(i+vec3f(1.,1.,0.)),w.x),w.y),
            mix(mix(h31(i+vec3f(0.,0.,1.)),h31(i+vec3f(1.,0.,1.)),w.x),mix(h31(i+vec3f(0.,1.,1.)),h31(i+vec3f(1.,1.,1.)),w.x),w.y),w.z);}
fn rot(v:vec3f,a:f32,ax:f32)->vec3f{let c=cos(a);let s=sin(a);
 if(ax>.5){return vec3f(v.x,s*v.z+c*v.y,c*v.z-s*v.y);}
 return vec3f(c*v.x-s*v.y,s*v.x+c*v.y,v.z);}
fn rx(v:vec3f,a:f32)->vec3f{let c=cos(a);let s=sin(a);return vec3f(v.x,v.y*c-v.z*s,v.y*s+v.z*c);}
fn ry(v:vec3f,a:f32)->vec3f{let c=cos(a);let s=sin(a);return vec3f(c*v.x+s*v.z,v.y,-s*v.x+c*v.z);}
fn rz(v:vec3f,a:f32)->vec3f{let c=cos(a);let s=sin(a);return vec3f(c*v.x-s*v.y,s*v.x+c*v.y,v.z);}
fn hs1(x:f32)->f32{return fract(sin(x*127.1+.3)*43758.5453);}
fn fbm2(p:vec2f)->f32{return vn(vec3f(p,.5))*.5+vn(vec3f(p*2.03,1.7))*.25+vn(vec3f(p*4.1,3.1))*.125+vn(vec3f(p*8.3,5.3))*.0625;}
// drifting cloud cover, used for the sky's moving wisps and for cloud shadows on the floor
fn cloudAt(p:vec2f)->f32{return fbm2(p*.006+vec2f(u.cam.w*.012,u.cam.w*.005));}
struct DV{p:vec3f,n:vec3f,col:vec3f,hide:f32};
// free-orientation instances: 0 static part, 1 person, 2 bird, 3 water droplet, 4 leaf
fn dynXf(p0:vec3f,n0:vec3f,part:f32,a:vec4f,b:vec4f,c:vec4f,d:vec4f)->DV{
 let t=u.cam.w;let kind=i32(b.w+.5);var o:DV;o.col=c.rgb;o.hide=0.;
 var p=p0;var n=n0;var pos=a.xyz;
 if(kind==1){
  let pt=i32(part+.5);let pose=i32(d.w+.5);let mv=min(d.z/1.3,1.);
  let ph=c.w*6.2831+t*(1.6+d.z*1.5)*3.1416;
  var sw=sin(ph)*.48*mv;
  if(pose==1){sw=sin(t*.6+c.w*40.)*.05;}
  if(pt==2||pt==3){var ang=select(-sw,sw,pt==2);if(pose==2||pose==5||pose==7){ang=-1.45;}if(pose==8){ang=sin(t*5.+f32(pt))*.15;}let pv=vec3f(0.,.9,0.);p=rx(p-pv,ang)+pv;n=rx(n,ang);}
  // poses: 0 walk, 1 stand, 2 sit, 3 zombie walk, 4 zombie fallen, 5 zombie feeding (crouched), 6 person pulled down, 7 cowering, 8 zombie crawling
  let zomb=(pose>=3&&pose<=5)||pose==8;
  if(pt==4||pt==5||pt==13||pt==14){var ang=select(sw,-sw,pt==4||pt==14)*.8;if(pose==2){ang=-.75;}if(zomb){ang=-1.3+sin(t*2.+c.w*20.+f32(pt))*.12;}if(pose==5){ang=-.6+sin(t*7.+f32(pt))*.25;}if(pose==7){ang=-2.75+sin(t*9.+c.w*30.)*.06;}if(pose==8){ang=-2.9+sin(t*5.+select(0.,3.14,pt==5||pt==13))*.35;}let pv=vec3f(0.,1.47,0.);p=rx(p-pv,ang)+pv;n=rx(n,ang);}
  if(pose==2||pose==5||pose==7){p.y-=.43;}
  if(pose==7){p=rx(p-vec3f(0.,.5,0.),.45)+vec3f(0.,.5,0.);n=rx(n,.45);}
  if(pose==5){p=rx(p-vec3f(0.,.5,0.),.85)+vec3f(0.,.5,0.);n=rx(n,.85);}
  if(pose==3){p=rx(p-vec3f(0.,.9,0.),.22)+vec3f(0.,.9,0.);n=rx(n,.22);}
  if(pose==4||pose==6){p=rx(p,-1.5708)+vec3f(0.,.14,0.);n=rx(n,-1.5708);}
  if(pose==8){p=rx(p,1.5708)+vec3f(0.,.16,0.);n=rx(n,1.5708);}
  if(pose==0){p.y+=abs(cos(ph))*.035*mv;}
  let h=c.w*97.13;
  let sk=hs1(h+1.);var skin=mix(vec3f(.07,.035,.02),vec3f(.62,.42,.32),sk*sk*.8+sk*.2);
  let pi=i32(hs1(h+2.)*5.);var pants=vec3f(.04,.07,.15);
  if(pi==1){pants=vec3f(.015);}else if(pi==2){pants=vec3f(.3,.24,.15);}else if(pi==3){pants=vec3f(.12,.12,.13);}else if(pi==4){pants=c.rgb*.5;}
  if(zomb){skin=mix(skin,vec3f(.16,.22,.11),.75);pants*=.55;}
  let hi=i32(hs1(h+3.)*4.);var hair=vec3f(.012,.01,.008);
  if(hi==1){hair=vec3f(.07,.035,.015);}else if(hi==2){hair=vec3f(.38,.25,.1);}else if(hi==3&&hs1(h+4.)>.5){hair=vec3f(.3,.3,.3);}
  if(pt==2||pt==3||pt==7){o.col=pants;}
  if((pt==2||pt==3)&&p0.y<.1){o.col=select(vec3f(.012),vec3f(.5,.48,.45),hs1(h+6.)>.65);}
  if(pt==1){o.col=skin;}
  if(pt==6||pt==11||pt==12){o.col=hair;}
  if(d.x>.5){o.col=c.rgb*(.8+.4*hs1(h+f32(pt)));if(pt==1){o.col=vec3f(.12,.08,.06);}if(pt==8||pt==9){o.col=vec3f(.02);}if(pt==10){o.col=vec3f(.15,.05,.04);}}
  if(pt==8){o.col=vec3f(.62,.6,.58);}
  if(pt==9){let ei=hs1(h+8.);o.col=select(select(vec3f(.025,.012,.006),vec3f(.03,.08,.16),ei>.75),vec3f(.04,.07,.03),ei>.9);}
  if(pt==10){o.col=skin*vec3f(.78,.45,.45);}
  if(zomb&&pt==9){o.col=vec3f(.75,.72,.35);}
  if(zomb&&pt==10){o.col=vec3f(.32,.01,.01);}
  let longHair=hs1(h+7.)<.45;let beard=!longHair&&hs1(h+9.)>.72;
  if((pt==11&&!longHair)||(pt==12&&!beard)){p=vec3f(0.,1.62,0.);}
  // extras: shopping bags, a long coat, a hat, glasses, a backpack, a bun; and a heavier or slimmer build
  let bag=hs1(h+12.)<.45;let bag2=bag&&hs1(h+13.)<.3;let coat=hs1(h+14.)<.3;let hat=hs1(h+15.)<.15;let specs=hs1(h+16.)<.22;let pack=!bag&&hs1(h+17.)<.2;let bun=longHair&&hs1(h+18.)<.3;
  // limbs that have been blown off (bit 1 left arm, 2 right arm, 4 left leg, 8 right leg)
  let lm=u32(d.y+.5);if((pt==4&&(lm&1u)!=0u)||(pt==5&&(lm&2u)!=0u)||(pt==2&&(lm&4u)!=0u)||(pt==3&&(lm&8u)!=0u)){p=vec3f(0.,1.2,0.);}
  if(pt>=13&&(zomb||d.x>.5||(pt==13&&!bag)||(pt==14&&!bag2)||(pt==15&&!coat)||(pt==16&&!hat)||(pt==17&&!specs)||(pt==18&&!pack)||(pt==19&&!bun))){p=vec3f(0.,1.2,0.);}
  if(pt==13||pt==14){o.col=.15+.7*vec3f(hs1(h+20.+f32(pt)),hs1(h+21.+f32(pt)),hs1(h+22.+f32(pt)));if(hs1(h+23.)<.3){o.col=vec3f(.55,.42,.28);}}
  if(pt==15){o.col=select(c.rgb*.55,mix(vec3f(.08,.08,.09),vec3f(.35,.27,.18),hs1(h+24.)),hs1(h+25.)<.6);}
  if(pt==16){o.col=select(c.rgb*.7,vec3f(.05,.05,.06),hs1(h+26.)<.5);}
  if(pt==17){o.col=vec3f(.015);}
  if(pt==18){o.col=mix(vec3f(.05,.06,.08),c.rgb*.6,hs1(h+27.));}
  if(pt==19){o.col=hair;}
  if(pt==0||pt==7||pt==15){p.x*=.88+.3*hs1(h+28.);p.z*=.9+.25*hs1(h+28.);}
  if((pt==4||pt==5)&&p0.y<1.2&&hs1(h+5.)>.4){o.col=skin;}
  p*=b.xyz;p=ry(p,a.w);n=ry(n,a.w);
 }else if(kind==2){
  let th=c.w*6.2831+t*d.z;
  pos=a.xyz+vec3f(b.x*cos(th),sin(th*2.3+c.w*9.)*b.y,b.x*sin(th));
  let yaw=-th+select(0.,3.14159,d.z<0.);
  let pt=i32(part+.5);let fl=sin(t*(7.+hs1(c.w)*3.)+c.w*20.)*.65;
  if(pt==1){p=rz(p,-fl);n=rz(n,-fl);}if(pt==2){p=rz(p,fl);n=rz(n,fl);}
  let bank=select(.35,-.35,d.z<0.);p=ry(rz(p,bank),yaw);n=ry(rz(n,bank),yaw);
 }else if(kind==3){
  let vz=d.z;let T=2.*vz/9.8+.12;let tau=fract(t/T+c.w)*T;
  pos=a.xyz+vec3f(d.x*tau,vz*tau-4.9*tau*tau,d.y*tau);
  if(pos.y<a.w){o.hide=1.;}
  p*=b.xyz;
 }else if(kind==5){ // fish: swim a wobbly ellipse, tail wagging
  let th=t*d.x+c.w*6.2831;let off=vec3f(b.x*cos(th),b.y*sin(th*2.3+c.w*9.),b.z*sin(th));
  let sg=select(1.,-1.,d.x<0.);let yaw=atan2(-b.x*sin(th)*sg,b.z*cos(th)*sg);
  if(part>.5){let w=sin(t*(6.+d.z*8.)+c.w*30.)*.5;p=ry(p-vec3f(0.,0.,-.18),w)+vec3f(0.,0.,-.18);}
  p*=d.y;p=ry(p,yaw+a.w);n=ry(n,yaw+a.w);pos=a.xyz+ry(off,a.w);
 }else if(kind==6){ // whole ride turning: about x (Ferris wheel) or y (carousel)
  let ang=-(t*d.x+c.w*6.2831);
  if(d.y<.5){p=rx(p,ang);n=rx(n,ang);}else{p=ry(p,ang);n=ry(n,ang);}
  p*=b.xyz;p=ry(p,a.w);n=ry(n,a.w);
 }else if(kind==7){ // something carried round: gondolas, horses, coaster cars, drop-tower seats
  let th=t*d.x+c.w*6.2831;var off=vec3f(0.);
  if(d.y<.5){off=vec3f(0.,b.x*sin(th),b.x*cos(th));}
  else if(d.y<1.5){off=vec3f(b.x*cos(th),b.y*sin(d.z*th+c.w*3.),b.z*sin(th));let sg=select(1.,-1.,d.x<0.);let yw=atan2(-b.x*sin(th)*sg,b.z*cos(th)*sg);p=ry(p,yw);n=ry(n,yw);}
  else{off=vec3f(0.,b.y*(.5+.5*sin(th)),0.);}
  p=ry(p+off,a.w);n=ry(n,a.w);
 }else{
  var pitch=d.x;var yaw=a.w;
  if(kind==4){let w=sin(t*1.3+c.w*30.+a.x*.2)*.06;pitch+=w;yaw+=w*.6;}
  p=ry(rx(rz(p*b.xyz,d.y),pitch),yaw);n=ry(rx(rz(n,d.y),pitch),yaw);
 }
 o.p=p+pos;o.n=n;return o;
}
// models: a=(pos,yaw) b=(scale xyz, unused) c=(tint rgb, sway) d=(pitch,roll,unused,glow)
fn modelXf(p0:vec3f,n0:vec3f,a:vec4f,b:vec4f,c:vec4f,d:vec4f)->DV{var o:DV;var q=p0*b.xyz;
 if(c.w>0.){let w=sin(u.cam.w*1.1+a.x*.31+a.z*.17)*c.w*q.y*.05;q.x+=w*q.y;q.z+=w*.6*q.y;}
 o.p=ry(rx(rz(q,d.y),d.x),a.w)+a.xyz;o.n=ry(rx(rz(normalize(n0/b.xyz),d.y),d.x),a.w);o.col=c.rgb;o.hide=0.;return o;}
fn skyDir(d:vec3f)->vec3f{return vec3f(u.skyp.z*d.x-u.skyp.w*d.z,d.y,u.skyp.w*d.x+u.skyp.z*d.z);}
fn shIrr(n0:vec3f)->vec3f{let n=skyDir(n0);let x=n.x;let y=n.y;let z=n.z;
 return max(vec3f(0.),u.sh[0].rgb*.282095+u.sh[1].rgb*(.488603*y)+u.sh[2].rgb*(.488603*z)+u.sh[3].rgb*(.488603*x)
  +u.sh[4].rgb*(1.092548*x*y)+u.sh[5].rgb*(1.092548*y*z)+u.sh[6].rgb*(.315392*(3.*z*z-1.))+u.sh[7].rgb*(1.092548*x*z)+u.sh[8].rgb*(.546274*(x*x-y*y)))*u.skyp.y;}
fn octE(n:vec3f)->vec2f{var p=n.xy/(abs(n.x)+abs(n.y)+abs(n.z));if(n.z<0.){p=(1.-abs(p.yx))*select(vec2f(-1.),vec2f(1.),p>=vec2f(0.));}return p;}
fn octD(e:vec2f)->vec3f{var n=vec3f(e,1.-abs(e.x)-abs(e.y));if(n.z<0.){n=vec3f((1.-abs(n.yx))*select(vec2f(-1.),vec2f(1.),n.xy>=vec2f(0.)),n.z);}return normalize(n);}
fn ggx(N:vec3f,V:vec3f,L:vec3f,r:f32,F0:vec3f)->vec3f{let H=normalize(V+L);let nh=max(dot(N,H),0.);let nv=max(dot(N,V),1e-3);let nl=max(dot(N,L),1e-3);
 let a=max(r*r,.0025);let a2=a*a;let d=nh*nh*(a2-1.)+1.;let D=a2/(PI*d*d);let k=a*.5;let G=1./((nv*(1.-k)+k)*(nl*(1.-k)+k));
 let F=F0+(1.-F0)*pow(1.-max(dot(H,V),0.),5.);return D*G*F*.25;}
`;
// sky lookup: needs skyT + smpR declared by the module
const SKYFN=`
// sky texture: day photo in the top half, the Milky Way night photo in the bottom half
fn skyRad(d0:vec3f)->vec3f{var c=vec3f(0.);
 if(u.nite.x<.999){let d=skyDir(ry(d0,u.cam.w*.0025));
  let uv=vec2f(atan2(d.x,-d.z)/(2.*PI)+.5,min(acos(clamp(d.y,-1.,1.))/PI*2.,.996));
  let s=textureSampleLevel(skyT,smpR,vec2f(uv.x,uv.y*.5),0.).rgb;c=u.skyp.x*s/max(1.-s,vec3f(.03))*u.skyp.y;}
 if(u.nite.x>.001){let dn=vec3f(u.nite.z*d0.x-u.nite.w*d0.z,d0.y,u.nite.w*d0.x+u.nite.z*d0.z);
  let uv=vec2f(atan2(dn.x,-dn.z)/(2.*PI)+.5,min(acos(clamp(dn.y,-1.,1.))/PI*2.,.996));
  let s=textureSampleLevel(skyT,smpR,vec2f(uv.x,.502+uv.y*.498),0.).rgb;c=mix(c,s/max(1.-s,vec3f(.016))*u.nite.y,u.nite.x);}
 return c;}
`;
const SCENE_WGSL=COMMON+SKYFN+`
struct Lt{p:vec4f,c:vec4f};
@group(0)@binding(1)var<storage,read>LS:array<Lt>;
@group(0)@binding(2)var<storage,read>GR:array<u32>;
@group(0)@binding(3)var atl:texture_2d<f32>;
@group(0)@binding(4)var smp:sampler;
@group(0)@binding(5)var albT:texture_2d_array<f32>;
@group(0)@binding(6)var nrT:texture_2d_array<f32>;
@group(0)@binding(7)var shT:texture_depth_2d;
@group(0)@binding(8)var cmp:sampler_comparison;
@group(0)@binding(9)var visT:texture_3d<f32>;
@group(0)@binding(10)var skyT:texture_2d<f32>;
@group(0)@binding(11)var smpR:sampler;
@group(0)@binding(12)var mAlb:texture_2d_array<f32>;
@group(0)@binding(13)var mNr:texture_2d_array<f32>;
@group(0)@binding(14)var lblT:texture_2d<f32>;
const STRIDE=33u;
struct VO{
 @builtin(position)pos:vec4f,
 @location(0)wp:vec3f,
 @location(1)n:vec3f,
 @location(2)col:vec3f,
 @location(3)@interpolate(flat)m:vec4f,
 @location(4)lp:vec3f,
 @location(5)@interpolate(flat)ln:vec3f,
 @location(6)@interpolate(flat)sg:vec4f,
};
struct FO{@location(0)c:vec4f,@location(1)g:vec4f,@location(2)a:vec4f};
fn shade(wp:vec3f,Ng:vec3f,N:vec3f,V:vec3f,dist:f32,base:vec3f,rough:f32,metal:f32,emis:vec3f)->FO{
 let t=u.cam.w;
 let F0=mix(vec3f(.04),base,metal);let dif=base*(1.-metal);
 let NV=max(dot(N,V),1e-3);
 // baked sky visibility + ambient occlusion (from the compute pass)
 let wq=wp+Ng*.55;let qx=wq.x-u.rgn.z;let qz=wq.z-u.rgn.w;
 let vc=(vec3f(u.rgn.x*qx+u.rgn.y*qz,wq.y,-u.rgn.y*qx+u.rgn.x*qz)-u.vis.xyz)*u.vis.w/vec3f(textureDimensions(visT));
 var skyV=.6;var ao=1.;
 if(all(vc>vec3f(0.))&&all(vc<vec3f(1.))){let vv=textureSampleLevel(visT,smp,vc,0.);skyV=vv.r;ao=vv.g;}
 var acc=dif*shIrr(N)/PI*skyV;
 acc+=dif*mix(vec3f(.09,.075,.065),vec3f(.15,.145,.15),N.y*.5+.5)*u.misc.y*ao;
 let R=reflect(-V,N);
 let Fv=F0+(1.-F0)*pow(1.-NV,5.);
 acc+=Fv*shIrr(R)/PI*skyV*ss(.3,.55,rough)*ao;
 // the sun, through the glass roof
 let Ls=u.sun.xyz;let nlg=dot(Ng,Ls);
 if(nlg>0.){
  var sh=shadow(wp+Ng*.05,1.3);
  if(sh>0.){let cp=wp.xz+Ls.xz/max(Ls.y,.2)*(600.-wp.y);sh*=mix(1.,.22,ss(.48,.72,cloudAt(cp)));}
  if(sh>0.){acc+=u.sunC.rgb*sh*max(dot(N,Ls),0.)*(dif/PI+ggx(N,V,Ls,rough,F0));}
 }
 // shop and concourse lights
 let lvl=select(0u,1u,wp.y>5.99);
 let gc=floor((wp.xz-u.grid.xy)/u.grid.z);
 if(gc.x>=0.&&gc.y>=0.&&gc.x<u.grid.w&&gc.y<u.misc.x){
  let bi=(lvl*u32(u.grid.w*u.misc.x)+u32(gc.y*u.grid.w+gc.x))*STRIDE;
  let cnt=GR[bi];
  for(var k=1u;k<=cnt;k++){
   let L=LS[GR[bi+k]];
   let d=L.p.xyz-wp;let d2=dot(d,d);let r2=L.p.w*L.p.w;
   if(d2>=r2){continue;}
   let Ld=d*inverseSqrt(max(d2,1e-4));
   let x=d2/r2;let win=1.-x*x;
   var att=win*win/(1.+d2*.25);
   if(L.c.w>0.){if(h31(vec3f(floor(t*13.),L.c.w,7.))<.14){att*=.06;}}
   let nd=max(dot(N,Ld),0.);
   if(nd<=0.){continue;}
   acc+=L.c.rgb*att*nd*(dif*(.4+.6*ao)+ggx(N,V,Ld,max(rough,.12),F0)*PI*.6);
  }
 }
 acc+=vec3f(1.,.94,.82)*torch(wp,N)*(dif+F0*.3);
 var col=acc+emis;
 col=mix(col,u.fog.yzw,1.-exp(-dist*u.fog.x));
 let vn3=(u.view*vec4f(N,0.)).xyz;
 let vd=-(u.view*vec4f(wp,1.)).z;
 var o:FO;
 o.c=vec4f(col,1.);
 o.g=vec4f(octE(normalize(vn3)),vd,0.);
 o.a=vec4f(rough,metal,skyV,1.);
 return o;
}
@vertex fn vs(@location(0)p:vec3f,@location(1)n:vec3f,@location(2)a:vec4f,@location(3)b:vec4f,@location(4)c:vec4f,@location(5)d:vec4f)->VO{
 var o:VO;
 o.wp=rot(p*b.xyz,a.w,d.w)+a.xyz;o.n=rot(n,a.w,d.w);
 o.col=c.rgb;o.m=vec4f(b.w,c.w,d.z,d.w);o.lp=p;o.ln=n;o.sg=d;
 o.pos=u.vp*vec4f(o.wp,1.);
 return o;
}
@vertex fn vsDyn(@location(0)p:vec3f,@location(1)n:vec3f,@location(2)part:f32,@location(3)a:vec4f,@location(4)b:vec4f,@location(5)c:vec4f,@location(6)d:vec4f)->VO{
 let r=dynXf(p,n,part,a,b,c,d);var o:VO;
 let kind=i32(b.w+.5);var em=0.;var sp=.12;
 if(kind==3){em=.5;sp=.97;}else if(kind==4){sp=.3;}else if(kind==1){sp=.2;}else if(kind==8){em=d.z;sp=.4;}
 var col=r.col;
 if(kind>=5&&kind<=7){sp=.5;if(part>.5&&part<1.5&&kind!=5){em=3.;col=mix(r.col,vec3f(1.,.7,.3),.5)*(.6+.4*sin(u.cam.w*3.+p.x*2.+p.y*3.+p.z*2.));}if(part>1.5&&part<2.5){col=vec3f(.9,.88,.85);sp=.7;}if(part>2.5&&part<3.5){col=vec3f(.62,.43,.34);}if(part>3.5&&part<4.5){col=vec3f(.42,.06,.03);}if(part>4.5&&part<5.5){col=vec3f(.5,.25,.6);sp=.9;}}
 o.wp=r.p;o.n=r.n;o.col=col;o.m=vec4f(em,sp,select(0.,d.w,kind==8),0.);o.lp=p;o.ln=n;o.sg=vec4f(-1.,0.,0.,0.);
 o.pos=u.vp*vec4f(r.p,1.);if(r.hide>.5){o.pos=vec4f(2.,2.,2.,1.);}
 return o;
}
fn shadow(p:vec3f,soft:f32)->f32{
 let s=u.lvp*vec4f(p,1.);let uv=s.xy*vec2f(.5,-.5)+.5;
 if(any(uv<vec2f(0.))||any(uv>vec2f(1.))||s.z>1.||u.sun.w<.5){return 0.;}
 let ts=soft/vec2f(textureDimensions(shT));var acc=0.;
 for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){acc+=textureSampleCompareLevel(shT,cmp,uv+vec2f(f32(x),f32(y))*ts,s.z-.0004);}}
 return acc/9.;
}
// material table: layer, metres per tile, normal strength, roughness scale
fn matOf(p:i32)->vec4f{
 if(p==1||p==12){return vec4f(0.,1.5,1.,.2);}
 if(p==7){return vec4f(7.,3.4,1.,1.5);}
 if(p==20){return vec4f(9.,2.5,1.,1.3);}
 if(p==21){return vec4f(10.,3.,1.,1.1);}
 if(p==22){return vec4f(11.,2.2,1.,1.1);}
 if(p==23){return vec4f(12.,2.4,1.,1.);}
 if(p==24){return vec4f(13.,2.,1.,.45);}
 if(p==25){return vec4f(14.,2.2,1.,1.1);}
 if(p==26){return vec4f(15.,2.5,1.,1.1);}
 if(p==27){return vec4f(16.,2.6,1.,1.);}
 if(p==28){return vec4f(17.,3.,1.,1.);}
 if(p==29){return vec4f(18.,2.6,1.,1.);}
 if(p==2){return vec4f(2.,1.7,1.,.55);}
 if(p==10){return vec4f(1.,2.3,1.,.32);}
 if(p==11){return vec4f(3.,2.,.5,1.);}
 // gun finishes (zombie mode): Poly Haven metal plates and paint, layers 19-24
 if(p>=40&&p<=45){return vec4f(19.+f32(p-40),.55,1.3,1.);}
 return vec4f(-1.,1.,0.,1.);
}
// each part of the mall gets its own floor
fn zoneMat(wp:vec3f)->vec4f{
 if(wp.y>3.){return vec4f(6.,1.8,1.,.3);}                   // upper walkways: speckled granite
 let ax=abs(wp.x);let az=abs(wp.z);
 if(ax<16.&&az<26.){return vec4f(4.,3.,1.,.3);}            // food court: marble checkerboard
 if(abs(ax-60.)<16.&&az>=7.){return vec4f(5.,3.,1.,.3);}   // wings: large stone slabs
 if(wp.x<0.){return vec4f(0.,1.5,1.,.2);}                   // west concourse: cream marble
 return vec4f(8.,1.5,1.,.35);                               // east concourse: warm stone squares
}
fn band(v:f32,a:f32,b:f32,w:f32)->f32{return ss(a-w,a+w,v)*(1.-ss(b-w,b+w,v));}
// dark granite inlays: shopfront borders, diamonds down the concourse, rings around the fountain
fn inlay(wp:vec3f,w:f32)->f32{
 let ax=abs(wp.x);let az=abs(wp.z);
 if(wp.y>3.){if(ax>16.&&ax<120.&&abs(ax-60.)>14.){return band(az,6.35,6.75,w);}return 0.;}
 if(ax<16.&&az<26.){let r=length(wp.xz);
  return max(max(band(r,5.,5.6,w),band(r,6.,6.2,w)),max(band(az,21.3,21.8,w)*step(ax,11.8),band(ax,11.3,11.8,w)*step(az,21.8)));}
 if(abs(ax-60.)<16.&&az>=7.){return band(abs(ax-60.),3.3,3.6,w)*step(17.,az);}
 if(ax>16.&&ax<120.){
  let cx=wp.x-(floor(wp.x/12.)+.5)*12.;let d=abs(cx)+abs(wp.z)*1.3;
  return max(band(az,5.6,6.2,w),max(band(d,1.25,1.6,w),1.-ss(.45-w,.45+w,d)));}
 return 0.;
}
@fragment fn fs(i:VO)->FO{
 let t=u.cam.w;
 let wp=i.wp;
 let V0=u.cam.xyz-wp;let dist=length(V0);let V=V0/max(dist,1e-4);
 var Ng=normalize(i.n);
 if(dot(Ng,V)<0.){Ng=-Ng;}
 // sign lettering (sampled unconditionally to keep derivatives valid)
 let f=i32(i.sg.y+.5);
 var fd=vec3f(0.,0.,1.);var rt=vec3f(1.,0.,0.);
 if(f==1){fd=vec3f(0.,0.,-1.);rt=vec3f(-1.,0.,0.);}
 else if(f==2){fd=vec3f(1.,0.,0.);rt=vec3f(0.,0.,-1.);}
 else if(f==3){fd=vec3f(-1.,0.,0.);rt=vec3f(0.,0.,1.);}
 let si=max(i.sg.x,0.);
 let cl=vec2f(si-u.misc.z*floor(si/u.misc.z),floor(si/u.misc.z));
 let suv=clamp(vec2f(dot(i.lp,rt)+.5,.5-i.lp.y),vec2f(.004),vec2f(.996));
 let tx=textureSample(atl,smp,(cl+suv)/u.misc.zw).r;
 // packaged goods: the position along a shelf, measured to the viewer's right, and its screen-space rates of change
 let anF=abs(Ng);let hc=select(-wp.x*sign(Ng.z),wp.z*sign(Ng.x),anF.x>anF.z);
 let lp9=vec2f(hc,wp.y);let dlx=dpdx(lp9);let dly=dpdy(lp9);let dsx=dpdx(suv);let dsy=dpdy(suv);
 // photo materials: box-projected in world space
 var pat=i32(i.m.z+.5);
 if((pat==1||pat==7||pat==12)&&Ng.y<-.5){pat=11;}
 let isFloor=pat==1&&Ng.y>.5;
 var M=matOf(pat);if(isFloor){M=zoneMat(wp);}
 let an=abs(Ng);var uv=wp.xz;var T=vec3f(1.,0.,0.);var Bt=vec3f(0.,0.,1.);
 if(an.x>an.y&&an.x>an.z){uv=vec2f(wp.z,-wp.y);T=vec3f(0.,0.,1.);Bt=vec3f(0.,-1.,0.);}
 else if(an.z>an.y){uv=vec2f(wp.x,-wp.y);T=vec3f(1.,0.,0.);Bt=vec3f(0.,-1.,0.);}
 // gun finishes follow the gun: map them in the part's own space rather than the world's
 if(pat>=40){let al=abs(i.ln);uv=select(select(i.lp.xy,i.lp.xz,al.y>.5),i.lp.zy,al.x>.5);}
 let lay=max(i32(M.x),0);
 let ta=textureSample(albT,smpR,uv/M.y,lay);
 let tn=textureSample(nrT,smpR,uv/M.y,lay);
 let ga=textureSample(albT,smpR,uv/2.3,1);let gn=textureSample(nrT,smpR,uv/2.3,1);
 let inl=select(0.,inlay(wp,.004+dist*.0025),isFloor);
 var base=i.col;var emis=i.col*i.m.x;var rough=clamp(1.-i.m.y*.9,.06,1.);var metal=0.;
 var N=Ng;
 if(M.x>-.5){
  let tint=i.col/max(dot(i.col,vec3f(.3333)),.02);
  let lum=dot(ta.rgb,vec3f(.3,.59,.11));
  if(pat==11){base=i.col*(.62+.38*lum/.6);}
  else if(pat==10){base=ta.rgb*mix(vec3f(1.),tint,.55)*1.15;}
  else if(pat==2){base=ta.rgb*mix(vec3f(1.),tint,.15);}
  else if(pat==7||isFloor){base=ta.rgb*1.05;}
  else if(pat>=40){base=ta.rgb*mix(vec3f(1.),tint,.6)*1.1;emis+=base*.12;}
  else{base=ta.rgb*mix(vec3f(1.),tint,.35)*1.05;}
  let tnn=mix(tn,gn,inl);
  let nx=(tnn.rg*2.-1.)*M.z;
  N=normalize(T*nx.x+Bt*nx.y+Ng*sqrt(max(.05,1.-dot(nx,nx))));
  rough=clamp(tn.b*M.w,.05,1.);
  if(isFloor){
   // patchy tone and gloss so long runs of floor never repeat exactly
   let z=M.x*7.;
   base*=.9+.2*vn(vec3f(wp.xz*.35,z))+.06*(h31(vec3f(floor(wp.xz*.66),z))-.5);
   rough=clamp(rough*(.7+.8*vn(vec3f(wp.xz*.5,z+3.))),.04,1.);
   base=mix(base,ga.rgb*vec3f(.42,.4,.42),inl);rough=mix(rough,.1,inl);
  }
 }
 if(i.m.y>.75&&M.x<0.){metal=1.;rough=clamp(1.-i.m.y,.12,.5);}
 if(i.sg.x>-.5){
  if(dot(i.ln,fd)>.5){emis=i.col*i.m.x*tx;base=vec3f(.02);}else{emis=vec3f(0.);base=vec3f(.03);}
 }
 let up=abs(Ng.y)>.5;
 if(pat==13){base=vec3f(.6,.68,.78)*(.94+.06*vn(wp*2.));rough=.03+.1*ss(.55,.8,vn(vec3f(wp.xz*6.,1.)));metal=0.;}
 else if(pat==3){ // carpet
  base*=.8+.35*vn(wp*9.);rough=1.;
 }else if(pat==4&&!up){ // stripes
  base*=mix(1.,.55,step(.5,fract((wp.x+wp.z)*1.4)));
 }else if(pat==5){ // screens
  emis*=.55+.45*sin(dot(wp,vec3f(3.,9.,3.))-t*2.5+h31(floor(wp*.7))*6.283);rough=.1;
 }else if(pat==6&&!up){ // ribbed shutter
  base*=.6+.4*step(.35,fract(wp.y*6.));
 }else if(pat==8){ // water
  let w=sin(wp.x*3.+t)+sin(wp.z*3.7-t*1.3)+sin((wp.x+wp.z+wp.y)*2.3+t*.7);emis*=.75+.12*w;rough=.05;
 }else if(pat==9&&!up){ // shelves of goods
  let h=h31(vec3f(floor(wp.x*12.),floor(wp.z*12.),floor(wp.y*2.2)));
  let bc=.5+.5*cos(6.2831*(h+vec3f(0.,.33,.67)));let sh=fract(wp.y*2.2);
  base=mix(bc*bc*.7*(.7+.3*h31(vec3f(floor(wp.x*40.),floor(wp.z*40.),3.))),i.col*.5,step(sh,.1));
 }
 // labelled goods. 30: a box with a printed label on its front face. 33: shelves of packages, 31: shelves of books,
 // 32: racks of records. Labels come from the generated label texture (16 x 16 designs).
 var lt=-1.;var lu=vec2f(.5);var gx=vec2f(0.);var gy=vec2f(0.);
 if(pat==30&&dot(i.ln,fd)>.5){lt=max(-i.sg.x-2.,0.);lu=clamp(suv,vec2f(.01),vec2f(.99));gx=dsx;gy=dsy;rough=.4;}
 else if(pat>=31&&pat<=33&&!up){
  let rows=select(select(2.2,2.6,pat==31),3.,pat==32);let ry=wp.y*rows;let row=floor(ry);let fy=fract(ry);
  let iw=select(select(.19,.05,pat==31),.33,pat==32);let gcol=floor(hc/iw);let fx=fract(hc/iw);
  let h=h31(vec3f(gcol,row,f32(pat)+floor(wp.y*.1)));
  let hf=select(.6+.27*h,.8+.12*h,pat==31);
  base=i.col*.3;if(fy<.1){base=i.col*.7;}
  if(fy>.1&&fy<.1+hf&&fx>.06&&fx<.94){
   if(pat==31){let grp=h31(vec3f(floor(hc/.25),row,7.));
    if(grp<.18){lt=160.+floor(h31(vec3f(floor(hc/.25),row,9.))*64.);let gw=fract(hc/.25);lu=vec2f(gw,1.-(fy-.1)/hf);gx=vec2f(dlx.x/.25,-dlx.y*rows/hf);gy=vec2f(dly.x/.25,-dly.y*rows/hf);}
    else{let sc=.5+.5*cos(6.2831*(h+vec3f(0.,.33,.67)));base=mix(vec3f(.32,.28,.24),sc*sc,.45)*(.35+.4*h31(vec3f(gcol,row,3.)));let by=(fy-.1)/hf;
     if(h31(vec3f(gcol,row,5.))<.45&&(abs(by-.78)<.018||abs(by-.22)<.014)){base=vec3f(.42,.34,.16);}}}
   else{lt=select(floor(h*160.),224.+floor(h*32.),pat==32);lu=vec2f((fx-.06)/.88,1.-(fy-.1)/hf);
    gx=vec2f(dlx.x/(iw*.88),-dlx.y*rows/hf);gy=vec2f(dly.x/(iw*.88),-dly.y*rows/hf);}
  }
  rough=.55;
 }
 if(lt>=0.){let tl=vec2f(lt-16.*floor(lt/16.),floor(lt/16.));base=textureSampleGrad(lblT,smp,(tl+lu)/16.,gx/16.,gy/16.).rgb;emis=vec3f(0.);}
 return shade(wp,Ng,N,V,dist,base,rough,metal,emis);
}
// super low detail: flat colours lit by the sun and the sky, and fog; no textures, reflections, shadows or effects
@fragment fn fsLow(i:VO)->@location(0)vec4f{
 var N=normalize(i.n);let V0=u.cam.xyz-i.wp;let dist=length(V0);if(dot(N,V0)<0.){N=-N;}
 let nk=u.nite.x;let L=normalize(u.sun.xyz);let ndl=max(dot(N,L),0.);
 let amb=mix(vec3f(.5,.53,.58),vec3f(.2,.22,.3)+vec3f(.24,.23,.2)*u.ph.x,nk)*(.72+.28*N.y)*(1.+.15*u.ph.x);
 var c=i.col*(amb+mix(vec3f(.65,.6,.52),vec3f(.08,.09,.14),nk)*ndl)+i.col*i.m.x*.6;
 c+=i.col*vec3f(1.,.94,.82)*torch(i.wp,N)*.8;
 c=mix(c,mix(vec3f(.62,.7,.82),mix(vec3f(.03,.04,.07),vec3f(.13,.14,.19),u.ph.x),nk),1.-exp(-dist*u.fog.x*.8));
 return vec4f(pow(clamp(c,vec3f(0.),vec3f(1.)),vec3f(1./2.2)),1.);}
// ---- Poly Haven models and foliage cards: textured meshes, instanced ----
struct MO{@builtin(position)pos:vec4f,@location(0)wp:vec3f,@location(1)n:vec3f,@location(2)uv:vec2f,@location(3)@interpolate(flat)m:vec4f,@location(4)tint:vec3f};
@vertex fn vsModel(@location(0)p4:vec4f,@location(1)n:vec3f,@location(2)uv:vec2f,@location(4)a:vec4f,@location(5)b:vec4f,@location(6)c:vec4f,@location(7)d:vec4f)->MO{let p=p4.xyz;let lay=p4.w;
 let r=modelXf(p,n,a,b,c,d);var o:MO;o.wp=r.p;o.n=r.n;o.uv=uv;o.m=vec4f(lay,b.w,d.z,d.w);o.tint=c.rgb;o.pos=u.vp*vec4f(r.p,1.);return o;}
@fragment fn fsModel(i:MO,@builtin(front_facing)ff:bool)->FO{
 let lay=i32(i.m.x+.5);
 let ta=textureSample(mAlb,smpR,i.uv,lay);let tn=textureSample(mNr,smpR,i.uv,lay);
 let dp1=dpdx(i.wp);let dp2=dpdy(i.wp);let du1=dpdx(i.uv);let du2=dpdy(i.uv);
 if(ta.a<.45){discard;}
 let V0=u.cam.xyz-i.wp;let dist=length(V0);let V=V0/max(dist,1e-4);
 var Ng=normalize(i.n);if(!ff){Ng=-Ng;}
 let pT=cross(dp2,Ng);let pB=cross(Ng,dp1);let Tt=pT*du1.x+pB*du2.x;let Bb=pT*du1.y+pB*du2.y;let ivm=inverseSqrt(max(max(dot(Tt,Tt),dot(Bb,Bb)),1e-12));
 let nx=tn.rg*2.-1.;var N=normalize(Tt*ivm*nx.x-Bb*ivm*nx.y+Ng*sqrt(max(.05,1.-dot(nx,nx))));
 if(dot(N,N)<.5||any(N!=N)){N=Ng;}
 let base=ta.rgb*i.tint;let rough=clamp(tn.b,.05,1.);
 return shade(i.wp,Ng,N,V,dist,base,rough,0.,base*i.m.w);
}
// ---- sky behind the glass ----
@vertex fn vsSky(@builtin(vertex_index)i:u32)->@builtin(position)vec4f{return vec4f(f32(i32(i&1u)*4-1),f32(i32(i>>1u)*4-1),1.,1.);}
@fragment fn fsSky(@builtin(position)fc:vec4f)->FO{
 let ndc=vec2f(fc.x*u.scr.z*2.-1.,1.-fc.y*u.scr.w*2.);
 let w=u.ivp*vec4f(ndc,1.,1.);let d=normalize(w.xyz/w.w-u.cam.xyz);
 var c=skyRad(d);
 let k=u.nite.x;
 if(k>0.){let lum=dot(c,vec3f(.3,.6,.1));c*=1.+k*.45*sin(u.cam.w*5.+h31(floor(d*1800.))*40.)*ss(.25,1.5,lum);}
 if(d.y>.02){let q=d.xz/d.y*600.;let cl=cloudAt(q);let m=ss(.5,.78,cl)*ss(.02,.25,d.y);
  let cc=mix(vec3f(1.,.99,.97)*u.skyp.y*(1.1+.9*ss(.6,.9,cl)),vec3f(.045,.05,.065),k);
  c=mix(c,cc,m*mix(.75,.45,k));}
 let sd=dot(d,u.sun.xyz);
 c+=u.sunC.rgb*(1.-k)*(ss(.99997,.999992,sd)*90.+pow(max(sd,0.),900.)*1.5+pow(max(sd,0.),60.)*.05);
 if(k>0.){ // full moon: limb-darkened disk with procedural maria and craters, plus a soft halo
  let mr=.021;let ax=normalize(cross(u.sun.xyz,vec3f(0.,1.,0.)));let ay=cross(ax,u.sun.xyz);
  let q=vec2f(dot(d,ax),dot(d,ay))/mr;let r=length(q);
  if(sd>0.&&r<1.05){let zz=sqrt(max(0.,1.-r*r));let sp=vec3f(q,zz);
   let mar=fbm2(sp.xy*1.6+vec2f(3.,7.));let cr=vn(sp*11.)*.5+vn(sp*23.)*.5;
   let alb=mix(1.,.5,ss(.42,.6,mar))*(.86+.18*cr);
   c=mix(c,vec3f(1.,.97,.9)*alb*(.55+.45*zz)*5.,k*(1.-ss(.97,1.03,r)));}
  c+=vec3f(.55,.65,.9)*k*(pow(max(sd,0.),4000.)*1.2+pow(max(sd,0.),300.)*.12+pow(max(sd,0.),20.)*.012);
 }
 var o:FO;o.c=vec4f(c,1.);o.g=vec4f(0.,0.,6e4,0.);o.a=vec4f(1.,0.,1.,0.);return o;
}
// ---- glass: thin tinted panes, blended over what is behind ----
@fragment fn fsGlass(i:VO)->@location(0)vec4f{
 let V=normalize(u.cam.xyz-i.wp);var N=normalize(i.n);if(dot(N,V)<0.){N=-N;}
 let nv=max(dot(N,V),0.);let F=.04+.96*pow(1.-nv,5.);
 let R=reflect(-V,N);
 var refl=mix(vec3f(.16,.13,.11),vec3f(.3,.26,.22),ss(-.5,.5,R.y))*(1.-.75*u.nite.x);
 if(R.y>.05){refl=skyRad(R)*.6;}
 let g=dot(N,u.sun.xyz);
 if(g>0.){refl+=u.sunC.rgb*ggx(N,V,u.sun.xyz,.05,vec3f(.04))*g/max(F,.04)*.2;}
 let dirt=vn(i.wp*vec3f(.6,2.5,.6))*.6+vn(i.wp*3.1)*.4;
 let a=(1.-F)*(.86-.07*dirt);
 return vec4f(refl*F+vec3f(.012,.013,.012)*dirt+i.col*i.m.x*.35,a*(1.-.55*min(i.m.x,1.)));
}`;
const SHADOW_WGSL=COMMON+`
@group(0)@binding(1)var mAlbS:texture_2d_array<f32>;@group(0)@binding(2)var smS:sampler;
struct SO{@builtin(position)pos:vec4f,@location(0)uv:vec2f,@location(1)@interpolate(flat)lay:f32};
@vertex fn vsModelA(@location(0)p4:vec4f,@location(1)n:vec3f,@location(2)uv:vec2f,@location(4)a:vec4f,@location(5)b:vec4f,@location(6)c:vec4f,@location(7)d:vec4f)->SO{let p=p4.xyz;let lay=p4.w;
 var o:SO;o.pos=u.lvp*vec4f(modelXf(p,n,a,b,c,d).p,1.);o.uv=uv;o.lay=lay;return o;}
@fragment fn fsModelA(i:SO){if(textureSampleLevel(mAlbS,smS,i.uv,i32(i.lay+.5),0.).a<.45){discard;}}
@vertex fn vsModel(@location(0)p4:vec4f,@location(1)n:vec3f,@location(2)uv:vec2f,@location(4)a:vec4f,@location(5)b:vec4f,@location(6)c:vec4f,@location(7)d:vec4f)->@builtin(position)vec4f{let p=p4.xyz;let lay=p4.w;
 return u.lvp*vec4f(modelXf(p,n,a,b,c,d).p,1.);}
@vertex fn vsDyn(@location(0)p:vec3f,@location(1)n:vec3f,@location(2)part:f32,@location(3)a:vec4f,@location(4)b:vec4f,@location(5)c:vec4f,@location(6)d:vec4f)->@builtin(position)vec4f{
 return u.lvp*vec4f(dynXf(p,n,part,a,b,c,d).p,1.);}
@vertex fn vs(@location(0)p:vec3f,@location(1)n:vec3f,@location(2)a:vec4f,@location(3)b:vec4f,@location(4)c:vec4f,@location(5)d:vec4f)->@builtin(position)vec4f{
 return u.lvp*vec4f(rot(p*b.xyz,a.w,d.w)+a.xyz,1.);}`;
// sky visibility + ambient occlusion, baked once from the collision grid
const VIS_WGSL=`
@group(0)@binding(0)var occ:texture_3d<u32>;
@group(0)@binding(1)var outT:texture_storage_3d<rgba8unorm,write>;
struct VP{a:vec4f,o:vec4f,n:vec4f};
@group(0)@binding(2)var<uniform>vp:VP;
fn solid(p:vec3f)->bool{
 let g=floor((p-vp.o.xyz)/.5);
 if(g.y<0.){return true;}
 if(g.y>=vp.n.y){return false;}
 if(g.x<0.||g.z<0.||g.x>=vp.n.x||g.z>=vp.n.z){return vp.a.z>.5;}
 return textureLoad(occ,vec3i(g),0).r>0u;
}
@compute @workgroup_size(4,4,4) fn main(@builtin(global_invocation_id)id:vec3u){
 let dims=textureDimensions(outT);if(any(id>=dims)){return;}
 let c=vp.o.xyz+vec3f(id)+.5;let top=vp.o.y+vp.n.y*.5+.3;
 let ns=u32(vp.a.x);var sky=0.;
 for(var k=0u;k<ns;k++){
  let fk=(f32(k)+.5)/f32(ns);let r=sqrt(fk);let ph=f32(k)*2.399963;
  let d=vec3f(r*cos(ph),sqrt(1.-fk),r*sin(ph));
  var t=.7;var vis=1.;
  loop{let p=c+d*t;if(p.y>top){break;}if(solid(p)){vis=0.;break;}t+=.5;if(t>110.){vis=0.;break;}}
  sky+=vis;
 }
 let na=u32(vp.a.y);var occl=0.;
 for(var k=0u;k<na;k++){
  let fk=(f32(k)+.5)/f32(na);let z=1.-2.*fk;let rr=sqrt(1.-z*z);let ph=f32(k)*2.399963;
  let d=vec3f(rr*cos(ph),z,rr*sin(ph));var t=.7;
  loop{if(t>4.){break;}if(solid(c+d*t)){occl+=1.-t/4.;break;}t+=.5;}
 }
 textureStore(outT,id,vec4f(sky/f32(ns),clamp(1.-occl/f32(na)*1.3,0.,1.),0.,1.));
}`;
const FS_VS=`@vertex fn vs(@builtin(vertex_index)i:u32)->@builtin(position)vec4f{return vec4f(f32(i32(i&1u)*4-1),f32(i32(i>>1u)*4-1),0.,1.);}`;
// screen-space reflections + volumetric sun shafts (half resolution)
const FX_WGSL=COMMON+SKYFN+FS_VS+`
@group(0)@binding(1)var gb:texture_2d<f32>;
@group(0)@binding(2)var ax:texture_2d<f32>;
@group(0)@binding(3)var hdr:texture_2d<f32>;
@group(0)@binding(4)var shT:texture_depth_2d;
@group(0)@binding(5)var cmp:sampler_comparison;
@group(0)@binding(6)var ls:sampler;
@group(0)@binding(7)var skyT:texture_2d<f32>;
@group(0)@binding(8)var smpR:sampler;
struct FX{@location(0)r:vec4f,@location(1)v:vec4f};
fn vpos(uv:vec2f,d:f32)->vec3f{let n=vec2f(uv.x*2.-1.,1.-uv.y*2.);return vec3f(n.x*d/u.proj.x,n.y*d/u.proj.y,-d);}
fn prj(p:vec3f)->vec2f{let n=vec2f(p.x*u.proj.x,p.y*u.proj.y)/(-p.z);return vec2f(n.x*.5+.5,.5-n.y*.5);}
fn dAt(q:vec2f)->f32{return textureLoad(gb,vec2i(clamp(q,vec2f(0.),vec2f(.9999))*u.scr.xy),0).z;}
fn ign(p:vec2f)->f32{return fract(52.9829189*fract(dot(p,vec2f(.06711056,.00583715))));}
@fragment fn fs(@builtin(position)fc:vec4f)->FX{
 let uv=fc.xy*2.*u.scr.zw;
 let ip=vec2i(uv*u.scr.xy);
 let g=textureLoad(gb,ip,0);let am=textureLoad(ax,ip,0);
 let d=g.z;let rough=am.x;let j=fract(ign(fc.xy)+u.cam.w*.618);
 var o:FX;o.r=vec4f(0.);o.v=vec4f(0.);
 let ndc=vec2f(uv.x*2.-1.,1.-uv.y*2.);
 let w=u.ivp*vec4f(ndc,1.,1.);let dw=normalize(w.xyz/w.w-u.cam.xyz);
 // reflections
 if(d<250.&&rough<.5){
  let P=vpos(uv,d);let N=octD(g.xy);let R=reflect(normalize(P),N);
  var stepL=.12+d*.015;var p=P+N*.03+R*stepL*j;var hit=false;var huv=vec2f(0.);
  for(var k=0;k<40;k++){
   p+=R*stepL;stepL*=1.1;
   if(p.z>-u.proj.z){break;}
   let q=prj(p);if(any(q<vec2f(0.))||any(q>vec2f(1.))){break;}
   let sd=dAt(q);let dz=-p.z-sd;
   if(dz>0.&&dz<stepL*1.5+.25){
    var a=p-R*stepL;var b=p;
    for(var r=0;r<6;r++){let m=(a+b)*.5;if(-m.z>dAt(prj(m))){b=m;}else{a=m;}}
    huv=prj(b);hit=true;break;
   }
  }
  let Rw=(transpose(u.view)*vec4f(R,0.)).xyz;
  var fb=mix(vec3f(.05,.045,.04),vec3f(.12,.1,.09),ss(-.3,.6,Rw.y));
  if(Rw.y>0.){fb=mix(fb,skyRad(Rw),am.z*am.z);}
  var c=fb;
  if(hit){let e=min(min(huv.x,1.-huv.x),min(huv.y,1.-huv.y));let k=ss(0.,.1,e);c=mix(fb,textureSampleLevel(hdr,ls,huv,0.).rgb,k);}
  o.r=vec4f(c,1.-ss(.3,.5,rough));
 }
 // sun shafts: march the view ray through the sun's shadow map
 let fw=-vec3f(u.view[0].z,u.view[1].z,u.view[2].z);
 let tmax=min(d/max(dot(dw,fw),.05),140.);
 var lit=0.;let n=20;
 for(var k=0;k<n;k++){
  let tt=(f32(k)+j)/f32(n)*tmax;let p=u.cam.xyz+dw*tt;
  if(p.y>18.){continue;}
  let s=u.lvp*vec4f(p,1.);let su=s.xy*vec2f(.5,-.5)+.5;
  if(any(su<vec2f(0.))||any(su>vec2f(1.))){continue;}
  lit+=textureSampleCompareLevel(shT,cmp,su,s.z-.0005);
 }
 let cs=dot(dw,u.sun.xyz);let gg=.6;
 let ph=(1.-gg*gg)/(4.*PI*pow(1.+gg*gg-2.*gg*cs,1.5))+.03;
 o.v=vec4f(u.sunC.rgb*ph*u.sunC.w*lit/f32(n)*tmax,1.);
 return o;
}`;
// combine: base + reflections + shafts
const COMBINE_WGSL=COMMON+FS_VS+`
@group(0)@binding(1)var hdr:texture_2d<f32>;
@group(0)@binding(2)var gb:texture_2d<f32>;
@group(0)@binding(3)var ax:texture_2d<f32>;
@group(0)@binding(4)var fxR:texture_2d<f32>;
@group(0)@binding(5)var fxV:texture_2d<f32>;
@group(0)@binding(6)var ls:sampler;
@fragment fn fs(@builtin(position)fc:vec4f)->@location(0)vec4f{
 let ip=vec2i(fc.xy);let uv=fc.xy*u.scr.zw;
 var c=textureLoad(hdr,ip,0).rgb;
 let g=textureLoad(gb,ip,0);let am=textureLoad(ax,ip,0);
 let r=textureSampleLevel(fxR,ls,uv,0.);
 if(g.z<250.&&r.a>0.){
  let P=normalize(vec3f((uv.x*2.-1.)/u.proj.x,(1.-uv.y*2.)/u.proj.y,-1.));
  let N=octD(g.xy);let nv=clamp(dot(N,-P),0.,1.);
  let F0=mix(.04,.65,am.y);let F=F0+(1.-F0)*pow(1.-nv,5.);
  c+=r.rgb*F*r.a;
 }
 c+=textureSampleLevel(fxV,ls,uv,0.).rgb;
 return vec4f(c,1.);
}`;
const BLOOM_WGSL=FS_VS+`
@group(0)@binding(0)var t:texture_2d<f32>;@group(0)@binding(1)var s:sampler;
fn kar(c:vec3f)->vec4f{let w=1./(1.+max(c.r,max(c.g,c.b)));return vec4f(c*w,w);}
fn tap(uv:vec2f)->vec4f{return kar(min(textureSampleLevel(t,s,uv,0.).rgb,vec3f(60.)));}
@fragment fn fsDown0(@builtin(position)fc:vec4f)->@location(0)vec4f{
 let dm=vec2f(textureDimensions(t));let uv=fc.xy*2./dm;let e=1./dm;
 let m=tap(uv+e*vec2f(-1.,-1.))+tap(uv+e*vec2f(1.,-1.))+tap(uv+e*vec2f(-1.,1.))+tap(uv+e*vec2f(1.,1.));
 return vec4f(m.rgb/m.a,1.);}
@fragment fn fsDown(@builtin(position)fc:vec4f)->@location(0)vec4f{
 let dm=vec2f(textureDimensions(t));let uv=fc.xy*2./dm;let e=1./dm;
 return(textureSampleLevel(t,s,uv+e*vec2f(-1.,-1.),0.)+textureSampleLevel(t,s,uv+e*vec2f(1.,-1.),0.)+textureSampleLevel(t,s,uv+e*vec2f(-1.,1.),0.)+textureSampleLevel(t,s,uv+e*vec2f(1.,1.),0.))*.25;}
@fragment fn fsUp(@builtin(position)fc:vec4f)->@location(0)vec4f{
 let dm=vec2f(textureDimensions(t));let uv=fc.xy*.5/dm;let e=.75/dm;
 return(textureSampleLevel(t,s,uv+e*vec2f(-1.,-1.),0.)+textureSampleLevel(t,s,uv+e*vec2f(1.,-1.),0.)+textureSampleLevel(t,s,uv+e*vec2f(-1.,1.),0.)+textureSampleLevel(t,s,uv+e*vec2f(1.,1.),0.))*.25;}`;
// tone map with auto exposure read from the smallest bloom level
const FINAL_WGSL=FS_VS+`
@group(0)@binding(0)var h:texture_2d<f32>;@group(0)@binding(1)var bl:texture_2d<f32>;@group(0)@binding(2)var s:sampler;@group(0)@binding(3)var<uniform>pp:vec4f;@group(0)@binding(4)var lo:texture_2d<f32>;
fn h31(p:vec3f)->f32{var q=fract(p*vec3f(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
fn aces(x:vec3f)->vec3f{return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),vec3f(0.),vec3f(1.));}
@fragment fn fs(@builtin(position)fc:vec4f)->@location(0)vec4f{
 let uv=fc.xy/vec2f(textureDimensions(h));
 var lg=0.;var ws=0.;
 for(var y=0;y<5;y++){for(var x=0;x<5;x++){let q=vec2f(f32(x)+.5,f32(y)+.5)/5.;let c=textureSampleLevel(lo,s,mix(vec2f(.1),vec2f(.9),q),0.).rgb;
  let wt=1.2-length(q-.5);lg+=log(max(dot(c,vec3f(.2126,.7152,.0722)),1e-3))*wt;ws+=wt;}}
 let avg=exp(lg/ws);
 var ex=pp.y*clamp(.2/avg,.2,2.6);if(pp.w>.5){ex=pp.y;}
 var c=textureSampleLevel(h,s,uv,0.).rgb+textureSampleLevel(bl,s,uv,0.).rgb*pp.x;
 c=aces(c*ex);
 let q=uv-.5;c*=1.-.35*pow(length(q)*1.25,2.6);
 c=pow(c,vec3f(1./2.2))+(h31(vec3f(fc.xy,pp.z))-.5)/255.;
 return vec4f(c,1.);}`;
//WGSL-END
