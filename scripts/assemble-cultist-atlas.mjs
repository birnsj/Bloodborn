/**
 * Assemble Phase 5 authored cultist frames into even-grid 128×192 atlas (mirror5).
 * Sources: public/sprites/characters/src/cultist-{clip}-{dir}-{n}.png
 * Missing cells fall back to nearest authored pose (same dir → front → idle); logged.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'public', 'sprites', 'characters', 'src');
const outDir = path.join(root, 'public', 'sprites', 'characters');

const CELL_W = 128;
const CELL_H = 192;
const DIRS = ['front', 'frontSide', 'side', 'backSide', 'back'];
const COLS = 15;

const clips = [
  { name: 'idle', frames: 3, dirs: true },
  { name: 'walk', frames: 3, dirs: true },
  { name: 'run', frames: 3, dirs: true },
  { name: 'alert', frames: 2, dirs: true },
  { name: 'attack', frames: 3, dirs: true },
  { name: 'hit', frames: 2, dirs: true },
  { name: 'death', frames: 4, dirs: false },
  { name: 'dead', frames: 1, dirs: false },
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

function isBackdrop(r, g, b, a) {
  if (a < 12) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max > 200 && max - min < 45) return true;
  if (max > 160 && max - min < 28) return true;
  if (g > 140 && g > r * 1.25 && g > b * 1.25) return true;
  return false;
}

function stripBackdrop(src) {
  const out = createPng(src.width, src.height);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const i = (src.width * y + x) << 2;
      const r = src.data[i];
      const g = src.data[i + 1];
      const b = src.data[i + 2];
      const a = src.data[i + 3];
      if (isBackdrop(r, g, b, a)) continue;
      out.data[i] = r;
      out.data[i + 1] = g;
      out.data[i + 2] = b;
      out.data[i + 3] = 255;
    }
  }
  return out;
}

function contentBounds(src) {
  let minX = src.width;
  let minY = src.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (src.data[((src.width * y + x) << 2) + 3] < 16) continue;
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

function fitToCell(src, { lean = 0 } = {}) {
  const cell = createPng(CELL_W, CELL_H);
  const bounds = contentBounds(src);
  if (!bounds) return cell;

  const marginX = 4;
  const marginTop = 4;
  const marginBottom = 2;
  const usableW = CELL_W - marginX * 2;
  const usableH = CELL_H - marginTop - marginBottom;
  const scale = Math.min(usableW / bounds.w, usableH / bounds.h) * 0.98;
  const drawW = Math.max(1, Math.floor(bounds.w * scale));
  const drawH = Math.max(1, Math.floor(bounds.h * scale));
  const ox = Math.floor((CELL_W - drawW) / 2);
  const oy = CELL_H - marginBottom - drawH;

  for (let y = 0; y < drawH; y++) {
    for (let x = 0; x < drawW; x++) {
      const sx = bounds.minX + (x / drawW) * bounds.w + lean * (y / drawH) * 4;
      const sy = bounds.minY + (y / drawH) * bounds.h;
      const [r, g, b, a] = sample(src, sx, sy);
      if (a < 16) continue;
      const dx = ox + x;
      const dy = oy + y;
      if (dx < 0 || dy < 0 || dx >= CELL_W || dy >= CELL_H) continue;
      const di = (CELL_W * dy + dx) << 2;
      cell.data[di] = r;
      cell.data[di + 1] = g;
      cell.data[di + 2] = b;
      cell.data[di + 3] = 255;
    }
  }
  return cell;
}

/** Approximate fallen body by rotating upright art ~90° (death/dead fallback only). */
function fitFallen(src) {
  const cell = createPng(CELL_W, CELL_H);
  const bounds = contentBounds(src);
  if (!bounds) return cell;
  const srcW = bounds.w;
  const srcH = bounds.h;
  const margin = 4;
  const scale = Math.min((CELL_W - margin * 2) / srcH, (CELL_H - margin * 2) / srcW) * 0.95;
  const drawW = Math.floor(srcH * scale);
  const drawH = Math.floor(srcW * scale);
  const ox = Math.floor((CELL_W - drawW) / 2);
  const oy = CELL_H - margin - drawH;

  for (let y = 0; y < drawH; y++) {
    for (let x = 0; x < drawW; x++) {
      const u = x / drawW;
      const v = y / drawH;
      const sx = bounds.minX + (1 - v) * srcW;
      const sy = bounds.minY + u * srcH;
      const [r, g, b, a] = sample(src, sx, sy);
      if (a < 16) continue;
      const dx = ox + x;
      const dy = oy + y;
      if (dx < 0 || dy < 0 || dx >= CELL_W || dy >= CELL_H) continue;
      const di = (CELL_W * dy + dx) << 2;
      cell.data[di] = r;
      cell.data[di + 1] = g;
      cell.data[di + 2] = b;
      cell.data[di + 3] = 255;
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

const DIR_NEIGHBORS = {
  front: ['frontSide', 'side', 'backSide', 'back'],
  frontSide: ['front', 'side', 'backSide', 'back'],
  side: ['frontSide', 'backSide', 'front', 'back'],
  backSide: ['back', 'side', 'frontSide', 'front'],
  back: ['backSide', 'side', 'frontSide', 'front'],
};

function resolveSource(clip, dir, frame) {
  const candidates = [];
  const push = (c, d, f) => {
    if (d) candidates.push(path.join(srcDir, `cultist-${c}-${d}-${f}.png`));
    else candidates.push(path.join(srcDir, `cultist-${c}-${f}.png`));
  };

  if (dir) {
    push(clip, dir, frame);
    push(clip, dir, 0);
    if (frame > 0) push(clip, dir, frame - 1);
    for (const d of DIR_NEIGHBORS[dir] ?? DIRS) {
      push(clip, d, frame);
      push(clip, d, 0);
    }
    // Cross-clip same facing (e.g. missing run → walk → idle)
    if (clip === 'run') {
      push('walk', dir, frame);
      push('walk', dir, 0);
    }
    if (clip === 'walk' || clip === 'run' || clip === 'alert' || clip === 'attack' || clip === 'hit') {
      push('idle', dir, 0);
    }
  } else {
    push(clip, null, frame);
    push(clip, null, 0);
    if (clip === 'death' || clip === 'dead') {
      push('hit', 'front', 0);
      push('idle', 'front', 0);
    }
  }
  push('idle', 'front', 0);

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

fs.mkdirSync(srcDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const sheet = createPng(COLS * CELL_W, ROWS * CELL_H);
const animations = {};
const fallbacks = [];

clips.forEach((clip, row) => {
  let col = 0;
  if (clip.dirs) {
    for (const dir of DIRS) {
      const start = row * COLS + col;
      animations[`${clip.name}_${dir}`] = { start, count: clip.frames };
      for (let f = 0; f < clip.frames; f++) {
        const expected = path.join(srcDir, `cultist-${clip.name}-${dir}-${f}.png`);
        const srcPath = resolveSource(clip.name, dir, f);
        if (!srcPath) {
          fallbacks.push(`${clip.name}_${dir}_${f}: EMPTY`);
          continue;
        }
        if (srcPath !== expected) {
          fallbacks.push(`${clip.name}_${dir}_${f} ← ${path.basename(srcPath)}`);
        }
        const stripped = stripBackdrop(loadPng(srcPath));
        const lean = clip.name === 'walk' || clip.name === 'run' ? (f - 1) * 0.4 : 0;
        const cell = fitToCell(stripped, { lean });
        blit(sheet, (col + f) * CELL_W, row * CELL_H, cell);
      }
      col += clip.frames;
    }
  } else {
    const start = row * COLS;
    animations[clip.name] = { start, count: clip.frames };
    for (let f = 0; f < clip.frames; f++) {
      const expected = path.join(srcDir, `cultist-${clip.name}-${f}.png`);
      const srcPath = resolveSource(clip.name, null, f);
      if (!srcPath) {
        fallbacks.push(`${clip.name}_${f}: EMPTY`);
        continue;
      }
      if (srcPath !== expected) {
        fallbacks.push(`${clip.name}_${f} ← ${path.basename(srcPath)}`);
      }
      const stripped = stripBackdrop(loadPng(srcPath));
      const bounds = contentBounds(stripped);
      // Already-horizontal corpses: fit as-is. Tall upright art: rotate into fallen pose.
      const alreadyFallen = bounds && bounds.w >= bounds.h * 0.85;
      const cell =
        (clip.name === 'death' || clip.name === 'dead') && !alreadyFallen
          ? fitFallen(stripped)
          : fitToCell(stripped);
      // Column within this row is f (0..count-1), not absolute cell index.
      blit(sheet, f * CELL_W, row * CELL_H, cell);
    }
  }
});

fs.writeFileSync(path.join(outDir, 'cultist.png'), PNG.sync.write(sheet));
fs.writeFileSync(
  path.join(outDir, 'cultist.json'),
  JSON.stringify(
    {
      image: 'cultist.png',
      cellWidth: CELL_W,
      cellHeight: CELL_H,
      columns: COLS,
      rows: ROWS,
      anchor: [0.5, 0],
      animations,
    },
    null,
    2,
  ),
);

console.log(
  `Assembled cultist atlas ${COLS * CELL_W}x${ROWS * CELL_H}; fallbacks ${fallbacks.length}`,
);
if (fallbacks.length) {
  console.log('Fallbacks (first 40):');
  fallbacks.slice(0, 40).forEach((f) => console.log(' ', f));
}
