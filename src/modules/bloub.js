/*
 * Bloub — 1:1 原生 JS 移植自 D:\EdgeDownload\bloub-main\bloub-main 的 src/bot/* 引擎。
 * 纯函数动画引擎 sample(t)（呼吸 / 眨眼 / 眼神漂移 / 形态 morph / 3D 轨道弧线）。
 * 暴露全局 Bloub：mount(动画球) 与 static(静态球字符串)。
 */
(function () {
  'use strict';

  /* ================================================================ math.ts */
  const TAU = Math.PI * 2;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const r2 = (v) => Math.round(v * 100) / 100;
  const n = r2; // 渲染用短名

  const easings = {
    easeOutCubic: (t) => 1 - (1 - t) ** 3,
    easeInOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
    easeOutQuint: (t) => 1 - (1 - t) ** 5
  };

  function loopNoise(t, period, seed = 0) {
    const p = (t / period) * TAU;
    return (
      0.55 * Math.sin(p + seed) +
      0.3 * Math.sin(2 * p + seed * 1.7 + 1.1) +
      0.15 * Math.sin(3 * p + seed * 2.3 + 2.4)
    );
  }

  function createRng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* =============================================================== repere.ts */
  const RAYON = 100;
  const DEMI_VIEWBOX = 158;

  /* ============================================================ profiles.ts */
  const PROFILE_SAMPLES = 64;
  const PROFILES = {
    egg: [0.8369,0.8424,0.8497,0.8585,0.8674,0.8775,0.8878,0.8983,0.9089,0.9185,0.9288,0.9374,0.9445,0.9504,0.9543,0.9559,0.9555,0.9519,0.9466,0.9389,0.9302,0.9193,0.9085,0.8969,0.8852,0.8734,0.8625,0.8513,0.8411,0.8325,0.8243,0.8179,0.8137,0.8112,0.8102,0.8128,0.8178,0.8262,0.8374,0.8518,0.8702,0.8922,0.9169,0.9446,0.9741,1.0023,1.0267,1.0433,1.0481,1.0393,1.0216,0.9970,0.9697,0.9418,0.9169,0.8949,0.8760,0.8604,0.8490,0.8394,0.8337,0.8314,0.8305,0.8326],
    hexagon: [0.9210,0.9282,0.9441,0.9706,0.9984,1.0059,0.9896,0.9562,0.9290,0.9124,0.9047,0.9058,0.9157,0.9349,0.9642,0.9873,0.9882,0.9665,0.9336,0.9105,0.8968,0.8918,0.8955,0.9080,0.9293,0.9611,0.9820,0.9812,0.9590,0.9282,0.9089,0.8978,0.8964,0.9026,0.9189,0.9439,0.9778,0.9990,0.9964,0.9713,0.9439,0.9274,0.9196,0.9206,0.9308,0.9502,0.9799,1.0121,1.0226,1.0071,0.9752,0.9510,0.9366,0.9316,0.9351,0.9485,0.9711,1.0026,1.0213,1.0155,0.9863,0.9547,0.9347,0.9232],
    triangle: [0.7819,0.8211,0.8747,0.9440,1.0223,1.0960,1.1401,1.1340,1.0808,1.0047,0.9265,0.8603,0.8104,0.7730,0.7450,0.7273,0.7151,0.7118,0.7148,0.7245,0.7427,0.7680,0.8037,0.8518,0.9148,0.9876,1.0583,1.1073,1.1109,1.0667,0.9940,0.9164,0.8482,0.7948,0.7555,0.7261,0.7056,0.6925,0.6859,0.6869,0.6938,0.7084,0.7305,0.7615,0.8040,0.8595,0.9311,1.0092,1.0791,1.1171,1.1054,1.0501,0.9779,0.9050,0.8450,0.7990,0.7656,0.7413,0.7258,0.7160,0.7146,0.7204,0.7330,0.7528]
  };

  /* =============================================================== shape.ts */
  const ANGLES = Array.from({ length: PROFILE_SAMPLES }, (_, i) => (i / PROFILE_SAMPLES) * TAU);
  const COS = ANGLES.map(Math.cos);
  const SIN = ANGLES.map(Math.sin);

  function silhouette(name, pose = {}) {
    return {
      radii: [...PROFILES[name]],
      rot: 0, cx: 0, cy: 0, sx: 1, sy: 1,
      ...pose
    };
  }

  function circle(radius, pose = {}) {
    return {
      radii: new Array(PROFILE_SAMPLES).fill(radius),
      rot: 0, cx: 0, cy: 0, sx: 1, sy: 1,
      ...pose
    };
  }

  function blend(a, b, t, out) {
    const dst = out || { radii: new Array(PROFILE_SAMPLES), rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 };
    for (let i = 0; i < PROFILE_SAMPLES; i++) {
      dst.radii[i] = lerp(a.radii[i] !== undefined ? a.radii[i] : 1, b.radii[i] !== undefined ? b.radii[i] : 1, t);
    }
    let dRot = b.rot - a.rot;
    while (dRot > Math.PI) dRot -= TAU;
    while (dRot < -Math.PI) dRot += TAU;
    dst.rot = a.rot + dRot * t;
    dst.cx = lerp(a.cx, b.cx, t);
    dst.cy = lerp(a.cy, b.cy, t);
    dst.sx = lerp(a.sx, b.sx, t);
    dst.sy = lerp(a.sy, b.sy, t);
    return dst;
  }

  function toPoints(s, scale, out = []) {
    const cr = Math.cos(s.rot);
    const sr = Math.sin(s.rot);
    for (let i = 0; i < PROFILE_SAMPLES; i++) {
      const r = s.radii[i] !== undefined ? s.radii[i] : 1;
      const x = r * (COS[i] || 0);
      const y = r * (SIN[i] || 0);
      const rx = x * cr - y * sr;
      const ry = x * sr + y * cr;
      const p = out[i] || { x: 0, y: 0 };
      p.x = (rx * s.sx + s.cx) * scale;
      p.y = (ry * s.sy + s.cy) * scale;
      out[i] = p;
    }
    out.length = PROFILE_SAMPLES;
    return out;
  }

  function closedPath(pts, tension = 1 / 6) {
    const nP = pts.length;
    if (nP < 3) return '';
    const first = pts[0];
    let d = `M${r2(first.x)} ${r2(first.y)}`;
    for (let i = 0; i < nP; i++) {
      const p0 = pts[(i - 1 + nP) % nP];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % nP];
      const p3 = pts[(i + 2) % nP];
      const c1x = p1.x + (p2.x - p0.x) * tension;
      const c1y = p1.y + (p2.y - p0.y) * tension;
      const c2x = p2.x - (p3.x - p1.x) * tension;
      const c2y = p2.y - (p3.y - p1.y) * tension;
      d += `C${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2.x)} ${r2(p2.y)}`;
    }
    return `${d}Z`;
  }

  function profileFromPolygon(poly, cx, cy) {
    const radii = new Array(PROFILE_SAMPLES).fill(0);
    const nP = poly.length;
    for (let k = 0; k < PROFILE_SAMPLES; k++) {
      const dx = COS[k] || 0;
      const dy = SIN[k] || 0;
      let best = 0;
      for (let i = 0; i < nP; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % nP];
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const px = a.x - cx;
        const py = a.y - cy;
        const t = (px * ey - py * ex) / den;
        const u = (px * dy - py * dx) / den;
        if (t > best && u >= 0 && u <= 1) best = t;
      }
      radii[k] = best;
    }
    return radii;
  }

  function hullOfCircles(x1, y1, r1, x2, y2, r2v, steps = 96) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy) || 1e-6;
    const base = Math.atan2(dy, dx);
    const spread = Math.acos(Math.max(-1, Math.min(1, (r1 - r2v) / dist)));
    const pts = [];
    for (let i = 0; i <= steps / 2; i++) {
      const a = base + spread + ((TAU - 2 * spread) * i) / (steps / 2);
      pts.push({ x: x1 + Math.cos(a) * r1, y: y1 + Math.sin(a) * r1 });
    }
    for (let i = 0; i <= steps / 2; i++) {
      const a = base - spread + ((2 * spread) * i) / (steps / 2);
      pts.push({ x: x2 + Math.cos(a) * r2v, y: y2 + Math.sin(a) * r2v });
    }
    return pts;
  }

  function radiusAtAngle(radii, angle) {
    const nR = radii.length;
    const t = ((((angle / TAU) % 1) + 1) % 1) * nR;
    const i = Math.floor(t);
    return lerp(radii[i % nR] !== undefined ? radii[i % nR] : 1, radii[(i + 1) % nR] !== undefined ? radii[(i + 1) % nR] : 1, t - i);
  }

  function superellipseProfile(nn, sx = 1, sy = 1) {
    return ANGLES.map((_, i) => {
      const c = Math.abs((COS[i] || 0) / sx) ** nn;
      const s = Math.abs((SIN[i] || 0) / sy) ** nn;
      return (c + s) ** (-1 / nn);
    });
  }

  function unionOfCirclesProfile(circles) {
    const out = new Array(PROFILE_SAMPLES).fill(0);
    for (let i = 0; i < PROFILE_SAMPLES; i++) {
      const dx = COS[i] || 0;
      const dy = SIN[i] || 0;
      let best = 0;
      for (const c of circles) {
        const b = dx * c.x + dy * c.y;
        const disc = b * b - (c.x * c.x + c.y * c.y - c.r * c.r);
        if (disc < 0) continue;
        const t = b + Math.sqrt(disc);
        if (t > best) best = t;
      }
      out[i] = best;
    }
    return out;
  }

  function roundedPolygon(verts, rc, arcSteps = 10) {
    const nP = verts.length;
    const out = [];
    const normal = (a, b) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      return Math.atan2(-dx / len, dy / len);
    };
    for (let i = 0; i < nP; i++) {
      const prev = verts[(i - 1 + nP) % nP];
      const cur = verts[i];
      const next = verts[(i + 1) % nP];
      const a0 = normal(prev, cur);
      const a1 = normal(cur, next);
      let d = a1 - a0;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      for (let k = 0; k <= arcSteps; k++) {
        const a = a0 + (d * k) / arcSteps;
        out.push({ x: cur.x + Math.cos(a) * rc, y: cur.y + Math.sin(a) * rc });
      }
    }
    return out;
  }

  function regularPolygonProfile(sides, radius, rc, rotationDeg = 0) {
    const rot = (rotationDeg * Math.PI) / 180;
    const verts = Array.from({ length: sides }, (_, i) => {
      const a = rot + (i / sides) * TAU;
      return { x: Math.cos(a) * (radius - rc), y: Math.sin(a) * (radius - rc) };
    });
    return profileFromPolygon(roundedPolygon(verts, rc), 0, 0);
  }

  function polyPath(pts, scale = 1) {
    if (pts.length < 3) return '';
    let d = '';
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      d += `${i === 0 ? 'M' : 'L'}${r2(p.x * scale)} ${r2(p.y * scale)}`;
    }
    return `${d}Z`;
  }

  function capsulePath(w, h) {
    const hw = Math.max(w, 0.01) / 2;
    const hh = Math.max(h, 0.01) / 2;
    const r = Math.min(hw, hh);
    return (
      `M${r2(-hw)} ${r2(-hh + r)}` +
      `A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw + r)} ${r2(-hh)}` +
      `L${r2(hw - r)} ${r2(-hh)}` +
      `A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw)} ${r2(-hh + r)}` +
      `L${r2(hw)} ${r2(hh - r)}` +
      `A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw - r)} ${r2(hh)}` +
      `L${r2(-hw + r)} ${r2(hh)}` +
      `A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw)} ${r2(hh - r)}Z`
    );
  }

  /* ================================================================ skins.ts */
  function normalize(radii, max = 1) {
    const peak = Math.max(...radii);
    if (peak <= 0) return radii;
    const k = max / peak;
    return radii.map((r) => r * k);
  }

  const pebble = normalize(
    ANGLES.map((a) => 1 + 0.075 * Math.cos(2 * a + 0.5) + 0.035 * Math.cos(3 * a + 2.1)),
    1.02
  );

  const cloud = normalize(
    unionOfCirclesProfile([
      { x: -0.44, y: 0.2, r: 0.54 },
      { x: 0.46, y: 0.2, r: 0.5 },
      { x: 0.02, y: 0.3, r: 0.6 },
      { x: -0.24, y: -0.3, r: 0.48 },
      { x: 0.3, y: -0.24, r: 0.44 }
    ]),
    1.02
  );

  const droplet = normalize(
    profileFromPolygon(hullOfCircles(0, 0.28, 0.66, 0, -0.96, 0.05), 0, 0),
    1.04
  );

  const capsuleRadii = profileFromPolygon(hullOfCircles(-0.42, 0, 0.62, 0.42, 0, 0.62), 0, 0);

  const SHAPES = [
    { id: 'cercle', radii: new Array(PROFILE_SAMPLES).fill(1) },
    { id: 'galet', radii: pebble },
    { id: 'squircle', radii: normalize(superellipseProfile(4.2), 1.15) },
    { id: 'capsule', radii: capsuleRadii },
    { id: 'triangle', radii: regularPolygonProfile(3, 1.12, 0.34, -90) },
    { id: 'hexagone', radii: regularPolygonProfile(6, 1.04, 0.26, 0) },
    /* 正方形：rot=45 让平面朝上/下/左/右（而非菱形）。
       平面外伸 = (1.3-0.24)*cos45 + 0.24 ≈ 0.99，与 cercle 等宽；角点 1.3 < DEMI_VIEWBOX 不裁切。 */
    { id: 'carre', radii: regularPolygonProfile(4, 1.3, 0.24, 45) },
    { id: 'nuage', radii: cloud },
    { id: 'goutte', radii: droplet }
  ];
  const SHAPE_BY_ID = new Map(SHAPES.map((s) => [s.id, s]));
  const DEFAULT_SHAPE = 'cercle';

  /* 调色板单一来源：共享层 window.BallCore.COLORS（P1-1，已在三页于 bloub.js 之前加载） */
  const COLORS = window.BallCore.COLORS;
  const COLOR_BY_ID = new Map(COLORS.map((c) => [c.id, c]));
  const DEFAULT_COLOR = 'encre';

  /* 颜色插值单一实现：共享层 window.BallCore.mixHex（P1-1，数学等价，调用点零改动） */
  const mixHex = window.BallCore.mixHex;

  /* ================================================================ decor.ts */
  function wheel(hue, s = 0.55, l = 0.62) {
    const h = ((hue % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    const hex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${hex(rgb[0])}${hex(rgb[1])}${hex(rgb[2])}`;
  }

  function arcRender(seed, t, scale, id, opacity = 1) {
    const spin = seed.phase + t * seed.speed * TAU;
    const cu = Math.cos(seed.tilt);
    const su = Math.sin(seed.tilt);
    const kz = Math.sqrt(Math.max(0, 1 - seed.k * seed.k));

    const N = 64;
    const span = seed.sweep * TAU;
    let front = '';
    let back = '';
    let prev = null;

    for (let i = 0; i <= N; i++) {
      const th = spin + (i / N) * span;
      const ct = Math.cos(th);
      const st = Math.sin(th);
      const x = seed.a * (ct * cu + st * -su * seed.k) + seed.cx;
      const y = seed.a * (ct * su + st * cu * seed.k) + seed.cy;
      const z = seed.a * st * kz;
      const behind = z < 0;
      const sx = r2(x * scale);
      const sy = r2(y * scale);
      const cmd = behind !== prev ? 'M' : 'L';
      if (behind) back += `${cmd}${sx} ${sy}`;
      else front += `${cmd}${sx} ${sy}`;
      prev = behind;
    }

    const gx = Math.cos(seed.tilt) * seed.a * scale;
    const gy = Math.sin(seed.tilt) * seed.a * scale;
    return {
      id,
      front,
      back,
      width: seed.width * scale,
      opacity,
      grad: {
        x1: r2(seed.cx * scale - gx),
        y1: r2(seed.cy * scale - gy),
        x2: r2(seed.cx * scale + gx),
        y2: r2(seed.cy * scale + gy),
        stops: [wheel(seed.hue), wheel(seed.hue + seed.hueSpan * 0.5), wheel(seed.hue + seed.hueSpan)]
      }
    };
  }

  const RING_RNG = createRng(0xa11ce);
  const RINGS = Array.from({ length: 6 }, (_, i) => ({
    a: 1.3 + RING_RNG() * 0.1,
    k: 0.05 + RING_RNG() * 0.4,
    tilt: (i / 6) * Math.PI + RING_RNG() * 0.5,
    speed: 3 + RING_RNG() * 0.7,
    phase: RING_RNG() * TAU,
    sweep: 0.6 + RING_RNG() * 0.25,
    hue: (i * 360) / 6 + RING_RNG() * 30,
    hueSpan: 60 + RING_RNG() * 60,
    width: 0.05 + RING_RNG() * 0.012,
    cx: 0,
    cy: 0.1
  }));

  const SWOOSH = Array.from({ length: 4 }, (_, i) => ({
    a: 0.78 + i * 0.2,
    k: 0.05 + i * 0.02,
    tilt: -0.62 + i * 0.05,
    speed: 0.3,
    phase: 0.06 * i,
    sweep: 0.4,
    hue: 95 + i * 62,
    hueSpan: 100,
    width: 0.05,
    cx: 0,
    cy: -0.12
  }));

  const DOT_X = [-0.557, -0.013, 0.532];
  const DOT_R = 0.165;
  const DOT_PEAK = 1.25;

  const P_RNG = createRng(0xbeef);
  const PARTICLES = Array.from({ length: 5 }, (_, i) => ({
    birth: i * 0.2,
    angle: P_RNG() * TAU,
    rho: 0.58 + P_RNG() * 0.18
  }));

  function particles(t, scale) {
    const out = [];
    for (const p of PARTICLES) {
      const u = t - p.birth;
      if (u < 0 || u > 0.62) continue;
      const rho = p.rho * Math.pow(0.75, u * 10);
      const a = p.angle + (u * 100 * Math.PI) / 180;
      out.push({
        x: Math.cos(a) * rho * scale,
        y: Math.sin(a) * rho * scale,
        r: (0.04 + 0.028 * clamp(u / 0.55)) * scale,
        depth: clamp(1 - rho / 0.8),
        opacity: clamp(u / 0.06) * clamp((0.62 - u) / 0.08)
      });
    }
    return out;
  }

  const COMET_RNG = createRng(0xc0e7);
  const COMET_RIBBONS = Array.from({ length: 4 }, (_, i) => {
    const d = i - 1.5;
    return {
      a: 0.85 * (1 + d * 0.03),
      k: (0.15 / 0.85) * (1 + d * 0.16),
      tilt: (34 * Math.PI) / 180 + d * 0.035,
      speed: 210 / 360,
      phase: -i * 0.045 + COMET_RNG() * 0.012,
      sweep: 0.34,
      hue: i * 85 + COMET_RNG() * 20,
      hueSpan: 80,
      width: 0.095,
      cx: 0,
      cy: 0
    };
  });

  const COMET_DOT = 0.129;
  const NOTIF_BLUE = '#2496e8';
  const NOTIF_ANGLE = -42;
  const NOTIF_DIST = 1.003;
  const NOTIF_R = 0.15;
  const NOTIF_POP = 1.14;
  const NOTIF_MARGIN = 0.054;

  /* ================================================================= face.ts */
  const EYE_SPLIT = 15.46;
  const EYE_W = 0.186;
  const EYE_H = 0.412;
  const REST_GAZE = { yaw: 28.49, pitch: 28.62, roll: -13 };

  const deg = (d) => (d * Math.PI) / 180;

  function spin(u, v, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
      [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s],
      [v[0] * c - u[0] * s, v[1] * c - u[1] * s, v[2] * c - u[2] * s]
    ];
  }

  function eyePoses(gaze, scale, split = EYE_SPLIT) {
    let f = [0, 0, 1];
    let right = [1, 0, 0];
    let down = [0, 1, 0];

    [f, right] = spin(f, right, deg(gaze.yaw));
    [down, f] = spin(down, f, deg(gaze.pitch));
    [right, down] = spin(right, down, deg(gaze.roll));

    const build = (side) => {
      const [ef, er] = spin(f, right, deg(split * side));
      return {
        x: ef[0] * scale,
        y: ef[1] * scale,
        a: er[0],
        b: er[1],
        c: down[0],
        d: down[1],
        depth: ef[2]
      };
    };

    return [build(-1), build(1)];
  }

  const BLINK_RNG = createRng(0x5eed);
  const BLINKS = (() => {
    const out = [];
    let t = 1.4;
    while (t < 900) {
      out.push(t);
      t += 1.9 + BLINK_RNG() * 2.7;
      if (BLINK_RNG() < 0.18) {
        out.push(t);
        t += 0.24;
      }
    }
    return out;
  })();

  const BLINK_DUR = 0.18;

  function blinkLid(t) {
    for (let i = 0; i < BLINKS.length; i++) {
      const start = BLINKS[i];
      if (t < start) break;
      const k = (t - start) / BLINK_DUR;
      if (k >= 0 && k <= 1) {
        return k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55;
      }
    }
    return 1;
  }

  function liveliness(t, opt = {}) {
    const { wander = 1, blink = true, float = true } = opt;
    return {
      dYaw: (loopNoise(t, 11.3, 0.4) * 5.5 + loopNoise(t, 3.7, 2.1) * 1.6) * wander,
      dPitch: (loopNoise(t, 9.1, 1.3) * 4.2 + loopNoise(t, 4.3, 0.7) * 1.3) * wander,
      dRoll: loopNoise(t, 13.7, 3.2) * 2.2 * wander,
      lid: blink ? blinkLid(t) : 1,
      driftX: float ? loopNoise(t, 7.9, 1.9) * 0.006 : 0,
      driftY: float ? loopNoise(t, 5.3, 0.3) * 0.007 : 0,
      breath: float ? 1 + Math.sin((t / 3.4) * Math.PI * 2) * 0.005 : 1
    };
  }

  function blinkScale(lid) {
    return 0.06 + 0.94 * clamp(lid);
  }

  /* ========================================================= expressions.ts */
  const eye = (w, h, tilt = 0, open = 1) => ({ w, h, tilt, open });
  const pair = (w, h, tilt = 0, open = 1) => [eye(w, h, tilt, open), eye(w, h, -tilt, open)];

  const EXPRESSIONS = [
    { id: 'neutre', gaze: { ...REST_GAZE }, split: EYE_SPLIT, eyes: [eye(EYE_W, EYE_H), eye(EYE_W, EYE_H)] },
    { id: 'attentif', gaze: { yaw: 4, pitch: 5, roll: -4 }, split: 16, eyes: pair(0.21, 0.44) },
    { id: 'surpris', gaze: { yaw: 3, pitch: -3, roll: 0 }, split: 19, eyes: pair(0.45, 0.47) },
    { id: 'excite', gaze: { yaw: 6, pitch: -14, roll: 0 }, split: 19.5, eyes: pair(0.4, 0.56, -10) },
    { id: 'heureux', gaze: { yaw: 5, pitch: 9, roll: 0 }, split: 17, eyes: pair(0.27, 0.17, 14) },
    { id: 'hilare', gaze: { yaw: 4, pitch: 14, roll: 0 }, split: 18, eyes: pair(0.34, 0.13, 20) },
    { id: 'colere', gaze: { yaw: 3, pitch: 7, roll: 0 }, split: 17, eyes: pair(0.34, 0.15, 30) },
    { id: 'triste', gaze: { yaw: 3, pitch: -13, roll: 0 }, split: 16, eyes: pair(0.22, 0.4, -28) },
    { id: 'effraye', gaze: { yaw: 2, pitch: -20, roll: 0 }, split: 20.5, eyes: pair(0.4, 0.6) },
    { id: 'mefiant', gaze: { yaw: 12, pitch: 6, roll: -6 }, split: 16, eyes: [eye(0.21, 0.4), eye(0.22, 0.15)] },
    { id: 'confus', gaze: { yaw: -14, pitch: 3, roll: 8 }, split: 16.5, eyes: [eye(0.2, 0.44, -18), eye(0.28, 0.17, 14)] },
    { id: 'curieux', gaze: { yaw: 16, pitch: -9, roll: -15 }, split: 16.5, eyes: [eye(0.24, 0.46, -8), eye(0.2, 0.38, -8)] },
    { id: 'fier', gaze: { yaw: 5, pitch: 17, roll: 0 }, split: 17, eyes: pair(0.3, 0.15, 18) },
    { id: 'timide', gaze: { yaw: -19, pitch: -14, roll: -7 }, split: 14, eyes: pair(0.17, 0.3) },
    { id: 'blase', gaze: { yaw: -22, pitch: 2, roll: 0 }, split: 16, eyes: pair(0.3, 0.12) },
    { id: 'somnolent', gaze: { yaw: 6, pitch: -9, roll: -3 }, split: 16, eyes: pair(0.2, 0.42, 0, 0.42) }
  ];
  const EXPRESSION_BY_ID = new Map(EXPRESSIONS.map((e) => [e.id, e]));
  const DEFAULT_EXPRESSION = 'neutre';

  const lerpEyeCfg = (a, b, t) => ({
    w: lerp(a.w, b.w, t),
    h: lerp(a.h, b.h, t),
    tilt: lerp(a.tilt !== undefined ? a.tilt : 0, b.tilt !== undefined ? b.tilt : 0, t),
    open: lerp(a.open, b.open, t)
  });

  function blendExpression(a, b, t) {
    return {
      id: b.id,
      gaze: {
        yaw: lerp(a.gaze.yaw, b.gaze.yaw, t),
        pitch: lerp(a.gaze.pitch, b.gaze.pitch, t),
        roll: lerp(a.gaze.roll, b.gaze.roll, t)
      },
      split: lerp(a.split, b.split, t),
      eyes: [lerpEyeCfg(a.eyes[0], b.eyes[0], t), lerpEyeCfg(a.eyes[1], b.eyes[1], t)]
    };
  }

  /* =============================================================== states.ts */
  const BAR_UPRIGHT_CY = -0.1875;
  const BAR_UPRIGHT = profileFromPolygon(
    hullOfCircles(0, -0.505, 0.132, 0, 0.13, 0.075),
    0,
    BAR_UPRIGHT_CY
  );
  const BAR_ITALIC = profileFromPolygon(hullOfCircles(0, -0.2535, 0.1345, 0, 0.2535, 0.1345), 0, 0);

  const barUpright = (pose = {}) => ({
    radii: [...BAR_UPRIGHT],
    rot: 0, cx: 0, cy: BAR_UPRIGHT_CY, sx: 1, sy: 1,
    ...pose
  });
  const barItalic = (pose = {}) => ({
    radii: [...BAR_ITALIC],
    rot: 0, cx: 0, cy: 0, sx: 1, sy: 1,
    ...pose
  });

  const TEAR = polyPath(hullOfCircles(0, 0, 0.118, 0, 0.172, 0.012));

  const TRI_ORBIT = 0.213;
  function spinningTriangle(rot) {
    return silhouette('triangle', {
      rot,
      cx: -TRI_ORBIT * Math.sin(rot),
      cy: TRI_ORBIT * Math.cos(rot)
    });
  }

  function base(over = {}) {
    return {
      sil: circle(1),
      offX: 0,
      offY: 0,
      gaze: { ...REST_GAZE },
      split: EYE_SPLIT,
      eyes: pair(EYE_W, EYE_H),
      eyeAlpha: 1,
      bodyAlpha: 1,
      dots: [],
      arcs: [],
      notif: null,
      dotsBehind: false,
      ...over
    };
  }

  function dotPulse(t, index) {
    const p = ((((t - index * 0.5) / 1.5) % 1) + 1) % 1;
    const k = p < 0.5 ? 0.5 - 0.5 * Math.cos(p * TAU) : 0;
    return clamp(k * 2);
  }

  const STATES = [
    {
      id: 'idle',
      duration: 2.4,
      morph: 0.45,
      blinkIn: false,
      baseFace: true,
      baseBody: true,
      pose: () => base()
    },
    {
      id: 'thinking',
      duration: 2.6,
      morph: 0.4,
      baseFace: false,
      baseBody: false,
      blinkIn: true,
      pose: (t) => {
        const mid = dotPulse(t, 1);
        const emerge = 0.3 + 0.7 * easings.easeOutCubic(clamp(t / 0.3));
        return base({
          sil: circle(DOT_R * (1 + (DOT_PEAK - 1) * mid), { cx: DOT_X[1] }),
          eyeAlpha: 0,
          dots: [0, 2].map((i) => {
            const k = dotPulse(t, i);
            return {
              x: DOT_X[i] * emerge,
              y: 0,
              r: DOT_R * (1 + (DOT_PEAK - 1) * k),
              opacity: 0.55 + 0.45 * k
            };
          })
        });
      }
    },
    {
      id: 'wink',
      duration: 1.6,
      morph: 0.3,
      blinkIn: true,
      baseFace: false,
      baseBody: true,
      pose: () =>
        base({
          gaze: { yaw: -5.37, pitch: 4.55, roll: 6.7 },
          split: 16.25,
          eyes: [
            { w: 0.236, h: 0.464, open: 1 },
            { w: 0.447, h: 0.089, open: 1 }
          ]
        })
    },
    {
      id: 'wide',
      duration: 1.8,
      morph: 0.55,
      blinkIn: true,
      baseFace: false,
      baseBody: true,
      pose: () =>
        base({
          gaze: { yaw: 6.92, pitch: -21.96, roll: 11.6 },
          split: 18.43,
          eyes: pair(0.356, 0.875)
        })
    },
    {
      id: 'alert',
      duration: 2.4,
      minDuration: 2,
      morph: 0.45,
      baseFace: false,
      baseBody: false,
      blinkIn: false,
      pose: (t) => {
        const p = clamp(t / 1.5);
        const travel = easings.easeInOutCubic(p) * 0.82 - 0.087;
        const back = t > 1.6 ? clamp((t - 1.6) / 0.4) : 0;
        const x = travel * (1 - back) + 0.1 * back;
        const buzz = Math.sin(t * 2.5 * TAU) * 0.005;
        const tilt = (17.7 * Math.PI) / 180;
        return base({
          sil: barItalic({ rot: tilt, cx: x, cy: -0.325 - buzz }),
          eyeAlpha: 0,
          dots: [
            {
              x: x - Math.sin(tilt) * 0.58,
              y: -0.325 + Math.cos(tilt) * 0.58 + buzz * 2.8,
              r: 0.118,
              d: TEAR,
              rot: (tilt * 180) / Math.PI,
              opacity: 1
            }
          ]
        });
      }
    },
    {
      id: 'notify',
      duration: 2.2,
      morph: 0.5,
      blinkIn: true,
      baseFace: false,
      baseBody: true,
      pose: (t) => {
        const p = clamp(t / 0.45);
        const pop = 1 + (NOTIF_POP - 1) * Math.sin(p * Math.PI) * (1 - p * 0.35);
        const r = NOTIF_R * (p < 1 ? pop : 1);
        const a = (NOTIF_ANGLE * Math.PI) / 180;
        return base({
          gaze: { yaw: -21.94, pitch: -5.82, roll: -12.2 },
          split: 18.89,
          eyes: pair(0.505, 0.498),
          notif: {
            x: Math.cos(a) * NOTIF_DIST,
            y: Math.sin(a) * NOTIF_DIST,
            r,
            notch: r + NOTIF_MARGIN
          }
        });
      }
    },
    {
      id: 'exclaim',
      duration: 2,
      morph: 0.45,
      baseFace: false,
      baseBody: false,
      blinkIn: false,
      pose: () =>
        base({
          sil: barUpright(),
          eyeAlpha: 0,
          dots: [{ x: -0.012, y: 0.526, r: 0.113, opacity: 1 }]
        })
    },
    {
      id: 'sleep',
      duration: 2.4,
      morph: 0.5,
      baseFace: false,
      baseBody: false,
      blinkIn: false,
      pose: (t) =>
        base({
          sil: circle(0.1585, { cy: 0.11 + Math.sin(t * (TAU / 0.6)) * 0.19 }),
          eyeAlpha: 0
        })
    },
    {
      id: 'egg',
      duration: 1.8,
      morph: 0.4,
      baseFace: false,
      baseBody: false,
      blinkIn: true,
      pose: () =>
        base({
          sil: silhouette('egg'),
          gaze: { yaw: 19.97, pitch: 26.01, roll: -17.1 },
          split: 11.07,
          eyes: pair(0.164, 0.385)
        })
    },
    {
      id: 'hexagon',
      duration: 1.6,
      morph: 0.4,
      baseFace: false,
      baseBody: false,
      blinkIn: true,
      pose: () =>
        base({
          sil: silhouette('hexagon'),
          gaze: { yaw: 23.11, pitch: 24.42, roll: -13.3 },
          split: 13.37,
          eyes: pair(0.177, 0.411)
        })
    },
    {
      id: 'play',
      duration: 2,
      morph: 0.5,
      baseFace: false,
      baseBody: false,
      blinkIn: true,
      pose: (t) => {
        const fade = clamp(t / 0.35) * clamp((2.2 - t) / 0.5);
        return base({
          sil: spinningTriangle(0),
          gaze: { yaw: 12, pitch: -8, roll: -6 },
          split: 15,
          eyes: pair(0.18, 0.34),
          arcs: SWOOSH.map((s, i) => ({
            id: `sw${i}`,
            seed: { ...s, cx: 0.45 - t * 0.42 },
            t,
            opacity: fade
          }))
        });
      }
    },
    {
      id: 'orbit',
      duration: 3.4,
      minDuration: 2.5,
      morph: 0.6,
      baseFace: false,
      baseBody: false,
      blinkIn: false,
      pose: (t) => {
        const ramp = easings.easeInOutCubic(clamp(t / 0.35));
        const rot = -TAU * 1.25 * t * ramp;
        const back = easings.easeInOutCubic(clamp((t - 1.6) / 0.9));
        const tri = spinningTriangle(rot);
        const ball = circle(1, { rot });
        const sil = {
          radii: tri.radii.map((r, i) => r + (ball.radii[i] - r) * back),
          rot,
          cx: tri.cx * (1 - back),
          cy: tri.cy * (1 - back),
          sx: 1,
          sy: 1
        };
        const fade = clamp(t / 0.8) * clamp((3.6 - t) / 0.9);
        return base({
          sil,
          gaze: {
            yaw: REST_GAZE.yaw + Math.sin(t * 6.5) * 65 * (1 - back),
            pitch: -4 + back * 32,
            roll: -13
          },
          eyes: pair(0.18, 0.34 + back * 0.07),
          arcs: RINGS.map((s, i) => ({
            id: `rg${i}`,
            seed: s,
            t,
            opacity: fade * clamp((t - i * 0.13) / 0.3)
          }))
        });
      }
    },
    {
      id: 'swirl',
      duration: 1.3,
      minDuration: 1.3,
      morph: 0.3,
      baseFace: true,
      baseBody: true,
      blinkIn: true,
      pose: (t) =>
        base({
          arcs: RINGS.slice(0, 3).map((s, i) => ({
            id: `sw${i}`,
            seed: s,
            t,
            opacity: clamp((t - i * 0.06) / 0.14) * clamp((1.22 - t) / 0.34)
          }))
        })
    },
    {
      id: 'burst',
      duration: 2.6,
      minDuration: 2.4,
      morph: 0.4,
      baseFace: false,
      baseBody: false,
      blinkIn: false,
      pose: (t) => {
        const collapse = 1 - 0.834 * easings.easeOutQuint(clamp(t / 0.7));
        const regrow = easings.easeOutQuint(clamp((t - 1.7) / 0.7));
        return base({
          sil: circle(collapse + (1 - collapse) * regrow),
          eyeAlpha: clamp((t - 1.85) / 0.4),
          dots: particles(t, 1),
          dotsBehind: true
        });
      }
    },
    {
      id: 'comet',
      duration: 2.4,
      minDuration: 2.4,
      morph: 0.45,
      baseFace: false,
      baseBody: false,
      blinkIn: false,
      pose: (t) => {
        const collapse = 1 - (1 - COMET_DOT) * easings.easeOutQuint(clamp(t / 0.55));
        const regrow = easings.easeOutQuint(clamp((t - 1.85) / 0.6));
        const fade = clamp((t - 0.15) / 0.25) * clamp((1.95 - t) / 0.3);
        return base({
          sil: circle(collapse + (1 - collapse) * regrow, {
            cy: Math.sin(clamp(t / 1.7) * Math.PI) * 0.035
          }),
          eyeAlpha: clamp((t - 2) / 0.35),
          arcs: COMET_RIBBONS.map((s, i) => ({ id: `cm${i}`, seed: s, t, opacity: fade }))
        });
      }
    }
  ];

  const STATE_BY_ID = new Map(STATES.map((s) => [s.id, s]));

  const POSES = {
    idle: 1, thinking: 1.1, wink: 0.8, wide: 0.8, alert: 0.75, notify: 0.9,
    exclaim: 0.8, sleep: 0.45, egg: 0.8, hexagon: 0.8, play: 0.9, orbit: 1.2,
    swirl: 0.5, burst: 0.45, comet: 1.15
  };

  const SEQUENCE = ['idle', 'thinking', 'wink', 'wide', 'alert', 'notify', 'exclaim', 'sleep', 'egg', 'hexagon', 'play', 'orbit', 'burst', 'comet'];

  /* =============================================================== eyefit.ts */
  const R_EYEFIT = 100;
  const DERIVE_YAW = 5.5 + 1.6;
  const DERIVE_PITCH = 4.2 + 1.3;
  const DERIVE_X = 0.006;
  const DERIVE_Y = 0.007;
  const FLOTTEMENT = Math.hypot(DERIVE_X, DERIVE_Y) * R_EYEFIT;
  const DIRECTIONS = 12;
  const DICHOTOMIE = 8;

  function empreintes(visage, sil, radii) {
    const out = [];
    const poses = eyePoses(visage.gaze, R_EYEFIT, visage.split);
    for (let i = 0; i < 2; i++) {
      const e = poses[i];
      if (e.depth <= 0.02) continue;
      const cfg = visage.eyes[i];
      const phi = ((cfg.tilt !== undefined ? cfg.tilt : 0) * Math.PI) / 180;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      const ax = e.a * cp + e.c * sp;
      const ay = e.b * cp + e.d * sp;
      const cx = -e.a * sp + e.c * cp;
      const cy = -e.b * sp + e.d * cp;

      const hw = Math.max(cfg.w * R_EYEFIT, 0.01) / 2;
      const hh = Math.max(cfg.h * R_EYEFIT, 0.01) / 2;
      const r = Math.min(hw, hh);
      const long = hh > hw;
      const demi = long ? hh - r : hw - r;
      const fit = radiusAtAngle(radii, Math.atan2(e.y, e.x) - sil.rot);
      out.push({
        x: e.x * fit,
        y: e.y * fit,
        ax: (long ? cx : ax) * demi,
        ay: (long ? cy : ay) * demi,
        r,
        m: [ax, ay, cx, cy]
      });
    }
    return out;
  }

  function approche(pts, x0, y0, x1, y1) {
    const sx = x1 - x0;
    const sy = y1 - y0;
    const len2 = sx * sx + sy * sy;
    let best = Infinity;
    let vx = 0;
    let vy = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      let t = len2 > 0 ? ((p.x - x0) * sx + (p.y - y0) * sy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x0 + t * sx - p.x;
      const ey = y0 + t * sy - p.y;
      const d2 = ex * ex + ey * ey;
      if (d2 < best) {
        best = d2;
        vx = ex;
        vy = ey;
      }
    }
    const d = Math.sqrt(best);
    return { d, ux: d > 1e-9 ? vx / d : 0, uy: d > 1e-9 ? vy / d : 0 };
  }

  function pire(pts, emps, tx, ty) {
    let marge = Infinity;
    let ux = 0;
    let uy = 0;
    for (const e of emps) {
      const x = e.x + tx;
      const y = e.y + ty;
      const a = approche(pts, x - e.ax, y - e.ay, x + e.ax, y + e.ay);
      const [m0, m1, m2, m3] = e.m;
      const rayon = e.r * Math.hypot(m0 * a.ux + m1 * a.uy, m2 * a.ux + m3 * a.uy) + FLOTTEMENT;
      if (a.d - rayon < marge) {
        marge = a.d - rayon;
        ux = a.ux;
        uy = a.uy;
      }
    }
    return { marge, ux, uy };
  }

  function resous(epreuves) {
    if (!epreuves.length) return { x: 0, y: 0 };

    const marge = (tx, ty) => {
      let m = Infinity;
      for (const ep of epreuves) m = Math.min(m, pire(ep.contour, ep.empreintes, tx, ty).marge);
      return m;
    };

    let requis = Infinity;
    for (const ep of epreuves) {
      requis = Math.min(requis, pire(ep.calContour, ep.reference, 0, 0).marge);
    }

    let mx = 0;
    let my = 0;
    const emps = epreuves[0].empreintes;
    for (const e of emps) {
      mx -= e.x / emps.length;
      my -= e.y / emps.length;
    }
    const course = Math.max(0.35 * R_EYEFIT, Math.hypot(mx, my) * 1.25);

    requis = Math.min(requis, marge(mx, my));

    const depart = marge(0, 0);
    if (depart >= requis && depart >= 0) return { x: 0, y: 0 };
    const cible = Math.max(requis, 0);

    let meilleurX = 0;
    let meilleurY = 0;
    let meilleureNorme = Infinity;
    let secoursX = 0;
    let secoursY = 0;
    let secours = depart;

    for (let d = 0; d < DIRECTIONS; d++) {
      const a = (d / DIRECTIONS) * Math.PI * 2;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      if (marge(ux * course, uy * course) < cible) {
        for (const k of [0.3, 0.6, 1]) {
          const m = marge(ux * course * k, uy * course * k);
          if (m > secours) {
            secours = m;
            secoursX = ux * course * k;
            secoursY = uy * course * k;
          }
        }
        continue;
      }
      let bas = 0;
      let haut = course;
      for (let i = 0; i < DICHOTOMIE; i++) {
        const mid = (bas + haut) / 2;
        if (marge(ux * mid, uy * mid) >= cible) haut = mid;
        else bas = mid;
      }
      if (haut < meilleureNorme) {
        meilleureNorme = haut;
        meilleurX = ux * haut;
        meilleurY = uy * haut;
      }
    }

    const x = meilleureNorme === Infinity ? secoursX : meilleurX;
    const y = meilleureNorme === Infinity ? secoursY : meilleurY;
    return { x: +(x / R_EYEFIT).toFixed(6), y: +(y / R_EYEFIT).toFixed(6) };
  }

  function visageDe(def, pose, expr) {
    if (def.baseFace && expr) return { gaze: expr.gaze, split: expr.split, eyes: expr.eyes };
    return { gaze: pose.gaze, split: pose.split, eyes: pose.eyes };
  }

  function dates(def) {
    const signature = (p) =>
      JSON.stringify([p.gaze, p.split, p.eyes, p.sil.rot, p.sil.cx, p.sil.cy, p.sil.sx, p.sil.sy]);
    if (signature(def.pose(0)) === signature(def.pose(def.duration))) return [0];
    const nn = 3;
    return Array.from({ length: nn }, (_, i) => (i / (nn - 1)) * def.duration);
  }

  function decalagePour(def, radii, expr) {
    const epreuves = [];
    for (const t of dates(def)) {
      const pose = def.pose(t);
      const contour = toPoints({ ...pose.sil, radii }, R_EYEFIT);
      const calContour = toPoints(pose.sil, R_EYEFIT);
      const v = visageDe(def, pose, expr);
      const coins = [];
      for (const dy of [-DERIVE_YAW, DERIVE_YAW]) {
        for (const dp of [-DERIVE_PITCH, DERIVE_PITCH]) {
          coins.push({
            ...v,
            gaze: { yaw: v.gaze.yaw + dy, pitch: v.gaze.pitch + dp, roll: v.gaze.roll }
          });
        }
      }
      for (const c of coins) {
        epreuves.push({
          empreintes: empreintes(c, pose.sil, radii),
          reference: empreintes(c, pose.sil, pose.sil.radii),
          contour,
          calContour
        });
      }
    }
    return resous(epreuves);
  }

  const NUL = { x: 0, y: 0 };
  const clef = (state, expr) => `${state}|${expr !== null && expr !== undefined ? expr : ''}`;

  function batir() {
    return new Map(
      SHAPES.map((forme) => {
        const par = new Map();
        for (const def of STATES) {
          if (!def.baseBody) continue;
          const expressions = def.baseFace ? [null, ...EXPRESSIONS] : [null];
          for (const expr of expressions) {
            par.set(clef(def.id, expr ? expr.id : null), decalagePour(def, forme.radii, expr));
          }
        }
        return [forme.radii, par];
      })
    );
  }

  const DECALAGES = batir();

  function decalageDesYeux(radii, state, expr) {
    if (!radii) return NUL;
    const par = DECALAGES.get(radii);
    if (!par) return NUL;
    return par.get(clef(state, expr)) || par.get(clef(state, null)) || NUL;
  }

  /* =============================================================== engine.ts */
  const NO_LOOK = { yaw: 0, pitch: 0, mix: 0, spin: 0, wander: 1 };

  const lerpLook = (a, b, t) => ({
    yaw: lerp(a.yaw, b.yaw, t),
    pitch: lerp(a.pitch, b.pitch, t),
    mix: lerp(a.mix, b.mix, t),
    spin: lerp(a.spin, b.spin, t),
    wander: lerp(a.wander, b.wander, t)
  });

  const lerpEye = (a, b, t) => ({
    w: lerp(a.w, b.w, t),
    h: lerp(a.h, b.h, t),
    open: lerp(a.open, b.open, t),
    tilt: lerp(a.tilt !== undefined ? a.tilt : 0, b.tilt !== undefined ? b.tilt : 0, t)
  });

  function blendPose(a, b, t) {
    const out = 1 - t;
    return {
      sil: blend(a.sil, b.sil, t),
      offX: lerp(a.offX, b.offX, t),
      offY: lerp(a.offY, b.offY, t),
      gaze: {
        yaw: lerp(a.gaze.yaw, b.gaze.yaw, t),
        pitch: lerp(a.gaze.pitch, b.gaze.pitch, t),
        roll: lerp(a.gaze.roll, b.gaze.roll, t)
      },
      split: lerp(a.split, b.split, t),
      eyes: [lerpEye(a.eyes[0], b.eyes[0], t), lerpEye(a.eyes[1], b.eyes[1], t)],
      eyeAlpha: lerp(a.eyeAlpha, b.eyeAlpha, t),
      bodyAlpha: lerp(a.bodyAlpha, b.bodyAlpha, t),
      dots: [
        ...a.dots.map((d) => ({ ...d, opacity: d.opacity * out })),
        ...b.dots.map((d) => ({ ...d, opacity: d.opacity * t }))
      ],
      arcs: [
        ...a.arcs.map((r) => ({ ...r, id: `a${r.id}`, opacity: r.opacity * out })),
        ...b.arcs.map((r) => ({ ...r, id: `b${r.id}`, opacity: r.opacity * t }))
      ],
      notif: t < 0.5 ? a.notif : b.notif,
      dotsBehind: t < 0.5 ? a.dotsBehind : b.dotsBehind
    };
  }

  class BotEngine {
    static SHAPE_MORPH = 0.45;
    static LOOK_MORPH = 0.24;

    constructor(scale = 100, initial = 'idle', shape = null, expression = null) {
      this.scale = scale;
      this.cur = initial;
      this.prev = null;
      this.departFige = null;
      this.tCur = 0;
      this.tPrev = 0;
      this.blinkAt = -10;
      this.pts = [];
      this.shape = shape;
      this.shapePrev = null;
      this.shapeAt = -10;
      this.expr = expression;
      this.exprPrev = null;
      this.exprAt = -10;
      this.look = NO_LOOK;
      this.lookPrev = NO_LOOK;
      this.lookAt = -10;
      this.lookMorph = 0.24;
    }

    setExpression(expression, now = 0) {
      // 公共 API 容错：允许传入表达式 id（字符串），统一解析为 EXPRESSIONS 中的表达式对象。
      // 若直接存入字符串，exprAtTime/blendExpression 读取 .gaze 时会逐帧抛 TypeError，
      // 导致采样中断、头像表情无法过渡。
      const next = typeof expression === 'string' ? expressionOf(expression) : expression;
      if (next === this.expr) return;
      this.exprPrev = this.expr;
      this.expr = next;
      this.exprAt = now;
    }

    exprAtTime(now) {
      const to = this.expr;
      const from = this.exprPrev;
      if (!to || !from) return to;
      const k = (now - this.exprAt) / BotEngine.SHAPE_MORPH;
      if (k >= 1) return to;
      return blendExpression(from, to, easings.easeOutQuint(clamp(k)));
    }

    setShape(radii, now = 0) {
      if (radii === this.shape) return;
      this.shapePrev = this.shape;
      this.shape = radii;
      this.shapeAt = now;
    }

    shapeAtTime(now) {
      const to = this.shape;
      const from = this.shapePrev;
      if (!to || !from) return to;
      const k = (now - this.shapeAt) / BotEngine.SHAPE_MORPH;
      if (k >= 1) return to;
      const t = easings.easeOutQuint(clamp(k));
      return to.map((r, i) => lerp(from[i] !== undefined ? from[i] : r, r, t));
    }

    setLook(look, now, morph = BotEngine.LOOK_MORPH) {
      if (look && !Number.isFinite(look.yaw + look.pitch + look.mix + look.spin + look.wander)) {
        return;
      }
      this.lookPrev = this.lookAtTime(now);
      this.look = look || NO_LOOK;
      this.lookAt = now;
      this.lookMorph = morph;
    }

    lookAtTime(now) {
      const k = (now - this.lookAt) / this.lookMorph;
      if (k >= 1) return this.look;
      return lerpLook(this.lookPrev, this.look, easings.easeOutQuint(clamp(k)));
    }

    posed(def, t, shape, expr) {
      let pose = def.pose(t);
      if (def.baseBody && shape) {
        pose = { ...pose, sil: { ...pose.sil, radii: shape } };
      }
      if (def.baseFace && expr) {
        pose = { ...pose, gaze: expr.gaze, split: expr.split, eyes: expr.eyes };
      }
      return pose;
    }

    decalageAtTime(now, state) {
      const surAxe = (debut, duree, a, b) => {
        if (a === b) return b;
        const k = (now - debut) / duree;
        if (k >= 1) return b;
        const t = easings.easeOutQuint(clamp(k));
        return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
      };

      const parForme = (radii) =>
        surAxe(
          this.exprAt,
          BotEngine.SHAPE_MORPH,
          decalageDesYeux(radii, state, this.exprPrev ? this.exprPrev.id : null),
          decalageDesYeux(radii, state, this.expr ? this.expr.id : null)
        );

      return surAxe(
        this.shapeAt,
        BotEngine.SHAPE_MORPH,
        parForme(this.shapePrev),
        parForme(this.shape)
      );
    }

    get state() {
      return this.cur;
    }

    reset(id, now) {
      this.cur = id;
      this.prev = null;
      this.departFige = null;
      this.tCur = now;
      this.tPrev = now;
      this.blinkAt = -10;
    }

    origine(now, shape, expr) {
      if (this.departFige) return this.departFige;
      if (!this.prev) return null;
      const prevDef = STATE_BY_ID.get(this.prev);
      return this.posed(prevDef, Math.max(0, now - this.tPrev), shape, expr);
    }

    poseComposee(now) {
      const def = STATE_BY_ID.get(this.cur);
      const shape = this.shapeAtTime(now);
      const expr = this.exprAtTime(now);
      const pose = this.posed(def, Math.max(0, now - this.tCur), shape, expr);
      const since = now - this.tCur;
      if (since >= def.morph) return pose;
      const origine = this.origine(now, shape, expr);
      if (!origine) return pose;
      return blendPose(origine, pose, easings.easeOutQuint(clamp(since / def.morph)));
    }

    setState(id, now) {
      if (id === this.cur) return;
      const morph = STATE_BY_ID.get(this.cur).morph;
      const enPleinFondu = this.prev !== null && now - this.tCur < morph;
      this.departFige = enPleinFondu ? this.poseComposee(now) : null;
      this.prev = this.cur;
      this.tPrev = this.tCur;
      this.cur = id;
      this.tCur = now;
      if (STATE_BY_ID.get(id).blinkIn) this.blinkAt = now;
    }

    sample(now) {
      const R = this.scale;
      const def = STATE_BY_ID.get(this.cur);
      const shape = this.shapeAtTime(now);
      const expr = this.exprAtTime(now);
      let pose = this.posed(def, Math.max(0, now - this.tCur), shape, expr);
      let decalage = this.decalageAtTime(now, this.cur);

      const since = now - this.tCur;
      const origine = since < def.morph ? this.origine(now, shape, expr) : null;
      if (origine) {
        const ratio = easings.easeOutQuint(clamp(since / def.morph));
        pose = blendPose(origine, pose, ratio);
        const quitte = this.prev;
        if (quitte) {
          const avant = this.decalageAtTime(now, quitte);
          decalage = {
            x: lerp(avant.x, decalage.x, ratio),
            y: lerp(avant.y, decalage.y, ratio)
          };
        }
      }

      const alive = pose.eyeAlpha > 0.01;
      const look = this.lookAtTime(now);
      const life = liveliness(now, { wander: alive ? look.wander : 0, blink: alive });

      const gaze = {
        yaw: lerp(pose.gaze.yaw, look.yaw, look.mix) + life.dYaw - look.spin,
        pitch: lerp(pose.gaze.pitch, look.pitch, look.mix) + life.dPitch,
        roll: pose.gaze.roll + life.dRoll
      };

      const forced = clamp((now - this.blinkAt) / 0.2);
      const forcedLid = forced < 1 ? Math.abs(forced * 2 - 1) : 1;
      const lid = Math.min(life.lid, forcedLid);

      const offX = pose.offX + life.driftX;
      const offY = pose.offY + life.driftY;

      const sil = {
        ...pose.sil,
        cx: pose.sil.cx + offX,
        cy: pose.sil.cy + offY,
        sy: pose.sil.sy * life.breath
      };
      const bodyPath = closedPath(toPoints(sil, R, this.pts));

      const bodyRadius = (x, y) =>
        radiusAtAngle(pose.sil.radii, Math.atan2(y, x) - pose.sil.rot);

      const eyes = [];
      if (pose.eyeAlpha > 0.01) {
        const poses = eyePoses(gaze, R, pose.split);
        for (let i = 0; i < 2; i++) {
          const e = poses[i];
          if (e.depth <= 0.02) continue;
          const cfg = pose.eyes[i];
          const fit = bodyRadius(e.x, e.y);
          const phi = ((cfg.tilt !== undefined ? cfg.tilt : 0) * Math.PI) / 180;
          const cp = Math.cos(phi);
          const sp = Math.sin(phi);
          const ax = e.a * cp + e.c * sp;
          const ay = e.b * cp + e.d * sp;
          const cx2 = -e.a * sp + e.c * cp;
          const cy2 = -e.b * sp + e.d * cp;
          const k = blinkScale(Math.min(lid, cfg.open));
          eyes.push({
            d: capsulePath(cfg.w * R, cfg.h * R),
            matrix: `matrix(${r2(ax)},${r2(ay * k)},${r2(cx2)},${r2(cy2 * k)},${r2(e.x * fit + (offX + decalage.x) * R)},${r2(e.y * fit + (offY + decalage.y) * R)})`,
            alpha: pose.eyeAlpha * clamp(e.depth / 0.12)
          });
        }
      }

      const dots = pose.dots
        .filter((p) => p.opacity > 0.01 && p.r > 0.0005)
        .map((p) => ({ ...p, x: (p.x + offX) * R, y: (p.y + offY) * R, r: p.r * R }));

      const nFit = pose.notif ? bodyRadius(pose.notif.x, pose.notif.y) : 1;
      const nx = pose.notif ? (pose.notif.x * nFit + offX) * R : 0;
      const ny = pose.notif ? (pose.notif.y * nFit + offY) * R : 0;
      const notif = pose.notif ? { x: nx, y: ny, r: pose.notif.r * R } : null;
      const notch = pose.notif ? { x: nx, y: ny, r: pose.notif.notch * R } : null;

      return {
        bodyPath,
        bodyAlpha: pose.bodyAlpha,
        eyes,
        dots,
        dotsBehind: pose.dotsBehind,
        arcs: pose.arcs
          .filter((a) => a.opacity > 0.01)
          .map((a) => arcRender(a.seed, a.t, R, a.id, a.opacity)),
        notif,
        notch
      };
    }
  }

  /* ================================================================ 渲染层 */
  function dotEl(dot, ink, paper) {
    const fill = dot.color !== undefined
      ? dot.color
      : (dot.depth === undefined ? ink : mixHex(paper, ink, dot.depth));
    if (dot.d) {
      return `<path fill="${fill}" opacity="${n(dot.opacity)}" d="${dot.d}" transform="translate(${n(dot.x)} ${n(dot.y)}) rotate(${dot.rot !== undefined ? dot.rot : 0}) scale(${RAYON})"/>`;
    }
    return `<circle fill="${fill}" opacity="${n(dot.opacity)}" cx="${n(dot.x)}" cy="${n(dot.y)}" r="${n(dot.r)}"/>`;
  }

  function renderSVG(f, uid, ink, paper) {
    const defs = [];
    defs.push(`<mask id="${uid}" maskUnits="userSpaceOnUse" x="${-DEMI_VIEWBOX}" y="${-DEMI_VIEWBOX}" width="${DEMI_VIEWBOX * 2}" height="${DEMI_VIEWBOX * 2}">`);
    defs.push(`<path d="${f.bodyPath}" fill="#fff"/>`);
    for (const ey of f.eyes) {
      defs.push(`<path d="${ey.d}" transform="${ey.matrix}" opacity="${n(ey.alpha)}" fill="#000"/>`);
    }
    if (f.notch) {
      defs.push(`<circle cx="${n(f.notch.x)}" cy="${n(f.notch.y)}" r="${n(f.notch.r)}" fill="#000"/>`);
    }
    defs.push(`</mask>`);

    for (const arc of f.arcs) {
      defs.push(`<linearGradient id="${uid}-${arc.id}" gradientUnits="userSpaceOnUse" x1="${n(arc.grad.x1)}" y1="${n(arc.grad.y1)}" x2="${n(arc.grad.x2)}" y2="${n(arc.grad.y2)}">`);
      const stops = arc.grad.stops;
      stops.forEach((c, i) => {
        defs.push(`<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`);
      });
      defs.push(`</linearGradient>`);
    }

    let s = `<defs>${defs.join('')}</defs>`;

    s += `<g fill="none" stroke-linecap="round">`;
    for (const arc of f.arcs) {
      s += `<path d="${arc.back}" stroke="url(#${uid}-${arc.id})" stroke-width="${n(arc.width)}" opacity="${n(arc.opacity)}"/>`;
    }
    s += `</g>`;

    if (f.dotsBehind) {
      s += `<g>${f.dots.map((d) => dotEl(d, ink, paper)).join('')}</g>`;
    }

    s += `<g opacity="${n(f.bodyAlpha)}">`;
    s += `<path d="${f.bodyPath}" fill="${paper}"/>`;
    s += `<g mask="url(#${uid})"><rect x="${-DEMI_VIEWBOX}" y="${-DEMI_VIEWBOX}" width="${DEMI_VIEWBOX * 2}" height="${DEMI_VIEWBOX * 2}" fill="${ink}"/></g>`;
    s += `</g>`;

    if (!f.dotsBehind) {
      s += `<g>${f.dots.map((d) => dotEl(d, ink, paper)).join('')}</g>`;
    }

    if (f.notif) {
      s += `<circle cx="${n(f.notif.x)}" cy="${n(f.notif.y)}" r="${n(f.notif.r)}" fill="${NOTIF_BLUE}"/>`;
    }

    s += `<g fill="none" stroke-linecap="round">`;
    for (const arc of f.arcs) {
      s += `<path d="${arc.front}" stroke="url(#${uid}-${arc.id})" stroke-width="${n(arc.width)}" opacity="${n(arc.opacity)}"/>`;
    }
    s += `</g>`;

    return s;
  }

  /* ================================================================= API */
  const NS = 'http://www.w3.org/2000/svg';

  function shapeRadiiOf(shapeId) {
    if (!shapeId) return null;
    const sh = SHAPE_BY_ID.get(shapeId);
    return sh ? sh.radii : null;
  }

  function expressionOf(exprId) {
    if (!exprId) return null;
    return EXPRESSION_BY_ID.get(exprId) || null;
  }

  function inkOf(opts) {
    if (opts.ink) return opts.ink;
    if (opts.color) {
      const c = COLOR_BY_ID.get(opts.color);
      if (c) return c.hex;
      if (/^#/.test(opts.color)) return opts.color;
    }
    return COLOR_BY_ID.get(DEFAULT_COLOR).hex;
  }

  function makeEngine(opts) {
    return new BotEngine(
      RAYON,
      opts.state || 'idle',
      shapeRadiiOf(opts.shape),
      expressionOf(opts.expression)
    );
  }

  /**
   * 动画球：在容器里挂一个持续呼吸/眨眼的实时球。
   * opts: {size, shape, color|ink, expression, state, cycle:[{state,duration,expression}], paper, speed}
   */
  function mount(container, opts = {}) {
    if (!container) return null;
    const size = opts.size || 160;
    const paper = opts.paper || '#0d1524';
    const ink = inkOf(opts);
    const uid = 'b' + Math.random().toString(36).slice(2, 9);

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `${-DEMI_VIEWBOX} ${-DEMI_VIEWBOX} ${DEMI_VIEWBOX * 2} ${DEMI_VIEWBOX * 2}`);
    svg.setAttribute('role', 'img');
    container.innerHTML = '';
    container.appendChild(svg);

    const eng = makeEngine(opts);
    const speed = opts.speed || 1;
    const cycle = Array.isArray(opts.cycle) && opts.cycle.length ? opts.cycle : null;
    let blockIdx = 0;
    let blockStart = 0;

    let raf = 0;
    let last = 0;
    let clock = 0;

    function step(ms) {
      raf = requestAnimationFrame(step);
      const dt = last ? Math.min((ms - last) / 1000, 0.064) : 0;
      last = ms;
      const prev = clock;
      clock += dt * speed;

      if (cycle) {
        const block = cycle[blockIdx];
        if (clock - blockStart >= block.duration) {
          blockIdx = (blockIdx + 1) % cycle.length;
          blockStart = clock;
          const nb = cycle[blockIdx];
          eng.setState(nb.state, clock);
          if (nb.expression) eng.setExpression(expressionOf(nb.expression), clock);
        } else if (block.expression && eng.expr && eng.expr.id !== block.expression) {
          eng.setExpression(expressionOf(block.expression), clock);
        }
        void prev;
      }

      const f = eng.sample(clock);
      svg.innerHTML = renderSVG(f, uid, ink, paper);
    }

    raf = requestAnimationFrame(step);
    return { stop() { cancelAnimationFrame(raf); }, engine: eng };
  }

  /**
   * 静态球：返回一段 <svg> 字符串（引擎在 frozenAt 时刻的确定画面）。
   * opts: {size, shape, color|ink, expression, state, frozenAt, paper}
   */
  function staticSvg(opts = {}) {
    const size = opts.size || 80;
    const paper = opts.paper || '#0d1524';
    const ink = inkOf(opts);
    const uid = 's' + Math.random().toString(36).slice(2, 9);
    const eng = makeEngine(opts);
    const f = eng.sample(opts.frozenAt !== undefined ? opts.frozenAt : 1);
    return `<svg width="${size}" height="${size}" viewBox="${-DEMI_VIEWBOX} ${-DEMI_VIEWBOX} ${DEMI_VIEWBOX * 2} ${DEMI_VIEWBOX * 2}" role="img">${renderSVG(f, uid, ink, paper)}</svg>`;
  }

  /** 批量填充静态球：选择器 -> 配置映射。 */
  function fill(selector, opts) {
    document.querySelectorAll(selector).forEach((el) => {
      const data = { ...opts, ...JSON.parse(el.dataset.bot || '{}') };
      el.innerHTML = staticSvg(data);
    });
  }

  // 仅导出被外部调用的 API；fill/RAYON/DEMI_VIEWBOX/SHAPES/COLORS/EXPRESSIONS/STATES/SEQUENCE/POSES/BotEngine
  // 为内部实现细节，不再挂到 window.Bloub（见 ARCHITECTURE-REVIEW.md P1-10）
  window.Bloub = {
    mount,
    static: staticSvg
  };
})();
