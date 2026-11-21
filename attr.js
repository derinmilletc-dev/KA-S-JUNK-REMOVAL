// Ilk temas kaynagini 30 gun saklar (UTM, reklam tiklari, yonlendiren site). Hicbir kisisel veri tutmaz.
(function(){
  try {
    var q = new URLSearchParams(location.search), src = '', cmp = '';
    var us = (q.get('utm_source') || '').toLowerCase(), um = (q.get('utm_medium') || '').toLowerCase(), uc = (q.get('utm_campaign') || '').toLowerCase();
    if (q.get('ref')) { src = 'partner'; cmp = um || 'link'; }
    else if (q.get('rc')) { src = 'customer-referral'; }
    else if (q.get('gclid')) { src = 'google-ads'; cmp = uc; }
    else if (q.get('fbclid')) { src = 'facebook'; cmp = uc; }
    else if (us) { src = us; cmp = [um, uc].filter(Boolean).join(' / '); }
    else if (document.referrer) {
      var h = new URL(document.referrer).hostname.replace(/^www\./, '');
      if (h && h !== location.hostname.replace(/^www\./, '')) src = /google\./.test(h) ? 'google-search' : /facebook|fb\./.test(h) ? 'facebook' : /instagram/.test(h) ? 'instagram' : /bing\./.test(h) ? 'bing' : h;
    }
    var cur = JSON.parse(localStorage.getItem('kj_src') || 'null');
    var fresh = cur && Date.now() - cur.t < 30 * 864e5;
    // Ilk temas korunur; ama ortak/QR gelisi ve reklam tiklari daha guclu sinyaldir
    var strong = src === 'partner' || src === 'customer-referral' || src === 'google-ads' || src === 'facebook';
    if (src && (!fresh || strong)) localStorage.setItem('kj_src', JSON.stringify({ s: src, c: cmp.slice(0, 60), t: Date.now() }));
    var pg = location.pathname.match(/junk-removal-([a-z-]+)\.html$/);
    if (pg && !(fresh || src)) localStorage.setItem('kj_src', JSON.stringify({ s: 'city-page', c: pg[1], t: Date.now() }));
  } catch (e) {}
  window.kjSource = function(){
    try { var v = JSON.parse(localStorage.getItem('kj_src') || 'null'); if (v && Date.now() - v.t < 30 * 864e5) return v; } catch (e) {}
    return { s: 'direct', c: '' };
  };
})();
