(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || !(script instanceof HTMLScriptElement)) return;
  var origin = new URL(script.src).origin + new URL(script.src).pathname.replace(/\/embed\.js$/, '');
  var root = document.createElement('span');
  var position = script.dataset.position || 'top-right';
  var theme = script.dataset.theme || 'auto';
  var variant = script.dataset.compact === 'true' ? 'badge' : 'banner';
  var isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var palette = isDark
    ? { border: '#31415e', text: '#e5e7eb', background: '#17243d', shadow: 'rgba(0,0,0,.4)', danger: '#f87171', ok: '#4ade80', muted: '#a9b6cc' }
    : { border: '#dbe3ef', text: '#17243d', background: '#fff', shadow: 'rgba(23,36,61,.16)', danger: '#b91c1c', ok: '#166534', muted: '#5c6b82' };
  var positions = {
    'top-right': 'top:20px;right:20px',
    'top-left': 'top:20px;left:20px',
    'bottom-right': 'bottom:20px;right:20px',
    'bottom-left': 'bottom:20px;left:20px'
  };
  var positionStyle = positions[position] || positions['top-right'];
  root.setAttribute('role', 'status');
  var hideOperational = script.dataset.hideOperational === 'true';
  root.style.cssText = [
    'position:fixed',
    positionStyle,
    'z-index:9999',
    'display:inline-flex',
    'align-items:center',
    'box-sizing:border-box',
    'max-width:calc(100vw - 40px)',
    'font:600 14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'padding:' + (variant === 'badge' ? '6px 12px' : '10px 14px'),
    'border:1px solid ' + palette.border,
    'border-radius:' + (variant === 'badge' ? '999px' : '10px'),
    'color:' + palette.text,
    'background:' + palette.background,
    'box-shadow:0 8px 24px ' + palette.shadow,
    'white-space:nowrap'
  ].join(';');
  if (variant === 'badge') root.style.boxShadow = 'none';
  if (window.matchMedia('(max-width:480px)').matches && variant !== 'badge') {
    root.style.right = '12px';
    root.style.left = '12px';
    root.style.maxWidth = 'none';
    root.style.whiteSpace = 'normal';
    if (position.indexOf('bottom-') === 0) {
      root.style.top = 'auto';
      root.style.bottom = '12px';
    } else {
      root.style.top = '12px';
      root.style.bottom = 'auto';
    }
  }
  root.textContent = 'Status unavailable';
  script.insertAdjacentElement('afterend', root);
  var interval = Math.max(60000, Number(script.dataset.pollInterval || 300000));
  function render(summary) {
    var service = script.dataset.service || 'all';
    var operational = !summary.hasActiveIncident && (service === 'all' || summary.affectedServiceCount === 0);
    if (service !== 'all' && summary.affectedServiceCount === 0) root.textContent = 'Operational';
    else root.textContent = summary.hasActiveIncident ? summary.activeIncidentCount + ' active incident' + (summary.activeIncidentCount === 1 ? '' : 's') : 'All systems operational';
    root.style.color = summary.hasActiveIncident ? palette.danger : palette.ok;
    root.hidden = hideOperational && operational;
    root.setAttribute('aria-hidden', root.hidden ? 'true' : 'false');
  }
  function refresh() {
    fetch(origin + '/data/summary.json', { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('summary unavailable');
      return response.json();
    }).then(render).catch(function () {
      root.hidden = false;
      root.setAttribute('aria-hidden', 'false');
      root.textContent = 'Status unavailable';
      root.style.color = palette.muted;
    });
  }
  refresh();
  setInterval(refresh, interval);
  window.PulseStatus = window.PulseStatus || {};
  window.PulseStatus.getSummary = function () { return fetch(origin + '/data/summary.json').then(function (response) { if (!response.ok) throw new Error('summary unavailable'); return response.json(); }); };
}());
