/**
 * Even-grid placeholder combat sprites (Combat Presentation phase).
 * Cultist: 128×192, 5-dir + mirror (unique8 via CULTIST_UNIQUE8=1).
 * Pistol: 256×256 readable FP silhouette.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'public', 'sprites');
const weaponsDir = path.join(root, 'weapons');
const charsDir = path.join(root, 'characters');
const unique8 = process.env.CULTIST_UNIQUE8 === '1';
const MAX_EDGE = 2048;

fs.mkdirSync(weaponsDir, { recursive: true });
fs.mkdirSync(charsDir, { recursive: true });

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function createPng(width, height) {
  const png = new PNG({ width, height });
  png.data.fill(0);
  return png;
}

function writePng(filePath, png) {
  fs.writeFileSync(filePath, PNG.sync.write(png));
  console.log('Wrote', filePath);
}

function fillRect(png, x0, y0, w, h, color) {
  const { width, height, data } = png;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const idx = (width * y + x) << 2;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = color[3] ?? 255;
    }
  }
}

function fillEllipse(png, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        fillRect(png, x, y, 1, 1, color);
      }
    }
  }
}

function blitCell(dest, ox, oy, cell) {
  for (let y = 0; y < cell.height; y++) {
    for (let x = 0; x < cell.width; x++) {
      const si = (cell.width * y + x) << 2;
      if (cell.data[si + 3] === 0) continue;
      const di = (dest.width * (oy + y) + (ox + x)) << 2;
      dest.data[di] = cell.data[si];
      dest.data[di + 1] = cell.data[si + 1];
      dest.data[di + 2] = cell.data[si + 2];
      dest.data[di + 3] = cell.data[si + 3];
    }
  }
}

function writeGridAtlas(fileBase, png, cellW, cellH, columns, rows, animations, frameNames = null, anchor = [0.5, 0]) {
  const edgeW = columns * cellW;
  const edgeH = rows * cellH;
  if (edgeW > MAX_EDGE || edgeH > MAX_EDGE) {
    throw new Error(`Sheet ${edgeW}x${edgeH} exceeds ${MAX_EDGE} edge cap (${fileBase})`);
  }
  writePng(`${fileBase}.png`, png);
  const atlas = {
    image: path.basename(`${fileBase}.png`),
    cellWidth: cellW,
    cellHeight: cellH,
    columns,
    rows,
    anchor,
    animations,
  };
  if (frameNames) atlas.frameNames = frameNames;
  fs.writeFileSync(`${fileBase}.json`, JSON.stringify(atlas, null, 2));
  console.log('Wrote', `${fileBase}.json`, `(${edgeW}x${edgeH})`);
}

// --- Dummy character sprites (legacy) ---
function paintDummy(mood) {
  const w = 128;
  const h = 192;
  const png = createPng(w, h);
  const robe =
    mood === 'dead' ? [40, 40, 48, 255] :
    mood === 'hit' ? [160, 50, 50, 255] :
    [55, 40, 72, 255];
  const skin =
    mood === 'dead' ? [90, 90, 90, 255] :
    mood === 'hit' ? [220, 180, 160, 255] :
    [210, 175, 150, 255];
  fillRect(png, 34, 70, 60, 100, robe);
  fillRect(png, 44, 28, 40, 44, skin);
  fillRect(png, 40, 20, 48, 18, robe);
  if (mood !== 'dead') {
    fillRect(png, 52, 44, 8, 8, [20, 20, 30, 255]);
    fillRect(png, 68, 44, 8, 8, [20, 20, 30, 255]);
  }
  fillRect(png, 18, 80, 18, 55, robe);
  fillRect(png, 92, 80, 18, 55, robe);
  if (mood === 'hit') fillRect(png, 58, 100, 14, 22, [200, 30, 30, 220]);
  return png;
}

writePng(path.join(charsDir, 'dummy-idle.png'), paintDummy('idle'));
writePng(path.join(charsDir, 'dummy-hit.png'), paintDummy('hit'));
writePng(path.join(charsDir, 'dummy-dead.png'), paintDummy('dead'));

// --- Cultist 128×192 even grid ---
const DIRS5 = ['front', 'frontSide', 'side', 'backSide', 'back'];
const DIRS8 = [
  'front', 'frontSide', 'side', 'backSide', 'back',
  'backSideL', 'sideL', 'frontSideL',
];
const DIRS = unique8 ? DIRS8 : DIRS5;

const cfW = 128;
const cfH = 192;

const DIR_LEAN = {
  front: 0, frontSide: 6, side: 14, backSide: 6, back: 0,
  frontSideL: -6, sideL: -14, backSideL: -6,
};

function paintCultistCell(pose, frameIndex, dir, flash = false) {
  const png = createPng(cfW, cfH);
  const lean = DIR_LEAN[dir] ?? 0;
  const shift =
    pose === 'walk' || pose === 'run'
      ? (frameIndex % 2 === 0 ? -5 : 5) * (pose === 'run' ? 1.3 : 1)
      : pose === 'idle'
        ? (frameIndex % 2) * 2
        : 0;

  // High-contrast silhouette so the placeholder reads clearly in dark fog.
  const robeBase =
    pose === 'dead' || pose === 'death' ? [55, 50, 62] :
    pose === 'hit' ? [200, 55, 55] :
    pose === 'attack' ? [120, 55, 150] :
    pose === 'alert' ? [110, 70, 140] :
    pose === 'run' ? [95, 60, 125] :
    [88, 58, 120];
  const robe = [...robeBase, 255];
  const robeDark = [clamp(robeBase[0] - 28), clamp(robeBase[1] - 22), clamp(robeBase[2] - 18), 255];
  const skin =
    pose === 'dead' || pose === 'death' ? [120, 120, 125, 255] :
    pose === 'hit' ? [255, 200, 180, 255] :
    [245, 210, 185, 255];
  const hoodTrim = [35, 28, 50, 255];
  const outline = [12, 8, 18, 255];

  const ox = Math.round(lean + shift);
  const isBack = dir === 'back';
  const legSpread = pose === 'run' ? 16 : pose === 'walk' ? 10 : 6;

  if (pose === 'death') {
    const drop = Math.min(frameIndex, 3) * 14;
    const bodyY = 70 + drop;
    fillEllipse(png, 64 + ox, bodyY + 18, 40, 22, robe);
    fillEllipse(png, 48 + ox, bodyY + 4, 16, 14, skin);
    fillRect(png, 36 + ox, bodyY - 6, 40, 12, robe);
    return png;
  }
  if (pose === 'dead') {
    fillEllipse(png, 64 + ox, 150, 48, 18, robe);
    fillEllipse(png, 40 + ox, 142, 16, 12, skin);
    fillRect(png, 28 + ox, 132, 36, 12, robe);
    return png;
  }

  // Dark outline plate (readable against stone)
  fillRect(png, 28 + ox, 16, 72, 172, outline);

  // Legs (feet at bottom — Three.js center [0.5, 0])
  fillRect(png, 42 + ox - legSpread, 148, 20, 38, robeDark);
  fillRect(png, 68 + ox + legSpread, 148, 20, 38, robeDark);
  fillRect(png, 40 + ox - legSpread, 178, 24, 12, [30, 24, 40, 255]);
  fillRect(png, 66 + ox + legSpread, 178, 24, 12, [30, 24, 40, 255]);

  // Robe body — wide, high-contrast silhouette
  fillRect(png, 34 + ox, 74, 60, 82, robe);
  fillRect(png, 30 + ox, 98, 68, 58, robe);
  fillRect(png, 38 + ox, 74, 12, 74, robeDark);
  fillRect(png, 78 + ox, 74, 12, 74, robeDark);

  // Head / hood
  if (!isBack) {
    fillEllipse(png, 64 + ox, 48, 24, 28, skin);
    fillRect(png, 40 + ox, 18, 48, 32, robe);
    fillRect(png, 38 + ox, 14, 52, 14, hoodTrim);
    fillRect(png, 50 + ox, 44, 10, 10, [20, 16, 30, 255]);
    fillRect(png, 70 + ox, 44, 10, 10, [20, 16, 30, 255]);
    fillRect(png, 56 + ox, 60, 16, 4, [50, 35, 50, 220]);
  } else {
    fillRect(png, 40 + ox, 18, 48, 54, robe);
    fillRect(png, 38 + ox, 14, 52, 14, hoodTrim);
  }

  if (pose === 'attack') {
    // Aiming arm + pistol silhouette
    fillRect(png, 12 + ox, 88, 28, 16, robe);
    fillRect(png, 88 + ox, 82, 30, 14, robe);
    fillRect(png, 112 + ox, 76, 14, 10, [150, 150, 160, 255]);
    fillRect(png, 118 + ox, 72, 8, 6, [100, 100, 110, 255]);
  } else if (pose === 'alert') {
    fillRect(png, 18 + ox, 70, 20, 36, robe);
    fillRect(png, 90 + ox, 70, 20, 36, robe);
  } else {
    fillRect(png, 18 + ox, 88, 18, 48, robe);
    fillRect(png, 92 + ox, 88, 18, 48, robe);
  }

  if (pose === 'hit') {
    fillRect(png, 56 + ox, 100, 16, 24, [210, 30, 30, 230]);
  }
  if (flash) {
    for (let y = 60; y < 95; y++) {
      for (let x = 110; x < 128; x++) {
        const dx = x - 120;
        const dy = y - 76;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 14) {
          const idx = (png.width * y + x) << 2;
          png.data[idx] = 255;
          png.data[idx + 1] = 210;
          png.data[idx + 2] = 70;
          png.data[idx + 3] = Math.max(0, 220 - d * 12);
        }
      }
    }
  }

  return png;
}

// mirror5: 5 dirs × 3 = 15 cols × 128 = 1920 ≤ 2048
// unique8: 8 dirs × 2 = 16 cols × 128 = 2048
const locoFrames = unique8 ? 2 : 3;
const cultistAnims = [
  { name: 'idle', frames: locoFrames, directional: true },
  { name: 'walk', frames: locoFrames, directional: true },
  { name: 'run', frames: locoFrames, directional: true },
  { name: 'alert', frames: 2, directional: true },
  { name: 'attack', frames: unique8 ? 2 : 3, directional: true },
  { name: 'hit', frames: 2, directional: true },
  { name: 'death', frames: 4, directional: false },
  { name: 'dead', frames: 1, directional: false },
];

const maxDirFrames = Math.max(
  ...cultistAnims.filter((a) => a.directional).map((a) => a.frames * DIRS.length),
  4,
);
const cultistCols = maxDirFrames;
const cultistRows = cultistAnims.length;
const cultistSheet = createPng(cultistCols * cfW, cultistRows * cfH);
const cultistAnimations = {};

cultistAnims.forEach((anim, row) => {
  const oy = row * cfH;
  if (anim.directional) {
    DIRS.forEach((dir, di) => {
      const start = row * cultistCols + di * anim.frames;
      cultistAnimations[`${anim.name}_${dir}`] = { start, count: anim.frames };
      for (let f = 0; f < anim.frames; f++) {
        const cell = paintCultistCell(anim.name, f, dir, anim.name === 'attack' && f === 1);
        blitCell(cultistSheet, (di * anim.frames + f) * cfW, oy, cell);
      }
    });
  } else {
    const start = row * cultistCols;
    cultistAnimations[anim.name] = { start, count: anim.frames };
    for (let f = 0; f < anim.frames; f++) {
      blitCell(cultistSheet, f * cfW, oy, paintCultistCell(anim.name, f, 'front', false));
    }
  }
});

const cultistName = unique8 ? 'cultist-unique8' : 'cultist';
const SKIP_PROCEDURAL_CULTIST = !unique8 && process.env.PROCEDURAL_CULTIST !== '1';
if (SKIP_PROCEDURAL_CULTIST) {
  console.log('Skipping procedural cultist (use assemble-cultist-atlas). Set PROCEDURAL_CULTIST=1 to force.');
} else {
  writeGridAtlas(
    path.join(charsDir, cultistName),
    cultistSheet,
    cfW,
    cfH,
    cultistCols,
    cultistRows,
    cultistAnimations,
    null,
    [0.5, 0],
  );
  if (unique8) {
    console.log('Wrote unique8 atlas as cultist-unique8.*; set facingMode unique8 to use.');
  }
}

// --- Pistol: authored Phase 5 frames via assemble-weapon-atlas.mjs ---
// Procedural pistol paint is intentionally skipped so generate-combat-sprites
// does not overwrite gothic FP art. Pipeline: npm run assemble-weapon-atlas
const SKIP_PROCEDURAL_PISTOL = process.env.PROCEDURAL_PISTOL !== '1';
const pfW = 256;
const pfH = 256;
const pistolClips = [
  { name: 'idle', frames: 3, paint: (f) => ({ kick: f * 1.0, breathe: f }) },
  { name: 'fire', frames: 4, paint: (f) => ({ kick: [10, 22, 14, 6][f], slide: [0, 8, 4, 0][f] }) },
  { name: 'reload', frames: 4, paint: (f) => ({ kick: 3, mag: f }) },
  { name: 'equip', frames: 3, paint: (f) => ({ kick: 36 - f * 14 }) },
  { name: 'lower', frames: 3, paint: (f) => ({ kick: f * 16 }) },
  { name: 'muzzle', frames: 2, paint: (f) => ({ muzzleOnly: true, flashScale: 1 + f * 0.35 }) },
];
const pistolCols = 4;
const pistolRows = pistolClips.length;
const pistolSheet = createPng(pistolCols * pfW, pistolRows * pfH);
const pistolAnimations = {};
const pistolFrameNames = {};
if (SKIP_PROCEDURAL_PISTOL) {
  console.log('Skipping procedural pistol (use assemble-weapon-atlas). Set PROCEDURAL_PISTOL=1 to force.');
} else {

/** FP gun axis: t=0 near (bottom-right hand), t=1 muzzle into screen center. */
function fpPoint(t, kick = 0) {
  const nearX = 175;
  const nearY = 200 - kick;
  const farX = 95;
  const farY = 70 - kick * 0.3;
  return {
    x: nearX + (farX - nearX) * t,
    y: nearY + (farY - nearY) * t,
  };
}

function fpWidth(t) {
  // Chunky near end like the reference rifle body; taper only mildly.
  return 110 * (1 - t * 0.45);
}

function fillFpSegment(png, t0, t1, color, kick, heightScale = 0.7) {
  const steps = 36;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const t = t0 + (t1 - t0) * u;
    const p = fpPoint(t, kick);
    const w = Math.max(8, fpWidth(t));
    const h = Math.max(6, w * heightScale);
    fillRect(
      png,
      Math.round(p.x - w * 0.5),
      Math.round(p.y - h * 0.65),
      Math.round(w),
      Math.round(h),
      color,
    );
  }
}

/**
 * FPS viewmodel like the user reference: over-the-top camera,
 * thick gun body foreshortened into the world, hand underneath.
 */
function paintPistolCell({ kick = 0, slide = 0, mag = 0, muzzleOnly = false, flashScale = 1, breathe = 0 }) {
  const cell = createPng(pfW, pfH);
  const ky = kick + breathe * 0.4;

  if (muzzleOnly) {
    const tip = fpPoint(0.78, 0);
    const r = 40 * flashScale;
    for (let y = 0; y < pfH; y++) {
      for (let x = 0; x < pfW; x++) {
        const dx = x - tip.x;
        const dy = y - tip.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < r) {
          const t = d / r;
          const idx = (pfW * y + x) << 2;
          cell.data[idx] = 255;
          cell.data[idx + 1] = Math.round(245 - t * 50);
          cell.data[idx + 2] = Math.round(90 + t * 40);
          cell.data[idx + 3] = Math.round(255 * (1 - t * t));
        }
      }
    }
    return cell;
  }

  const gun = [45, 46, 52, 255];
  const gunHi = [88, 90, 100, 255];
  const gunLo = [22, 23, 28, 255];
  const rail = [120, 124, 135, 255];
  const skin = [220, 175, 145, 255];
  const skinDark = [185, 140, 115, 255];

  // Compact depth — pistol held close (not a long stick)
  fillFpSegment(cell, 0.02, 0.72, gun, ky, 0.78);
  fillFpSegment(cell, 0.04, 0.7, gunHi, ky - 5, 0.28);
  fillFpSegment(cell, 0.06, 0.68, gunLo, ky + 8, 0.28);

  // Picatinny-style top rail (reference cue)
  for (let i = 0; i < 7; i++) {
    const t = 0.12 + i * 0.07;
    const p = fpPoint(t, ky);
    const w = fpWidth(t) * 0.55;
    fillRect(
      cell,
      Math.round(p.x - w * 0.5),
      Math.round(p.y - fpWidth(t) * 0.55),
      Math.round(w),
      4,
      rail,
    );
  }

  // Rear block / receiver (big near camera)
  {
    const p = fpPoint(0.08, ky);
    const w = fpWidth(0.08);
    fillRect(cell, Math.round(p.x - w * 0.55), Math.round(p.y - w * 0.5), Math.round(w * 1.05), Math.round(w * 0.75), gun);
    fillRect(cell, Math.round(p.x - w * 0.5), Math.round(p.y - w * 0.55), Math.round(w * 0.95), Math.round(w * 0.2), gunHi);
    // Rear sight
    fillRect(cell, Math.round(p.x - 14), Math.round(p.y - w * 0.7), 12, 14, gunLo);
    fillRect(cell, Math.round(p.x + 4), Math.round(p.y - w * 0.7), 12, 14, gunLo);
  }

  // Slide kick toward camera
  if (slide > 0) {
    const p = fpPoint(0.1 + slide * 0.008, ky);
    const w = fpWidth(0.12);
    fillRect(cell, Math.round(p.x - w * 0.45), Math.round(p.y - w * 0.4), Math.round(w * 0.9), Math.round(w * 0.4), rail);
  }

  // Front sight ring (far)
  {
    const p = fpPoint(0.62, ky);
    fillEllipse(cell, Math.round(p.x), Math.round(p.y - 14), 9, 9, rail);
    fillEllipse(cell, Math.round(p.x), Math.round(p.y - 14), 4, 4, gunLo);
  }

  // Muzzle
  {
    const p = fpPoint(0.72, ky);
    fillEllipse(cell, Math.round(p.x), Math.round(p.y), 10, 7, gunLo);
    fillEllipse(cell, Math.round(p.x), Math.round(p.y), 4, 3, [0, 0, 0, 255]);
  }

  // Grip + mag under near receiver
  {
    const p = fpPoint(0.06, ky);
    fillRect(cell, Math.round(p.x + 8), Math.round(p.y + 18), 40, 60, [55, 40, 30, 255]);
    fillRect(cell, Math.round(p.x + 12), Math.round(p.y + 24), 12, 50, [80, 55, 40, 255]);
    fillRect(
      cell,
      Math.round(p.x + 14),
      Math.round(p.y + 48 + mag * 12),
      28,
      36,
      [35, 36, 42, 255],
    );
  }

  // Supporting hand under forend (reference style)
  {
    const p = fpPoint(0.28, ky);
    fillRect(cell, Math.round(p.x - 28), Math.round(p.y + 16), 64, 42, skin);
    fillRect(cell, Math.round(p.x - 18), Math.round(p.y + 24), 50, 14, skinDark);
    fillRect(cell, Math.round(p.x - 8), Math.round(p.y + 4), 30, 22, skin);
  }

  // Firing hand on grip
  {
    const p = fpPoint(0.04, ky);
    fillRect(cell, Math.round(p.x + 20), Math.round(p.y + 30), 58, 55, skin);
    fillRect(cell, Math.round(p.x + 28), Math.round(p.y + 40), 42, 16, skinDark);
  }

  return cell;
}

pistolClips.forEach((clip, row) => {
  const start = row * pistolCols;
  pistolAnimations[clip.name] = { start, count: clip.frames };
  for (let f = 0; f < clip.frames; f++) {
    const cell = paintPistolCell(clip.paint(f));
    blitCell(pistolSheet, f * pfW, row * pfH, cell);
    pistolFrameNames[start + f] = clip.name + '_' + f;
  }
});

writeGridAtlas(
  path.join(weaponsDir, 'pistol'),
  pistolSheet,
  pfW,
  pfH,
  pistolCols,
  pistolRows,
  pistolAnimations,
  pistolFrameNames,
  [0.72, 0.95],
);
}

console.log('Combat sprite generation complete.', unique8 ? '(unique8 cultist)' : '(mirror5 cultist)');
