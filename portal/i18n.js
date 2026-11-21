// Dil secici (TR / EN / ES). Sayfa kaynak dilinde yazilidir; secilen dile ekrandaki metinler otomatik cevrilir.
// Kullanim: KJI.add(rows), KJI.pat(regex,en,es), KJI.init({src:'tr', langs:['tr','en','es']})
(function(){
  var D={},P=[],lang='en',src='tr',on=false;
  var NAMES={tr:'Türkçe',en:'English',es:'Español'};
  function add(rows){rows.forEach(function(r){D[r[0]]={en:r[1],es:r[2]}})}
  function pat(re,en,es){P.push([re,en,es])}
  function look(core){
    var d=D[core];if(d&&d[lang]!=null)return d[lang];
    for(var i=0;i<P.length;i++){var m=core.match(P[i][0]);if(m){var f=P[i][lang==='en'?1:2];if(f==null)return null;return f.replace(/\$(\d)/g,function(x,n){return m[+n]==null?'':m[+n]})}}
    return null}
  function tx(s){var c=s.trim();if(!c)return s;var v=look(c);if(v==null)return s;var i=s.indexOf(c);return s.slice(0,i)+v+s.slice(i+c.length)}
  function run(root){
    if(!on||!root)return;
    if(root.nodeType===3){var p=root.parentNode;if(p&&p.tagName!=='SCRIPT'&&p.tagName!=='STYLE'&&p.tagName!=='TEXTAREA'){var n=tx(root.nodeValue);if(n!==root.nodeValue)root.nodeValue=n}return}
    if(root.nodeType!==1||root.tagName==='SCRIPT'||root.tagName==='STYLE')return;
    var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),a=[],x;while((x=w.nextNode()))a.push(x);a.forEach(run);
    var els=root.querySelectorAll?Array.prototype.slice.call(root.querySelectorAll('[placeholder],[title],[aria-label]')):[];if(root.getAttribute)els.push(root);
    els.forEach(function(e){['placeholder','title','aria-label'].forEach(function(at){var v=e.getAttribute&&e.getAttribute(at);if(v){var n=tx(v);if(n!==v)e.setAttribute(at,n)}})})}
  function init(o){
    src=o.src||'tr';var langs=o.langs||['tr','en','es'],saved=null;try{saved=localStorage.getItem('kj_lang')}catch(e){}
    var nav=(navigator.language||'en').slice(0,2).toLowerCase();
    lang=langs.indexOf(saved)>-1?saved:(langs.indexOf(nav)>-1?nav:(langs.indexOf('en')>-1?'en':langs[0]));
    on=lang!==src;document.documentElement.lang=lang;
    function boot(){
      var h=document.querySelector('header');
      if(h&&!document.getElementById('langsel')){var s=document.createElement('select');s.id='langsel';s.setAttribute('aria-label','Language');
        s.style.cssText='width:auto;margin-left:auto;margin-right:8px;padding:6px 8px;border-radius:10px;background:#ffffff14;color:#fff;border:1px solid #ffffff55;font:inherit;font-size:13px';
        langs.forEach(function(l){var op=document.createElement('option');op.value=l;op.textContent=NAMES[l];op.style.color='#000';if(l===lang)op.selected=true;s.appendChild(op)});
        s.onchange=function(){try{localStorage.setItem('kj_lang',s.value)}catch(e){}location.reload()};
        var b=h.querySelector('button');if(b)h.insertBefore(s,b);else h.appendChild(s)}
      if(!on)return;run(document.body);
      new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){run(n)})})}).observe(document.body,{childList:true,subtree:true})}
    if(document.body)boot();else document.addEventListener('DOMContentLoaded',boot)}
  window.KJI={add:add,pat:pat,init:init,tx:tx,get lang(){return lang}};
})();
