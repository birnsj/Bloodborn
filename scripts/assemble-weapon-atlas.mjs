/**
 * Assemble Phase 5 authored FP pistol frames into an even-grid atlas.
 * Sources: public/sprites/weapons/src/pistol-{clip}-{n}.png
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'public', 'sprites', 'weapons', 'src');
const outDir = path.join(root, 'public', 'sprites', 'weapons');

const CELL = 256;
const COLS = 4;
const clips = [
  { name: 'idle', frames: 3 },
  { name: 'fire', frames: 4 },
  { name: 'reload', frames: 4 },
  { name: 'equip', frames: 3 },
  { name: 'lower', frames: 3 },
  { name: 'muzzle', frames: 2 },
];
const ROWS = clips.length;

function createPng(w, h) {
  const png = new PNG({ width: w, height: h });
  png.data.fill(0);
  return png;
}

function loadPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function isStudioGray(r, g, b, a) {
  if (a < 12) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  // Solid studio gray / white / beige plates
  if (max - min < 48 && avg > 125) return true;
  if (max > 155 && max - min < 40) return true;
  return false;
}

/** Flood-fill from corners so dark metal/hand is never mistaken for backdrop. */
function stripBackdrop(src) {
  const { width: w, height: h } = src;
  const out = createPng(w, h);
  // Copy first
  for (let i = 0; i < src.data.length; i++) out.data[i] = src.data[i];

  const visited = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    const i = idx << 2;
    if (!isStudioGray(src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3])) return;
    visited[idx] = 1;
    stack.push(idx);
  };
  // Seed from edges
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const idx = stack.pop();
    const x = idx % w;
    const y = (idx / w) | 0;
    const i = idx << 2;
    out.data[i] = 0;
    out.data[i + 1] = 0;
    out.data[i + 2] = 0;
    out.data[i + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  // Force remaining near-white islands / checker leftovers transparent
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (w * y + x) << 2;
      if (out.data[i + 3] < 12) continue;
      if (isStudioGray(out.data[i], out.data[i + 1], out.data[i + 2], out.data[i + 3])) {
        out.data[i + 3] = 0;
        continue;
      }
      out.data[i + 3] = 255;
    }
  }
  return out;
}

/** Lift shadows so dark gothic metal stays readable over dim dungeon lighting. */
function liftWeaponPixel(r, g, b) {
  // shadow lift + mild mid contrast
  const lift = 38;
  const gain = 1.18;
  r = Math.min(255, Math.round((r + lift) * gain));
  g = Math.min(255, Math.round((g + lift) * gain));
  b = Math.min(255, Math.round((b + lift) * gain));
  return [r, g, b];
}

function contentBounds(src) {
  let minX = src.width;
  let minY = src.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const a = src.data[((src.width * y + x) << 2) + 3];
      if (a < 16) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function sample(src, x, y) {
  const ix = Math.max(0, Math.min(src.width - 1, Math.floor(x)));
  const iy = Math.max(0, Math.min(src.height - 1, Math.floor(y)));
  const i = (src.width * iy + ix) << 2;
  return [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]];
}

/**
 * Fit content into cell using a shared layout derived from idle_0
 * so all clips share the same pivot / framing.
 */
function fitToCell(src, layout, { padBottom = 10, darken = 0 } = {}) {
  const cell = createPng(CELL, CELL);
  const bounds = contentBounds(src);
  if (!bounds) return cell;

  const margin = 8;
  const usable = CELL - margin * 2;
  const scale = layout.scale;
  const drawW = Math.floor(bounds.w * scale);
  const drawH = Math.floor(bounds.h * scale);

  // Place so content bottom aligns with idle reference bottom.
  const ox = Math.floor(margin + (usable - drawW) * layout.alignX);
  const oy = Math.floor(CELL - margin - padBottom - drawH * layout.alignBottomFactor);

  for (let y = 0; y < drawH; y++) {
    for (let x = 0; x < drawW; x++) {
      const sx = bounds.minX + (x / drawW) * bounds.w;
      const sy = bounds.minY + (y / drawH) * bounds.h;
      let [r, g, b, a] = sample(src, sx, sy);
      if (a < 16) continue;
      [r, g, b] = liftWeaponPixel(r, g, b);
      if (darken) {
        r = Math.max(0, r - darken);
        g = Math.max(0, g - darken);
        b = Math.max(0, b - darken);
      }
      const dx = ox + x;
      const dy = oy + y;
      if (dx < 0 || dy < 0 || dx >= CELL || dy >= CELL) continue;
      const di = (CELL * dy + dx) << 2;
      cell.data[di] = r;
      cell.data[di + 1] = g;
      cell.data[di + 2] = b;
      cell.data[di + 3] = 255;
    }
  }
  return cell;
}

function fitMuzzle(src) {
  const cell = createPng(CELL, CELL);
  const bounds = contentBounds(src);
  if (!bounds) return cell;
  const margin = 40;
  const usable = CELL - margin * 2;
  const scale = Math.min(usable / bounds.w, usable / bounds.h) * 0.85;
  const drawW = Math.floor(bounds.w * scale);
  const drawH = Math.floor(bounds.h * scale);
  const ox = Math.floor((CELL - drawW) / 2);
  const oy = Math.floor((CELL - drawH) / 2);
  for (let y = 0; y < drawH; y++) {
    for (let x = 0; x < drawW; x++) {
      const sx = bounds.minX + (x / drawW) * bounds.w;
      const sy = bounds.minY + (y / drawH) * bounds.h;
      const [r, g, b, a] = sample(src, sx, sy);
      // Keep bright flash; drop near-black plate
      if (a < 16 || (r + g + b) < 60) continue;
      const dx = ox + x;
      const dy = oy + y;
      if (dx < 0 || dy < 0 || dx >= CELL || dy >= CELL) continue;
      const di = (CELL * dy + dx) << 2;
      cell.data[di] = r;
      cell.data[di + 1] = g;
      cell.data[di + 2] = b;
      cell.data[di + 3] = Math.min(255, Math.round(a * 1.1));
    }
  }
  return cell;
}

function blit(dest, ox, oy, src) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const si = (src.width * y + x) << 2;
      if (src.data[si + 3] < 8) continue;
      const dx = ox + x;
      const dy = oy + y;
      if (dx < 0 || dy < 0 || dx >= dest.width || dy >= dest.height) continue;
      const di = (dest.width * dy + dx) << 2;
      dest.data[di] = src.data[si];
      dest.data[di + 1] = src.data[si + 1];
      dest.data[di + 2] = src.data[si + 2];
      dest.data[di + 3] = src.data[si + 3];
    }
  }
}

function findSource(clip, frame) {
  // Prefer Phase-5 FP retarget (`pistol-fp-*`) over older side-profile art.
  const candidates = [
    path.join(srcDir, `pistol-fp-${clip}-${frame}.png`),
    path.join(srcDir, `pistol-fp-${clip}-${frame}.jpg`),
    path.join(srcDir, `pistol-${clip}-${frame}.png`),
    path.join(srcDir, `pistol-${clip}-${frame}.jpg`),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function findMuzzleTip(cell) {
  // Scan upper-left quadrant for brightest opaque pixel cluster as barrel tip proxy.
  let bestX = 48;
  let bestY = 48;
  let bestScore = -1;
  for (let y = 8; y < CELL * 0.55; y++) {
    for (let x = 8; x < CELL * 0.7; x++) {
      const i = (CELL * y + x) << 2;
      if (cell.data[i + 3] < 200) continue;
      // Prefer metal-ish mid tones near the edge of content
      const r = cell.data[i];
      const g = cell.data[i + 1];
      const b = cell.data[i + 2];
      const lum = (r + g + b) / 3;
      // Look for tip: opaque neighbor to transparent upper-left
      const up = y > 0 ? cell.data[((CELL * (y - 1) + x) << 2) + 3] : 0;
      const left = x > 0 ? cell.data[((CELL * y + (x - 1)) << 2) + 3] : 0;
      if (up > 40 && left > 40) continue;
      const score = (255 - Math.min(x, y)) + (lum > 40 ? 20 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
      }
    }
  }
  return { x: bestX, y: bestY };
}

// --- main ---
const idlePath = findSource('idle', 0);
if (!idlePath) {
  console.error('Missing pistol-idle-0 in', srcDir);
  process.exit(1);
}

const idleStripped = stripBackdrop(loadPng(idlePath));
const idleBounds = contentBounds(idleStripped);
if (!idleBounds) {
  console.error('idle_0 has no opaque content after backdrop strip');
  process.exit(1);
}

const margin = 8;
const usable = CELL - margin * 2;
const layout = {
  scale: Math.min(usable / idleBounds.w, usable / idleBounds.h) * 0.92,
  alignX: 0.55,
  alignBottomFactor: 1,
};

const sheet = createPng(COLS * CELL, ROWS * CELL);
const animations = {};
const frameNames = {};
let idleCell = null;

clips.forEach((clip, row) => {
  const start = row * COLS;
  animations[clip.name] = { start, count: clip.frames };
  for (let f = 0; f < clip.frames; f++) {
    const srcPath = findSource(clip.name, f);
    let cell;
    if (!srcPath) {
      console.warn(`Missing ${clip.name}_${f}, leaving empty cell`);
      cell = createPng(CELL, CELL);
    } else {
      const stripped = stripBackdrop(loadPng(srcPath));
      if (clip.name === 'muzzle') {
        cell = fitMuzzle(stripped);
      } else {
        // No darken on equip/lower — dark gothic metal already reads black in-dungeon.
        cell = fitToCell(stripped, layout, { darken: 0 });
      }
    }
    if (clip.name === 'idle' && f === 0) idleCell = cell;
    blit(sheet, f * CELL, row * CELL, cell);
    frameNames[start + f] = `${clip.name}_${f}`;
  }
});

const tip = idleCell ? findMuzzleTip(idleCell) : { x: 118, y: 70 };
// Grip sits lower-right; FP barrel tip trends upper-center of cell.
const anchor = [0.62, 0.92];
const muzzleOffset = [
  Math.round(tip.x - anchor[0] * CELL),
  Math.round(tip.y - anchor[1] * CELL),
];

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'pistol.png'), PNG.sync.write(sheet));
fs.writeFileSync(
  path.join(outDir, 'pistol.json'),
  JSON.stringify(
    {
      image: 'pistol.png',
      cellWidth: CELL,
      cellHeight: CELL,
      columns: COLS,
      rows: ROWS,
      anchor,
      muzzleHint: { cell: tip, offsetFromAnchor: muzzleOffset },
      animations,
      frameNames,
    },
    null,
    2,
  ),
);

console.log(
  `Assembled pistol atlas ${COLS * CELL}x${ROWS * CELL}; muzzle offset ${muzzleOffset[0]},${muzzleOffset[1]}`,
);
