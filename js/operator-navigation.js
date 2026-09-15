(function () {
  'use strict';

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function revealDestination(hash, updateHistory) {
    if (!hash || hash === '#top') return false;
    const target = document.querySelector(hash);
    if (!target) return false;

    if (target instanceof HTMLDetailsElement) target.open = true;
    const parentDetails = target.closest('details');
    if (parentDetails) parentDetails.open = true;

    if (updateHistory) history.pushState(null, '', hash);
    target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });

    const focusTarget = target instanceof HTMLDetailsElement
      ? target.querySelector(':scope > summary')
      : target.querySelector('h1, h2, h3') || target;
    if (focusTarget instanceof HTMLElement) {
      if (focusTarget.tagName !== 'SUMMARY' && !focusTarget.matches('a, button, input, select, textarea, [tabindex]')) {
        focusTarget.setAttribute('tabindex', '-1');
      }
      focusTarget.focus({ preventScroll: true });
    }
    return true;
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || !revealDestination(link.hash, true)) return;
    event.preventDefault();
    const menu = link.closest('details.operator-menu');
    if (menu) menu.open = false;
  });

  window.addEventListener('popstate', () => revealDestination(location.hash, false));
  if (location.hash) requestAnimationFrame(() => revealDestination(location.hash, false));
})();
