// Ortak pazarlama paketi: el ilani, kartvizit, sosyal medya gorselleri (canvas ile cizilir, QR'li)
(function(){
  var INK='#1F2421',OR='#F26B1D',DEEP='#C2500F',TINT='#FCE6D8',PAPER='#F6F3EE';
  var PHONE='+1 (407) 446-2534';
  var SIZES={flyer:[2550,3300],card:[1050,600],square:[1080,1080],story:[1080,1920]};
  function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
  function qr(c,text,x,y,size,pad){
    var q=window.qrcode(0,'M');q.addData(text);q.make();var n=q.getModuleCount(),cell=size/(n+2*(pad||2));
    c.fillStyle='#fff';rr(c,x,y,size,size,size*.05);c.fill();c.fillStyle=INK;
    var o=(pad||2)*cell;
    for(var r=0;r<n;r++)for(var k=0;k<n;k++)if(q.isDark(r,k))c.fillRect(x+o+k*cell,y+o+r*cell,Math.ceil(cell),Math.ceil(cell));
  }
  function font(px,w){return (w||700)+' '+px+'px "Bricolage Grotesque","DM Sans",system-ui,sans-serif'}
  function body(px,w){return (w||500)+' '+px+'px "DM Sans",system-ui,sans-serif'}
  function wrap(c,text,x,y,maxW,lh){var words=text.split(' '),line='';for(var i=0;i<words.length;i++){var t=line?line+' '+words[i]:words[i];if(c.measureText(t).width>maxW&&line){c.fillText(line,x,y);y+=lh;line=words[i]}else line=t}if(line){c.fillText(line,x,y);y+=lh}return y}
  function logo(c,x,y,px,dark){c.textBaseline='alphabetic';c.font=font(px,800);c.fillStyle=dark?INK:'#fff';c.fillText('Kais ',x,y);var w=c.measureText('Kais ').width;c.fillStyle=OR;c.fillText('Junk Remove',x+w,y)}
  function bg(c,w,h){c.fillStyle=INK;c.fillRect(0,0,w,h);var g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#2E3531');g.addColorStop(1,INK);c.fillStyle=g;c.fillRect(0,0,w,h);c.fillStyle=OR;c.fillRect(0,0,w,Math.round(h*.012))}
  function poster(c,w,h,link,code,u,story){
    bg(c,w,h);var m=w*.08;c.textAlign='left';
    logo(c,m,w*.12,w*.065);
    c.font=font(w*.125,800);var y=w*(story?.3:.28);
    ['Junk removal','in Florida'].forEach(function(t,i){c.fillStyle=i===1?OR:'#fff';c.fillText(t,m,y+i*w*.135)});
    y+=w*.135+w*.1;c.fillStyle='#ffffffc0';c.font=body(w*.045,500);y=wrap(c,'Send photos on WhatsApp. Get your quote. We haul it away. Furniture, appliances, garage and yard clean-outs.',m,y,w-2*m,w*.064);
    var cx=m,cy=y;
    ['Open 24/7','Photo quotes','Local crew'].forEach(function(t){c.font=body(w*.036,700);var tw=c.measureText(t).width+w*.05;c.fillStyle=TINT;rr(c,cx,cy,tw,w*.07,w*.035);c.fill();c.fillStyle=DEEP;c.fillText(t,cx+w*.025,cy+w*.048);cx+=tw+w*.02});
    var qs=w*(story?.5:.3),qy=cy+w*.12;
    qr(c,link,m,qy,qs,2);
    c.fillStyle='#fff';
    if(story){var ty=qy+qs+w*.09;c.font=font(w*.06,800);c.fillText('Scan to get a quote',m,ty);c.font=body(w*.05,600);c.fillStyle='#ffffffc0';c.fillText(PHONE,m,ty+w*.075);if(code){c.font=body(w*.036,500);c.fillText('Code: '+code,m,ty+w*.135)}}
    else{var tx=m+qs+w*.05,ty2=qy+qs*.38;c.font=font(w*.055,800);c.fillText('Scan to get',tx,ty2);c.fillText('a quote',tx,ty2+w*.065);c.font=body(w*.045,600);c.fillStyle='#ffffffc0';c.fillText(PHONE,tx,ty2+w*.15);if(code){c.font=body(w*.034,500);c.fillText('Code: '+code,tx,ty2+w*.21)}}
  }
  function card(c,w,h,link,code){
    c.fillStyle=PAPER;c.fillRect(0,0,w,h);c.fillStyle=INK;c.fillRect(0,0,w*.58,h);c.fillStyle=OR;c.fillRect(w*.58,0,w*.012,h);
    c.textAlign='left';logo(c,w*.05,h*.2,w*.058);
    c.fillStyle='#fff';c.font=font(w*.05,800);c.fillText('Junk removal',w*.05,h*.42);c.fillStyle=OR;c.fillText('in Florida',w*.05,h*.42+w*.058);
    c.fillStyle='#ffffffc0';c.font=body(w*.03,500);c.fillText('Photo quotes · Open 24/7',w*.05,h*.74);
    c.font=body(w*.034,700);c.fillStyle='#fff';c.fillText(PHONE,w*.05,h*.88);
    var qs=h*.62;qr(c,link,w*.58+(w*.42-qs)/2,h*.1,qs,2);
    c.fillStyle=INK;c.textAlign='center';c.font=body(w*.028,700);c.fillText('Scan for a quote',w*.79,h*.1+qs+h*.1);if(code){c.font=body(w*.024,500);c.fillStyle='#565D58';c.fillText('Code '+code,w*.79,h*.1+qs+h*.17)}c.textAlign='left';
  }
  function square(c,w,h,link,code){
    bg(c,w,h);var m=w*.08;c.textAlign='left';logo(c,m,h*.11,w*.06);
    c.font=font(w*.125,800);c.fillStyle='#fff';c.fillText('Need junk',m,h*.3);c.fillText('gone?',m,h*.3+w*.13);c.fillStyle=OR;c.fillText('Send photos.',m,h*.3+w*.26);
    c.fillStyle='#ffffffc0';c.font=body(w*.042,500);wrap(c,'Quote back on WhatsApp. Open 24/7 across Florida.',m,h*.3+w*.34,w*.55,w*.058);
    var qs=w*.3;qr(c,link,w-m-qs,h-m-qs-w*.1,qs,2);c.fillStyle='#fff';c.font=body(w*.036,700);c.fillText(PHONE,m,h-m);c.textAlign='right';c.font=body(w*.03,600);c.fillText('Scan to get a quote',w-m,h-m);c.textAlign='left';
  }
  function draw(canvas,type,link,code){var s=SIZES[type],c=canvas.getContext('2d');canvas.width=s[0];canvas.height=s[1];
    if(type==='card')card(c,s[0],s[1],link,code);else if(type==='square')square(c,s[0],s[1],link,code);else poster(c,s[0],s[1],link,code,null,type==='story')}
  var DEF=['flyer','card','square','story'],NAMES={flyer:'El ilani (8.5x11)',card:'Kartvizit (3.5x2 in)',square:'Sosyal medya kare',story:'Hikaye (Story)'};
  window.KJKit={draw:draw,types:DEF,names:NAMES,ready:function(){return (document.fonts&&document.fonts.load)?Promise.all([document.fonts.load('800 40px "Bricolage Grotesque"'),document.fonts.load('600 20px "DM Sans"')]).catch(function(){}):Promise.resolve()}};
})();
