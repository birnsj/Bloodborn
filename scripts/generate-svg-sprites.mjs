/**
 * Generate SVG even-grid masters + atlas manifests (Phase 5 SVG production).
 * Native vector art only — no embedded rasters.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSvgSheet, guideGrid } from './lib/svgSheet.js';
import { weaponFrameArt } from './lib/svgWeaponArt.js';
import { cultistFrameArt, DIRS } from './lib/svgCultistArt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const weaponsSvg = path.join(root, 'public', 'sprites', 'weapons', 'svg');
const charsSvg = path.join(root, 'public', 'sprites', 'characters', 'svg');

function writeSheet(outDir, name, sheet, manifest) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${name}.svg`), sheet);
  fs.writeFileSync(path.join(outDir, `${name}.atlas.json`), JSON.stringify(manifest, null, 2));
  console.log('Wrote', path.join(outDir, `${name}.svg`));
}

function packWeaponSheetA() {
  const cellW = 512;
  const cellH = 512;
  const columns = 4;
  const rows = 4;
  const width = 2048;
  const height = 2048;
  const layout = [
    { clip: 'idle', frames: 4, start: 0 },
    { clip: 'walk', frames: 4, start: 4 },
    { clip: 'fire', frames: 4, start: 8 },
    { clip: 'recoil', frames: 4, start: 12 },
  ];
  const cells = [];
  const animations = {};
  const frameNames = {};
  for (const { clip, frames, start } of layout) {
    animations[clip] = { start, count: frames };
    for (let f = 0; f < frames; f++) {
      const index = start + f;
      const col = index % columns;
      const row = Math.floor(index / columns);
      const id = `${clip}_${f}`;
      frameNames[String(index)] = id;
      cells.push({
        row,
        col,
        id,
        bodySvg: weaponFrameArt(clip, f),
      });
    }
  }
  const sheet = buildSvgSheet({
    width,
    height,
    cellWidth: cellW,
    cellHeight: cellH,
    columns,
    rows,
    cells,
    guideSvg: guideGrid(cellW, cellH, columns, rows, { x: 368, y: 480 }),
  });
  const manifest = {
    name: 'pistol-fp-a',
    outDir: 'weapons',
    image: 'pistol-fp-a.png',
    sourceSvg: 'svg/pistol-fp-a.svg',
    cellWidth: cellW,
    cellHeight: cellH,
    columns,
    rows,
    anchor: [0.72, 0.94],
    animations,
    frameNames,
  };
  writeSheet(weaponsSvg, 'pistol-fp-a', sheet, manifest);
}

function packWeaponSheetB() {
  const cellW = 512;
  const cellH = 512;
  const columns = 4;
  const rows = 4;
  const layout = [
    { clip: 'reload', frames: 6, start: 0 },
    { clip: 'equip', frames: 4, start: 6 },
    { clip: 'lower', frames: 4, start: 10 },
    { clip: 'muzzle', frames: 2, start: 14 },
  ];
  const cells = [];
  const animations = {};
  const frameNames = {};
  for (const { clip, frames, start } of layout) {
    animations[clip] = { start, count: frames };
    for (let f = 0; f < frames; f++) {
      const index = start + f;
      const col = index % columns;
      const row = Math.floor(index / columns);
      const id = `${clip}_${f}`;
      frameNames[String(index)] = id;
      cells.push({
        row,
        col,
        id,
        bodySvg: weaponFrameArt(clip, f),
      });
    }
  }
  const sheet = buildSvgSheet({
    width: 2048,
    height: 2048,
    cellWidth: cellW,
    cellHeight: cellH,
    columns,
    rows,
    cells,
    guideSvg: guideGrid(cellW, cellH, columns, rows, { x: 368, y: 480 }),
  });
  const manifest = {
    name: 'pistol-fp-b',
    outDir: 'weapons',
    image: 'pistol-fp-b.png',
    sourceSvg: 'svg/pistol-fp-b.svg',
    cellWidth: cellW,
    cellHeight: cellH,
    columns,
    rows,
    anchor: [0.72, 0.94],
    animations,
    frameNames,
  };
  writeSheet(weaponsSvg, 'pistol-fp-b', sheet, manifest);
}

function packCultistDirectional(name, clip, framesPerDir, startRow = 0) {
  const cellW = 256;
  const cellH = 512;
  const columns = 8;
  const rows = 4;
  const cells = [];
  const animations = {};
  let col = 0;
  let row = startRow;
  let linear = startRow * columns;

  for (const dir of DIRS) {
    const start = linear;
    animations[`${clip}_${dir}`] = { start, count: framesPerDir };
    for (let f = 0; f < framesPerDir; f++) {
      if (col >= columns) {
        col = 0;
        row += 1;
      }
      const id = `${clip}_${dir}_${f}`;
      cells.push({
        row,
        col,
        id,
        bodySvg: cultistFrameArt(clip, dir, f),
      });
      col += 1;
      linear += 1;
    }
  }
  return { cells, animations, cellW, cellH, columns, rows, linear };
}

function packCultistIdleDeath() {
  const cellW = 256;
  const cellH = 512;
  const columns = 8;
  const rows = 4;
  const { cells, animations } = packCultistDirectional('cultist-idle', 'idle', 4, 0);

  // death 6 + dead 1 starting after idle 20 → index 20
  let linear = 20;
  animations.death = { start: 20, count: 6 };
  for (let f = 0; f < 6; f++) {
    const col = linear % columns;
    const row = Math.floor(linear / columns);
    cells.push({
      row,
      col,
      id: `death_${f}`,
      bodySvg: cultistFrameArt('death', null, f),
    });
    linear += 1;
  }
  animations.dead = { start: 26, count: 1 };
  cells.push({
    row: Math.floor(26 / columns),
    col: 26 % columns,
    id: 'dead_0',
    bodySvg: cultistFrameArt('dead', null, 0),
  });

  const sheet = buildSvgSheet({
    width: 2048,
    height: 2048,
    cellWidth: cellW,
    cellHeight: cellH,
    columns,
    rows,
    cells,
    guideSvg: guideGrid(cellW, cellH, columns, rows, { x: 128, y: 500 }),
  });
  writeSheet(charsSvg, 'cultist-idle', sheet, {
    name: 'cultist-idle',
    outDir: 'characters',
    image: 'cultist-idle.png',
    sourceSvg: 'svg/cultist-idle.svg',
    cellWidth: cellW,
    cellHeight: cellH,
    columns,
    rows,
    anchor: [0.5, 0],
    animations,
  });
}

function packCultistClipSheet(fileName, clip, framesPerDir) {
  const cellW = 256;
  const cellH = 512;
  const columns = 8;
  const rows = 4;
  const { cells, animations } = packCultistDirectional(fileName, clip, framesPerDir, 0);
  const sheet = buildSvgSheet({
    width: 2048,
    height: 2048,
    cellWidth: cellW,
    cellHeight: cellH,
    columns,
    rows,
    cells,
    guideSvg: guideGrid(cellW, cellH, columns, rows, { x: 128, y: 500 }),
  });
  writeSheet(charsSvg, fileName, sheet, {
    name: fileName,
    outDir: 'characters',
    image: `${fileName}.png`,
    sourceSvg: `svg/${fileName}.svg`,
    cellWidth: cellW,
    cellHeight: cellH,
    columns,
    rows,
    anchor: [0.5, 0],
    animations,
  });
}

function packCultistAlertHit() {
  const cellW = 256;
  const cellH = 512;
  const columns = 8;
  const rows = 4;
  const cells = [];
  const animations = {};
  let linear = 0;

  for (const clip of ['alert', 'hit']) {
    const framesPerDir = 3;
    for (const dir of DIRS) {
      const start = linear;
      animations[`${clip}_${dir}`] = { start, count: framesPerDir };
      for (let f = 0; f < framesPerDir; f++) {
        const col = linear % columns;
        const row = Math.floor(linear / columns);
        cells.push({
          row,
          col,
          id: `${clip}_${dir}_${f}`,
          bodySvg: cultistFrameArt(clip, dir, f),
        });
        linear += 1;
      }
    }
  }

  const sheet = buildSvgSheet({
    width: 2048,
    height: 2048,
    cellWidth: cellW,
    cellHeight: cellH,
    columns,
    rows,
    cells,
    guideSvg: guideGrid(cellW, cellH, columns, rows, { x: 128, y: 500 }),
  });
  writeSheet(charsSvg, 'cultist-alert-hit', sheet, {
    name: 'cultist-alert-hit',
    outDir: 'characters',
    image: 'cultist-alert-hit.png',
    sourceSvg: 'svg/cultist-alert-hit.svg',
    cellWidth: cellW,
    cellHeight: cellH,
    columns,
    rows,
    anchor: [0.5, 0],
    animations,
  });
}

packWeaponSheetA();
packWeaponSheetB();
packCultistIdleDeath();
packCultistClipSheet('cultist-walk', 'walk', 6);
packCultistClipSheet('cultist-run', 'run', 6);
packCultistAlertHit();
packCultistClipSheet('cultist-attack', 'attack', 4);

console.log('SVG masters + atlas manifests generated.');
