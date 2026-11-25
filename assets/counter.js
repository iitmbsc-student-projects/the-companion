/* The Companion: optional, privacy-friendly view counter (GoatCounter).
   Off by default. To switch it on, create a free site at https://www.goatcounter.com,
   put its code in assets/config.js (goatcounter: 'yourcode'), and in GoatCounter open
   Settings, then tick "Allow adding visitor counts on your website".
   GoatCounter sets no cookies and stores no personal data, and it ignores localhost. */
(function () {
  'use strict';
  var cfg = window.COMPANION_CONFIG || {};
  var code = String(cfg.goatcounter || '').replace(/[^a-z0-9-]/gi, '');
  if (!code) return;

  var host = 'https://' + code + '.goatcounter.com';
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter', host + '/count');
  document.head.appendChild(s);

  function show(n) {
    var foot = document.querySelector('.site-end .se-brand, .colophon .co-brand');
    if (!foot || foot.querySelector('.se-views')) return;
    var v = document.createElement('span');
    v.className = 'se-views';
    v.title = n + (n === '1' ? ' view' : ' views');
    v.setAttribute('aria-label', v.title);
    v.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/>' +
      '<circle cx="12" cy="12" r="3"/></svg>';
    v.appendChild(document.createTextNode(n));
    foot.appendChild(v);
  }

  /* Show how many times this page has been opened. The count is read from GoatCounter's
     public counter; it appears only when that is enabled for the site. */
  function load() {
    var path = location.pathname.replace(/\/index\.html$/, '/') || '/';
    var url = host + '/counter/' + encodeURIComponent(path) + '.json';
    if (!window.fetch) return;
    fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (d && d.count && d.count !== '0') show(d.count);
    }).catch(function () {});
  }
  /* wait a moment so this visit is recorded before the number is read */
  window.addEventListener('load', function () { setTimeout(load, 1500); });
})();
