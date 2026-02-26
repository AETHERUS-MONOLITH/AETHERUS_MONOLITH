/**
 * grid.js — Hero Perspective Grid
 * AETHERUS MONOLITH
 * Perspective ground-plane with cursor spring and static gravity well.
 */
(function () {
  const canvas = document.getElementById('grid-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // ── Constants ──────────────────────────────────────────────────
  const VP_X_RATIO  = 0.5;    // vanishing point: horizontal center
  const VP_Y_RATIO  = 0.40;   // vanishing point: 40% from top
  const H_LINES     = 18;     // horizontal perspective lines
  const V_LINES     = 20;     // vertical perspective lines
  const INFLUENCE   = 150;    // cursor spring radius px
  const MAX_DISP    = 26;     // max cursor displacement px
  const SPRING      = 0.07;
  const DAMPING     = 0.72;
  const WELL_RADIUS = 200;    // static gravity well radius px
  const WELL_DEPTH  = 50;     // max downward displacement at well center px — Phase F: increased from 40
  const IDLE_MS     = 3000;   // RAF pause after idle

  // ── State ──────────────────────────────────────────────────────
  let W, H, vpX, vpY;
  let mouse = { x: -1000, y: -1000 };
  let vertices = []; // 2D array: vertices[row][col]
  let raf = null;
  let frozen = false;
  let lastMouseTime = 0;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ── Grid construction ──────────────────────────────────────────
  function buildGrid() {
    vertices = [];
    const VP_MARGIN = 20; // start slightly below VP — avoids degenerate zero-width lines

    for (let i = 0; i < H_LINES; i++) {
      const t  = i / (H_LINES - 1);
      // Quadratic distribution: lines bunch near VP, spread apart at bottom
      const y        = (vpY + VP_MARGIN) + (H - vpY - VP_MARGIN) * t * t;
      const progress = (y - vpY) / (H - vpY); // 0 near VP, 1 at bottom
      const xLeft    = vpX - vpX * progress;          // converges to 0 at bottom
      const xRight   = vpX + (W - vpX) * progress;   // converges to W at bottom

      const row = [];
      for (let j = 0; j < V_LINES; j++) {
        const u  = j / (V_LINES - 1);
        const ox = xLeft + (xRight - xLeft) * u;
        let   oy = y;

        // Static gravity well: push vertices downward near VP
        const wdx   = ox - vpX;
        const wdy   = oy - vpY;
        const wdist = Math.sqrt(wdx * wdx + wdy * wdy);
        if (wdist < WELL_RADIUS) {
          const f = 1 - wdist / WELL_RADIUS;
          oy += WELL_DEPTH * f * f;
        }

        row.push({ ox, oy, x: ox, y: oy, vx: 0, vy: 0 });
      }
      vertices.push(row);
    }
  }

  // ── Physics update ─────────────────────────────────────────────
  function update() {
    if (!W || !H) return;

    for (let i = 0; i < H_LINES; i++) {
      for (let j = 0; j < V_LINES; j++) {
        const v  = vertices[i][j];
        const dx = mouse.x - v.ox;
        const dy = mouse.y - v.oy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let tx = v.ox, ty = v.oy;
        if (dist < INFLUENCE && dist > 0) {
          const factor = 1 - dist / INFLUENCE;
          const pull   = factor * factor * MAX_DISP;
          tx = v.ox + (dx / dist) * pull;
          ty = v.oy + (dy / dist) * pull;
        }

        const fx = (tx - v.x) * SPRING;
        const fy = (ty - v.y) * SPRING;
        v.vx = (v.vx + fx) * DAMPING;
        v.vy = (v.vy + fy) * DAMPING;
        v.x += v.vx;
        v.y += v.vy;
      }
    }
  }

  // ── Render ─────────────────────────────────────────────────────
  function draw() {
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 0.5;

    // Horizontal lines
    for (let i = 0; i < H_LINES; i++) {
      // Base alpha: 0.02 near VP (row 0) → 0.14 at bottom (row H_LINES-1) — Phase F: widened from 0.04/0.10
      const baseAlpha = 0.02 + (i / (H_LINES - 1)) * 0.12;
      // Proximity check using midpoint vertex of the row
      const mv   = vertices[i][Math.floor(V_LINES / 2)];
      const dx   = mouse.x - mv.ox;
      const dy   = mouse.y - mv.oy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const proximity = (!frozen && dist < INFLUENCE) ? (1 - dist / INFLUENCE) : 0;

      ctx.beginPath();
      for (let j = 0; j < V_LINES; j++) {
        const v = vertices[i][j];
        if (j === 0) ctx.moveTo(v.x, v.y);
        else         ctx.lineTo(v.x, v.y);
      }
      ctx.strokeStyle = proximity > 0
        ? `rgba(0,191,255,${baseAlpha * 0.6 + proximity * 0.09})`
        : `rgba(180,184,193,${baseAlpha})`;
      ctx.stroke();
    }

    // Vertical lines — same color logic; base alpha derived from midpoint row
    const midRow    = Math.floor(H_LINES / 2);
    const vBaseAlpha = 0.02 + (midRow / (H_LINES - 1)) * 0.12; // Phase F: matched to horizontal range

    for (let j = 0; j < V_LINES; j++) {
      const mv   = vertices[midRow][j];
      const dx   = mouse.x - mv.ox;
      const dy   = mouse.y - mv.oy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const proximity = (!frozen && dist < INFLUENCE) ? (1 - dist / INFLUENCE) : 0;

      ctx.beginPath();
      for (let i = 0; i < H_LINES; i++) {
        const v = vertices[i][j];
        if (i === 0) ctx.moveTo(v.x, v.y);
        else         ctx.lineTo(v.x, v.y);
      }
      ctx.strokeStyle = proximity > 0
        ? `rgba(0,191,255,${vBaseAlpha * 0.6 + proximity * 0.09})`
        : `rgba(180,184,193,${vBaseAlpha})`;
      ctx.stroke();
    }

    // Vertex dots — only near cursor
    for (let i = 0; i < H_LINES; i++) {
      for (let j = 0; j < V_LINES; j++) {
        const v    = vertices[i][j];
        const dx   = mouse.x - v.ox;
        const dy   = mouse.y - v.oy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < INFLUENCE) {
          const t = 1 - dist / INFLUENCE;
          ctx.fillStyle = `rgba(0,191,255,${t * t * 0.55})`;
          ctx.beginPath();
          ctx.arc(v.x, v.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // ── Frozen return ──────────────────────────────────────────────
  // Self-scheduling lerp to rest positions. Stops if unfrozen or all settled.
  function frozenReturn() {
    if (!frozen) return; // unfrozen while mid-animation — stop chain

    let allSettled = true;
    for (let i = 0; i < H_LINES; i++) {
      for (let j = 0; j < V_LINES; j++) {
        const v  = vertices[i][j];
        v.vx = 0;
        v.vy = 0;
        const dx = v.ox - v.x;
        const dy = v.oy - v.y;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          allSettled = false;
          v.x += dx * 0.04;
          v.y += dy * 0.04;
        } else {
          v.x = v.ox;
          v.y = v.oy;
        }
      }
    }
    draw();
    if (!allSettled) requestAnimationFrame(frozenReturn);
  }

  // ── Main rAF loop ──────────────────────────────────────────────
  function loop() {
    try {
      if (frozen) { frozenReturn(); return; }
      if (Date.now() - lastMouseTime > IDLE_MS) { cancelAnimationFrame(raf); raf = null; return; }
      update();
      draw();
      raf = requestAnimationFrame(loop);
    } catch (e) {
      console.warn('[AETHERUS grid]', e);
      raf = requestAnimationFrame(loop);
    }
  }

  // ── Resize ─────────────────────────────────────────────────────
  // Must be called inside window load + rAF to guarantee real layout dimensions.
  function resize() {
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr); // canvas.width reset clears prior transforms; this is always fresh
    vpX = W * VP_X_RATIO;
    vpY = H * VP_Y_RATIO;
    buildGrid();
  }

  window.addEventListener('resize', () => requestAnimationFrame(resize));

  // ── Events ─────────────────────────────────────────────────────
  // canvas has pointer-events:none in CSS — hero-section is the event target.
  // getBoundingClientRect is called fresh on every event (no caching).
  // Coords are CSS pixels — no DPR multiplication.
  const hero = document.querySelector('.hero-section');
  if (hero) {
    if (!mq.matches) {
      hero.addEventListener('mousemove', (e) => {
        if (frozen) return;
        const rect = canvas.getBoundingClientRect(); // fresh call each event
        mouse.x = e.clientX - rect.left;            // CSS pixels only
        mouse.y = e.clientY - rect.top;
        lastMouseTime = Date.now();
        if (raf === null && !frozen) { raf = requestAnimationFrame(loop); }
      });
    }
    hero.addEventListener('mouseleave', () => {
      mouse.x = -1000;
      mouse.y = -1000;
    });
  }

  // ── Public API ─────────────────────────────────────────────────
  window.AetherusGrid = {
    startGrid() {
      if (raf === null && !frozen) {
        lastMouseTime = Date.now();
        raf = requestAnimationFrame(loop);
      }
    },
    stopGrid() {
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    },
    setFrozen(bool) {
      frozen = bool;
      if (bool) {
        this.stopGrid();
        mouse.x = -1000;
        mouse.y = -1000;
        requestAnimationFrame(frozenReturn);
      } else {
        this.startGrid();
      }
    }
  };

  // ── Initialization ─────────────────────────────────────────────
  // window 'load' + inner rAF guarantees a real layout pass before reading dimensions.
  window.addEventListener('load', () => {
    requestAnimationFrame(() => {
      resize();
      if (!mq.matches) {
        lastMouseTime = Date.now();
        raf = requestAnimationFrame(loop);
      } else {
        draw(); // single static frame — no loop, no mousemove
      }
    });
  });
})();
