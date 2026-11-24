/**
 * Living ASCII Lily Bouquet with organic multi-frequency sway, pointer reaction,
 * vibrant atmospheric background (nebula aura + floating dust/spores + twinkle stars),
 * and an active swarm of detailed procedural butterflies fluttering across the entire screen.
 */

const RAMP = ' .:-=+*cxoaX#%&@';
const WORLD_W = 1000;
const WORLD_H = 1100;
const FPS = 30;

const PALETTES = [
  {
    name: 'Pink Lilies',
    petal: '#f39ab2', edge: '#f9c3d2', blush: '#d99aa6', throat: '#c9dc78', vein: 'rgba(170,40,80,0.45)',
    anther: '#4a1d10', spots: true,
  },
  {
    name: 'White Lilies',
    petal: '#f6f2ea', edge: '#ffffff', blush: '#d8dcc0', throat: '#c8d87a', vein: 'rgba(120,130,90,0.4)',
    anther: '#8a3a16', spots: false,
  },
  {
    name: 'Mixed Garden',
    petal: ['#e3233a', '#d24aa9', '#f08a2a', '#e9c63c', '#f1e4c6', '#f39ab2'], edge: null,
    blush: '#c98a7a', throat: '#e8d070', vein: 'rgba(80,10,20,0.45)', anther: '#3a160a', spots: true,
  },
  {
    name: 'Twilight Blue',
    petal: ['#3b82f6', '#60a5fa', '#93c5fd', '#2563eb', '#1d4ed8'], edge: '#dbeafe',
    blush: '#1e3a8a', throat: '#38bdf8', vein: 'rgba(30,58,138,0.5)', anther: '#f59e0b', spots: true,
  }
];

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (T, start, dur) => clamp((T - start) / dur, 0, 1);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, t) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const rad = (d) => (d * Math.PI) / 180;

function rgbOf(c) {
  if (c[0] === '#') {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return c.match(/\d+/g).slice(0, 3).map(Number);
}

function mix(a, b, t) {
  const A = rgbOf(a), B = rgbOf(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}

function bez(p, t) {
  const u = 1 - t;
  return [
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
  ];
}

function bezAngle(p, t) {
  const a = bez(p, Math.max(0, t - 0.01)), b = bez(p, Math.min(1, t + 0.01));
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

const STEM_START = 0, STEM_DUR = 2.6;
const LEAF_START = 1.0;
const BUD_START = 2.2;
const BLUSH_START = 3.6;
const OPEN_START = 5.0, OPEN_GAP = 0.85, OPEN_DUR = 3.2;
const RUSCUS_START = 0.6;
const GYP_START = 2.4;

function buildScene() {
  const r = rng(11);
  const S = { stems: [], leaves: [], buds: [], ruscus: [], gyp: [] };

  const tops = [
    [310, 470, 2], [395, 360, 2], [500, 300, 3], [600, 350, 2],
    [700, 420, 2], [740, 500, 1], [350, 560, 1], [650, 560, 1],
  ];

  for (const [tx, ty, sides] of tops) {
    const bx = 485 + r() * 30;
    const stem = [[bx, 1090], [bx + (tx - bx) * 0.1, 860], [lerp(bx, tx, 0.7), ty + 220], [tx, ty]];
    const lean = (tx - 500) * 0.1;
    const stemRef = { pts: stem, start: STEM_START + r() * 0.4 };
    S.stems.push(stemRef);

    const n = 5 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const t = 0.22 + (i / n) * 0.5 + r() * 0.04;
      const side = i % 2 ? 1 : -1;
      S.leaves.push({
        stem, t, side, len: 85 + r() * 55, w: 13 + r() * 6,
        spread: rad(28 + r() * 26), start: LEAF_START + t * 1.5 + r() * 0.3, tint: r(),
      });
    }

    S.buds.push({ stem, stemRef, at: 1, ped: null, dir: rad(-90 + lean + (r() - 0.5) * 10) });
    for (let k = 0; k < sides; k++) {
      const side = k % 2 ? 1 : -1;
      const at = 0.82 + r() * 0.12;
      const base = bez(stem, at);
      const ang = rad(-90 + lean + side * (30 + r() * 25));
      const len = 40 + r() * 45;
      const end = [base[0] + Math.cos(ang) * len, base[1] + Math.sin(ang) * len];
      const ped = [base, [lerp(base[0], end[0], 0.3), base[1] - len * 0.35], [lerp(base[0], end[0], 0.8), lerp(base[1], end[1], 0.7)], end];
      S.buds.push({ stem, stemRef, at, ped, dir: ang });
    }
  }

  const order = S.buds.map((_, i) => i).sort(() => r() - 0.5);
  order.forEach((idx, rank) => {
    const b = S.buds[idx];
    b.len = 120 + r() * 40;
    b.width = 19 + r() * 5;
    b.squash = 0.6 + r() * 0.25;
    b.twist = (r() - 0.5) * 0.8;
    b.droop = rad((b.dir > rad(-90) ? 1 : -1) * (15 + r() * 20));
    b.colorIdx = rank;
    b.rnd = Array.from({ length: 12 }, r);
    b.grow = BUD_START + r() * 1.2;
    if (rank < 7) {
      b.maxOpen = 1; b.blush = 1; b.openAt = OPEN_START + rank * OPEN_GAP + r() * 0.3;
    } else if (rank < 11) {
      b.maxOpen = 0.08; b.blush = 0.8; b.openAt = OPEN_START + 2 + r() * 4;
    } else {
      b.maxOpen = 0; b.blush = 0.1 + r() * 0.2; b.openAt = Infinity; b.len *= 0.75;
    }
  });

  const rf = rng(29);
  const sprig = (base, ang, len, start, depth) => {
    const end = [base[0] + Math.cos(ang) * len, base[1] + Math.sin(ang) * len];
    const bend = (rf() - 0.5) * len * 0.3;
    const pts = [base, [lerp(base[0], end[0], 0.33) + bend, lerp(base[1], end[1], 0.33)],
      [lerp(base[0], end[0], 0.7) + bend * 0.5, lerp(base[1], end[1], 0.7)], end];
    const leaves = [];
    for (let t = 0.2 + rf() * 0.08, i = 0; t <= 1; t += 0.075 + rf() * 0.035, i++) {
      leaves.push({ t, side: i % 2 ? 1 : -1, len: 34 + rf() * 18, w: 10 + rf() * 4, tint: rf() });
    }
    leaves.push({ t: 1, side: 0, len: 46 + rf() * 16, w: 11, tint: rf() });
    S.ruscus.push({ pts, leaves, start });
    if (depth > 0) {
      for (let k = 0; k < 2; k++) {
        const t = 0.35 + rf() * 0.35;
        const p = bez(pts, t);
        const side = k ? 1 : -1;
        sprig(p, ang + side * rad(25 + rf() * 20), len * (0.4 + rf() * 0.2), start + t * 1.4, depth - 1);
      }
    }
  };

  for (const end of [[210, 560], [270, 340], [420, 215], [600, 205], [750, 320], [810, 560]]) {
    const base = [490 + rf() * 20, 820 - rf() * 40];
    const ang = Math.atan2(end[1] - base[1], end[0] - base[0]);
    sprig(base, ang, Math.hypot(end[0] - base[0], end[1] - base[1]), RUSCUS_START + rf() * 0.8, 0);
  }

  const clouds = [
    [340, 460], [660, 430], [500, 330], [280, 610], [740, 610],
    [450, 610], [590, 640], [400, 340], [620, 340], [520, 520],
  ];
  clouds.forEach(([cx, cy], ci) => {
    const base = [485 + rf() * 30, 1000 + rf() * 60];
    const start = GYP_START + ci * 0.12 + rf() * 0.4;
    const outward = Math.atan2(cy - 620, cx - 500);
    const segs = [], flowers = [];
    const branch = (x, y, ang, len, depth, t) => {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      segs.push({ x, y, x2, y2, t, w: 1.5 + depth * 0.8 });
      const t2 = t + 0.18;
      if (depth === 0) {
        flowers.push({ x: x2, y: y2, s: 4.5 + rf() * 3.5, t: t2 + rf() * 0.3, puffs: 2 + Math.floor(rf() * 2) });
        return;
      }
      if (depth < 3 && rf() < 0.75) flowers.push({ x: x2, y: y2, s: 3.5 + rf() * 2.5, t: t2 + rf() * 0.3, puffs: 1 });
      const kids = 2 + (rf() < 0.45 ? 1 : 0);
      for (let k = 0; k < kids; k++) {
        const spread = rad(lerp(-70, 70, kids === 1 ? 0.5 : k / (kids - 1)) + (rf() - 0.5) * 30);
        const target = lerp(ang + spread, outward, 0.25);
        branch(x2, y2, target, len * (0.4 + rf() * 0.45), depth - 1, t2);
      }
    };
    branch(cx, cy + 40, outward * 0.5 - Math.PI / 4, 40 + rf() * 10, 4, 0.6);
    S.gyp.push({ main: [[base[0], base[1]], [lerp(base[0], cx, 0.2), lerp(base[1], cy, 0.5)], [lerp(base[0], cx, 0.8), cy + 60], [cx, cy + 40]], segs, flowers, start, front: ci % 2 === 1 });
  });

  return S;
}

export class BouquetExperience {
  /**
   * @param {HTMLCanvasElement} screen
   */
  constructor(screen) {
    this.screen = screen;
    this.sctx = /** @type {CanvasRenderingContext2D} */ (screen.getContext('2d'));
    this.off = document.createElement('canvas');
    this.octx = /** @type {CanvasRenderingContext2D} */ (this.off.getContext('2d', { willReadFrequently: true }));

    this.styleCache = new Map();
    this.palette = 0;
    this.T = 0;
    this.t0 = performance.now();
    this.last = 0;
    this.running = false;
    this.rafId = 0;

    // Organic dual-spring cursor physics for ultra-smooth reactive swaying
    this.pointerX = 500;
    this.pointerY = 550;
    this.targetPointerX = 500;
    this.targetPointerY = 550;
    this.interactiveBendX = 0;
    this.interactiveBendVelX = 0;
    this.lastPointerX = 500;
    this.lastPointerY = 550;

    this.S = buildScene();

    // Floating glowing dust / fireflies / spores (dense & luminous)
    const sporeHues = ['#ffb7d5', '#bae6fd', '#fef08a', '#e9d5ff', '#a7f3d0'];
    this.spores = Array.from({ length: 85 }, () => ({
      x: Math.random() * WORLD_W,
      y: Math.random() * WORLD_H,
      baseX: Math.random() * WORLD_W,
      speedY: 0.2 + Math.random() * 0.55,
      radius: 1.8 + Math.random() * 4.2,
      phase: Math.random() * Math.PI * 2,
      freq: 0.3 + Math.random() * 0.9,
      hue: sporeHues[Math.floor(Math.random() * sporeHues.length)],
      alpha: 0.35 + Math.random() * 0.55,
    }));

    // Twinkling background star cluster
    this.stars = Array.from({ length: 48 }, () => ({
      x: Math.random() * WORLD_W,
      y: Math.random() * WORLD_H,
      size: 1.2 + Math.random() * 2.2,
      twinkleSpeed: 1.5 + Math.random() * 3.5,
      phase: Math.random() * Math.PI * 2,
    }));

    // Swarm of 10 diverse procedural butterflies fluttering across the entire screen
    const butterflyThemes = [
      { primary: '#ff69b4', secondary: '#ffe4f0', trim: '#610a2f' }, // Rose Pink
      { primary: '#38bdf8', secondary: '#f0f9ff', trim: '#0c4a6e' }, // Sky Blue
      { primary: '#fbbf24', secondary: '#fefce8', trim: '#713f12' }, // Amber Gold
      { primary: '#c084fc', secondary: '#faf5ff', trim: '#581c87' }, // Royal Lavender
      { primary: '#34d399', secondary: '#ecfdf5', trim: '#064e3b' }, // Mint Emerald
      { primary: '#fb7185', secondary: '#fff1f2', trim: '#881337' }, // Coral Flame
      { primary: '#818cf8', secondary: '#eef2ff', trim: '#312e81' }, // Periwinkle
      { primary: '#f472b6', secondary: '#fdf2f8', trim: '#831843' }, // Magenta Peach
      { primary: '#2dd4bf', secondary: '#f0fdfa', trim: '#134e4a' }, // Ocean Aqua
      { primary: '#fb923c', secondary: '#fff7ed', trim: '#7c2d12' }, // Tiger Orange
    ];

    this.butterflies = butterflyThemes.map((theme, i) => ({
      x: 100 + Math.random() * (WORLD_W - 200),
      y: 80 + Math.random() * (WORLD_H - 260),
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      targetX: 100 + Math.random() * (WORLD_W - 200),
      targetY: 80 + Math.random() * (WORLD_H - 260),
      heading: Math.random() * Math.PI * 2,
      flapPhase: Math.random() * Math.PI * 2,
      flapSpeed: 15 + Math.random() * 8,
      size: 13 + (i % 4) * 2.5,
      colorPrimary: theme.primary,
      colorSecondary: theme.secondary,
      colorTrim: theme.trim,
      wingSpanRatio: 1,
      perchTime: 0,
      wanderTimer: Math.random() * 3,
      orbitRadius: 40 + Math.random() * 90,
      orbitAngle: Math.random() * Math.PI * 2,
    }));

    this.onResize = () => this.resize();
    this.onClick = (e) => this._handleClick(e);
    this.onKeyDown = (e) => this._handleKeyDown(e);

    window.addEventListener('resize', this.onResize);
    this.screen.addEventListener('click', this.onClick);
    window.addEventListener('keydown', this.onKeyDown);

    this.resize();
    this.start();
  }

  _handleClick(e) {
    this.nextPalette();
    // Butterfly panic flutter burst
    for (const bf of this.butterflies) {
      bf.vx += (Math.random() - 0.5) * 12;
      bf.vy -= 4 + Math.random() * 7;
      bf.perchTime = 0;
      bf.flapSpeed = 30;
    }
  }

  _handleKeyDown(e) {
    if (e.key === ' ' || e.key === 'r') this.replay();
    if (e.key === 'p' || e.key === 'c') this.nextPalette();
  }

  nextPalette() {
    this.palette = (this.palette + 1) % PALETTES.length;
    this._updatePaletteUI();
  }

  _updatePaletteUI() {
    const palNameEl = document.getElementById('palette-name');
    if (palNameEl) {
      palNameEl.textContent = PALETTES[this.palette].name;
    }
  }

  _style(r, g, b) {
    const key = (r << 16) | (g << 8) | b;
    let s = this.styleCache.get(key);
    if (!s) {
      s = `rgb(${r},${g},${b})`;
      this.styleCache.set(key, s);
    }
    return s;
  }

  sway(x, y) {
    // Lift factor: 0 at base (ground), 1 at highest flower tips
    const lift = Math.pow(clamp((1090 - y) / 820, 0, 1), 1.25);

    // Natural multi-frequency gentle breeze (no pointer coupling)
    const breeze1 = Math.sin(this.T * 1.1 + y * 0.005) * 11;
    const breeze2 = Math.cos(this.T * 2.1 + x * 0.006) * 5;
    const ripple = Math.sin(this.T * 3.8 + (x + y) * 0.01) * 2.2;
    const ambientSway = (breeze1 + breeze2 + ripple) * lift;

    return [x + ambientSway, y];
  }

  strokeCurve(g, pts, from, upto, width, color) {
    if (upto <= from) return;
    const N = 36;
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const p = bez(pts, lerp(from, upto, i / N));
      const q = this.sway(p[0], p[1]);
      i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]);
    }
    g.lineWidth = width;
    g.strokeStyle = color;
    g.lineCap = 'round';
    g.stroke();
  }

  stemProgress(st) {
    return easeInOut(prog(this.T, st.start, STEM_DUR));
  }

  drawLeaf(g, lf) {
    const p = easeOut(prog(this.T, lf.start, 1.4));
    if (!p) return;
    const a = bez(lf.stem, lf.t);
    const [x, y] = this.sway(a[0], a[1]);
    const ang = bezAngle(lf.stem, lf.t) + lf.side * lf.spread * (0.4 + 0.6 * p);
    const L = lf.len * p, W = lf.w * (0.4 + 0.6 * p);
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    const bend = lf.side * L * 0.18;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(L * 0.3, -W, L * 0.7, -W * 0.8 + bend * 0.5, L, bend);
    g.bezierCurveTo(L * 0.7, W * 0.8 + bend * 0.5, L * 0.3, W, 0, 0);
    const grad = g.createLinearGradient(0, 0, L, 0);
    grad.addColorStop(0, '#2e6e22');
    grad.addColorStop(0.5, lf.tint > 0.5 ? '#4c9a2e' : '#3f8a2a');
    grad.addColorStop(1, '#78bc44');
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 5;
    g.stroke();
    g.strokeStyle = 'rgba(20,60,15,0.8)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.6, bend * 0.3, L * 0.95, bend * 0.95); g.stroke();
    g.restore();
  }

  tepal(g, L, W, color, edge, throat, vein, open, curl, spots, rnd) {
    const rc = smooth(0.45, 1, open);
    const tipX = L * (1 - 0.12 * rc), tipY = curl * W * 1.6 * rc;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(L * 0.3, -W * 0.85, L * 0.72, -W * 1.05 + tipY * 0.3, tipX, tipY);
    g.bezierCurveTo(L * 0.72, W * 1.05 + tipY * 0.3, L * 0.3, W * 0.85, 0, 0);
    const grad = g.createLinearGradient(0, 0, L, 0);
    grad.addColorStop(0, throat);
    grad.addColorStop(lerp(0.45, 0.22, open), color);
    grad.addColorStop(1, edge);
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.65)';
    g.lineWidth = 6;
    g.stroke();
    g.strokeStyle = open > 0.2 ? vein : 'rgba(40,70,20,0.55)';
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(L * 0.05, 0); g.quadraticCurveTo(L * 0.6, tipY * 0.2, tipX * 0.94, tipY * 0.9); g.stroke();
    if (spots && open > 0.6) {
      g.fillStyle = `rgba(110,15,40,${(open - 0.6) * 2})`;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(L * (0.18 + rnd[i] * 0.22), (rnd[i + 4] - 0.5) * W * 0.8, 3.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  budState(b) {
    const grow = easeOut(prog(this.T, b.grow, 2.2));
    const blush = smooth(0, 1, prog(this.T, BLUSH_START + (b.grow - BUD_START), 2.5)) * b.blush;
    const open = easeInOut(prog(this.T, b.openAt, OPEN_DUR)) * b.maxOpen;
    return { grow, blush, open };
  }

  drawBud(g, b, pal) {
    const sp = this.stemProgress(b.stemRef);
    if (b.ped) {
      if (sp < b.at) return;
      const pp = easeOut(prog(this.T, b.stemRef.start + STEM_DUR * b.at, 1.0));
      this.strokeCurve(g, b.ped, 0, pp, 5, '#5f9a34');
      if (pp < 0.6) return;
    } else if (sp < 0.98) {
      return;
    }
    const { grow, blush, open } = this.budState(b);
    if (!grow) return;

    const base = b.ped ? b.ped[3] : bez(b.stem, 1);
    const [x, y] = this.sway(base[0], base[1]);
    const multi = Array.isArray(pal.petal);
    const petal = multi ? pal.petal[b.colorIdx % pal.petal.length] : pal.petal;
    const edge = pal.edge || mix(petal, '#ffffff', 0.25);

    const budCol = mix('#9cc63e', pal.blush, blush);
    const color = mix(budCol, petal, smooth(0.05, 0.45, open));
    const edgeCol = mix(mix('#b4d860', pal.blush, blush), edge, smooth(0.05, 0.45, open));
    const throat = mix('#8fbf3a', pal.throat, open);

    const L = b.len * (0.3 + 0.7 * grow) * (1 + 0.3 * open);
    const W = b.width * (0.6 + 0.4 * grow) * (1 + 1.4 * open);

    g.save();
    g.translate(x, y);
    g.rotate(b.dir + b.droop * open);
    g.scale(1, lerp(1, b.squash, open));
    g.fillStyle = '#5f9a34';
    g.beginPath(); g.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2); g.fill();
    g.rotate(b.twist * open);
    for (const k of [3, 1, -1, 2, -2, 0]) {
      g.save();
      g.rotate(rad(k * 60) * open);
      const wob = 1 + (b.rnd[(k + 3) % 12] - 0.5) * 0.12 * open;
      this.tepal(g, L * wob, W, color, edgeCol, throat, pal.vein, open, k === 0 ? 0.3 : Math.sign(k) || 1, pal.spots, b.rnd);
      g.restore();
    }
    const st = smooth(0.55, 1, open);
    if (st > 0) {
      for (let i = 0; i < 6; i++) {
        const a = rad(-28 + i * 11);
        const l = L * 0.72 * st * (0.92 + b.rnd[i] * 0.16);
        g.strokeStyle = '#d6dca8';
        g.lineWidth = 3;
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(l * 0.5, a * l * 0.3, Math.cos(a) * l, Math.sin(a) * l); g.stroke();
        g.fillStyle = pal.anther;
        g.beginPath(); g.ellipse(Math.cos(a) * l, Math.sin(a) * l, 11, 4.5, a + Math.PI / 2, 0, Math.PI * 2); g.fill();
      }
      const pl = L * 0.82 * st;
      g.strokeStyle = '#cfe0a0';
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(pl, 0); g.stroke();
      g.fillStyle = '#86a83c';
      g.beginPath(); g.arc(pl, 0, 7, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  drawRuscus(g) {
    for (const sp of this.S.ruscus) {
      const p = easeOut(prog(this.T, sp.start, 2.2));
      if (!p) continue;
      this.strokeCurve(g, sp.pts, 0, p, 4, '#4f7a34');
      for (const lf of sp.leaves) {
        const lp = easeOut(prog(p, lf.t - 0.04, 0.22));
        if (!lp) continue;
        const a = bez(sp.pts, lf.t);
        const [x, y] = this.sway(a[0], a[1]);
        g.save();
        g.translate(x, y);
        g.rotate(bezAngle(sp.pts, lf.t) + lf.side * rad(38));
        const L = lf.len * lp, W = lf.w * lp;
        g.beginPath();
        g.moveTo(0, 0);
        g.bezierCurveTo(L * 0.25, -W, L * 0.7, -W * 0.8 + lf.side * L * 0.04, L, lf.side * L * 0.08);
        g.bezierCurveTo(L * 0.7, W * 0.8 + lf.side * L * 0.04, L * 0.25, W, 0, 0);
        const grad = g.createLinearGradient(0, -W, L, W);
        grad.addColorStop(0, lf.tint > 0.5 ? '#356a2c' : '#2c5f30');
        grad.addColorStop(0.55, lf.tint > 0.5 ? '#5aa046' : '#4c9240');
        grad.addColorStop(1, '#3a7436');
        g.fillStyle = grad;
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.6)';
        g.lineWidth = 4;
        g.stroke();
        g.strokeStyle = 'rgba(150,190,110,0.5)';
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(L * 0.85, lf.side * L * 0.06); g.stroke();
        g.restore();
      }
    }
  }

  drawGyp(g, front) {
    for (const c of this.S.gyp) {
      if (c.front !== front) continue;
      const p = prog(this.T, c.start, 3.2);
      if (!p) continue;
      this.strokeCurve(g, c.main, 0, easeOut(Math.min(1, p * 3)), 3, '#6b8a4a');
      const local = p * 3.2 - 0.6;
      g.strokeStyle = '#6f8f50';
      for (const sg of c.segs) {
        const k = clamp((local - sg.t) / 0.25, 0, 1);
        if (!k) continue;
        const [x, y] = this.sway(sg.x, sg.y), [x2, y2] = this.sway(sg.x2, sg.y2);
        g.lineWidth = sg.w;
        g.beginPath(); g.moveTo(x, y); g.lineTo(lerp(x, x2, k), lerp(y, y2, k)); g.stroke();
      }
      for (const f of c.flowers) {
        const k = easeOut(clamp((local - f.t) / 0.5, 0, 1));
        if (!k) continue;
        const [x, y] = this.sway(f.x, f.y);
        const tw = 0.88 + 0.12 * Math.sin(this.T * 2.5 + f.x * 0.3);
        g.fillStyle = `rgba(252,250,244,${tw})`;
        for (let i = 0; i < f.puffs; i++) {
          g.beginPath();
          g.arc(x + (i - (f.puffs - 1) / 2) * f.s * 0.9, y - (i % 2) * f.s * 0.6, f.s * k, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }

  /**
   * Rich atmospheric background: glowing cosmic aura, twinkling stars, and floating firefly spores.
   */
  drawAtmosphere(g) {
    // 1. Center bouquet aura - wide radiant backdrop
    const bgRad1 = g.createRadialGradient(500, 480, 80, 500, 480, 750);
    bgRad1.addColorStop(0, 'rgba(170, 52, 125, 0.52)');
    bgRad1.addColorStop(0.35, 'rgba(105, 30, 115, 0.42)');
    bgRad1.addColorStop(0.7, 'rgba(48, 16, 75, 0.28)');
    bgRad1.addColorStop(1, 'rgba(12, 5, 20, 0)');
    g.fillStyle = bgRad1;
    g.beginPath();
    g.arc(500, 480, 750, 0, Math.PI * 2);
    g.fill();

    // 2. Wide luminous flanks filling screen sides
    const leftAura = g.createRadialGradient(160, 400, 40, 160, 400, 520);
    leftAura.addColorStop(0, 'rgba(236, 72, 153, 0.32)');
    leftAura.addColorStop(0.55, 'rgba(147, 51, 234, 0.22)');
    leftAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = leftAura;
    g.beginPath();
    g.arc(160, 400, 520, 0, Math.PI * 2);
    g.fill();

    const rightAura = g.createRadialGradient(840, 420, 40, 840, 420, 520);
    rightAura.addColorStop(0, 'rgba(56, 189, 248, 0.3)');
    rightAura.addColorStop(0.55, 'rgba(129, 140, 248, 0.22)');
    rightAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = rightAura;
    g.beginPath();
    g.arc(840, 420, 520, 0, Math.PI * 2);
    g.fill();

    // 3. Top and bottom ambient atmospheric tints
    const topAura = g.createRadialGradient(500, 120, 20, 500, 120, 460);
    topAura.addColorStop(0, 'rgba(251, 146, 60, 0.18)');
    topAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = topAura;
    g.beginPath();
    g.arc(500, 120, 460, 0, Math.PI * 2);
    g.fill();

    // 3. Twinkling celestial stars
    for (const st of this.stars) {
      const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(this.T * st.twinkleSpeed + st.phase));
      g.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
      g.beginPath();
      g.arc(st.x, st.y, st.size, 0, Math.PI * 2);
      g.fill();
    }

    // 4. Floating fireflies / pollen spores across the canvas
    for (const sp of this.spores) {
      sp.y -= sp.speedY;
      if (sp.y < -30) {
        sp.y = WORLD_H + 30;
        sp.baseX = Math.random() * WORLD_W;
      }
      const waveX = Math.sin(this.T * sp.freq + sp.phase) * 45;
      const x = sp.baseX + waveX;
      const pulse = 0.65 + 0.35 * Math.sin(this.T * 2.2 + sp.phase);

      g.fillStyle = sp.hue;
      g.globalAlpha = sp.alpha * pulse;
      g.beginPath();
      g.arc(x, sp.y, sp.radius * pulse, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1.0;
  }

  /**
   * Swarm of butterflies navigating across full screen with detailed wing geometry.
   */
  updateAndDrawButterflies(g) {
    const bouquetHotspots = [
      [360, 360], [500, 270], [640, 340], [330, 480],
      [710, 430], [500, 490], [420, 600], [580, 580]
    ];

    for (let bi = 0; bi < this.butterflies.length; bi++) {
      const bf = this.butterflies[bi];
      bf.wanderTimer += 0.033;

      // Regular target switching: mix between flower nectar and wide flight arcs
      if (bf.wanderTimer > 2.8 + (bi % 3) * 1.1) {
        bf.wanderTimer = 0;
        if (Math.random() < 0.45) {
          // Fly to a flower hotspot
          const pt = bouquetHotspots[Math.floor(Math.random() * bouquetHotspots.length)];
          bf.targetX = pt[0] + (Math.random() - 0.5) * 90;
          bf.targetY = pt[1] + (Math.random() - 0.5) * 70;
          if (Math.random() < 0.3) {
            bf.perchTime = 1.4 + Math.random() * 2.0;
          }
        } else {
          // Roam freely anywhere across the canvas width & height
          bf.targetX = 60 + Math.random() * (WORLD_W - 120);
          bf.targetY = 60 + Math.random() * (WORLD_H - 160);
          bf.perchTime = 0;
        }
      }

      const isPerched = bf.perchTime > 0;
      if (isPerched) {
        bf.perchTime -= 0.033;
        bf.flapSpeed = 5; // Gentle resting flutter
        bf.vx *= 0.85;
        bf.vy *= 0.85;
      } else {
        bf.flapSpeed = 16 + (bi % 4) * 2;
        const toTargetX = bf.targetX - bf.x;
        const toTargetY = bf.targetY - bf.y;
        const dist = Math.hypot(toTargetX, toTargetY);
        const speed = clamp(dist * 0.038, 1.4, 5.2);

        const desiredVx = (toTargetX / (dist || 1)) * speed;
        const desiredVy = (toTargetY / (dist || 1)) * speed;

        bf.vx += (desiredVx - bf.vx) * 0.06;
        bf.vy += (desiredVy - bf.vy) * 0.06;

        // Flutter bounce motion
        bf.vy += Math.sin(bf.flapPhase * 2.0) * 0.85;
        bf.vx += Math.cos(bf.flapPhase * 1.4) * 0.55;
      }

      bf.x += bf.vx;
      bf.y += bf.vy;

      // Wrap-around screen bounds for continuous lively movement
      if (bf.x < 30) bf.x = WORLD_W - 40;
      if (bf.x > WORLD_W - 30) bf.x = 40;
      if (bf.y < 30) bf.y = WORLD_H - 120;
      if (bf.y > WORLD_H - 100) bf.y = 50;

      bf.flapPhase += bf.flapSpeed * 0.033;
      const flapAngle = Math.sin(bf.flapPhase);
      const wingSpan = Math.abs(flapAngle) * 0.92 + 0.08;

      const targetHeading = Math.atan2(bf.vy, bf.vx) + Math.PI / 2;
      bf.heading += (targetHeading - bf.heading) * 0.14;

      // DRAW DETAILED BUTTERFLY
      g.save();
      g.translate(bf.x, bf.y);
      g.rotate(bf.heading);

      const S = bf.size;

      for (const side of [-1, 1]) {
        g.save();
        g.scale(side * wingSpan, 1);

        // Forewing
        g.beginPath();
        g.moveTo(0, -S * 0.2);
        g.bezierCurveTo(S * 1.1, -S * 1.45, S * 1.85, -S * 0.7, S * 1.4, S * 0.1);
        g.bezierCurveTo(S * 1.0, S * 0.5, S * 0.3, S * 0.2, 0, 0);

        const wingGrad = g.createRadialGradient(S * 0.6, -S * 0.5, 2, S * 0.8, -S * 0.6, S * 1.6);
        wingGrad.addColorStop(0, bf.colorSecondary);
        wingGrad.addColorStop(0.55, bf.colorPrimary);
        wingGrad.addColorStop(1, bf.colorTrim);
        g.fillStyle = wingGrad;
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.65)';
        g.lineWidth = 2.2;
        g.stroke();

        // Forewing veins
        g.strokeStyle = 'rgba(255,255,255,0.45)';
        g.lineWidth = 1.1;
        g.beginPath();
        g.moveTo(0, -S * 0.2);
        g.quadraticCurveTo(S * 0.6, -S * 0.6, S * 1.3, -S * 0.8);
        g.moveTo(0, -S * 0.2);
        g.quadraticCurveTo(S * 0.7, -S * 0.3, S * 1.2, -S * 0.2);
        g.stroke();

        // Hindwing
        g.beginPath();
        g.moveTo(0, 0);
        g.bezierCurveTo(S * 0.6, S * 0.2, S * 1.2, S * 0.7, S * 0.8, S * 1.35);
        g.bezierCurveTo(S * 0.4, S * 1.6, S * 0.1, S * 1.1, 0, S * 0.4);

        const hindGrad = g.createRadialGradient(S * 0.4, S * 0.5, 2, S * 0.5, S * 0.7, S * 1.1);
        hindGrad.addColorStop(0, bf.colorSecondary);
        hindGrad.addColorStop(0.6, bf.colorPrimary);
        hindGrad.addColorStop(1, bf.colorTrim);
        g.fillStyle = hindGrad;
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.65)';
        g.lineWidth = 1.8;
        g.stroke();

        // Edge spots
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(S * 1.25, -S * 0.5, 1.5, 0, Math.PI * 2);
        g.arc(S * 0.75, S * 1.2, 1.3, 0, Math.PI * 2);
        g.fill();

        g.restore();
      }

      // Thorax & Abdomen
      g.fillStyle = '#1c151b';
      g.beginPath();
      g.ellipse(0, S * 0.2, S * 0.13, S * 0.55, 0, 0, Math.PI * 2);
      g.fill();

      // Head
      g.beginPath();
      g.arc(0, -S * 0.35, S * 0.14, 0, Math.PI * 2);
      g.fill();

      // Antennae
      g.strokeStyle = 'rgba(235, 235, 235, 0.85)';
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(-S * 0.06, -S * 0.4);
      g.quadraticCurveTo(-S * 0.3, -S * 0.9, -S * 0.55, -S * 0.85);
      g.moveTo(S * 0.06, -S * 0.4);
      g.quadraticCurveTo(S * 0.3, -S * 0.9, S * 0.55, -S * 0.85);
      g.stroke();

      g.restore();
    }
  }

  drawScene(g, pal) {
    this.drawAtmosphere(g);
    this.drawRuscus(g);
    this.drawGyp(g, false);
    for (const st of this.S.stems) this.strokeCurve(g, st.pts, 0, this.stemProgress(st), 9, '#5a9a30');
    for (const lf of this.S.leaves) this.drawLeaf(g, lf);
    const sorted = this.S.buds.slice().sort((a, b) => this.budState(a).open - this.budState(b).open || (a.openAt - b.openAt || 0));
    for (const b of sorted) this.drawBud(g, b, pal);
    this.drawGyp(g, true);
    this.updateAndDrawButterflies(g);
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.fontSize = clamp(Math.floor(Math.min(w / 100, h / 85)), 5, 11);
    this.sctx.font = `bold ${this.fontSize}px Menlo, Consolas, "DejaVu Sans Mono", monospace`;
    this.cellW = this.sctx.measureText('M').width || this.fontSize * 0.6;
    this.cellH = this.fontSize;
    this.screen.width = Math.floor(w * this.dpr);
    this.screen.height = Math.floor(h * this.dpr);
    this.cols = Math.ceil(w / this.cellW);
    this.rows = Math.ceil(h / this.cellH);
    this.off.width = this.cols;
    this.off.height = this.rows;
  }

  render(pal) {
    const { cols, rows, cellW, cellH, dpr, sctx, octx, off, screen } = this;
    if (!cols || !rows) return;

    const aspect = cellH / cellW;
    const sx = Math.min(cols / WORLD_W, (rows * aspect) / WORLD_H) * 0.96;
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.fillStyle = '#000';
    octx.fillRect(0, 0, cols, rows);
    octx.setTransform(sx, 0, 0, sx / aspect, (cols - WORLD_W * sx) / 2, (rows - (WORLD_H * sx) / aspect) / 2);

    this.drawScene(octx, pal);

    const data = octx.getImageData(0, 0, cols, rows).data;
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.fillStyle = '#000';
    sctx.fillRect(0, 0, screen.width, screen.height);

    // Warm luminous bloom underneath ASCII glyphs
    sctx.save();
    sctx.globalAlpha = 0.52;
    sctx.filter = `blur(${Math.round(cellH * 0.5)}px)`;
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(off, 0, 0, cols * cellW, rows * cellH);
    sctx.restore();

    sctx.textBaseline = 'top';
    const n = RAMP.length - 1;
    const flick = Math.floor(this.T * 8);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const m = Math.max(r, g, b);
        if (m < 10) continue;
        const v = m / 255;
        const h = ((x * 73856093) ^ (y * 19349663) ^ (flick * 83492791)) >>> 0;
        const j = h % 7 === 0 ? (h & 8 ? 1 : -1) : 0;
        const idx = clamp(Math.round(Math.pow(v, 0.65) * n) + j, 1, n);
        const k = Math.min(1.3, (45 + 210 * v) / m);
        sctx.fillStyle = this._style(Math.min(255, (r * k) | 0) & 0xf8, Math.min(255, (g * k) | 0) & 0xf8, Math.min(255, (b * k) | 0) & 0xf8);
        sctx.fillText(RAMP[idx], x * cellW, y * cellH);
      }
    }
  }

  frame(now) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame((n) => this.frame(n));
    if (now - this.last < 1000 / FPS) return;
    this.last = now;
    this.T = (now - this.t0) / 1000;
    this.render(PALETTES[this.palette]);
  }

  replay() {
    this.t0 = performance.now();
    this.S = buildScene();
    this._updatePaletteUI();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    this.rafId = requestAnimationFrame((n) => this.frame(n));
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    this.screen.removeEventListener('click', this.onClick);
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
