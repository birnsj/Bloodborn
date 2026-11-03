/**
 * Build pistol atlas from the user's FPS viewmodel reference image.
 * One clear FP gun the player can replace later.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const refPath = path.join(
  process.env.USERPROFILE || '',
  '.cursor',
  'projects',
  'd-Bloodbound-Proto',
  'assets',
  'image-8b8ed601-ddb3-4614-aeb3-65ccb4c61486.png',
);
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

/** Fit reference into cell with transparent BG; nudge for anim variants. */
function makeGunCell(ref, { dy = 0, dx = 0, darken = 0, flash = false } = {}) {
  const cell = createPng(pfW, pfH);
  // Cover most of the cell — FPS guns are large on screen.
  const marginX = 8;
  const marginY = 8;
  const dstW = pfW - marginX * 2;
  const dstH = pfH - marginY * 2;
  const scale = Math.min(dstW / ref.width, dstH / ref.height);
  const drawW = Math.floor(ref.width * scale);
  const drawH = Math.floor(ref.height * scale);
  const ox = Math.floor((pfW - drawW) / 2) + dx;
  const oy = Math.floor((pfH - drawH) / 2) + dy + 12; // bias down so muzzle aims up-left

  for (let y = 0; y < drawH; y++) {
    for (let x = 0; x < drawW; x++) {
      const sx = (x / drawW) * ref.width;
      const sy = (y / drawH) * ref.height;
      let [r, g, b, a] = sample(ref, sx, sy);
      // Knock out near-white / gray studio backdrop
      if (a > 0 && r > 170 && g > 170 && b > 170 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25) {
        a = 0;
      }
      if (a < 8) continue;
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
      cell.data[di + 3] = a;
    }
  }

  if (flash) {
    // Soft muzzle bloom near upper-left of gun tip region
    const cx = 70;
    const cy = 70;
    const rad = 42;
    for (let y = cy - rad; y <= cy + rad; y++) {
      for (let x = cx - rad; x <= cx + rad; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d >= rad || x < 0 || y < 0 || x >= pfW || y >= pfH) continue;
        const t = d / rad;
        const di = (pfW * y + x) << 2;
        const a = Math.round(220 * (1 - t * t));
        // Additive-ish over existing
        cell.data[di] = Math.min(255, cell.data[di] + Math.round(255 * (1 - t)));
        cell.data[di + 1] = Math.min(255, cell.data[di + 1] + Math.round(220 * (1 - t)));
        cell.data[di + 2] = Math.min(255, cell.data[di + 2] + Math.round(80 * (1 - t)));
        cell.data[di + 3] = Math.max(cell.data[di + 3], a);
      }
    }
  }
  return cell;
}

function makeMuzzleCell(scale) {
  const cell = createPng(pfW, pfH);
  const cx = 72;
  const cy = 72;
  const rad = 48 * scale;
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
  console.error('Reference FPS weapon image not found:', refPath);
  process.exit(1);
}

const ref = PNG.sync.read(fs.readFileSync(refPath));
const sheet = createPng(cols * pfW, rows * pfH);
const animations = {};
const frameNames = {};

const variants = {
  idle: [
    { dy: 0 },
    { dy: -2 },
    { dy: 1 },
  ],
  fire: [
    { dy: -4, flash: true },
    { dy: -14 },
    { dy: -8 },
    { dy: -2 },
  ],
  reload: [
    { dy: 2, dx: 2 },
    { dy: 6, dx: 4 },
    { dy: 10, dx: 2 },
    { dy: 4 },
  ],
  equip: [
    { dy: 28, darken: 20 },
    { dy: 14, darken: 10 },
    { dy: 0 },
  ],
  lower: [
    { dy: 0 },
    { dy: 16, darken: 10 },
    { dy: 32, darken: 25 },
  ],
};

clips.forEach((clip, row) => {
  const start = row * cols;
  animations[clip.name] = { start, count: clip.frames };
  for (let f = 0; f < clip.frames; f++) {
    let cell;
    if (clip.name === 'muzzle') {
      cell = makeMuzzleCell(1 + f * 0.35);
    } else {
      const opts = variants[clip.name][f] || {};
      cell = makeGunCell(ref, opts);
    }
    blit(sheet, f * pfW, row * pfH, cell);
    frameNames[start + f] = `${clip.name}_${f}`;
  }
});

fs.mkdirSync(outDir, { recursive: true });
const pngPath = path.join(outDir, 'pistol.png');
fs.writeFileSync(pngPath, PNG.sync.write(sheet));
const atlas = {
  image: 'pistol.png',
  cellWidth: pfW,
  cellHeight: pfH,
  columns: cols,
  rows,
  anchor: [0.78, 0.92],
  animations,
  frameNames,
};
fs.writeFileSync(path.join(outDir, 'pistol.json'), JSON.stringify(atlas, null, 2));
console.log('Wrote FPS reference pistol atlas', pngPath);
