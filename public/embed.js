(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || !(script instanceof HTMLScriptElement)) return;
  var origin = new URL(script.src).origin + new URL(script.src).pathname.replace(/\/embed\.js$/, '');
  var root = document.createElement('span');
  root.setAttribute('role', 'status');
  root.style.cssText = 'display:inline-block;font:600 14px system-ui;padding:8px 12px;border:1px solid #dbe3ef;border-radius:8px;color:#17243d;background:#fff';
  root.textContent = 'Status unavailable';
  script.insertAdjacentElement('afterend', root);
  var interval = Math.max(60000, Number(script.dataset.pollInterval || 300000));
  function render(summary) {
    var service = script.dataset.service || 'all';
    if (service !== 'all' && summary.affectedServiceCount === 0) { root.textContent = 'Operational'; return; }
    root.textContent = summary.hasActiveIncident ? summary.activeIncidentCount + ' active incident' + (summary.activeIncidentCount === 1 ? '' : 's') : 'All systems operational';
    root.style.color = summary.hasActiveIncident ? '#b91c1c' : '#166534';
  }
  function refresh() {
    fetch(origin + '/data/summary.json', { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('summary unavailable');
      return response.json();
    }).then(render).catch(function () { root.textContent = 'Status unavailable'; root.style.color = '#5c6b82'; });
  }
  refresh();
  setInterval(refresh, interval);
  window.PulseStatus = window.PulseStatus || {};
  window.PulseStatus.getSummary = function () { return fetch(origin + '/data/summary.json').then(function (response) { if (!response.ok) throw new Error('summary unavailable'); return response.json(); }); };
}());
