/* ==========================================================================
   Editorial data-journey visualization (dark background)
   RAW DATA -> STRUCTURE & MODEL -> ANALYSIS & INSIGHT -> BUSINESS DECISION

   One canvas, four stages, read left to right:
   1. Raw data          a loose, dim cloud of points
   2. Structure & model a small connected node structure (a star-schema
                        style constellation) resolving out of the cloud
   3. Analysis & insight faint bars and one clean trend line
   4. Business decision  the trend ends in a single highlighted point with
                        a target line continuing beyond it

   No chart libraries, no external data. Motion is restrained: a short
   entrance, slow idle drift and a gentle cursor push. With
   prefers-reduced-motion the final state is shown and nothing moves.

   1. Config   2. Helpers   3. Data field   4. Overlays (graph, bars, trend)
   5. Controller (resize, mouse, animation)   6. Rendering   7. Bootstrap
   ========================================================================== */

(() => {
  "use strict";

  /* ---------------------------------------------------------------------
   * 1. Config
   * ------------------------------------------------------------------- */
  const CONFIG = {
    particleCountDesktop: 2200,
    particleCountMobile: 1000,
    mobileBreakpoint: 720,
    interactionRadius: 90, // px, cursor influence radius
    maxPush: 18, // px, max displacement a particle gets from the cursor
    springEase: 0.09,
    entranceStaggerMs: 900,
    entranceDurationMs: 950,

    // Cool slate -> brand purple -> light lilac, left to right.
    colorStops: [
      { t: 0.0, rgb: [122, 134, 196] },
      { t: 0.5, rgb: [146, 112, 218] },
      { t: 1.0, rgb: [204, 186, 255] },
    ],

    // Stage boundaries as fractions of the canvas width. They line up with
    // the HTML stage labels (4% / 28% / 55% / 80%).
    structureZone: [0.28, 0.55],
    insightZone: [0.55, 0.8],
    decisionX: 0.9,

    linkMaxDistance: 26, // px, only connect close neighbours
    linkMaxCount: 110,
    linkOpacity: 0.3,

    barCount: 9,
    baselinePad: 30, // px kept free at the bottom for the stage labels
  };

  /* ---------------------------------------------------------------------
   * 2. Helpers
   * ------------------------------------------------------------------- */
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const rgba = (rgb, a) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a.toFixed(3)})`;

  // Box-Muller transform for a natural-feeling (gaussian) spread.
  function gaussianRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function lerpColor(a, b, t) {
    return [
      Math.round(lerp(a[0], b[0], t)),
      Math.round(lerp(a[1], b[1], t)),
      Math.round(lerp(a[2], b[2], t)),
    ];
  }

  function colorAt(t) {
    const stops = CONFIG.colorStops;
    t = clamp(t, 0, 1);
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      if (t >= a.t && t <= b.t) return lerpColor(a.rgb, b.rgb, (t - a.t) / (b.t - a.t));
    }
    return stops[stops.length - 1].rgb;
  }

  /* ---------------------------------------------------------------------
   * 3. The data field — a rising, organically uneven cloud of points.
   *    Everything is a function of xNorm (0..1), so resizing just
   *    re-samples the same shape at the new pixel size.
   * ------------------------------------------------------------------- */

  // Height of the field's centreline (fraction of canvas height from the
  // bottom): rises left -> right with gentle fluctuation.
  function trendFraction(xNorm) {
    const trend = 0.18 + 0.62 * xNorm;
    const wave =
      0.055 * Math.sin(xNorm * Math.PI * 3.1 + 0.4) +
      0.03 * Math.sin(xNorm * Math.PI * 7.3 + 1.7);
    return clamp(trend + wave, 0.06, 0.92);
  }

  function densityAt(xNorm) {
    return (
      0.75 +
      0.35 * Math.sin(xNorm * Math.PI * 2.2 + 0.8) +
      0.25 * Math.sin(xNorm * Math.PI * 5.0 + 2.4)
    );
  }

  function generateParticles(width, height, count) {
    const particles = [];
    const bins = 70;
    const weights = new Array(bins);
    let weightSum = 0;
    for (let i = 0; i < bins; i++) {
      const w = Math.max(0.15, densityAt((i + 0.5) / bins));
      weights[i] = w;
      weightSum += w;
    }

    let id = 0;
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

        const radius = 0.6 + Math.pow(Math.random(), 2.2) * 2.0;
        const distFromCenter = Math.abs(y - centerY) / spread;

        // Softer cloud edge, and the field brightens as it moves from raw
        // data (dim) towards insight (bright).
        const baseOpacity =
          clamp(0.8 - distFromCenter * 0.55, 0.06, 0.8) *
          (0.5 + Math.random() * 0.5) *
          (0.72 + 0.28 * xNorm);

        particles.push({
          id: id++,
          homeX: x,
          homeY: y,
          curX: x,
          curY: y,
          radius,
          baseOpacity,
          curOpacity: 0,
          colorT: clamp(xNorm + (Math.random() - 0.5) * 0.08, 0, 1),
          offX: 0,
          offY: 0,
          entranceDelay: xNorm * CONFIG.entranceStaggerMs + Math.random() * 250,
          phase: Math.random() * Math.PI * 2,
          ampX: 0.5 + Math.random() * 0.7,
          ampY: 0.5 + Math.random() * 0.7,
          spawnX: x + (Math.random() - 0.5) * width * 0.4,
          spawnY: y + (Math.random() - 0.5) * height * 0.6,
        });
      }
    }
    return particles;
  }

  /* ---------------------------------------------------------------------
   * 4. Overlays that make each stage explicit
   * ------------------------------------------------------------------- */

  // Faint neighbour links inside the structure zone (a light spatial hash
  // keeps this to one pass; the hard cap keeps it subtle).
  function buildLinks(particles, width) {
    const [zMin, zMax] = CONFIG.structureZone;
    const cell = CONFIG.linkMaxDistance * 1.6;
    const grid = new Map();
    const inZone = [];

    for (const p of particles) {
      const xn = p.homeX / width;
      if (xn >= zMin && xn <= zMax) inZone.push(p);
    }
    for (const p of inZone) {
      const key = `${Math.floor(p.homeX / cell)}_${Math.floor(p.homeY / cell)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(p);
    }

    const links = [];
    const step = Math.max(1, Math.floor(inZone.length / (CONFIG.linkMaxCount * 2.5)));
    for (let i = 0; i < inZone.length && links.length < CONFIG.linkMaxCount; i += step) {
      const p = inZone[i];
      const cx = Math.floor(p.homeX / cell);
      const cy = Math.floor(p.homeY / cell);
      let best = null;
      let bestDist = CONFIG.linkMaxDistance;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = grid.get(`${cx + dx}_${cy + dy}`);
          if (!bucket) continue;
          for (const q of bucket) {
            if (q === p) continue;
            const d = Math.hypot(q.homeX - p.homeX, q.homeY - p.homeY);
            if (d > 3 && d < bestDist) { bestDist = d; best = q; }
          }
        }
      }
      if (best) links.push({ a: p, b: best });
    }
    return links;
  }

  // A small star-schema-like structure: one central node with satellites,
  // a few satellite-to-satellite links and tiny outer nodes. Positions are
  // deterministic so it always reads as designed, not random.
  function buildGraph(width, height) {
    const [zMin, zMax] = CONFIG.structureZone;
    const cxN = (zMin + zMax) / 2;
    const cx = cxN * width;
    const cy = height * (1 - trendFraction(cxN)) - height * 0.02;
    const r = Math.min((zMax - zMin) * width * 0.42, height * 0.17);

    const angles = [-2.55, -1.55, -0.55, 0.55, 1.6, 2.6];
    const factors = [1.0, 1.15, 0.95, 1.05, 1.1, 0.95];
    const nodes = [{ x: cx, y: cy, r: 5.2, ring: 12, hub: true }];
    angles.forEach((a, i) => {
      nodes.push({
        x: cx + Math.cos(a) * r * factors[i] * 1.15,
        y: cy + Math.sin(a) * r * factors[i] * 0.95,
        r: 3,
        ring: 0,
      });
    });

    const edges = [];
    for (let i = 1; i <= angles.length; i++) edges.push([0, i]);
    edges.push([1, 2], [3, 4], [5, 6]); // dimension-to-dimension links

    // Tiny outer nodes hanging off three satellites.
    [[2, -0.9], [4, 0.7], [6, 2.2]].forEach(([parent, a]) => {
      const p = nodes[parent];
      nodes.push({
        x: p.x + Math.cos(a) * r * 0.55,
        y: p.y + Math.sin(a) * r * 0.5,
        r: 1.8,
        ring: 0,
      });
      edges.push([parent, nodes.length - 1]);
    });
    return { nodes, edges };
  }

  // Bars under the trend line in the insight zone.
  function buildBars(width, height) {
    const [zMin, zMax] = CONFIG.insightZone;
    const n = CONFIG.barCount;
    const baseY = height - CONFIG.baselinePad;
    const slot = ((zMax - zMin) * width) / n;
    const bars = [];
    for (let i = 0; i < n; i++) {
      const xN = zMin + ((i + 0.5) / n) * (zMax - zMin);
      const lineY = height * (1 - trendFraction(xN));
      const gap = height * (0.09 + 0.05 * Math.sin(i * 1.7 + 0.6));
      const top = clamp(lineY + gap, 10, baseY - 8);
      bars.push({ x: xN * width - slot * 0.3, w: slot * 0.6, top, baseY });
    }
    return bars;
  }

  // One smooth path along the trend, from the start of the insight zone
  // to the decision point.
  function buildTrendPath(width, height) {
    const zMin = CONFIG.insightZone[0];
    const zMax = CONFIG.decisionX;
    const steps = 56;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const xN = zMin + ((zMax - zMin) * i) / steps;
      pts.push({ x: xN * width, y: height * (1 - trendFraction(xN)) });
    }
    return pts;
  }

  /* ---------------------------------------------------------------------
   * 5. Controller
   * ------------------------------------------------------------------- */
  class DataFlowViz {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.wrap = canvas.parentElement;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.reduced =
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      this.mouse = { x: 0, y: 0, active: false };
      this.particles = [];

      this._bindEvents();
      this.resize();
      requestAnimationFrame(this._tick.bind(this));
    }

    resize() {
      const rect = this.wrap.getBoundingClientRect();
      this.width = Math.max(1, Math.round(rect.width));
      this.height = Math.max(1, Math.round(rect.height));

      this.canvas.width = this.width * this.dpr;
      this.canvas.height = this.height * this.dpr;
      this.canvas.style.width = this.width + "px";
      this.canvas.style.height = this.height + "px";
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      const count =
        this.width < CONFIG.mobileBreakpoint
          ? CONFIG.particleCountMobile
          : CONFIG.particleCountDesktop;

      this.particles = generateParticles(this.width, this.height, count);
      this.links = buildLinks(this.particles, this.width);
      this.graph = buildGraph(this.width, this.height);
      this.bars = buildBars(this.width, this.height);
      this.trendPath = buildTrendPath(this.width, this.height);
      this.decision = this.trendPath[this.trendPath.length - 1];

      // Reduced motion: start in the finished state.
      this.startTime = performance.now() - (this.reduced ? 10000 : 0);
    }

    _bindEvents() {
      if (!this.reduced) {
        const onMove = (x, y) => {
          const rect = this.canvas.getBoundingClientRect();
          this.mouse.x = x - rect.left;
          this.mouse.y = y - rect.top;
          this.mouse.active = true;
        };
        this.wrap.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
        this.wrap.addEventListener("mouseleave", () => { this.mouse.active = false; });
        this.wrap.addEventListener(
          "touchmove",
          (e) => { if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY); },
          { passive: true }
        );
        this.wrap.addEventListener("touchend", () => { this.mouse.active = false; });
      }

      let timer = null;
      window.addEventListener("resize", () => {
        clearTimeout(timer);
        timer = setTimeout(() => this.resize(), 150);
      });
    }

    _tick(now) {
      const elapsed = now - this.startTime;
      this._update(now, elapsed);
      this._render(now, elapsed);
      requestAnimationFrame(this._tick.bind(this));
    }

    _update(now, elapsed) {
      const { mouse } = this;
      const drift = this.reduced ? 0 : 1;

      for (const p of this.particles) {
        const raw = (elapsed - p.entranceDelay) / CONFIG.entranceDurationMs;
        const entrance = easeOutCubic(clamp(raw, 0, 1));

        const idleX = Math.cos(now * 0.0006 + p.phase) * p.ampX * drift;
        const idleY = Math.sin(now * 0.0006 + p.phase) * p.ampY * drift;

        let wantX = 0, wantY = 0;
        if (mouse.active && entrance > 0.5) {
          const dx = p.homeX - mouse.x;
          const dy = p.homeY - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < CONFIG.interactionRadius && dist > 0.001) {
            const force = (CONFIG.interactionRadius - dist) / CONFIG.interactionRadius;
            wantX = (dx / dist) * force * CONFIG.maxPush;
            wantY = (dy / dist) * force * CONFIG.maxPush;
          }
        }
        p.offX += (wantX - p.offX) * CONFIG.springEase;
        p.offY += (wantY - p.offY) * CONFIG.springEase;

        p.curX = lerp(p.spawnX, p.homeX, entrance) + idleX + p.offX;
        p.curY = lerp(p.spawnY, p.homeY, entrance) + idleY + p.offY;
        p.curOpacity = p.baseOpacity * entrance;
      }
    }

    /* -------------------- 6. Rendering -------------------- */
    _render(now, elapsed) {
      const { ctx, width, height } = this;
      ctx.clearRect(0, 0, width, height);

      this._renderGrid(elapsed);
      this._renderBars(elapsed);
      this._renderLinks();
      this._renderParticles();
      this._renderGraph(elapsed);
      this._renderTrend(now, elapsed);
    }

    // Very faint horizontal guides + baseline: the "this is a chart" cue.
    _renderGrid(elapsed) {
      const { ctx, width, height } = this;
      const a = easeOutCubic(clamp(elapsed / 900, 0, 1));
      const baseY = height - CONFIG.baselinePad;
      const c = colorAt(0.6);

      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(c, 0.07 * a);
      for (let i = 1; i <= 4; i++) {
        const y = Math.round(lerp(baseY, height * 0.06, i / 4)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.strokeStyle = rgba(c, 0.2 * a);
      ctx.beginPath();
      ctx.moveTo(0, baseY + 0.5);
      ctx.lineTo(width, baseY + 0.5);
      ctx.stroke();
      ctx.restore();
    }

    _renderBars(elapsed) {
      const { ctx } = this;
      const c = colorAt(0.72);
      ctx.save();
      this.bars.forEach((b, i) => {
        const t = easeOutCubic(clamp((elapsed - 1000 - i * 70) / 700, 0, 1));
        if (t <= 0) return;
        const h = (b.baseY - b.top) * t;
        const y = b.baseY - h;
        const grad = ctx.createLinearGradient(0, y, 0, b.baseY);
        grad.addColorStop(0, rgba(c, 0.2 * t));
        grad.addColorStop(1, rgba(c, 0.03 * t));
        ctx.fillStyle = grad;
        ctx.fillRect(b.x, y, b.w, h);
        ctx.fillStyle = rgba(c, 0.38 * t);
        ctx.fillRect(b.x, y, b.w, 1.2);
      });
      ctx.restore();
    }

    _renderLinks() {
      const { ctx } = this;
      ctx.save();
      ctx.lineWidth = 1;
      for (const { a, b } of this.links) {
        const op = Math.min(a.curOpacity, b.curOpacity);
        if (op <= 0.02) continue;
        ctx.strokeStyle = rgba(colorAt((a.colorT + b.colorT) / 2), op * CONFIG.linkOpacity);
        ctx.beginPath();
        ctx.moveTo(a.curX, a.curY);
        ctx.lineTo(b.curX, b.curY);
        ctx.stroke();
      }
      ctx.restore();
    }

    _renderParticles() {
      const { ctx } = this;
      ctx.save();
      ctx.globalCompositeOperation = "lighter"; // soft glow where points overlap
      for (const p of this.particles) {
        if (p.curOpacity <= 0.005) continue;
        ctx.beginPath();
        ctx.fillStyle = rgba(colorAt(p.colorT), p.curOpacity);
        ctx.arc(p.curX, p.curY, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    _renderGraph(elapsed) {
      const { ctx } = this;
      const t = easeOutCubic(clamp((elapsed - 1200) / 900, 0, 1));
      if (t <= 0) return;
      const { nodes, edges } = this.graph;
      const c = colorAt(0.55);
      const bright = colorAt(0.9);

      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(c, 0.5 * t);
      for (const [i, j] of edges) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }

      for (const n of nodes) {
        if (n.ring) {
          ctx.beginPath();
          ctx.strokeStyle = rgba(c, 0.35 * t);
          ctx.arc(n.x, n.y, n.ring, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.shadowColor = rgba(bright, 0.8 * t);
        ctx.shadowBlur = n.hub ? 14 : 8;
        ctx.fillStyle = rgba(bright, (n.hub ? 0.95 : 0.8) * t);
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Trend line, then the decision point it lands on.
    _renderTrend(now, elapsed) {
      const path = this.trendPath;
      if (!path || path.length < 2) return;
      const { ctx, width } = this;

      const delay = CONFIG.entranceStaggerMs + CONFIG.entranceDurationMs * 0.5;
      const progress = clamp((elapsed - delay) / 1100, 0, 1);
      if (progress <= 0) return;

      const eased = easeOutCubic(progress);
      const count = Math.max(2, Math.round(path.length * eased));
      const line = colorAt(0.95);

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = rgba(line, 0.85 * eased);
      ctx.shadowColor = rgba(colorAt(0.6), 0.75 * eased);
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < count; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
      ctx.restore();

      // Decision point: only once the line has arrived.
      const m = easeOutCubic(clamp((elapsed - delay - 950) / 500, 0, 1));
      if (m <= 0) return;
      const { x, y } = this.decision;
      const pulse = this.reduced ? 0 : Math.sin(now * 0.002) * 1.6;
      const halo = colorAt(0.7);

      ctx.save();
      // Target line continuing beyond the decision.
      ctx.setLineDash([3, 6]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(halo, 0.3 * m);
      ctx.beginPath();
      ctx.moveTo(x + 22, y);
      ctx.lineTo(width - 6, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = rgba(halo, 0.16 * m);
      ctx.beginPath();
      ctx.arc(x, y, 19 + pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = rgba(halo, 0.55 * m);
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowColor = rgba(halo, 0.95 * m);
      ctx.shadowBlur = 16;
      ctx.fillStyle = `rgba(248, 245, 255, ${(0.95 * m).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* -------------------- 7. Bootstrap -------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("dataflow-canvas");
    if (canvas) new DataFlowViz(canvas);
  });
})();
