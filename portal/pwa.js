// Ana ekrana ekleme bannerı + service worker. 3 dil.
// Yeni surum bildirimi: uygulama acik kalmissa ustte "Guncelle" cikar.
(function(){
var U={tr:['Yeni surum hazir','Guncelle'],es:['Nueva versión disponible','Actualizar'],en:['New version available','Update']};
var l=(function(){try{return localStorage.getItem('kj_lang')}catch(e){}})()||((navigator.language||'en').slice(0,2)),t=U[l]||U.en,base=null,shown=false;
function sig(){var u=location.pathname;return Promise.all([fetch(u,{cache:'no-store'}).then(function(r){return r.text()}),fetch('core.js',{cache:'no-store'}).then(function(r){return r.text()})]).then(function(x){var h=0,s=x.join('|');for(var i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))|0}return h+':'+s.length})}
function banner(){if(shown)return;shown=true;var d=document.createElement('div');d.id='kjupd';
d.style.cssText='position:fixed;top:max(10px,env(safe-area-inset-top));left:50%;transform:translate(-50%,-140%);z-index:2147483000;display:flex;align-items:center;gap:12px;padding:8px 8px 8px 16px;border-radius:99px;background:rgba(31,36,33,.94);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:#fff;font:600 14px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 14px 34px -10px rgba(0,0,0,.55);transition:transform .45s cubic-bezier(.2,.9,.3,1.2);max-width:calc(100vw - 20px);white-space:nowrap';
d.innerHTML='<span style="width:8px;height:8px;border-radius:50%;background:#7BE0A4;box-shadow:0 0 0 4px rgba(123,224,164,.25);flex:none"></span><span>'+t[0]+'</span><button style="border:0;border-radius:99px;background:#F26B1D;color:#fff;font:700 14px system-ui,sans-serif;padding:9px 16px;cursor:pointer">'+t[1]+'</button>';
d.querySelector('button').onclick=function(){this.textContent='...';location.reload()};
document.body.appendChild(d);requestAnimationFrame(function(){requestAnimationFrame(function(){d.style.transform='translate(-50%,0)'})})}
function check(){if(shown||!base)return;sig().then(function(n){if(n&&n!==base)banner()}).catch(function(){})}
function start(){sig().then(function(h){base=h;setInterval(check,300000);document.addEventListener('visibilitychange',function(){if(!document.hidden)check()});window.addEventListener('focus',check)}).catch(function(){})}
if(document.readyState==='complete')start();else window.addEventListener('load',start);
})();
(function(){
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(function(){});
var L=(function(){try{return localStorage.getItem('kj_lang')}catch(e){}})()||((navigator.language||'en').slice(0,2)),T={
tr:['Uygulama gibi kur','Ana ekrana ekle, tek dokunusla ac.','Kur','Sonra','Safari: Paylas simgesi > "Ana Ekrana Ekle"'],
es:['Instalar como app','Agrégala a tu pantalla de inicio.','Instalar','Luego','Safari: botón Compartir > "Añadir a pantalla de inicio"'],
en:['Install as an app','Add it to your home screen for one-tap access.','Install','Later','Safari: tap Share > "Add to Home Screen"']}[L]||null;
T=T||['Install as an app','Add it to your home screen for one-tap access.','Install','Later','Safari: tap Share > "Add to Home Screen"'];
function done(){try{localStorage.setItem('kj_pwa_no','1')}catch(e){}}
if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone){done();return}
window.addEventListener('appinstalled',done);
try{var seen=+localStorage.getItem('kj_pwa_seen')||0;if(localStorage.getItem('kj_pwa_no')||seen>=1)return}catch(e){}
var ev=null,ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
function show(){if(document.getElementById('pwab'))return;try{localStorage.setItem('kj_pwa_seen','1')}catch(e){}var d=document.createElement('div');d.id='pwab';d.style.cssText='position:fixed;left:10px;right:10px;bottom:10px;z-index:99;background:#fff;border:1px solid #e3e7ec;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.18);padding:12px 14px;display:flex;gap:10px;align-items:center;font:14px system-ui';
 d.innerHTML='<img src="icon-192.png" width="40" height="40" style="border-radius:10px"><div style="flex:1"><b>'+T[0]+'</b><div style="color:#678;font-size:13px">'+(ev?T[1]:T[4])+'</div></div>'+(ev?'<button id="pwai" style="background:#f97316;color:#fff;border:0;border-radius:10px;padding:9px 14px;font-weight:700">'+T[2]+'</button>':'')+'<button id="pwax" style="background:none;border:0;color:#678;padding:6px">'+T[3]+'</button>';
 document.body.appendChild(d);document.getElementById('pwax').onclick=function(){try{localStorage.setItem('kj_pwa_no','1')}catch(e){}d.remove()};var i=document.getElementById('pwai');if(i)i.onclick=function(){ev.prompt();d.remove()}}
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();ev=e;setTimeout(show,2500)});
if(ios)setTimeout(show,4000);
})();
