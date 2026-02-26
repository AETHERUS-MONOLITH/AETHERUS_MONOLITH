/**
 * pipeline.js — Pipeline HUD State Machine
 * AETHERUS MONOLITH
 * Joints = bevelled squares with pulser, Gates = diamonds.
 * F = freeze, P = pass sim, X = fail sim, I = idempotent cache sim.
 */
(function () {

  // ── Node → related doc IDs ─────────────────────────────────
  const nodeDocMap = {
    'G_IDEM': ['PIPELINE_OVERVIEW'],
    'S1':     ['JOINT_SPECIFICATIONS'],
    'G1':     ['GATE_SPECIFICATIONS'],
    'G1A':    ['GATE_SPECIFICATIONS'],
    'S2':     ['JOINT_SPECIFICATIONS'],
    'G2':     ['GATE_SPECIFICATIONS'],
    'S3':     ['JOINT_SPECIFICATIONS'],
    'S4':     ['JOINT_SPECIFICATIONS'],
    'G4':     ['GATE_SPECIFICATIONS'],
    'S5':     ['JOINT_SPECIFICATIONS', 'DELTA_BRIEF']
  };

  const NODE_ORDER = ['G_IDEM', 'S1', 'G1', 'G1A', 'S2', 'G2', 'S3', 'S4', 'G4', 'S5'];

  let frozen = false;

  // ── Helpers ────────────────────────────────────────────────

  function clearAllActive() {
    document.querySelectorAll('[data-node-id]').forEach(el => {
      el.classList.remove('active', 'failure');
    });
  }

  function setNodeActive(nodeId, isFailure = false) {
    const el = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (!el) return;
    if (isFailure) {
      el.classList.remove('active');
      el.classList.add('failure');
    } else {
      el.classList.remove('failure');
      el.classList.add('active');
    }
  }

  function showStatus(text, duration = 2500) {
    const readout = document.querySelector('.pipeline-status-readout');
    if (!readout) return;
    readout.textContent = text;
    readout.style.opacity = '1';
    setTimeout(() => { readout.style.opacity = '0'; }, duration);
  }

  // ── Rail junctions ─────────────────────────────────────────
  // Absolutely-positioned dot overlays on the rail at each pnode's x center.
  function drawRailJunctions() {
    const hud  = document.querySelector('.pipeline-hud');
    const rail = document.querySelector('.pipeline-rail');
    if (!hud || !rail) return;

    // Remove stale junctions
    hud.querySelectorAll('.rail-junction').forEach(j => j.remove());

    const hudRect  = hud.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const railCenterY = railRect.top + railRect.height / 2 - hudRect.top;

    hud.querySelectorAll('.pnode').forEach(pnode => {
      const pRect   = pnode.getBoundingClientRect();
      const centerX = pRect.left + pRect.width / 2 - hudRect.left;

      const dot = document.createElement('div');
      dot.className = 'rail-junction';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.cssText =
        'position:absolute;' +
        'left:' + (centerX - 2) + 'px;' +
        'top:'  + (railCenterY - 2) + 'px;' +
        'width:4px;height:4px;border-radius:50%;' +
        'background:rgba(180,184,193,0.35);' +
        'z-index:5;pointer-events:none;';
      hud.appendChild(dot);
    });
  }

  // ── Node interaction ───────────────────────────────────────

  function initNodeInteraction() {
    document.querySelectorAll('[data-node-id]').forEach(nodeEl => {
      function activate() {
        if (frozen) return;
        const nodeId     = nodeEl.getAttribute('data-node-id');
        const relatedDocs = nodeDocMap[nodeId] || [];

        clearAllActive();
        nodeEl.classList.add('active');

        // Scroll to artifacts section
        const artifacts = document.getElementById('artifacts');
        if (artifacts) artifacts.scrollIntoView({ behavior: 'smooth' });

        // After 400ms highlight related doc cards
        setTimeout(() => {
          document.querySelectorAll('.doc-card').forEach(card => {
            const cardId = card.getAttribute('data-doc-id');
            if (relatedDocs.includes(cardId)) {
              card.classList.add('active');
            } else {
              card.classList.remove('active');
            }
          });
        }, 400);
      }

      nodeEl.addEventListener('click', activate);
      nodeEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      });
    });
  }

  // ── Frozen state ───────────────────────────────────────────

  function applyFrozen(isFrozen) {
    frozen = isFrozen;

    const particles = document.querySelectorAll('.pipeline-particle');
    const rail      = document.querySelector('.pipeline-rail');
    const hud       = document.querySelector('.pipeline-hud');

    particles.forEach(p => {
      p.style.animationPlayState = isFrozen ? 'paused' : 'running';
    });

    if (rail) {
      rail.style.transition = 'opacity 0.4s ease';
      rail.style.opacity    = isFrozen ? '0.15' : '';
    }

    // Static frozen dot at rail center
    const railWrap = document.querySelector('.pipeline-rail-wrap');
    let dot = document.querySelector('.pipeline-frozen-dot');

    if (isFrozen && !dot && railWrap) {
      dot = document.createElement('div');
      dot.className = 'pipeline-frozen-dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.cssText =
        'position:absolute;top:50%;left:50%;' +
        'transform:translate(-50%,-50%);' +
        'width:4px;height:4px;border-radius:50%;' +
        'background:rgba(180,184,193,0.6);' +
        'z-index:5;pointer-events:none;transition:opacity 0.4s ease;';
      railWrap.appendChild(dot);
    } else if (!isFrozen && dot) {
      dot.style.opacity = '0';
      setTimeout(() => dot.remove(), 400);
    }

    if (hud) {
      hud.style.transition = 'opacity 0.4s ease';
      hud.style.opacity    = isFrozen ? '0.5' : '';
    }

    if (isFrozen) clearAllActive();
  }

  // ── Keyboard dev controls ──────────────────────────────────

  function initKeyboardControls() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case 'f': case 'F':
          applyFrozen(!frozen);
          break;
        case 'p': case 'P':
          window.AetherusPipeline.simulatePass();
          break;
        case 'x': case 'X':
          window.AetherusPipeline.simulateFail();
          break;
        case 'i': case 'I':
          window.AetherusPipeline.simulateIdempotentCache();
          break;
      }
    });
  }

  // ── Public API ─────────────────────────────────────────────

  window.AetherusPipeline = {

    clearAllActive,

    setFrozen(bool) {
      applyFrozen(bool);
    },

    simulatePass() {
      if (frozen) return;
      clearAllActive();
      const sequence = NODE_ORDER.slice(); // all 10 nodes
      sequence.forEach((nodeId, i) => {
        setTimeout(() => {
          clearAllActive();
          setNodeActive(nodeId);
        }, i * 280);
      });
      // clearAllActive 500ms after last node activates
      setTimeout(() => clearAllActive(), (sequence.length - 1) * 280 + 500);
    },

    simulateFail() {
      if (frozen) return;
      clearAllActive();
      const forward = ['G_IDEM', 'S1', 'G1', 'G1A', 'S2', 'G2', 'S3', 'S4'];
      forward.forEach((nodeId, i) => {
        setTimeout(() => {
          clearAllActive();
          setNodeActive(nodeId);
        }, i * 280);
      });
      // G4 failure — 280ms after last forward node
      const g4Time = forward.length * 280;
      setTimeout(() => {
        clearAllActive();
        setNodeActive('G4', true);
      }, g4Time);
      // Retrograde S4 → S3 with failure, 500ms after G4, then 300ms apart
      ['S4', 'S3'].forEach((nodeId, i) => {
        setTimeout(() => {
          clearAllActive();
          setNodeActive(nodeId, true);
        }, g4Time + 500 + i * 300);
      });
      // clearAllActive 600ms after retrograde ends
      setTimeout(() => clearAllActive(), g4Time + 500 + 2 * 300 + 600);
    },

    simulateIdempotentCache() {
      if (frozen) return;
      clearAllActive();
      setNodeActive('G_IDEM');
      showStatus('Idempotency confirmed. Returning cached artifact.', 2500);
      setTimeout(() => clearAllActive(), 2500);
    }
  };

  // ── Init ───────────────────────────────────────────────────

  function init() {
    initNodeInteraction();
    initKeyboardControls();
    // Draw junction dots after layout paint
    requestAnimationFrame(drawRailJunctions);
    window.addEventListener('resize', () => requestAnimationFrame(drawRailJunctions));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
