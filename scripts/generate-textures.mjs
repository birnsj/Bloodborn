/**
 * Generates tileable procedural textures for Phase 1 placeholders.
 * Output: public/textures/*.png
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'textures');

fs.mkdirSync(outDir, { recursive: true });

function clamp(v, min = 0, max = 255) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y, octaves = 4) {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * smoothNoise(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return value;
}

function writePng(name, size, paintFn) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = paintFn(x, y, size);
      const idx = (size * y + x) << 2;
      png.data[idx] = clamp(r);
      png.data[idx + 1] = clamp(g);
      png.data[idx + 2] = clamp(b);
      png.data[idx + 3] = 255;
    }
  }
  const file = path.join(outDir, name);
  fs.writeFileSync(file, PNG.sync.write(png));
  console.log('Wrote', file);
}

function stoneFloor(x, y, size) {
  const u = x / size;
  const v = y / size;
  const tiles = 4;
  const tx = (u * tiles) % 1;
  const ty = (v * tiles) % 1;
  const grout = tx < 0.04 || ty < 0.04 || tx > 0.96 || ty > 0.96;
  const n = fbm(u * 8, v * 8, 5);
  const base = 72 + n * 55;
  if (grout) return [base * 0.45, base * 0.42, base * 0.38];
  const shade = 0.85 + hash2(Math.floor(u * tiles), Math.floor(v * tiles)) * 0.25;
  return [base * shade, base * shade * 0.92, base * shade * 0.82];
}

function stoneWall(x, y, size) {
  const u = x / size;
  const v = y / size;
  const brickW = 8;
  const brickH = 4;
  const row = Math.floor(v * brickH);
  const offset = (row % 2) * 0.5;
  const col = Math.floor(u * brickW + offset);
  const lx = (u * brickW + offset) % 1;
  const ly = (v * brickH) % 1;
  const mortar = lx < 0.06 || ly < 0.08 || lx > 0.94 || ly > 0.92;
  const n = fbm(u * 10 + col, v * 10 + row, 4);
  const tone = 58 + n * 40 + hash2(col, row) * 18;
  if (mortar) return [tone * 0.55, tone * 0.52, tone * 0.48];
  return [tone * 1.05, tone * 0.95, tone * 0.82];
}

function ceiling(x, y, size) {
  const u = x / size;
  const v = y / size;
  const n = fbm(u * 6, v * 6, 5);
  const beams = Math.abs(((u * 4) % 1) - 0.5) < 0.06;
  const base = 42 + n * 28;
  if (beams) return [base * 0.55, base * 0.45, base * 0.35];
  return [base * 0.9, base * 0.88, base * 0.84];
}

function wood(x, y, size) {
  const u = x / size;
  const v = y / size;
  const grain = Math.sin(v * Math.PI * 28 + fbm(u * 3, v * 2, 3) * 6);
  const n = fbm(u * 4, v * 12, 4);
  const base = 78 + n * 35 + grain * 12;
  return [base * 1.15, base * 0.72, base * 0.38];
}

function pillar(x, y, size) {
  const u = x / size;
  const v = y / size;
  const bands = Math.abs(Math.sin(v * Math.PI * 8)) * 12;
  const n = fbm(u * 5, v * 8, 4);
  const base = 88 + n * 30 + bands;
  return [base, base * 0.94, base * 0.86];
}

writePng('stone-floor.png', 512, stoneFloor);
writePng('stone-wall.png', 512, stoneWall);
writePng('ceiling.png', 512, ceiling);
writePng('wood.png', 512, wood);
writePng('pillar.png', 512, pillar);
console.log('Texture generation complete.');
