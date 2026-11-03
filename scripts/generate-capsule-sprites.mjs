/**
 * Trek-style capsule/ellipsoid sprites for BloodBound cultist + FP shotgun.
 * Same technique as ST-Adventures makeCharacterSprites.mjs — lit volumetric limbs.
 * Overwrites public/sprites/characters/cultist-*.png and weapons/pistol-fp-*.png.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import {
  add,
  capsule,
  deg,
  ellipsoid,
  fpWeaponScene,
  isoScene,
  material,
  mapShapes,
  ontoGround,
  pitchPoint,
  renderCell,
  blitCell,
  scale,
  sub,
  v3,
} from './lib/capsuleRender.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const charsOut = path.join(root, 'public', 'sprites', 'characters');
const weaponsOut = path.join(root, 'public', 'sprites', 'weapons');

const DIRS = ['front', 'frontSide', 'side', 'backSide', 'back'];
// Match Trek-ish facings (BloodBound mirror5).
const DIR_ANGLE = {
  front: Math.PI / 4,
  frontSide: 0,
  side: -Math.PI / 4,
  backSide: -Math.PI / 2,
  back: (-3 * Math.PI) / 4,
};

// High-contrast like Trek gold tunic: robe must read on dark dungeon + black atlas bg.
const ROBE = material('#9a6a88', { spec: 0.16, shininess: 14, part: 'robe' });
const ROBE_DK = material('#6a4058', { spec: 0.14, shininess: 12, part: 'robe' });
const HOOD = material('#2a1824', { spec: 0.18, shininess: 16, part: 'hood' });
const SKIN = material('#e8d4bc', { spec: 0.16, shininess: 20, part: 'skin' });
const EYES = material('#1a1410', { spec: 0.45, shininess: 40, part: 'eyes' });
const LIPS = material('#8a4050', { spec: 0.2, shininess: 22, part: 'lips' });
const BOOTS = material('#1a1218', { spec: 0.4, shininess: 28, part: 'boots' });
const GOLD = material('#f0d080', { spec: 0.55, shininess: 30, part: 'gold' });
const GUN_METAL = material('#7a7a84', { spec: 0.55, shininess: 36, part: 'gun' });
const GUN_DK = material('#1a1a20', { spec: 0.4, shininess: 28, part: 'gun' });
const GUN_HI = material('#d0d0d8', { spec: 0.45, shininess: 24, part: 'gun' });
const GLOVE = material('#141210', { spec: 0.12, shininess: 12, part: 'glove' });
const WOOD = material('#3a2818', { spec: 0.2, shininess: 16, part: 'stock' });

function buildCultist(pose) {
  const hs = 1.05;
  const ws = 1.05;
  const shapes = [];
  const put = (s) => shapes.push(s);

  const hipHalf = 2.9 * ws;
  const hipZ = 23 * hs;
  const thighLen = 10.5 * hs;
  const shinLen = 10.5 * hs;

  // sideStep: lateral weight transfer for strafe cycles (character-local +Y)
  const sideStep = pose.sideStep ?? 0;
  const feet = [1, -1].map((side, index) => {
    const hipY = side * hipHalf + sideStep * side * 0.9;
    const hip = v3(0, hipY, hipZ);
    const thigh = pose.thigh[index];
    const shin = thigh - pose.knee[index];
    // Abduct the leading foot sideways while the other stays under the hip
    const lead = index === 0 ? Math.max(0, sideStep) : Math.max(0, -sideStep);
    const yOut = side * (0.4 + lead * 3.2);
    const knee = add(hip, v3(Math.sin(thigh) * thighLen, yOut * 0.35, -Math.cos(thigh) * thighLen));
    const ankle = add(knee, v3(Math.sin(shin) * shinLen, yOut * 0.65, -Math.cos(shin) * shinLen));
    return { hip, knee, ankle };
  });
  const lift = -Math.min(...feet.map(({ ankle }) => ankle[2])) + 1.7 + (pose.bounce ?? 0);
  const up = (p) => add(p, v3(0, 0, lift));
  for (const { hip, knee, ankle } of feet) {
    put(capsule(up(hip), up(knee), 2.5 * ws, ROBE_DK));
    put(capsule(up(knee), up(ankle), 2.15 * ws, ROBE));
    put(capsule(up(ankle), up(add(ankle, v3(2.5, 0, -0.3))), 1.65 * ws, BOOTS));
  }

  const z = (value) => value * hs + lift - 1.7;
  const breathe = pose.breathe ?? 0;
  // Lower robe / pelvis
  put(ellipsoid(v3(0, 0, z(24)), [3.6 * ws, hipHalf + 2.6, 4.2 * hs], ROBE));
  // Torso
  const shoulderHalf = 6.2 * ws;
  put(ellipsoid(v3(0, 0, z(32.5)), [3.6 * ws, shoulderHalf * 0.9, (8.8 + breathe * 0.25) * hs], ROBE));
  const shoulderZ = z(38.5) + breathe * 0.25;
  put(capsule(v3(0, -shoulderHalf + 1.4, shoulderZ), v3(0, shoulderHalf - 1.4, shoulderZ), 2.7 * ws, ROBE));
  put(ellipsoid(v3(3.2 * ws, 0, z(34)), [0.55, 0.9, 1.1], GOLD));

  // Arms
  ;[1, -1].forEach((side, index) => {
    const swing = pose.arm[index];
    const bend = pose.elbow ? pose.elbow[index] : deg(14) + Math.max(0, swing) * 0.65;
    const shoulder = v3(0, side * shoulderHalf, shoulderZ);
    const elbow = add(shoulder, v3(Math.sin(swing) * 7.8 * hs, side * 0.7, -Math.cos(swing) * 7.8 * hs));
    const forearm = swing + bend;
    const wrist = add(elbow, v3(Math.sin(forearm) * 7.1 * hs, side * 0.3, -Math.cos(forearm) * 7.1 * hs));
    put(capsule(shoulder, elbow, 1.9 * ws, ROBE_DK));
    put(capsule(elbow, wrist, 1.6 * ws, ROBE));
    const along = v3(Math.sin(forearm), 0, -Math.cos(forearm));
    put(ellipsoid(add(wrist, scale(along, 1.1)), [1.35, 1.15, 1.45], SKIN));
    if (pose.prop && index === 1) {
      put(capsule(add(wrist, scale(along, 0.8)), add(wrist, scale(along, 4.2)), 0.55, GUN_METAL));
    }
  });

  // Neck / head / face (hood open in front so features read)
  put(capsule(v3(0.2, 0, z(39.5)), v3(0.3, 0, z(44)), 1.7 * ws, SKIN));
  const head = v3(0.3, 0, z(47.2));
  put(ellipsoid(head, [3.1, 2.85, 3.7], SKIN));
  // Nose (bigger — must read at game scale)
  put(ellipsoid(add(head, v3(3.15, 0, -0.4)), [1.0, 0.7, 1.15], SKIN));
  // Brows
  ;[1, -1].forEach((side) =>
    put(ellipsoid(add(head, v3(2.5, side * 1.2, 1.15)), [0.35, 0.85, 0.28], HOOD)),
  );
  // Eyes
  ;[1, -1].forEach((side) => {
    put(ellipsoid(add(head, v3(2.7, side * 1.25, 0.4)), [0.55, 0.7, 0.55], material('#f5efe4', { spec: 0.25, shininess: 30, part: 'eyes' })));
    put(ellipsoid(add(head, v3(3.05, side * 1.25, 0.4)), [0.38, 0.42, 0.38], EYES));
    put(ellipsoid(add(head, v3(3.25, side * 1.25, 0.45)), [0.14, 0.14, 0.14], material('#f8f0e0', { spec: 0.7, shininess: 55, part: 'eyes' })));
  });
  // Mouth
  put(ellipsoid(add(head, v3(2.55, 0, -1.7)), [0.4, 1.05, 0.35], LIPS));
  put(ellipsoid(add(head, v3(2.7, 0, -1.7)), [0.2, 0.65, 0.18], material('#3a1820', { part: 'lips' })));
  // Hood: only behind a sloping cowl line so the face stays open (Trek hairline trick)
  const rel = (p) => sub(p, head);
  put(
    ellipsoid(add(head, v3(-0.45, 0, 0.75)), [3.55, 3.35, 3.9], HOOD, (p) => {
      const r = rel(p);
      return r[0] < (r[2] - 0.2) * 1.15;
    }),
  );
  put(ellipsoid(add(head, v3(-0.6, 0, -0.9)), [3.1, 3.4, 2.3], HOOD, (p) => rel(p)[0] < -0.4));
  // Cowl sides framing the face
  ;[1, -1].forEach((side) =>
    put(ellipsoid(add(head, v3(0.6, side * 2.9, -0.2)), [1.6, 1.1, 2.4], HOOD)),
  );

  let figure = shapes;
  if (pose.lean) {
    const k = Math.tan(pose.lean);
    figure = mapShapes(figure, (p) => [p[0] + p[2] * k, p[1], p[2]]);
  }
  // Lateral lean for strafe (shear in Y)
  if (pose.sideLean) {
    const k = Math.tan(pose.sideLean);
    figure = mapShapes(figure, (p) => [p[0], p[1] + p[2] * k, p[2]]);
  }
  // Fall: pitch whole body, settle on floor, center on origin so iso puts it at the feet
  if (pose.pitch) {
    const pivot = v3(0, 0, 1.5);
    figure = mapShapes(figure, (p) => pitchPoint(p, pose.pitch, pivot), { dropKeep: true });
    figure = ontoGround(figure);
    let minX = Infinity;
    let maxX = -Infinity;
    for (const shape of figure) {
      const xs =
        shape.kind === 'c'
          ? [shape.a[0], shape.b[0]]
          : [shape.c[0] - shape.r[0], shape.c[0] + shape.r[0]];
      minX = Math.min(minX, ...xs);
      maxX = Math.max(maxX, ...xs);
    }
    const midX = (minX + maxX) * 0.5;
    figure = mapShapes(figure, (p) => [p[0] - midX, p[1], p[2]]);
  }
  return figure;
}

function cultistPose(clip, frame, frames) {
  if (clip === 'idle') {
    const breathe = Math.sin((frame / Math.max(1, frames - 1 || 1)) * Math.PI * 2);
    return {
      thigh: [deg(2), deg(-2)],
      knee: [deg(3), deg(3)],
      arm: [deg(4 + breathe), deg(4 - breathe)],
      breathe,
    };
  }
  if (clip === 'walk' || clip === 'run') {
    const phase = (frame / frames) * Math.PI * 2;
    const swing = Math.sin(phase);
    const run = clip === 'run';
    return {
      thigh: [deg(run ? 36 : 24) * swing, -deg(run ? 36 : 24) * swing],
      knee: [
        deg((run ? 14 : 6) + (run ? 76 : 34) * Math.max(0, Math.cos(phase))),
        deg((run ? 14 : 6) + (run ? 76 : 34) * Math.max(0, -Math.cos(phase))),
      ],
      arm: run
        ? [-deg(10) - deg(32) * swing, -deg(10) + deg(32) * swing]
        : [-deg(18) * swing, deg(18) * swing],
      elbow: run ? [deg(72), deg(72)] : undefined,
      breathe: 0,
      lean: run ? deg(9) : 0,
    };
  }
  if (clip === 'alert') {
    const t = frame / Math.max(1, frames - 1);
    return {
      thigh: [deg(4), deg(8)],
      knee: [deg(8), deg(4)],
      arm: [deg(10), deg(-25 - t * 35)],
      elbow: [deg(20), deg(40)],
      breathe: 0.3,
      prop: t > 0.3,
    };
  }
  if (clip === 'attack') {
    const keys = [
      { arm: [deg(8), deg(-20)], elbow: [deg(20), deg(50)], lean: deg(-4), prop: true },
      { arm: [deg(6), deg(-55)], elbow: [deg(15), deg(25)], lean: deg(10), prop: true },
      { arm: [deg(8), deg(-40)], elbow: [deg(18), deg(35)], lean: deg(6), prop: true },
      { arm: [deg(10), deg(-8)], elbow: [deg(20), deg(30)], lean: deg(2), prop: true },
    ];
    const k = keys[Math.min(frame, keys.length - 1)];
    return { thigh: [deg(4), deg(10)], knee: [deg(8), deg(4)], breathe: 0, ...k };
  }
  if (clip === 'strafe') {
    // Side-step cycle facing the camera: weight shifts + leading foot out.
    const phase = (frame / frames) * Math.PI * 2;
    const s = Math.sin(phase);
    return {
      thigh: [deg(10) + deg(14) * s, deg(10) - deg(14) * s],
      knee: [
        deg(18) + deg(28) * Math.max(0, s),
        deg(18) + deg(28) * Math.max(0, -s),
      ],
      arm: [deg(8), deg(-18)],
      elbow: [deg(22), deg(38)],
      sideStep: s,
      sideLean: deg(7) * s,
      prop: true,
      breathe: 0,
    };
  }
  if (clip === 'strafeAttack') {
    // Same lateral steps as strafe, with a fire beat on the arms.
    const phase = (frame / Math.max(1, frames)) * Math.PI * 2;
    const s = Math.sin(phase);
    const keys = [
      { arm: [deg(10), deg(-25)], elbow: [deg(22), deg(48)], lean: deg(-2) },
      { arm: [deg(8), deg(-58)], elbow: [deg(16), deg(22)], lean: deg(8) },
      { arm: [deg(10), deg(-42)], elbow: [deg(18), deg(32)], lean: deg(4) },
      { arm: [deg(10), deg(-12)], elbow: [deg(20), deg(30)], lean: deg(1) },
    ];
    const k = keys[Math.min(frame, keys.length - 1)];
    return {
      thigh: [deg(10) + deg(12) * s, deg(10) - deg(12) * s],
      knee: [
        deg(18) + deg(24) * Math.max(0, s),
        deg(18) + deg(24) * Math.max(0, -s),
      ],
      sideStep: s * 0.85,
      sideLean: deg(6) * s,
      prop: true,
      breathe: 0,
      ...k,
    };
  }
  if (clip === 'hit') {
    // Keep lean tiny — large shear changes silhouette height and reads as "scaling".
    const t = frame / Math.max(1, frames - 1);
    return {
      thigh: [deg(14), deg(4)],
      knee: [deg(22), deg(8)],
      arm: [deg(32), deg(28)],
      elbow: [deg(44), deg(40)],
      breathe: 0,
      lean: deg(-4 - t * 4),
      bounce: 0,
    };
  }
  if (clip === 'death') {
    // Crumple then tip onto the side — keep pitch moderate so limbs stay in proportion.
    const t = frame / Math.max(1, frames - 1);
    const keys = [8, 22, 38, 52, 62, 70];
    return {
      thigh: [deg(16 + t * 45), deg(12 + t * 40)],
      knee: [deg(22 + t * 48), deg(20 + t * 44)],
      arm: [deg(25 + t * 45), deg(18 + t * 40)],
      elbow: [deg(40), deg(36)],
      pitch: deg(keys[Math.min(frame, keys.length - 1)]),
      breathe: 0,
    };
  }
  // dead — collapsed on the ground (same bake framing as idle)
  return {
    thigh: [deg(55), deg(48)],
    knee: [deg(70), deg(65)],
    arm: [deg(75), deg(60)],
    elbow: [deg(45), deg(40)],
    pitch: deg(72),
    breathe: 0,
  };
}

function writePng(filePath, width, height, data) {
  const png = new PNG({ width, height });
  png.data = Buffer.from(data);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, PNG.sync.write(png));
  console.log('Wrote', filePath);
}

function writeSidecar(filePath, manifest) {
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2));
}

function cultistFrameOpts(clip) {
  // One framing for every clip so idle↔death↔walk stay the same visual scale.
  // Death uses a slight side yaw so the tipped body reads as a corpse, not a stick.
  if (clip === 'death' || clip === 'dead') {
    return {
      anchorX: 0.5,
      anchorY: 0,
      paint: 2.2,
      designW: 64,
      designH: 128,
      samples: 2,
      angle: -Math.PI / 5,
    };
  }
  return {
    anchorX: 0.5,
    anchorY: 0,
    paint: 2.2,
    designW: 64,
    designH: 128,
    samples: 2,
  };
}

function packCultistSheet(fileName, layout) {
  const cellW = 256;
  const cellH = 512;
  const columns = 8;
  const rows = 4;
  const sheetW = columns * cellW;
  const sheetH = rows * cellH;
  const sheet = Buffer.alloc(sheetW * sheetH * 4);
  const animations = {};
  let linear = 0;

  for (const { clip, frames, dirs } of layout) {
    const frameOpts = cultistFrameOpts(clip);
    if (dirs) {
      for (const dir of DIRS) {
        const start = linear;
        animations[`${clip}_${dir}`] = { start, count: frames };
        for (let f = 0; f < frames; f++) {
          const pose = cultistPose(clip, f, frames);
          const shapes = buildCultist(pose);
          const scene = isoScene(shapes, DIR_ANGLE[dir]);
          const cell = renderCell(scene, cellW, cellH, frameOpts);
          const col = linear % columns;
          const row = Math.floor(linear / columns);
          blitCell(sheet, sheetW, col * cellW, row * cellH, cellW, cellH, cell);
          linear += 1;
        }
      }
    } else {
      const start = linear;
      animations[clip] = { start, count: frames };
      for (let f = 0; f < frames; f++) {
        const pose = cultistPose(clip, f, frames);
        const shapes = buildCultist(pose);
        const angle = frameOpts.angle ?? DIR_ANGLE.front;
        const scene = isoScene(shapes, angle);
        const cell = renderCell(scene, cellW, cellH, frameOpts);
        const col = linear % columns;
        const row = Math.floor(linear / columns);
        blitCell(sheet, sheetW, col * cellW, row * cellH, cellW, cellH, cell);
        linear += 1;
      }
    }
  }

  writePng(path.join(charsOut, `${fileName}.png`), sheetW, sheetH, sheet);
  writeSidecar(path.join(charsOut, `${fileName}.json`), {
    image: `${fileName}.png`,
    cellWidth: cellW,
    cellHeight: cellH,
    columns,
    rows,
    anchor: [0.5, 0],
    animations,
  });
}

/**
 * Doom-style FP shotgun in XY (camera looks down -Z, +Y = screen down).
 * Compact silhouette centered in the cell: stock BR, barrel UL.
 */
function buildShotgun(pose) {
  const shapes = [];
  const put = (s) => shapes.push(s);
  const kick = (pose.kick ?? 0) * 0.28;
  const slide = (pose.slide ?? 0) * 0.18;
  const pump = (pose.pump ?? 0) * 0.22;
  const dy = (pose.dy ?? 0) * 0.28;

  const ox = slide;
  const oy = -kick + dy;

  // Compact: fits in ~±5 design units so bake framing can fill the cell.
  const grip = v3(2.2 + ox, 3.2 + oy, 0.3);
  const receiver = v3(0.6 + ox, 0.5 + oy, 0);
  const muzzle = v3(-3.8 + ox, -3.0 + oy, -0.3);

  // Stock mass
  put(capsule(add(grip, v3(1.0, 0.8, 0.2)), add(receiver, v3(1.2, 1.1, 0.1)), 1.05, WOOD));
  put(ellipsoid(add(grip, v3(0.5, 0.25, 0.15)), [1.35, 1.5, 1.0], WOOD));
  put(capsule(add(grip, v3(-0.1, -0.15, 0)), add(grip, v3(0.15, 1.35, 0.15)), 0.7, GUN_DK));

  // Receiver + highlight rail
  put(ellipsoid(receiver, [1.9, 1.25, 1.2], GUN_METAL));
  put(ellipsoid(add(receiver, v3(0.1, -0.3, 0.5)), [1.45, 0.75, 0.6], GUN_HI));

  // Barrel
  const barrelRoot = add(receiver, v3(-0.55, -0.45, 0));
  put(capsule(barrelRoot, muzzle, 0.9, GUN_METAL));
  put(capsule(add(barrelRoot, v3(0.08, 0.3, -0.35)), add(muzzle, v3(0.25, 0.3, -0.2)), 0.48, GUN_DK));
  for (let i = 0; i < 6; i++) {
    const t = 0.18 + i * 0.11;
    const p = add(scale(barrelRoot, 1 - t), scale(muzzle, t));
    put(capsule(add(p, v3(0.15, 0.5, 0.45)), add(p, v3(-0.15, -0.5, 0.45)), 0.11, GUN_HI));
  }
  put(ellipsoid(muzzle, [0.7, 0.55, 0.5], GUN_DK));
  put(ellipsoid(add(muzzle, v3(-0.15, -0.05, 0)), [0.32, 0.24, 0.24], material('#050508', { part: 'bore' })));

  // Pump forend
  const pumpA = add(receiver, v3(-1.1, -0.75 - pump * 0.08, 0.15));
  const pumpB = add(receiver, v3(-2.35, -1.85 - pump, 0));
  put(capsule(pumpA, pumpB, 1.15, GUN_DK));
  put(ellipsoid(add(pumpB, v3(0.1, -0.05, 0.2)), [1.15, 1.0, 0.9], GUN_DK));

  if (pose.flash) {
    put(ellipsoid(add(muzzle, v3(-0.95, -0.4, 0)), [2.1, 1.8, 1.4], material('#ff9020', { spec: 0.85, shininess: 6, part: 'flash' })));
    put(ellipsoid(add(muzzle, v3(-0.5, -0.2, 0)), [1.05, 0.9, 0.8], material('#fff2c0', { spec: 0.9, shininess: 4, part: 'flash' })));
  }

  // Hands + sleeve
  put(ellipsoid(add(grip, v3(-0.3, -0.3, 0.55)), [1.1, 0.95, 0.9], SKIN));
  put(ellipsoid(add(pumpA, v3(0.2, 0.45, 0.65)), [1.25, 1.05, 0.95], GLOVE));
  put(ellipsoid(add(pumpA, v3(-0.25, -0.1, 0.45)), [0.9, 0.8, 0.75], GLOVE));
  put(capsule(add(grip, v3(1.9, 1.6, 0.3)), add(grip, v3(0.4, -0.05, 0.2)), 1.1, material('#1a1410', { part: 'sleeve' })));
  put(capsule(add(grip, v3(2.4, 2.1, 0.15)), add(grip, v3(1.2, 0.7, 0.2)), 1.25, material('#0a0806', { part: 'sleeve' })));

  return shapes;
}

function weaponPose(clip, frame) {
  const table = {
    idle: [
      { kick: 0, slide: 0 },
      { kick: 1.2, slide: 0 },
      { kick: 0, slide: 0.4 },
      { kick: 1.0, slide: 0 },
    ],
    walk: [
      { kick: 0.5, slide: -2.5 },
      { kick: 3.5, slide: 1.5 },
      { kick: 0.5, slide: 2.5 },
      { kick: 3.5, slide: -1.5 },
    ],
    fire: [
      { kick: 1, flash: true },
      { kick: 8, slide: -0.8 },
      { kick: 4.5 },
      { kick: 1 },
    ],
    recoil: [{ kick: 7 }, { kick: 4 }, { kick: 1.5 }, { kick: 0 }],
    reload: [
      { kick: 1, slide: -1, pump: 0 },
      { kick: 2, slide: -2, pump: 4 },
      { kick: 2.5, slide: -1.5, pump: 8 },
      { kick: 2, slide: -1, pump: 4 },
      { kick: 1, pump: 0 },
      { kick: 0 },
    ],
    equip: [{ dy: 14 }, { dy: 7 }, { dy: 2.5 }, { dy: 0 }],
    lower: [{ dy: 0 }, { dy: 5 }, { dy: 10 }, { dy: 16 }],
    muzzle: [{ flash: true }, { flash: true }],
  };
  return (table[clip] ?? table.idle)[frame] ?? {};
}

function packWeaponSheets() {
  const cellW = 512;
  const cellH = 512;
  const columns = 4;
  const rows = 4;

  const pack = (name, clips) => {
    const sheetW = columns * cellW;
    const sheetH = rows * cellH;
    const sheet = Buffer.alloc(sheetW * sheetH * 4);
    const animations = {};
    const frameNames = {};
    let linear = 0;
    for (const { clip, frames } of clips) {
      animations[clip] = { start: linear, count: frames };
      for (let f = 0; f < frames; f++) {
        const pose = weaponPose(clip, f);
        let cell;
        if (clip === 'muzzle') {
          const shapes = [
            ellipsoid(v3(-4.0, -3.2, 0), [2.2, 1.9, 1.5], material('#ff9020', { spec: 0.85, shininess: 6 })),
            ellipsoid(v3(-3.7, -3.0, 0), [1.15, 1.0, 0.85], material('#fff2c0', { spec: 0.9, shininess: 4 })),
          ];
          const scene = fpWeaponScene(shapes);
          cell = renderCell(scene, cellW, cellH, {
            anchorX: 0.52,
            anchorY: 0.55,
            paint: 1,
            designW: 12,
            designH: 12,
            samples: 2,
          });
        } else {
          const shapes = buildShotgun(pose);
          const scene = fpWeaponScene(shapes);
          // Centered bake — WeaponView anchor places the sprite in the BR of the HUD.
          cell = renderCell(scene, cellW, cellH, {
            anchorX: 0.52,
            anchorY: 0.55,
            paint: 1,
            designW: 11,
            designH: 11,
            samples: 2,
          });
        }
        const col = linear % columns;
        const row = Math.floor(linear / columns);
        blitCell(sheet, sheetW, col * cellW, row * cellH, cellW, cellH, cell);
        frameNames[String(linear)] = `${clip}_${f}`;
        linear += 1;
      }
    }
    // pad unused cells
    writePng(path.join(weaponsOut, `${name}.png`), sheetW, sheetH, sheet);
    writeSidecar(path.join(weaponsOut, `${name}.json`), {
      image: `${name}.png`,
      cellWidth: cellW,
      cellHeight: cellH,
      columns,
      rows,
      anchor: [0.72, 0.94],
      animations,
      frameNames,
    });
  };

  pack('pistol-fp-a', [
    { clip: 'idle', frames: 4 },
    { clip: 'walk', frames: 4 },
    { clip: 'fire', frames: 4 },
    { clip: 'recoil', frames: 4 },
  ]);
  pack('pistol-fp-b', [
    { clip: 'reload', frames: 6 },
    { clip: 'equip', frames: 4 },
    { clip: 'lower', frames: 4 },
    { clip: 'muzzle', frames: 2 },
  ]);
}

// --- main ---
const only = process.argv.includes('--weapons-only')
  ? 'weapons'
  : process.argv.includes('--cultist-only')
    ? 'cultist'
    : 'all';
console.log('Generating Trek-style capsule sprites…', only);
if (only === 'all' || only === 'cultist') {
  packCultistSheet('cultist-idle', [
    { clip: 'idle', frames: 4, dirs: true },
    { clip: 'death', frames: 6 },
    { clip: 'dead', frames: 1 },
  ]);
  packCultistSheet('cultist-walk', [{ clip: 'walk', frames: 6, dirs: true }]);
  packCultistSheet('cultist-run', [{ clip: 'run', frames: 6, dirs: true }]);
  packCultistSheet('cultist-attack', [{ clip: 'attack', frames: 4, dirs: true }]);
  packCultistSheet('cultist-strafe', [{ clip: 'strafe', frames: 6, dirs: true }]);
  packCultistSheet('cultist-strafe-attack', [{ clip: 'strafeAttack', frames: 4, dirs: true }]);
  packCultistSheet('cultist-alert-hit', [
    { clip: 'alert', frames: 3, dirs: true },
    { clip: 'hit', frames: 3, dirs: true },
  ]);
}
if (only === 'all' || only === 'weapons') packWeaponSheets();
console.log('Done.');
