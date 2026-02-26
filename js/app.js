/**
 * app.js — Bootstrap & Orchestration
 * AETHERUS MONOLITH
 * Initializes all modules. Manages system mode (NORMAL / FROZEN).
 * Dev note: Press 'F' to toggle FROZEN state for demonstration.
 */
(function() {
  let systemMode = 'NORMAL'; // 'NORMAL' | 'FROZEN'

  /* ─── SCROLL REVEAL ─────────────────────────────── */
  // Phase E — reveal observer uses is-visible class (not legacy 'visible').
  // cardObserver lives here so observeNew() can register dynamically injected
  // doc cards (docs.js calls window.AetherusReveal.observeNew() after fetch).
  function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // Phase E — Card Stagger Observer
    // Stagger delays are handled by CSS .doc-card.is-visible:nth-child() rules.
    const cardObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          cardObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.05,
      rootMargin: '0px 0px -20px 0px'
    });

    document.querySelectorAll('.doc-card').forEach(el => cardObserver.observe(el));

    // Expose so docs.js can call after dynamic card injection
    window.AetherusReveal = {
      observeNew() {
        document.querySelectorAll('.reveal:not(.is-visible)').forEach(el => observer.observe(el));
        document.querySelectorAll('.doc-card:not(.is-visible)').forEach(el => cardObserver.observe(el));
      }
    };
  }

  /* ─── PIPELINE NODE STAGGER ─────────────────────── */
  function initPipelineReveal() {
    const pipelineContainer = document.querySelector('.pipeline-container');
    if (!pipelineContainer) return;

    const nodes = pipelineContainer.querySelectorAll('[data-node-id]');
    nodes.forEach(n => {
      n.style.opacity = '0';
      n.style.transform = 'translateY(4px)';
      n.style.transition = 'opacity 300ms ease, transform 300ms ease';
    });

    const pObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          nodes.forEach((n, i) => {
            setTimeout(() => {
              n.style.opacity = '1';
              n.style.transform = 'translateY(0)';
            }, 300 + i * 80);
          });
          pObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });

    pObserver.observe(pipelineContainer);
  }

  /* ─── SMOOTH NAV ANCHORS ────────────────────────── */
  function initNavigation() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  /* ─── SYSTEM MODE TOGGLE ────────────────────────── */
  function setSystemMode(mode) {
    systemMode = mode;
    const isFrozen = mode === 'FROZEN';

    if (window.AetherusGrid) window.AetherusGrid.setFrozen(isFrozen);
    if (window.AetherusPipeline) window.AetherusPipeline.setFrozen(isFrozen);

    // Visual signal on body
    document.body.setAttribute('data-system-mode', mode);

    // Scan line dims on frozen
    const scanLine = document.querySelector('.scan-line');
    if (scanLine) {
      scanLine.style.opacity = isFrozen ? '0' : '';
      scanLine.style.transition = 'opacity 0.4s ease';
    }
  }

  /* ─── KEYBOARD SHORTCUT (DEV) ───────────────────── */
  // Press 'F' to toggle FROZEN — discoverable only via developer note
  function initDevControls() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'f' || e.key === 'F') {
        const next = systemMode === 'NORMAL' ? 'FROZEN' : 'NORMAL';
        setSystemMode(next);
      }
      // P = simulate Pass
      if ((e.key === 'p' || e.key === 'P') && window.AetherusPipeline) {
        window.AetherusPipeline.simulatePass();
      }
      // X = simulate Fail
      if ((e.key === 'x' || e.key === 'X') && window.AetherusPipeline) {
        window.AetherusPipeline.simulateFail();
      }
    });
  }

  /* ─── REDUCED MOTION ────────────────────────────── */
  function applyReducedMotion() {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      const scanLine = document.querySelector('.scan-line');
      if (scanLine) scanLine.remove();
    }
  }

  /* ─── INIT ──────────────────────────────────────── */
  function init() {
    applyReducedMotion();
    initScrollReveal();
    initPipelineReveal();
    initNavigation();
    initDevControls();

    // Phase E — Nav entry
    // Double rAF ensures the browser has completed an initial paint before
    // adding is-revealed, so the transition fires rather than snapping.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const nav = document.querySelector('.nav');
        if (nav) nav.classList.add('is-revealed');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
