(function(){
  var C = window.KJ || {};
  var ok = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase);
  var sb = ok ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;
  var $ = function(id){ return document.getElementById(id); };
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function money(n){ return n == null ? '-' : '$' + Number(n).toFixed(2).replace(/\.00$/, ''); }
  function dt(s){ return new Date(s).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); }
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
  // Giris: e-posta ile tek kullanimlik baglanti (sifre yok)
  function loginUI(onSession){
    $('loginBox').hidden = false; $('app').hidden = true;
    if (!sb){ flash($('lmsg'), 'Sistem henuz baglanmadi (portal/config.js bos).', true); $('lbtn').disabled = true; return; }
    $('lform').onsubmit = function(e){
      e.preventDefault();
      var email = $('lemail').value.trim(); $('lbtn').disabled = true;
      sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.href.split('#')[0] } }).then(function(r){
        $('lbtn').disabled = false;
        if (r.error) flash($('lmsg'), 'Gonderilemedi: ' + r.error.message, true);
        else flash($('lmsg'), 'Giris baglantisi e-postana gonderildi. Postani kontrol et.');
      });
    };
  }
  function start(onReady){
    if (!sb){ loginUI(); return; }
    sb.auth.getSession().then(function(r){
      if (r.data.session) { $('loginBox').hidden = true; $('app').hidden = false; onReady(r.data.session); }
      else loginUI();
    });
    sb.auth.onAuthStateChange(function(ev){ if (ev === 'SIGNED_IN' && $('app').hidden) location.reload(); });
    var lo = $('logout'); if (lo) lo.onclick = function(){ sb.auth.signOut().then(function(){ location.reload(); }); };
  }
  window.KJC = { sb: sb, $: $, esc: esc, money: money, dt: dt, STATUS: STATUS, flash: flash, refLink: refLink, trackLink: trackLink, newTok: newTok, qrSvg: qrSvg, start: start };
})();
