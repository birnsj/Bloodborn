/**
 * Validates even-grid sprite atlases against ART_SPEC approved sizes.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import { APPROVED } from './lib/svgSheet.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const spritesRoot = path.join(__dirname, '..', 'public', 'sprites');

const SKIP_NAMES = new Set([
  'cultist-unique8.json',
  'pistol.json', // legacy 1024x1536 — kept until cutover optional
  'cultist.json', // legacy 1920x1536
]);

function collectAtlases(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === 'svg' || name === 'src' || name === 'legacy') continue;
      collectAtlases(full, list);
    } else if (name.endsWith('.json') && !name.endsWith('.atlas.json')) {
      list.push(full);
    }
  }
  return list;
}

let failed = 0;
const targets = collectAtlases(spritesRoot).filter((p) => !SKIP_NAMES.has(path.basename(p)));

if (!targets.length) {
  console.warn('No production atlas JSON found (export SVG sprites first).');
}

for (const jsonPath of targets) {
  const atlas = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  if (atlas.cellWidth == null || atlas.columns == null) {
    // Not a grid atlas (skip dummies / other json)
    continue;
  }

  const dir = path.dirname(jsonPath);
  const pngPath = path.join(dir, atlas.image);

  const required = ['image', 'cellWidth', 'cellHeight', 'columns', 'rows', 'animations'];
  for (const key of required) {
    if (atlas[key] == null) {
      console.error(`${jsonPath}: missing ${key}`);
      failed += 1;
    }
  }

  for (const [label, n] of [
    ['cellWidth', atlas.cellWidth],
    ['cellHeight', atlas.cellHeight],
    ['sheetW', atlas.cellWidth * atlas.columns],
    ['sheetH', atlas.cellHeight * atlas.rows],
  ]) {
    if (!APPROVED.has(n)) {
      console.error(`${jsonPath}: ${label}=${n} not in approved sizes`);
      failed += 1;
    }
  }

  if (!fs.existsSync(pngPath)) {
    console.error('MISSING PNG', pngPath);
    failed += 1;
    continue;
  }

  const png = PNG.sync.read(fs.readFileSync(pngPath));
  const expectedW = atlas.cellWidth * atlas.columns;
  const expectedH = atlas.cellHeight * atlas.rows;
  if (png.width !== expectedW || png.height !== expectedH) {
    console.error(
      `${jsonPath}: size ${png.width}x${png.height}, expected ${expectedW}x${expectedH}`,
    );
    failed += 1;
  }

  if (atlas.frames || atlas.meta) {
    console.error(`${jsonPath}: legacy TexturePacker fields present; use grid sidecar only`);
    failed += 1;
  }

  for (const [name, range] of Object.entries(atlas.animations ?? {})) {
    const start = range.start ?? 0;
    const count = range.count ?? 1;
    const last = start + count - 1;
    const max = atlas.columns * atlas.rows - 1;
    if (start < 0 || last > max) {
      console.error(`${jsonPath}: anim ${name} out of range (${start}+${count})`);
      failed += 1;
    }
  }

  console.log('OK', path.relative(path.join(__dirname, '..'), jsonPath), `${png.width}x${png.height}`);
}

if (failed) {
  console.error(`Validation failed (${failed} issues)`);
  process.exit(1);
}
console.log('All sprite atlases valid.');
