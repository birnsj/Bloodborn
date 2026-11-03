/**
 * Trek-style capsule/ellipsoid raycast renderer (from ST-Adventures makeCharacterSprites).
 * Produces lit, readable limb silhouettes — not flat SVG strokes.
 */

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const normalize = (v) => {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
};
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const v3 = (x, y, z) => [x, y, z];
export const deg = (d) => (d * Math.PI) / 180;

export const LIGHT = normalize([-0.35, 0.75, 1]);
export const FILL = normalize([1, -0.3, 0.4]);
export const VIEW = normalize([1, 1, 1]);
export const HALF = normalize(add(LIGHT, VIEW));

const hex = (value) => [1, 3, 5].map((s) => parseInt(value.slice(s, s + 2), 16) / 255);

export function material(colour, { spec = 0.12, shininess = 18, part = 'body' } = {}) {
  return { base: hex(colour), spec, shininess, part };
}

export function ellipsoid(c, r, mat, keep = null, rot = null) {
  return {
    kind: 'e',
    c,
    r,
    mat,
    keep,
    rot,
    bound: Math.max(...r),
  };
}

export function capsule(a, b, r, mat) {
  return {
    kind: 'c',
    a,
    b,
    r,
    mat,
    bound: r + Math.hypot(...sub(b, a)) / 2,
    c: scale(add(a, b), 0.5),
  };
}

const mulMatrix = (m, v) => m.map((row) => dot(row, v));
const mulTransposed = (m, v) => [
  m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2],
  m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2],
  m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2],
];

function hitEllipsoid(shape, origin, direction) {
  const [rx, ry, rz] = shape.r;
  const local = (v) => (shape.rot ? mulMatrix(shape.rot, v) : v);
  const oc = local(sub(origin, shape.c));
  const dl = local(direction);
  const o = [oc[0] / rx, oc[1] / ry, oc[2] / rz];
  const d = [dl[0] / rx, dl[1] / ry, dl[2] / rz];
  const a = dot(d, d);
  const b = dot(o, d);
  const disc = b * b - a * (dot(o, o) - 1);
  if (disc < 0) return null;
  const surface = (t, side) => {
    const p = add(origin, scale(direction, t));
    const q = local(sub(p, shape.c));
    const n = [q[0] / (rx * rx), q[1] / (ry * ry), q[2] / (rz * rz)];
    return {
      t,
      p,
      n: scale(normalize(shape.rot ? mulTransposed(shape.rot, n) : n), side),
    };
  };
  const near = surface((-b - Math.sqrt(disc)) / a, 1);
  if (near.t < 0) return null;
  if (!shape.keep || shape.keep(near.p)) return near;
  const far = surface((-b + Math.sqrt(disc)) / a, -1);
  return shape.keep(far.p) ? { ...far, inside: true } : null;
}

function hitCapsule(shape, origin, direction) {
  const { a: pa, b: pb, r } = shape;
  const ba = sub(pb, pa);
  const oa = sub(origin, pa);
  const baba = dot(ba, ba);
  const bard = dot(ba, direction);
  const baoa = dot(ba, oa);
  const rdoa = dot(direction, oa);
  const oaoa = dot(oa, oa);
  const qa = baba - bard * bard;
  const qb = baba * rdoa - baoa * bard;
  const qc = baba * oaoa - baoa * baoa - r * r * baba;
  const h = qb * qb - qa * qc;
  let t = null;
  if (h >= 0 && Math.abs(qa) > 1e-9) {
    const body = (-qb - Math.sqrt(h)) / qa;
    const y = baoa + body * bard;
    if (y > 0 && y < baba && body > 0) t = body;
    else {
      const oc = y <= 0 ? oa : sub(origin, pb);
      const cb = dot(direction, oc);
      const ch = cb * cb - (dot(oc, oc) - r * r);
      if (ch > 0 && -cb - Math.sqrt(ch) > 0) t = -cb - Math.sqrt(ch);
    }
  }
  if (t === null) return null;
  const p = add(origin, scale(direction, t));
  const along = clamp01(dot(sub(p, pa), ba) / baba);
  return { t, p, n: normalize(sub(sub(p, pa), scale(ba, along))) };
}

const K = Math.SQRT2;

/** Iso map-style scene for billboard characters (Trek camera). */
export function isoScene(shapes, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const toBody = ([x, y, zz]) => [(x * cos + y * sin) * K, (-x * sin + y * cos) * K, zz];
  const toWorldNormal = ([x, y, zz]) =>
    normalize([(x * cos - y * sin) * K, (x * sin + y * cos) * K, zz]);
  const direction = normalize(toBody([-1, -1, -1]));
  const screenOf = (point) => {
    const x = (point[0] * cos - point[1] * sin) / K;
    const y = (point[0] * sin + point[1] * cos) / K;
    return [x - y, (x + y) / 2 - point[2]];
  };
  const culled = shapes.map((shape) => ({
    shape,
    at: screenOf(shape.c),
    reach: shape.bound * 1.25 + 0.5,
  }));
  return (sx, sy) => {
    const ground = [sy + sx / 2, sy - sx / 2, 0];
    const origin = toBody([ground[0] + 200, ground[1] + 200, 200]);
    let best = null;
    for (const { shape, at, reach } of culled) {
      if (Math.abs(at[0] - sx) > reach || Math.abs(at[1] - sy) > reach) continue;
      const hit =
        shape.kind === 'e'
          ? hitEllipsoid(shape, origin, direction)
          : hitCapsule(shape, origin, direction);
      if (!hit || hit.p[2] < -0.5 || (best && hit.t >= best.t)) continue;
      best = { ...hit, mat: shape.mat };
    }
    if (!best) return null;
    const n = toWorldNormal(best.n);
    const albedo = best.mat.base;
    const light = 0.36 + 0.64 * Math.max(0, dot(n, LIGHT)) + 0.14 * Math.max(0, dot(n, FILL));
    const ao = (0.8 + 0.2 * clamp01(best.p[2] / 48)) * (best.inside ? 0.55 : 1);
    const highlight = best.mat.spec * Math.max(0, dot(n, HALF)) ** best.mat.shininess;
    return {
      colour: add(scale(albedo, light * ao), [highlight, highlight, highlight]),
      part: best.mat.part,
    };
  };
}

/**
 * Doom-style FP weapon camera: orthographic looking down -Z.
 * World +X = screen right, +Y = screen up. Gun is modelled in XY (barrel up-left).
 */
export function fpWeaponScene(shapes) {
  const dir = v3(0, 0, -1);
  return (sx, sy) => {
    // sx right, sy down — world +Y is screen-down (Doom FP convention)
    const origin = v3(sx, sy, 18);
    let best = null;
    for (const shape of shapes) {
      const hit =
        shape.kind === 'e'
          ? hitEllipsoid(shape, origin, dir)
          : hitCapsule(shape, origin, dir);
      if (!hit || (best && hit.t >= best.t)) continue;
      best = { ...hit, mat: shape.mat };
    }
    if (!best) return null;
    const albedo = best.mat.base;
    const light =
      0.4 + 0.6 * Math.max(0, dot(best.n, LIGHT)) + 0.16 * Math.max(0, dot(best.n, FILL));
    const highlight = best.mat.spec * Math.max(0, dot(best.n, HALF)) ** best.mat.shininess;
    return {
      colour: add(scale(albedo, light), [highlight, highlight, highlight]),
      part: best.mat.part,
    };
  };
}

/** Pitch about +Y (positive tips top toward +X). */
export function pitchPoint(p, angle, pivot = [0, 0, 0]) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const q = sub(p, pivot);
  return add(pivot, [q[0] * c + q[2] * s, q[1], -q[0] * s + q[2] * c]);
}

export function mapShapes(shapes, move, { dropKeep = false } = {}) {
  return shapes.map((shape) => {
    if (shape.kind === 'c') return capsule(move(shape.a), move(shape.b), shape.r, shape.mat);
    // keep tests original space; drop it after a rigid fall so the body isn't culled
    const keep = dropKeep ? null : shape.keep;
    return ellipsoid(move(shape.c), shape.r, shape.mat, keep, shape.rot);
  });
}

/** Raise / lower so the lowest point rests just above z=0. */
export function ontoGround(shapes) {
  let lowest = Infinity;
  for (const shape of shapes) {
    if (shape.kind === 'c') {
      lowest = Math.min(lowest, shape.a[2] - shape.r, shape.b[2] - shape.r);
    } else {
      lowest = Math.min(lowest, shape.c[2] - (shape.r[2] ?? shape.r));
    }
  }
  const rise = 0.4 - lowest;
  return mapShapes(shapes, (p) => [p[0], p[1], p[2] + rise]);
}

/** Rasterize scene(sx,sy) into RGBA buffer for one cell. */
export function renderCell(scene, cellW, cellH, { anchorX = 0.5, anchorY = 1, paint = 1, designW = 64, designH = 128, samples = 2 } = {}) {
  const data = Buffer.alloc(cellW * cellH * 4);
  const total = samples * samples;
  for (let oy = 0; oy < cellH; oy++) {
    for (let ox = 0; ox < cellW; ox++) {
      const colour = [0, 0, 0];
      let hits = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const u = (ox + (sx + 0.5) / samples) / cellW;
          const v = (oy + (sy + 0.5) / samples) / cellH;
          const px = ((u - anchorX) * designW) / paint;
          const py = ((v - (1 - anchorY)) * designH) / paint;
          const result = scene(px, py);
          if (!result) continue;
          hits++;
          for (let k = 0; k < 3; k++) colour[k] += result.colour[k];
        }
      }
      if (!hits) continue;
      const i = (oy * cellW + ox) * 4;
      for (let k = 0; k < 3; k++) data[i + k] = Math.round(clamp01(colour[k] / hits) * 255);
      data[i + 3] = Math.round((hits / total) * 255);
    }
  }
  return data;
}

export function blitCell(dest, destW, ox, oy, cellW, cellH, src) {
  for (let y = 0; y < cellH; y++) {
    for (let x = 0; x < cellW; x++) {
      const si = (y * cellW + x) * 4;
      if (src[si + 3] < 8) continue;
      const di = ((oy + y) * destW + (ox + x)) * 4;
      dest[di] = src[si];
      dest[di + 1] = src[si + 1];
      dest[di + 2] = src[si + 2];
      dest[di + 3] = src[si + 3];
    }
  }
}
