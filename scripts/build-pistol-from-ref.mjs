/**
 * Build pistol atlas from public/sprites/weapons/pistol-ref.png (real FPS viewmodel).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const refPath = path.join(root, 'public', 'sprites', 'weapons', 'pistol-ref.png');
const outDir = path.join(root, 'public', 'sprites', 'weapons');

const pfW = 256;
const pfH = 256;
const cols = 4;
const clips = [
  { name: 'idle', frames: 3 },
  { name: 'fire', frames: 4 },
  { name: 'reload', frames: 4 },
  { name: 'equip', frames: 3 },
  { name: 'lower', frames: 3 },
  { name: 'muzzle', frames: 2 },
];
const rows = clips.length;

function createPng(w, h) {
  const png = new PNG({ width: w, height: h });
  png.data.fill(0);
  return png;
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

function sample(src, x, y) {
  const ix = Math.max(0, Math.min(src.width - 1, Math.floor(x)));
  const iy = Math.max(0, Math.min(src.height - 1, Math.floor(y)));
  const i = (src.width * iy + ix) << 2;
  return [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]];
}

function isBackdrop(r, g, b) {
  // Studio gray / near-white backdrop from the reference render.
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max > 140 && max - min < 35;
}

/** Flip horizontally so gun sits naturally bottom-right, muzzle toward screen center. */
function makeGunCell(ref, { dy = 0, dx = 0, darken = 0, flash = false } = {}) {
  const cell = createPng(pfW, pfH);
  const margin = 6;
  const dstW = pfW - margin * 2;
  const dstH = pfH - margin * 2;
  const scale = Math.min(dstW / ref.width, dstH / ref.height) * 1.05;
  const drawW = Math.floor(ref.width * scale);
  const drawH = Math.floor(ref.height * scale);
  const ox = Math.floor((pfW - drawW) / 2) + dx;
  const oy = Math.floor((pfH - drawH) / 2) + dy + 8;

  for (let y = 0; y < drawH; y++) {
    for (let x = 0; x < drawW; x++) {
      // Horizontal flip while sampling
      const sx = ((drawW - 1 - x) / drawW) * ref.width;
      const sy = (y / drawH) * ref.height;
      let [r, g, b, a] = sample(ref, sx, sy);
      if (a < 8 || isBackdrop(r, g, b)) continue;
      if (darken) {
        r = Math.max(0, r - darken);
        g = Math.max(0, g - darken);
        b = Math.max(0, b - darken);
      }
      const dxp = ox + x;
      const dyp = oy + y;
      if (dxp < 0 || dyp < 0 || dxp >= pfW || dyp >= pfH) continue;
      const di = (pfW * dyp + dxp) << 2;
      cell.data[di] = r;
      cell.data[di + 1] = g;
      cell.data[di + 2] = b;
      cell.data[di + 3] = 255;
    }
  }

  if (flash) {
    const cx = 188;
    const cy = 68;
    const rad = 46;
    for (let y = cy - rad; y <= cy + rad; y++) {
      for (let x = cx - rad; x <= cx + rad; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d >= rad || x < 0 || y < 0 || x >= pfW || y >= pfH) continue;
        const t = d / rad;
        const di = (pfW * y + x) << 2;
        const a = Math.round(230 * (1 - t * t));
        cell.data[di] = Math.min(255, Math.max(cell.data[di], Math.round(255 * (1 - t))));
        cell.data[di + 1] = Math.min(255, Math.max(cell.data[di + 1], Math.round(230 * (1 - t))));
        cell.data[di + 2] = Math.min(255, cell.data[di + 2] + Math.round(70 * (1 - t)));
        cell.data[di + 3] = Math.max(cell.data[di + 3], a);
      }
    }
  }
  return cell;
}

function makeMuzzleCell(scale) {
  const cell = createPng(pfW, pfH);
  const cx = 188;
  const cy = 68;
  const rad = 50 * scale;
  for (let y = 0; y < pfH; y++) {
    for (let x = 0; x < pfW; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d >= rad) continue;
      const t = d / rad;
      const di = (pfW * y + x) << 2;
      cell.data[di] = 255;
      cell.data[di + 1] = Math.round(245 - t * 40);
      cell.data[di + 2] = Math.round(100 + t * 40);
      cell.data[di + 3] = Math.round(255 * (1 - t * t));
    }
  }
  return cell;
}

if (!fs.existsSync(refPath)) {
  console.error('Missing pistol-ref.png at', refPath);
  process.exit(1);
}

const ref = PNG.sync.read(fs.readFileSync(refPath));
const sheet = createPng(cols * pfW, rows * pfH);
const animations = {};
const frameNames = {};

const variants = {
  idle: [{ dy: 0 }, { dy: -2 }, { dy: 1 }],
  fire: [{ dy: -3, flash: true }, { dy: -12 }, { dy: -7 }, { dy: -1 }],
  reload: [{ dy: 2, dx: -2 }, { dy: 6, dx: -4 }, { dy: 10, dx: -2 }, { dy: 3 }],
  equip: [{ dy: 26, darken: 20 }, { dy: 12, darken: 8 }, { dy: 0 }],
  lower: [{ dy: 0 }, { dy: 14, darken: 10 }, { dy: 30, darken: 25 }],
};

clips.forEach((clip, row) => {
  const start = row * cols;
  animations[clip.name] = { start, count: clip.frames };
  for (let f = 0; f < clip.frames; f++) {
    const cell =
      clip.name === 'muzzle'
        ? makeMuzzleCell(1 + f * 0.35)
        : makeGunCell(ref, variants[clip.name][f] || {});
    blit(sheet, f * pfW, row * pfH, cell);
    frameNames[start + f] = `${clip.name}_${f}`;
  }
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'pistol.png'), PNG.sync.write(sheet));
fs.writeFileSync(
  path.join(outDir, 'pistol.json'),
  JSON.stringify(
    {
      image: 'pistol.png',
      cellWidth: pfW,
      cellHeight: pfH,
      columns: cols,
      rows,
      anchor: [0.72, 0.94],
      animations,
      frameNames,
    },
    null,
    2,
  ),
);
console.log('Wrote FPS viewmodel pistol atlas from pistol-ref.png');
