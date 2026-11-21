// Ana ekrana ekleme bannerı + service worker. 3 dil.
(function(){
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(function(){});
var L=(function(){try{return localStorage.getItem('kj_lang')}catch(e){}})()||((navigator.language||'en').slice(0,2)),T={
tr:['Uygulama gibi kur','Ana ekrana ekle, tek dokunusla ac.','Kur','Sonra','Safari: Paylas simgesi > "Ana Ekrana Ekle"'],
es:['Instalar como app','Agrégala a tu pantalla de inicio.','Instalar','Luego','Safari: botón Compartir > "Añadir a pantalla de inicio"'],
en:['Install as an app','Add it to your home screen for one-tap access.','Install','Later','Safari: tap Share > "Add to Home Screen"']}[L]||null;
T=T||['Install as an app','Add it to your home screen for one-tap access.','Install','Later','Safari: tap Share > "Add to Home Screen"'];
if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone)return;
try{if(localStorage.getItem('kj_pwa_no'))return}catch(e){}
var ev=null,ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
function show(){if(document.getElementById('pwab'))return;var d=document.createElement('div');d.id='pwab';d.style.cssText='position:fixed;left:10px;right:10px;bottom:10px;z-index:99;background:#fff;border:1px solid #e3e7ec;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.18);padding:12px 14px;display:flex;gap:10px;align-items:center;font:14px system-ui';
 d.innerHTML='<img src="icon-192.png" width="40" height="40" style="border-radius:10px"><div style="flex:1"><b>'+T[0]+'</b><div style="color:#678;font-size:13px">'+(ev?T[1]:T[4])+'</div></div>'+(ev?'<button id="pwai" style="background:#f97316;color:#fff;border:0;border-radius:10px;padding:9px 14px;font-weight:700">'+T[2]+'</button>':'')+'<button id="pwax" style="background:none;border:0;color:#678;padding:6px">'+T[3]+'</button>';
 document.body.appendChild(d);document.getElementById('pwax').onclick=function(){try{localStorage.setItem('kj_pwa_no','1')}catch(e){}d.remove()};var i=document.getElementById('pwai');if(i)i.onclick=function(){ev.prompt();d.remove()}}
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();ev=e;setTimeout(show,2500)});
if(ios)setTimeout(show,4000);
})();
