(function(){
  var C = window.KJ || {};
  var ok = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase);
  var sb = ok ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;
  var $ = function(id){ return document.getElementById(id); };
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function money(n){ return n == null ? '-' : '$' + Number(n).toFixed(2).replace(/\.00$/, ''); }
  function lc(){ try { return localStorage.getItem('kj_lang') === 'es' ? 'es-US' : 'en-US'; } catch(e){ return 'en-US'; } }
  function dt(s){ return new Date(s).toLocaleDateString(lc(), { month:'short', day:'numeric', year:'numeric' }); }
  var STATUS = { 'new':'Yeni', quoted:'Teklif verildi', booked:'Randevu', done:'Tamamlandi', lost:'Olmadi' };
  function flash(el, text, bad){ el.className = 'msg ' + (bad ? 'err' : 'ok'); el.textContent = text; el.hidden = false; }
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
  function start(onReady){
    var lo0 = $('logout'); if (lo0) lo0.style.display = 'none'; var sp1 = $('setpw'); if (sp1) sp1.style.display = 'none';
    if (!sb){ loginUI(); return; }
    sb.auth.getSession().then(function(r){
      if (r.data.session) { $('loginBox').hidden = true; $('app').hidden = false; if (lo0) lo0.style.display = ''; var sp0 = $('setpw'); if (sp0) sp0.style.display = ''; onReady(r.data.session); }
      else loginUI();
    });
    sb.auth.onAuthStateChange(function(ev){ if (ev === 'SIGNED_IN' && $('app').hidden) location.reload(); });
    var sp = $('setpw'); if (sp) sp.onclick = function(){
      var p = window.prompt('Yeni sifre (en az 8 karakter):'); if (!p) return;
      if (p.length < 8){ window.alert('En az 8 karakter olmali.'); return; }
      sb.auth.updateUser({ password: p }).then(function(r){ window.alert(r.error ? 'Olmadi: ' + r.error.message : 'Sifre kaydedildi. Artik e-posta ve sifreyle girebilirsin.'); });
    };
    var lo = $('logout'); if (lo) lo.onclick = function(){ sb.auth.signOut().then(function(){ location.reload(); }); };
  }
  window.KJC = { sb: sb, $: $, esc: esc, money: money, dt: dt, STATUS: STATUS, flash: flash, refLink: refLink, trackLink: trackLink, newTok: newTok, qrSvg: qrSvg, start: start };
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
