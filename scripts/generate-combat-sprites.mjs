/**
 * Generates placeholder combat sprites for Phase 2.
 * - Pistol spritesheet PNG + TexturePacker-style JSON
 * - Dummy character idle / hit / dead PNGs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'public', 'sprites');
const weaponsDir = path.join(root, 'weapons');
const charsDir = path.join(root, 'characters');

fs.mkdirSync(weaponsDir, { recursive: true });
fs.mkdirSync(charsDir, { recursive: true });

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function createPng(width, height, paint) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = paint(x, y, width, height);
      const idx = (width * y + x) << 2;
      png.data[idx] = clamp(r);
      png.data[idx + 1] = clamp(g);
      png.data[idx + 2] = clamp(b);
      png.data[idx + 3] = clamp(a);
    }
  }
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

// --- Pistol spritesheet (6 frames @ 128x128) ---
const frameW = 128;
const frameH = 128;
const frames = [
  { name: 'idle_0', kick: 0 },
  { name: 'idle_1', kick: 1 },
  { name: 'fire_0', kick: 8 },
  { name: 'fire_1', kick: 14 },
  { name: 'fire_2', kick: 6 },
  { name: 'muzzle_0', kick: 0, muzzleOnly: true },
];

const sheetW = frameW * frames.length;
const sheetH = frameH;
const sheet = createPng(sheetW, sheetH, () => [0, 0, 0, 0]);

frames.forEach((frame, i) => {
  const ox = i * frameW;
  if (frame.muzzleOnly) {
    // Soft yellow star flash
    for (let y = 20; y < 100; y++) {
      for (let x = 20; x < 100; x++) {
        const dx = x - 60;
        const dy = y - 60;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 28) {
          const a = Math.max(0, 220 - d * 7);
          const idx = (sheetW * y + (ox + x)) << 2;
          sheet.data[idx] = 255;
          sheet.data[idx + 1] = 220;
          sheet.data[idx + 2] = 80;
          sheet.data[idx + 3] = a;
        }
      }
    }
    return;
  }

  const kick = frame.kick;
  // Grip
  fillRect(sheet, ox + 48, 70 - kick, 28, 50, [62, 42, 28, 255]);
  // Slide / barrel
  fillRect(sheet, ox + 18, 48 - kick, 78, 22, [120, 120, 128, 255]);
  fillRect(sheet, ox + 10, 52 - kick, 20, 12, [90, 90, 98, 255]);
  // Trigger guard
  fillRect(sheet, ox + 52, 68 - kick, 16, 10, [80, 80, 86, 255]);
  // Highlight
  fillRect(sheet, ox + 24, 50 - kick, 50, 4, [180, 180, 190, 255]);
});

const pistolPngPath = path.join(weaponsDir, 'pistol.png');
writePng(pistolPngPath, sheet);

const framesJson = {};
frames.forEach((frame, i) => {
  framesJson[frame.name] = {
    frame: { x: i * frameW, y: 0, w: frameW, h: frameH },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: frameW, h: frameH },
    sourceSize: { w: frameW, h: frameH },
  };
});

const atlas = {
  frames: framesJson,
  meta: {
    app: 'bloodbound-generate-combat-sprites',
    version: '1.0',
    image: 'pistol.png',
    size: { w: sheetW, h: sheetH },
    scale: '1',
  },
};
fs.writeFileSync(path.join(weaponsDir, 'pistol.json'), JSON.stringify(atlas, null, 2));
console.log('Wrote', path.join(weaponsDir, 'pistol.json'));

// --- Dummy character sprites ---
function paintDummy(mood) {
  const w = 128;
  const h = 192;
  const png = createPng(w, h, () => [0, 0, 0, 0]);

  const robe =
    mood === 'dead' ? [40, 40, 48, 255] :
    mood === 'hit' ? [160, 50, 50, 255] :
    [70, 55, 90, 255];
  const skin =
    mood === 'dead' ? [90, 90, 90, 255] :
    mood === 'hit' ? [220, 180, 160, 255] :
    [190, 160, 140, 255];

  // Body
  fillRect(png, 34, 70, 60, 100, robe);
  // Head
  fillRect(png, 44, 28, 40, 44, skin);
  // Hood
  fillRect(png, 40, 20, 48, 18, robe);
  // Eyes
  if (mood !== 'dead') {
    fillRect(png, 52, 44, 8, 8, [20, 20, 30, 255]);
    fillRect(png, 68, 44, 8, 8, [20, 20, 30, 255]);
  } else {
    fillRect(png, 50, 46, 12, 3, [20, 20, 30, 255]);
    fillRect(png, 66, 46, 12, 3, [20, 20, 30, 255]);
  }
  // Arms
  fillRect(png, 18, 80, 18, 55, robe);
  fillRect(png, 92, 80, 18, 55, robe);

  if (mood === 'hit') {
    fillRect(png, 58, 100, 14, 22, [200, 30, 30, 220]);
  }

  return png;
}

writePng(path.join(charsDir, 'dummy-idle.png'), paintDummy('idle'));
writePng(path.join(charsDir, 'dummy-hit.png'), paintDummy('hit'));
writePng(path.join(charsDir, 'dummy-dead.png'), paintDummy('dead'));

// --- Cultist spritesheet (Phase 3 animated enemy) ---
const cultistFrames = [
  { name: 'idle_0', pose: 'idle', shift: 0 },
  { name: 'idle_1', pose: 'idle', shift: 2 },
  { name: 'walk_0', pose: 'walk', shift: -4 },
  { name: 'walk_1', pose: 'walk', shift: 4 },
  { name: 'attack_0', pose: 'attack', shift: 0 },
  { name: 'attack_1', pose: 'attack', shift: 0, flash: true },
  { name: 'hit_0', pose: 'hit', shift: 0 },
  { name: 'dead_0', pose: 'dead', shift: 0 },
];

const cfW = 96;
const cfH = 144;
const cultistSheet = createPng(cfW * cultistFrames.length, cfH, () => [0, 0, 0, 0]);

function paintCultistFrame(png, ox, pose, shift, flash) {
  const robe =
    pose === 'dead' ? [40, 40, 48, 255] :
    pose === 'hit' ? [160, 50, 50, 255] :
    pose === 'attack' ? [90, 45, 110, 255] :
    [70, 55, 90, 255];
  const skin =
    pose === 'dead' ? [90, 90, 90, 255] :
    pose === 'hit' ? [220, 180, 160, 255] :
    [190, 160, 140, 255];

  const leg = pose === 'dead' ? 0 : 8;
  fillRect(png, ox + 28 + shift, 55, 40, 70, robe);
  fillRect(png, ox + 34 + shift, 20, 28, 34, skin);
  fillRect(png, ox + 30 + shift, 14, 36, 14, robe);
  if (pose !== 'dead') {
    fillRect(png, ox + 40 + shift, 32, 6, 6, [20, 20, 30, 255]);
    fillRect(png, ox + 52 + shift, 32, 6, 6, [20, 20, 30, 255]);
  }
  // Arms
  if (pose === 'attack') {
    fillRect(png, ox + 10 + shift, 60, 18, 14, robe);
    fillRect(png, ox + 68 + shift, 58, 22, 12, robe);
    fillRect(png, ox + 82 + shift, 54, 10, 8, [140, 140, 150, 255]);
  } else {
    fillRect(png, ox + 14 + shift, 62, 14, 40, robe);
    fillRect(png, ox + 68 + shift, 62, 14, 40, robe);
  }
  // Legs / stance
  fillRect(png, ox + 30 + shift - leg, 120, 14, 20, robe);
  fillRect(png, ox + 52 + shift + leg, 120, 14, 20, robe);

  if (pose === 'hit') {
    fillRect(png, ox + 42 + shift, 80, 12, 18, [200, 30, 30, 220]);
  }
  if (flash) {
    for (let y = 40; y < 70; y++) {
      for (let x = 78; x < 95; x++) {
        const dx = x - 88;
        const dy = y - 55;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 10) {
          const idx = (png.width * y + (ox + x)) << 2;
          png.data[idx] = 255;
          png.data[idx + 1] = 200;
          png.data[idx + 2] = 80;
          png.data[idx + 3] = Math.max(0, 200 - d * 12);
        }
      }
    }
  }
}

cultistFrames.forEach((frame, i) => {
  paintCultistFrame(cultistSheet, i * cfW, frame.pose, frame.shift, frame.flash);
});
writePng(path.join(charsDir, 'cultist.png'), cultistSheet);

const cultistAtlasFrames = {};
cultistFrames.forEach((frame, i) => {
  cultistAtlasFrames[frame.name] = {
    frame: { x: i * cfW, y: 0, w: cfW, h: cfH },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: cfW, h: cfH },
    sourceSize: { w: cfW, h: cfH },
  };
});
fs.writeFileSync(
  path.join(charsDir, 'cultist.json'),
  JSON.stringify(
    {
      frames: cultistAtlasFrames,
      meta: {
        app: 'bloodbound-generate-combat-sprites',
        version: '1.0',
        image: 'cultist.png',
        size: { w: cfW * cultistFrames.length, h: cfH },
        scale: '1',
      },
    },
    null,
    2,
  ),
);
console.log('Wrote', path.join(charsDir, 'cultist.json'));

console.log('Combat sprite generation complete.');
