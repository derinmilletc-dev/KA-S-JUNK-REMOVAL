(function(){
  var C = window.KJ || {};
  var ok = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase);
  var sb = ok ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
  // Oturum suresi: ortak/ekip 7 gun, admin 30 gun. Bu sureden once kendiliginden cikis yapmaz.
  var MAXDAYS = /admin/.test(location.pathname) ? 30 : 7;
  function expired(sess){ var t = sess && sess.user && Date.parse(sess.user.last_sign_in_at || ''); return !!t && Date.now() - t > MAXDAYS * 864e5; }
  var $ = function(id){ return document.getElementById(id); };
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function money(n){ return n == null ? '-' : '$' + Number(n).toFixed(2).replace(/\.00$/, ''); }
  function lc(){ try { return localStorage.getItem('kj_lang') === 'es' ? 'es-US' : 'en-US'; } catch(e){ return 'en-US'; } }
  function dt(s){ return new Date(s).toLocaleDateString(lc(), { month:'short', day:'numeric', year:'numeric' }); }
  var STATUS = { 'new':'Yeni', quoted:'Teklif verildi', booked:'Randevu', done:'Tamamlandi', lost:'Olmadi' };
  function flash(el, text, bad){ el.className = 'msg ' + (bad ? 'err' : 'ok'); el.textContent = text; el.hidden = false; clearTimeout(el._ft); if (!bad && !el.closest('#loginBox')) el._ft = setTimeout(function(){ el.hidden = true; }, 5000); }
  function siteBase(){ return location.origin + location.pathname.replace(/\/portal\/[^/]*$/, '/').replace(/\/$/, '') + '/'; }
  function refLink(code){ return siteBase() + '?ref=' + encodeURIComponent(code); }
  function trackLink(t){ return siteBase() + 'track.html?t=' + t; }
  function newTok(){ var a = new Uint8Array(12); crypto.getRandomValues(a); return Array.prototype.map.call(a, function(x){ return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function qrSvg(text){
    var q = window.qrcode(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }
  // Giris: e-posta + sifre, ya da sifre bos birakilirsa tek kullanimlik baglanti
  function loginUI(onSession){
    $('loginBox').hidden = false; $('app').hidden = true;
    if (!sb){ flash($('lmsg'), 'Sistem henuz baglanmadi (portal/config.js bos).', true); $('lbtn').disabled = true; return; }
    // "Sifremi unuttum": kayitli e-postaya sifirlama maili (auth-mail fonksiyonu)
    if (!$('lforgot')){
      var fl = document.createElement('button'); fl.type = 'button'; fl.id = 'lforgot'; fl.className = 'linkbtn';
      fl.style.cssText = 'background:none;border:0;padding:10px 0 0;color:#C9500F;font:inherit;font-weight:600;cursor:pointer;text-decoration:underline;display:block;margin:0 auto';
      var L = (function(){ try { return localStorage.getItem('kj_lang') || 'en'; } catch(e){ return 'en'; } })(); if (L !== 'tr' && L !== 'es') L = 'en';
      var T = { tr:['Şifremi unuttum','Önce yukarıya e-postanı yaz.','Şifre sıfırlama linki e-postana gönderildi (kayıtlıysa). Spam klasörüne de bak.','Gönderilemedi, tekrar dene.'],
                en:['Forgot password','Type your email above first.','Reset link sent to your email (if registered). Check Spam too.','Could not send. Try again.'],
                es:['Olvidé mi contraseña','Escribe tu correo arriba primero.','Enlace enviado a tu correo (si está registrado). Revisa también Spam.','No se pudo enviar. Inténtalo de nuevo.'] }[L];
      fl.textContent = T[0];
      fl.onclick = function(){
        var em = $('lemail').value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){ flash($('lmsg'), T[1], true); $('lemail').focus(); return; }
        fl.disabled = true;
        fetch(window.KJ.SUPABASE_URL + '/functions/v1/auth-mail', { method:'POST', headers:{ 'content-type':'application/json', apikey: window.KJ.SUPABASE_ANON_KEY }, body: JSON.stringify({ action:'forgot', email: em, lang: L }) })
          .then(function(r){ fl.disabled = false; flash($('lmsg'), r.ok ? T[2] : T[3], !r.ok); })
          .catch(function(){ fl.disabled = false; flash($('lmsg'), T[3], true); });
      };
      $('lform').parentNode.insertBefore(fl, $('lform').nextSibling);
    }
    $('lform').onsubmit = function(e){
      e.preventDefault();
      var email = $('lemail').value.trim(); $('lbtn').disabled = true;
      var pw = $('lpw') ? $('lpw').value : '';
      if (pw){
        sb.auth.signInWithPassword({ email: email, password: pw }).then(function(r){
          $('lbtn').disabled = false;
          if (r.error) flash($('lmsg'), 'E-posta veya sifre yanlis.', true);
        });
        return;
      }
      sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.href.split('#')[0] } }).then(function(r){
        $('lbtn').disabled = false;
        if (r.error) flash($('lmsg'), 'Gonderilemedi: ' + r.error.message, true);
        else flash($('lmsg'), 'Giris baglantisi e-postana gonderildi. Postani kontrol et.');
      });
    };
  }
  // Ortak giris hareketi: en fazla 30 dakikada bir sayilir (admin panelinde "son giris / giris sayisi")
  function touchLogin(){
    try{
      if(!/partner/.test(location.pathname)||!sb)return;
      var k='kj_lt',t=+localStorage.getItem(k)||0;if(Date.now()-t<30*60*1000)return;
      localStorage.setItem(k,String(Date.now()));sb.rpc('partner_touch',{p_kind:'login'}).then(function(){},function(){});
    }catch(e){}
  }
  function start(onReady){
    var lo0 = $('logout'); if (lo0) lo0.style.display = 'none'; var sp1 = $('setpw'); if (sp1) sp1.style.display = 'none';
    if (!sb){ loginUI(); return; }
    sb.auth.getSession().then(function(r){
      if (r.data.session && expired(r.data.session)) { sb.auth.signOut().then(function(){ loginUI(); }); return; }
      if (r.data.session) { $('loginBox').hidden = true; $('app').hidden = false; if (lo0) lo0.style.display = ''; var sp0 = $('setpw'); if (sp0) sp0.style.display = ''; onReady(r.data.session); touchLogin(); }
      else loginUI();
    });
    document.addEventListener('visibilitychange', function(){ if (!document.hidden) sb.auth.getSession(); });
    sb.auth.onAuthStateChange(function(ev){ if (ev === 'SIGNED_IN' && $('app').hidden) location.reload(); });
    var sp = $('setpw'); if (sp) sp.onclick = function(){
      var p = window.prompt('Yeni sifre (en az 8 karakter):'); if (!p) return;
      if (p.length < 8){ window.alert('En az 8 karakter olmali.'); return; }
      sb.auth.updateUser({ password: p }).then(function(r){ if(!r.error)sb.rpc('partner_touch',{p_kind:'pw'}).then(function(){},function(){});window.alert(r.error ? 'Olmadi: ' + r.error.message : 'Sifre kaydedildi. Artik e-posta ve sifreyle girebilirsin.'); });
    };
    var lo = $('logout'); if (lo) lo.onclick = function(){ sb.auth.signOut().then(function(){ location.reload(); }); };
  }

  // ---- Gercek push: izin verilmisse tarayiciyi abone yap ve Supabase'e kaydet (sessiz, hata vermez)
  function b64u(s){var p='='.repeat((4-s.length%4)%4),b=(s+p).replace(/-/g,'+').replace(/_/g,'/'),r=atob(b),o=new Uint8Array(r.length);for(var i=0;i<r.length;i++)o[i]=r.charCodeAt(i);return o}
  function pushSub(role,lang){
    try{
      var key=window.KJ&&window.KJ.VAPID_PUBLIC_KEY;
      if(!key||!('serviceWorker' in navigator)||!('PushManager' in window)||!window.Notification||Notification.permission!=='granted')return Promise.resolve(false);
      return navigator.serviceWorker.ready.then(function(reg){
        return reg.pushManager.getSubscription().then(function(s){return s||reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(key)})});
      }).then(function(s){
        var j=s.toJSON();if(!j.keys)return false;
        return sb.rpc('push_save',{p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth,p_role:role||'partner',p_lang:lang||'en'}).then(function(r){return !r.error});
      }).catch(function(){return false});
    }catch(e){return Promise.resolve(false)}
  }
  window.KJC = { sb: sb, $: $, esc: esc, money: money, dt: dt, STATUS: STATUS, flash: flash, refLink: refLink, trackLink: trackLink, newTok: newTok, qrSvg: qrSvg, start: start, pushSub: pushSub };
})();

// Kaydirma yardimcilari: yatay listelerde "devami var" soluklugu, uzun sayfalarda yukari don dugmesi
(function(){
  function hint(){document.querySelectorAll('.tabs,.menu,.chipbar,.filters').forEach(function(e){e.classList.toggle('more',e.scrollWidth>e.clientWidth+4&&e.scrollLeft+e.clientWidth<e.scrollWidth-4)})}
  document.addEventListener('scroll',hint,true);window.addEventListener('resize',hint);setInterval(hint,1200);
  function mkTop(){var b=document.createElement('button');b.id='totop';b.type='button';b.setAttribute('aria-label','Yukari');b.textContent='\u2191';
  b.onclick=function(){window.scrollTo({top:0,behavior:'smooth'})};document.body.appendChild(b);
  window.addEventListener('scroll',function(){b.classList.toggle('show',window.scrollY>700)},{passive:true})}
  if(document.body)mkTop();else document.addEventListener('DOMContentLoaded',mkTop);
})();
