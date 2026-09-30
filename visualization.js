/* ==========================================================================
   Editorial particle data-flow visualization
   RAW DATA -> STRUCTURE & MODEL -> ANALYSIS & INSIGHT -> BUSINESS DECISION, rendered as an organic particle
   cloud on <canvas>. No chart libraries, no external data — everything is
   generated in the browser.

   The file is split into clearly separated responsibilities:
   1. Config
   2. Particle generation  (shape of the data field)
   3. Particle positioning (curve + density helpers)
   4. Color
   5. Mouse interaction
   6. Animation loop (entrance + idle drift + interaction easing)
   7. Rendering
   8. Responsive resizing
   9. Bootstrap
   ========================================================================== */

(() => {
  "use strict";

  /* ---------------------------------------------------------------------
   * 1. Config
   * ------------------------------------------------------------------- */
  const CONFIG = {
    particleCountDesktop: 2600,
    particleCountMobile: 1200,
    mobileBreakpoint: 720,
    interactionRadius: 90, // px, cursor influence radius
    maxPush: 22, // px, max displacement a particle gets from the cursor
    springEase: 0.09, // how fast a particle eases toward its target offset
    entranceStaggerMs: 900, // spread of entrance delays across the field
    entranceDurationMs: 950,
    colorStops: [
      { t: 0.0, rgb: [79, 99, 214] }, // soft indigo/blue
      { t: 0.5, rgb: [42, 176, 189] }, // cyan / teal
      { t: 1.0, rgb: [106, 79, 160] }, // deep plum lilac
    ],
    // "Transformation" zone: raw points resolving into a light structure.
    linkZone: [0.28, 0.58],
    linkMaxDistance: 26, // px, only connect close neighbors
    linkMaxCount: 130,
    linkOpacity: 0.4,
    // "Insight" zone: a clean analytical trend line drawn over the cloud.
    trendZone: [0.58, 0.97],
    trendRevealMs: 900,
  };

  /* ---------------------------------------------------------------------
   * Small math helpers
   * ------------------------------------------------------------------- */
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  // Box-Muller transform for a natural-feeling (gaussian) spread.
  function gaussianRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function lerpColor(rgbA, rgbB, t) {
    return [
      Math.round(lerp(rgbA[0], rgbB[0], t)),
      Math.round(lerp(rgbA[1], rgbB[1], t)),
      Math.round(lerp(rgbA[2], rgbB[2], t)),
    ];
  }

  function colorAt(t) {
    const stops = CONFIG.colorStops;
    t = clamp(t, 0, 1);
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      if (t >= a.t && t <= b.t) {
        const localT = (t - a.t) / (b.t - a.t);
        return lerpColor(a.rgb, b.rgb, localT);
      }
    }
    return stops[stops.length - 1].rgb;
  }

  /* ---------------------------------------------------------------------
   * 3. Positioning — the "data landscape" the particles trace out.
   *    Everything here is deterministic given xNorm (0..1), so resizing
   *    just re-samples the same field at the new pixel dimensions.
   * ------------------------------------------------------------------- */

  // Fraction of the canvas height (from the bottom) the data field's
  // centerline sits at, for a given x position. Rises left -> right with
  // gentle organic fluctuation layered on top of the trend.
  function trendFraction(xNorm) {
    const trend = 0.18 + 0.62 * xNorm;
    const wave =
      0.055 * Math.sin(xNorm * Math.PI * 3.1 + 0.4) +
      0.03 * Math.sin(xNorm * Math.PI * 7.3 + 1.7);
    return clamp(trend + wave, 0.06, 0.92);
  }

  // Density/thickness multiplier: some regions of the field are denser
  // and taller than others, so the cloud doesn't look uniform.
  function densityAt(xNorm) {
    return (
      0.75 +
      0.35 * Math.sin(xNorm * Math.PI * 2.2 + 0.8) +
      0.25 * Math.sin(xNorm * Math.PI * 5.0 + 2.4)
    );
  }

  /* ---------------------------------------------------------------------
   * 2. Particle generation
   * ------------------------------------------------------------------- */
  function generateParticles(width, height, count) {
    const particles = [];
    const bins = 70;

    // Distribute the particle count across x-bins proportional to a
    // weight function, so some columns are visibly denser than others.
    const weights = new Array(bins);
    let weightSum = 0;
    for (let i = 0; i < bins; i++) {
      const xNorm = (i + 0.5) / bins;
      const w = Math.max(0.15, densityAt(xNorm));
      weights[i] = w;
      weightSum += w;
    }

    let idCounter = 0;
    for (let i = 0; i < bins; i++) {
      const binCount = Math.round((weights[i] / weightSum) * count);
      const xStart = (i / bins) * width;
      const xEnd = ((i + 1) / bins) * width;

      for (let j = 0; j < binCount; j++) {
        const x = lerp(xStart, xEnd, Math.random());
        const xNorm = x / width;
        const centerY = height * (1 - trendFraction(xNorm));
        const spread = (26 + 46 * densityAt(xNorm)) * (height / 420);
        const y = clamp(centerY + gaussianRandom() * spread, -20, height + 20);

        // Bias toward small particles with a few larger accents.
        const radius = 0.5 + Math.pow(Math.random(), 2.2) * 2.1;

        // Particles nearer the centerline read as more opaque, giving a
        // soft cloud edge instead of a hard boundary.
        const distFromCenter = Math.abs(y - centerY) / spread;
        const baseOpacity =
          clamp(0.85 - distFromCenter * 0.55, 0.08, 0.85) *
          (0.55 + Math.random() * 0.45);

        particles.push({
          id: idCounter++,
          // "home" position the particle belongs to
          homeX: x,
          homeY: y,
          // current rendered position (starts randomized for entrance)
          curX: Math.random() * width,
          curY: Math.random() * height,
          radius,
          baseOpacity,
          colorT: clamp(xNorm + (Math.random() - 0.5) * 0.08, 0, 1),
          // interaction spring offset
          offX: 0,
          offY: 0,
          // entrance timing, staggered left -> right
          entranceDelay: xNorm * CONFIG.entranceStaggerMs + Math.random() * 250,
          // gentle idle bob, always-on subtle life
          phase: Math.random() * Math.PI * 2,
          ampX: 0.6 + Math.random() * 0.8,
          ampY: 0.6 + Math.random() * 0.8,
        });
      }
    }
    return particles;
  }

  /* ---------------------------------------------------------------------
   * 3b. Structural overlays — sparse neighbor links in the transformation
   *     zone, and a single clean trend line through the insight zone.
   *     Both make the "raw -> structured -> insight" concept explicit
   *     instead of leaving it to the particle density alone.
   * ------------------------------------------------------------------- */

  // Sparse neighbor links: a light spatial hash keeps this to a single
  // pass, and a hard cap keeps the result subtle rather than a web.
  function buildLinks(particles, width) {
    const [zoneMin, zoneMax] = CONFIG.linkZone;
    const cellSize = CONFIG.linkMaxDistance * 1.6;
    const grid = new Map();
    const zoneParticles = [];

    for (const p of particles) {
      if (p.homeX / width >= zoneMin && p.homeX / width <= zoneMax) {
        zoneParticles.push(p);
      }
    }
    for (const p of zoneParticles) {
      const key = `${Math.floor(p.homeX / cellSize)}_${Math.floor(p.homeY / cellSize)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(p);
    }

    const links = [];
    const step = Math.max(1, Math.floor(zoneParticles.length / (CONFIG.linkMaxCount * 2.5)));
    for (let i = 0; i < zoneParticles.length && links.length < CONFIG.linkMaxCount; i += step) {
      const p = zoneParticles[i];
      const cx = Math.floor(p.homeX / cellSize);
      const cy = Math.floor(p.homeY / cellSize);
      let best = null;
      let bestDist = CONFIG.linkMaxDistance;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = grid.get(`${cx + dx}_${cy + dy}`);
          if (!bucket) continue;
          for (const q of bucket) {
            if (q === p) continue;
            const ddx = q.homeX - p.homeX;
            const ddy = q.homeY - p.homeY;
            const d = Math.sqrt(ddx * ddx + ddy * ddy);
            if (d > 3 && d < bestDist) {
              bestDist = d;
              best = q;
            }
          }
        }
      }
      if (best) links.push({ a: p, b: best });
    }
    return links;
  }

  // A single smooth path sampled from the same trend curve the particle
  // field follows, confined to the insight zone on the right.
  function buildTrendPath(width, height) {
    const [zoneMin, zoneMax] = CONFIG.trendZone;
    const steps = 40;
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const xNorm = zoneMin + ((zoneMax - zoneMin) * i) / steps;
      points.push({
        x: xNorm * width,
        y: height * (1 - trendFraction(xNorm)),
      });
    }
    return points;
  }

  /* ---------------------------------------------------------------------
   * Main controller class
   * ------------------------------------------------------------------- */
  class DataFlowViz {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.wrap = canvas.parentElement;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.mouse = { x: 0, y: 0, active: false };
      this.startTime = performance.now();
      this.particles = [];

      this._bindEvents();
      this.resize(); // sets size + generates particles
      requestAnimationFrame(this._tick.bind(this));
    }

    /* -------------------- 8. Responsive resizing -------------------- */
    resize() {
      const rect = this.wrap.getBoundingClientRect();
      this.width = Math.max(1, Math.round(rect.width));
      this.height = Math.max(1, Math.round(rect.height));

      this.canvas.width = this.width * this.dpr;
      this.canvas.height = this.height * this.dpr;
      this.canvas.style.width = this.width + "px";
      this.canvas.style.height = this.height + "px";
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      const isMobile = this.width < CONFIG.mobileBreakpoint;
      const count = isMobile
        ? CONFIG.particleCountMobile
        : CONFIG.particleCountDesktop;

      this.particles = generateParticles(this.width, this.height, count);
      this.links = buildLinks(this.particles, this.width);
      this.trendPath = buildTrendPath(this.width, this.height);
      this.startTime = performance.now(); // replay entrance on resize
    }

    /* -------------------- 5. Mouse interaction -------------------- */
    _bindEvents() {
      const onMove = (clientX, clientY) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = clientX - rect.left;
        this.mouse.y = clientY - rect.top;
        this.mouse.active = true;
      };

      this.wrap.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
      this.wrap.addEventListener("mouseleave", () => {
        this.mouse.active = false;
      });
      this.wrap.addEventListener(
        "touchmove",
        (e) => {
          if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
        },
        { passive: true }
      );
      this.wrap.addEventListener("touchend", () => {
        this.mouse.active = false;
      });

      let resizeTimer = null;
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => this.resize(), 150);
      });
    }

    /* -------------------- 6. Animation loop -------------------- */
    _tick(now) {
      const elapsed = now - this.startTime;
      this._update(now, elapsed);
      this._render(elapsed);
      requestAnimationFrame(this._tick.bind(this));
    }

    _update(now, elapsed) {
      const { mouse } = this;

      for (const p of this.particles) {
        // Entrance progress: 0 (just spawned, scattered) -> 1 (in place)
        const raw = (elapsed - p.entranceDelay) / CONFIG.entranceDurationMs;
        const entrance = easeOutCubic(clamp(raw, 0, 1));

        // Always-on gentle idle drift, subtle and slow.
        const idleX = Math.cos(now * 0.0006 + p.phase) * p.ampX;
        const idleY = Math.sin(now * 0.0006 + p.phase) * p.ampY;

        // Desired spring offset from cursor repulsion.
        let desiredOffX = 0, desiredOffY = 0;
        if (mouse.active && entrance > 0.5) {
          const dx = p.homeX - mouse.x;
          const dy = p.homeY - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONFIG.interactionRadius && dist > 0.001) {
            const force = (CONFIG.interactionRadius - dist) / CONFIG.interactionRadius;
            desiredOffX = (dx / dist) * force * CONFIG.maxPush;
            desiredOffY = (dy / dist) * force * CONFIG.maxPush;
          }
        }

        // Ease current offset toward the desired one (spring-like; this
        // is what makes particles "slowly return" when the mouse leaves).
        p.offX += (desiredOffX - p.offX) * CONFIG.springEase;
        p.offY += (desiredOffY - p.offY) * CONFIG.springEase;

        // Blend from a scattered spawn point to the home position as the
        // entrance animation progresses, then add idle drift + interaction.
        const baseX = lerp(p.spawnX ?? (p.spawnX = p.homeX + (Math.random() - 0.5) * this.width * 0.4), p.homeX, entrance);
        const baseY = lerp(p.spawnY ?? (p.spawnY = p.homeY + (Math.random() - 0.5) * this.height * 0.6), p.homeY, entrance);

        p.curX = baseX + idleX + p.offX;
        p.curY = baseY + idleY + p.offY;
        p.curOpacity = p.baseOpacity * entrance;
      }
    }

    /* -------------------- 7. Rendering -------------------- */
    _render(elapsed) {
      const { ctx, width, height } = this;
      ctx.clearRect(0, 0, width, height);

      // Transformation zone: faint links show points resolving into
      // structure, drawn beneath the particles themselves.
      ctx.lineWidth = 1;
      for (const link of this.links) {
        const { a, b } = link;
        const op = Math.min(a.curOpacity, b.curOpacity);
        if (op <= 0.02) continue;
        const [r, g, bC] = colorAt((a.colorT + b.colorT) / 2);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${bC}, ${(op * CONFIG.linkOpacity).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.curX, a.curY);
        ctx.lineTo(b.curX, b.curY);
        ctx.stroke();
      }

      for (const p of this.particles) {
        if (p.curOpacity <= 0.005) continue;
        const [r, g, b] = colorAt(p.colorT);
        ctx.beginPath();
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.curOpacity.toFixed(3)})`;
        ctx.arc(p.curX, p.curY, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      this._renderTrendLine(elapsed);
    }

    // Insight zone: one clean, deliberately-drawn line through the field's
    // own upward trend — the "so what" that sits on top of the data cloud.
    _renderTrendLine(elapsed) {
      const path = this.trendPath;
      if (!path || path.length < 2) return;

      const revealDelay = CONFIG.entranceStaggerMs + CONFIG.entranceDurationMs * 0.5;
      const progress = clamp((elapsed - revealDelay) / CONFIG.trendRevealMs, 0, 1);
      if (progress <= 0) return;

      const eased = easeOutCubic(progress);
      const count = Math.max(2, Math.round(path.length * eased));
      const [r, g, b] = colorAt(0.95);
      const { ctx } = this;

      ctx.save();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(0.42 * eased).toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < count; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* -------------------- 9. Bootstrap -------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("dataflow-canvas");
    if (canvas) new DataFlowViz(canvas);
  });
})();
