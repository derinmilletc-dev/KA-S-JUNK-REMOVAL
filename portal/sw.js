// Sadece uygulama kabugunu onbellege alir. Veri (Supabase) asla onbellege alinmaz.
var V='kj-v31',F=['quotes.js','portal.css','core.js','i18n.js','config.js','nda.js','icon-192.png'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(V).then(function(c){return c.addAll(F)}).then(function(){return self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x!==V}).map(function(x){return caches.delete(x)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener('fetch',function(e){var u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
 e.respondWith(fetch(e.request).then(function(r){if(r.ok&&F.indexOf(u.pathname.split('/').pop())>-1){var c=r.clone();caches.open(V).then(function(x){x.put(e.request,c)})}return r}).catch(function(){return caches.match(e.request)}))});

self.addEventListener('push',function(e){var d={};try{d=e.data?e.data.json():{}}catch(x){d={body:e.data?e.data.text():''}}
 e.waitUntil(self.registration.showNotification(d.title||'Kais Partner',{body:d.body||'',icon:'icon-192.png',badge:'icon-192.png',tag:d.tag||'kj',data:{url:d.url||'partner.html'}}))});
self.addEventListener('notificationclick',function(e){e.notification.close();var u=(e.notification.data&&e.notification.data.url)||'partner.html';
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(l){for(var i=0;i<l.length;i++){if(l[i].url.indexOf(u)>-1&&'focus' in l[i])return l[i].focus()}for(var j=0;j<l.length;j++){if('focus' in l[j]&&u==='partner.html')return l[j].focus()}return self.clients.openWindow?self.clients.openWindow(u):null}))});
