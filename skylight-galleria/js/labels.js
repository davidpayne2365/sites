// Printed labels for packaged goods, drawn once at start-up into one texture of 16 x 16 tiles.
// Every tile is a different design with an invented brand or title, and the drawing uses a fixed seed,
// so the same labels appear in the same places for everyone.
//   tiles   0-63   cereal and snack boxes      tiles 112-159  bottles
//   tiles  64-111  cans and tins               tiles 160-223  book covers
//   tiles 224-255  record sleeves
const LABEL_RANGES={box:[0,64],can:[64,48],bottle:[112,48],book:[160,64],record:[224,32]};
function makeLabels(size){
 const R=rng(777),r=(a,b)=>a+(b-a)*R(),pick=a=>a[Math.floor(R()*a.length)];
 const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d'),T=size/16;
 const hsl=(h,s,l)=>`hsl(${h},${s}%,${l}%)`;
 const FONTS=['900 {s}px "Arial Black",Impact,sans-serif','700 {s}px Georgia,serif','800 {s}px "Trebuchet MS",sans-serif','900 {s}px Impact,"Arial Black",sans-serif',
  'italic 700 {s}px Georgia,serif','700 {s}px Verdana,sans-serif','800 {s}px "Comic Sans MS","Chalkboard SE",cursive','700 {s}px "Courier New",monospace'];
 const A=['Sunny','Golden','Crispy','Mountain','Happy','Ocean','Maple','Velvet','Silver','Little','Royal','Wild','Honey','Cozy','North','Bright','Meadow','Lucky','Prairie','Harbor','Orchard','Morning','Copper','Sparkle'];
 const N=['Oats','Crunch','Puffs','Flakes','Bites','Pops','Grains','Berries','Loops','Clusters','Crisps','Twists','Wafers','Chips','Rounds','Bars'];
 const CANS=['Tomato Soup','Sweet Corn','Chickpeas','Peach Halves','Black Beans','Coconut Milk','Lemon Soda','Cola','Ginger Fizz','Sardines','Peas','Cherry Pop','Iced Tea','Sparkling Water'];
 const BOT=['Olive Oil','Shampoo','Lotion','Maple Syrup','Hot Sauce','Lemonade','Red Wine','White Wine','Vanilla','Body Wash','Apple Juice','Vinegar','Cold Brew','Rose Water'];
 const W1=['Quiet','Silver','Last','Hidden','Paper','Golden','Winter','Distant','Burning','Glass','Velvet','Endless','Little','Secret','Midnight','Northern'];
 const W2=['Harbor','Garden','Orchard','Lighthouse','River','Kingdom','Library','Summer','Station','Island','Forest','Mountain','Letters','Compass','Tides','Bridge'];
 const FN=['Ada','Milo','Iris','Theo','June','Silas','Nora','Felix','Hazel','Oscar','Clara','Jonah','Ruth','Elias','Mae','Arlo'];
 const LN=['Hartley','Bellweather','Quinn','Marsh','Okafor','Lindqvist','Moreau','Castell','Fairweather','Nakamura','Abernathy','Delacroix','Whitlock','Rosales'];
 const BANDS=['The Velvet Hours','Neon Coast','Paper Moons','Static Bloom','The Wild Lanterns','Echo Park Saints','Glass Animals Club','Midnight Radio','Sunday Drivers','Kite Season','Low Tide','The Foxgloves'];
 const fit=(t,font,s,w)=>{g.font=font.replace('{s}',s);const m=g.measureText(t).width;if(m>w){s*=w/m;g.font=font.replace('{s}',s)}return s};
 const text=(t,x,y,font,s,w,col)=>{fit(t,font,s,w);g.fillStyle=col;g.fillText(t,x,y)};
 g.textAlign='center';g.textBaseline='middle';
 for(let i=0;i<256;i++){const x0=(i%16)*T,y0=Math.floor(i/16)*T,m=T*.04,w=T-2*m,h=T-2*m,X=x0+m,Y=y0+m,cx=X+w/2,hue=Math.floor(r(0,360)),font=pick(FONTS);
  g.save();g.beginPath();g.rect(x0,y0,T,T);g.clip();
  if(i<64){ // cereal or snack box
   g.fillStyle=hsl(hue,r(55,85),r(40,58));g.fillRect(x0,y0,T,T);g.fillStyle=hsl(hue+r(150,210),70,r(45,60));g.fillRect(X,Y,w,h*.2);
   text(pick(A),cx,Y+h*.1,font,h*.15,w*.9,'#fff');text(pick(N),cx,Y+h*.32,font,h*.2,w*.92,hsl(hue+180,90,90));
   g.fillStyle='#fff';g.beginPath();g.ellipse(cx,Y+h*.66,w*.36,h*.2,0,0,6.283);g.fill();g.fillStyle=hsl(hue+r(-30,30),70,45);
   for(let k=0;k<9;k++){g.beginPath();g.arc(cx+r(-.24,.24)*w,Y+h*r(.58,.72),T*r(.03,.06),0,6.283);g.fill()}
   g.fillStyle=hsl(50,95,55);g.beginPath();g.arc(X+w*.82,Y+h*.5,T*.09,0,6.283);g.fill();text('NEW',X+w*.82,Y+h*.5,FONTS[0],T*.06,T*.15,'#c00');
   text('NET WT '+Math.floor(r(8,24))+' OZ',cx,Y+h*.93,FONTS[5],h*.06,w*.8,'#fff');
  }else if(i<112){ // can or tin: shaded like a cylinder
   const gr=g.createLinearGradient(x0,0,x0+T,0),b=hsl(hue,r(50,85),r(35,55));gr.addColorStop(0,'#222');gr.addColorStop(.18,b);gr.addColorStop(.45,hsl(hue,60,72));gr.addColorStop(.75,b);gr.addColorStop(1,'#111');
   g.fillStyle=gr;g.fillRect(x0,y0,T,T);g.fillStyle='rgba(255,255,255,.85)';g.fillRect(x0,Y+h*.3,T,h*.38);
   const nm=pick(CANS);text(pick(A),cx,Y+h*.16,font,h*.13,w*.85,'#fff');text(nm,cx,Y+h*.49,FONTS[2],h*.14,w*.88,hsl(hue,70,30));text(pick(['Classic','Organic','Low Salt','Original','Light','Extra']),cx,Y+h*.8,FONTS[5],h*.09,w*.7,'#fff');
   g.fillStyle='rgba(200,200,200,.9)';g.fillRect(x0,y0,T,T*.05);g.fillRect(x0,y0+T*.95,T,T*.05);
  }else if(i<160){ // bottle: tinted glass with a paper label
   const glass=pick([hsl(120,40,18),hsl(30,60,22),hsl(200,30,30),hsl(0,0,80),hsl(45,70,40),hsl(330,40,40)]);g.fillStyle=glass;g.fillRect(x0,y0,T,T);
   g.fillStyle='rgba(255,255,255,.25)';g.fillRect(X+w*.12,Y,w*.08,h);g.fillStyle=hsl(hue,r(20,60),r(80,94));g.fillRect(X+w*.08,Y+h*.32,w*.84,h*.5);
   g.strokeStyle=hsl(hue,50,35);g.lineWidth=T*.012;g.strokeRect(X+w*.12,Y+h*.35,w*.76,h*.44);
   text(pick(A)+' '+pick(['Co.','& Sons','Farm','Lab','Estate','Kitchen']),cx,Y+h*.43,font,h*.1,w*.7,hsl(hue,60,25));text(pick(BOT),cx,Y+h*.58,FONTS[1],h*.12,w*.72,'#222');
   text(String(2010+Math.floor(r(0,15))),cx,Y+h*.71,FONTS[7],h*.07,w*.4,'#555');g.fillStyle=pick(['#b22','#d4af37','#222','#eee']);g.fillRect(X+w*.3,Y,w*.4,h*.12);
  }else if(i<224){ // book cover
   g.fillStyle=hsl(hue,r(25,70),r(18,55));g.fillRect(x0,y0,T,T);const k=Math.floor(r(0,4)),ac=hsl(hue+r(90,200),r(40,80),r(55,75));g.fillStyle=ac;g.strokeStyle=ac;g.lineWidth=T*.02;
   if(k===0){g.beginPath();g.arc(cx,Y+h*.55,w*.22,0,6.283);g.fill()}else if(k===1){g.beginPath();g.moveTo(X,Y+h*.75);g.lineTo(X+w*.35,Y+h*.45);g.lineTo(X+w*.55,Y+h*.62);g.lineTo(X+w*.8,Y+h*.4);g.lineTo(X+w,Y+h*.75);g.fill()}
   else if(k===2){for(let j=0;j<5;j++)g.fillRect(X,Y+h*(.42+j*.07),w,h*.025)}else{g.strokeRect(X+w*.15,Y+h*.38,w*.7,h*.38);g.strokeRect(X+w*.22,Y+h*.45,w*.56,h*.24)}
   const t=pick(['The ','A ',''])+pick(W1)+' '+pick(W2);text(t,cx,Y+h*.16,pick([FONTS[1],FONTS[4],FONTS[2]]),h*.13,w*.92,'#fff');
   text(pick(FN)+' '+pick(LN),cx,Y+h*.88,FONTS[5],h*.08,w*.8,'rgba(255,255,255,.85)');
  }else{ // record sleeve
   g.fillStyle=hsl(hue,r(30,80),r(15,60));g.fillRect(x0,y0,T,T);for(let j=0;j<6;j++){g.fillStyle=hsl(hue+r(-120,120),r(50,90),r(40,75));g.globalAlpha=.75;g.beginPath();
    if(R()<.5)g.arc(X+r(0,1)*w,Y+r(0,1)*h,T*r(.08,.3),0,6.283);else g.rect(X+r(0,.8)*w,Y+r(0,.8)*h,T*r(.1,.4),T*r(.05,.3));g.fill()}g.globalAlpha=1;
   text(pick(BANDS),cx,Y+h*.12,font,h*.12,w*.9,'#fff');text(pick(W1)+' '+pick(W2),cx,Y+h*.88,FONTS[4],h*.09,w*.8,'rgba(255,255,255,.9)');
  }
  g.restore()}
 return c}
