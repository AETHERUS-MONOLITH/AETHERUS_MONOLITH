(function () {
  'use strict';

  // Presentation only: a gentle perspective tilt and a travelling light for raised surfaces.
  // It sets CSS variables (--rx --ry --tx --ty --mx --my) and never touches content or state.
  var SELECTOR = [
    '.operator-disclosure:not([open])',
    '.doc-card',
    '.operator-stack > li > button',
    '.operator-stack__chambers button',
    '.work-method',
    '.work-provenance',
    '.operator-publication-object'
  ].join(',');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var current = null;
  var frame = 0;
  var last = null;

  function reset(el) {
    if (!el) return;
    el.classList.remove('is-tilting');
    ['--rx', '--ry', '--tx', '--ty', '--mx', '--my'].forEach(function (name) {
      el.style.removeProperty(name);
    });
  }

  function release() {
    reset(current);
    current = null;
  }

  function apply() {
    frame = 0;
    if (!current || !last) return;
    var rect = current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var px = Math.min(1, Math.max(0, (last.x - rect.left) / rect.width));
    var py = Math.min(1, Math.max(0, (last.y - rect.top) / rect.height));
    // Small surfaces lean further than wide ones; the result stays within 0.8-4.5 degrees.
    var max = Math.min(4.5, Math.max(0.8, 1400 / rect.width));
    var tx = (px - 0.5) * 2;
    var ty = (py - 0.5) * 2;
    current.classList.add('is-tilting');
    current.style.setProperty('--ry', (tx * max).toFixed(2) + 'deg');
    current.style.setProperty('--rx', (-ty * max).toFixed(2) + 'deg');
    current.style.setProperty('--tx', tx.toFixed(3));
    current.style.setProperty('--ty', ty.toFixed(3));
    current.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    current.style.setProperty('--my', (py * 100).toFixed(1) + '%');
  }

  document.addEventListener('pointermove', function (event) {
    if (reduced.matches || !fine.matches || event.pointerType === 'touch') return;
    var target = event.target instanceof Element ? event.target.closest(SELECTOR) : null;
    if (target !== current) {
      release();
      current = target;
    }
    if (!current) return;
    last = { x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(apply);
  }, { passive: true });

  document.addEventListener('pointerout', function (event) {
    if (!current) return;
    var next = event.relatedTarget;
    if (!next || !(next instanceof Node) || !current.contains(next)) release();
  }, true);
  document.addEventListener('pointercancel', release, true);
  document.addEventListener('toggle', release, true);
  window.addEventListener('blur', release);
  reduced.addEventListener('change', release);
})();
