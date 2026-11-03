/**
 * One-shot authoring helper: writes public/maps/mansion-vertical-test.json
 * Grid: 1 m primary, snaps to 0.25 m. Texture: 256px = 1 m → repeatPerMeter [1,1].
 * Footprint ≈ 28 × 24 m. Floors at Y = -4 / 0 / +4.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'maps', 'mansion-vertical-test.json');

const SNAP = 0.0625; // finest supported subdivision
const snap = (v) => Math.round(v / SNAP) * SNAP;
const snap3 = (a) => a.map(snap);

const rooms = [];
const walls = [];
const doorways = [];
const objects = [];
const lights = [];
const characters = [];

function room(id, name, min, max, floorMat = 'stone_floor', ceilMat = 'ceiling') {
  rooms.push({
    id,
    name,
    bounds: { min: snap3(min), max: snap3(max) },
    floor: { id: `floor_${id}`, material: floorMat },
    ceiling: { id: `ceil_${id}`, material: ceilMat },
  });
}

function wall(id, material, pos, size, collision = true) {
  walls.push({
    id,
    material,
    position: snap3(pos),
    size: snap3(size),
    rotation: [0, 0, 0],
    collision: { enabled: collision },
  });
}

/** Horizontal slab used as a stair tread (walkable top for step-up). */
function tread(id, x, y, z, sx, sy, sz) {
  walls.push({
    id,
    material: 'stone_wall',
    position: snap3([x, y + sy * 0.5, z]),
    size: snap3([sx, sy, sz]),
    rotation: [0, 0, 0],
    collision: { enabled: true, walkable: true },
  });
}

function pillar(id, x, y, z, h, s = 0.5) {
  objects.push({
    id,
    assetId: 'pillar_stone_primitive',
    position: snap3([x, y, z]),
    rotation: [0, 0, 0],
    scale: [s, h, s],
    collision: { enabled: true, size: [s, h, s] },
  });
}

function crate(id, x, y, z, scale = [0.9, 0.9, 0.9], yaw = 0) {
  objects.push({
    id,
    assetId: 'crate_wood_primitive',
    position: snap3([x, y, z]),
    rotation: [0, yaw, 0],
    scale,
    collision: { enabled: true, size: scale },
  });
}

/** Furniture asset (standalone JSON); collision comes from the asset def. */
function furniture(id, assetId, x, y, z, yaw = 0, scale = [1, 1, 1]) {
  objects.push({
    id,
    assetId,
    position: snap3([x, y, z]),
    rotation: [0, yaw, 0],
    scale: snap3(scale),
  });
}

function beam(id, x, y, z, sx, sy, sz) {
  objects.push({
    id,
    assetId: 'beam_wood_primitive',
    position: snap3([x, y, z]),
    rotation: [0, 0, 0],
    scale: [sx, sy, sz],
    collision: { enabled: false, size: [sx, sy, sz] },
  });
}

function railing(id, x, y, z, sx, sz) {
  // Thin wood rail along gallery edges (visual + light collision)
  wall(id, 'wood', [x, y + 0.5, z], [sx, 1.0, sz], true);
}

function door(id, from, to, center, size = [2.2, 2.8, 0.5]) {
  doorways.push({
    id,
    fromRoom: from,
    toRoom: to,
    center: snap3(center),
    size: snap3(size),
    frame: { id: `frame_${id}`, material: 'wood', thickness: 0.12 },
  });
}

function light(id, pos, color, intensity, distance, decay = 2, castShadow = false) {
  lights.push({
    id,
    type: 'point',
    position: snap3(pos),
    color,
    intensity,
    distance,
    decay,
    castShadow,
  });
}

/** Straight stair run: rise totalRise over n steps along +axis ('z' or 'x'). */
function stairRun({ idPrefix, origin, totalRise, runDepth, width, axis = 'z', dir = 1, risePer = 0.25 }) {
  const n = Math.round(totalRise / risePer);
  const treadDepth = runDepth / n;
  const treadThick = 0.125;
  for (let i = 0; i < n; i++) {
    const y = origin[1] + risePer * (i + 1) - treadThick;
    let x = origin[0];
    let z = origin[2];
    if (axis === 'z') z = origin[2] + dir * (treadDepth * (i + 0.5));
    else x = origin[0] + dir * (treadDepth * (i + 0.5));
    const sx = axis === 'z' ? width : treadDepth;
    const sz = axis === 'z' ? treadDepth : width;
    tread(`${idPrefix}_${i}`, x, y, z, sx, treadThick, sz);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTPRINT: X [-14, 14] = 28 m, Z [-12, 12] = 24 m
// Floors: basement Y=-4, ground Y=0, upper Y=+4
// Atrium hole (no upper floor): X[-4,4] × Z[-4,4]
// Service stair shaft (no ground/upper floor over basement open): X[-7.5,-5.5] × Z[-1,1]
// ─────────────────────────────────────────────────────────────────────────────

const WALL_T = 0.5;
const EXT_H_B = 4; // basement wall height
const EXT_H_G = 3.5; // typical ground wing ceiling
const ATRIUM_H = 8; // foyer floor 0 → ceiling 8 (sees gallery at 4)
const EXT_H_U = 3.5; // upper wing height (floor 4 → ceil 7.5)

// ── Rooms: Basement (Y = -4 → 0) ─────────────────────────────────────────────
room('b_crypt', 'Stone Crypt', [-14, -4, -10], [-2, 0, 4]);
room('b_lab', 'Underground Laboratory', [2, -4, -6], [14, 0, 10]);
room('b_storage', 'Storage Chamber', [-10, -4, 4], [2, 0, 12]);
room('b_corridor', 'Basement Corridor', [-2, -4, -2], [2, 0, 6]);
room('b_stair', 'Service Stairwell (basement)', [-7.5, -4, -1], [-5.5, 0, 1]);

// ── Rooms: Ground (Y = 0) ────────────────────────────────────────────────────
// Tall atrium foyer — open volume through gallery level
room('g_foyer', 'Gothic Entrance Foyer', [-6, 0, -6], [6, ATRIUM_H, 6]);
room('g_vestibule', 'Entrance Vestibule', [-4, 0, -12], [4, EXT_H_G, -6]);
// West dining — leave service shaft open (no floor over [-7.5,-5.5]×[-1,1])
room('g_dining_s', 'Dining Room (south)', [-14, 0, -6], [-7.5, EXT_H_G, -1]);
room('g_dining_n', 'Dining Room (north)', [-14, 0, 1], [-7.5, EXT_H_G, 6]);
room('g_west_hall', 'West Corridor', [-7.5, 0, -6], [-6, EXT_H_G, 6]);
// Thin strips beside stair shaft so west wing connects around it
room('g_stair_n', 'Stair Landing North', [-7.5, 0, 1], [-5.5, EXT_H_G, 2]);
room('g_stair_s', 'Stair Landing South', [-7.5, 0, -2], [-5.5, EXT_H_G, -1]);
room('g_library', 'Library', [6, 0, -6], [14, EXT_H_G, 6]);
room('g_north_w', 'North Chamber West', [-6, 0, 6], [0, EXT_H_G, 12]);
room('g_north_e', 'North Chamber East', [0, 0, 6], [6, EXT_H_G, 12]);

// ── Rooms: Upper (Y = 4) — gallery ring + wings; atrium hole left open ───────
room('u_gal_s', 'South Gallery', [-6, 4, -6], [6, 4 + EXT_H_U, -4]);
room('u_gal_n', 'North Gallery', [-6, 4, 4], [6, 4 + EXT_H_U, 6]);
room('u_gal_w', 'West Gallery', [-6, 4, -4], [-4, 4 + EXT_H_U, 4]);
room('u_gal_e', 'East Gallery', [4, 4, -4], [6, 4 + EXT_H_U, 4]);
room('u_bed_w', 'West Bedrooms', [-14, 4, -6], [-6, 4 + EXT_H_U, 6]);
room('u_bed_e', 'East Bedrooms', [6, 4, -6], [14, 4 + EXT_H_U, 6]);
room('u_hall_n', 'Upper North Hall', [-6, 4, 6], [6, 4 + EXT_H_U, 12]);
room('u_south', 'Upper South Wing', [-4, 4, -12], [4, 4 + EXT_H_U, -6]);
// Service stair continuation to upper (open shaft through ground)
room('u_stair', 'Service Stair Landing (upper)', [-7.5, 4, -1], [-5.5, 4 + EXT_H_U, 1]);

// ── Exterior shell walls (multi-segment by floor band) ────────────────────────
// South façade Z=-12
wall('ext_s_b', 'stone_wall', [0, -2, -12], [28 + WALL_T, EXT_H_B, WALL_T]);
wall('ext_s_g', 'stone_wall', [0, EXT_H_G * 0.5, -12], [8 + WALL_T, EXT_H_G, WALL_T]); // vestibule width
wall('ext_s_g_w', 'stone_wall', [-9, EXT_H_G * 0.5, -12], [10, EXT_H_G, WALL_T]); // fill west of vestibule? footprint south is only vestibule - wings start at z=-6
// South exterior only spans vestibule at z=-12; wing south walls at z=-6
wall('ext_s_u', 'stone_wall', [0, 4 + EXT_H_U * 0.5, -12], [8 + WALL_T, EXT_H_U, WALL_T]);

// North façade Z=12
wall('ext_n_b', 'stone_wall', [-4, -2, 12], [20 + WALL_T, EXT_H_B, WALL_T]); // storage width
wall('ext_n_g', 'stone_wall', [0, EXT_H_G * 0.5, 12], [12 + WALL_T, EXT_H_G, WALL_T]);
wall('ext_n_u', 'stone_wall', [0, 4 + EXT_H_U * 0.5, 12], [12 + WALL_T, EXT_H_U, WALL_T]);

// West façade X=-14
wall('ext_w_b', 'stone_wall', [-14, -2, 1], [WALL_T, EXT_H_B, 22 + WALL_T]);
wall('ext_w_g', 'stone_wall', [-14, EXT_H_G * 0.5, 0], [WALL_T, EXT_H_G, 12 + WALL_T]);
wall('ext_w_u', 'stone_wall', [-14, 4 + EXT_H_U * 0.5, 0], [WALL_T, EXT_H_U, 12 + WALL_T]);

// East façade X=14
wall('ext_e_b', 'stone_wall', [14, -2, 2], [WALL_T, EXT_H_B, 16 + WALL_T]);
wall('ext_e_g', 'stone_wall', [14, EXT_H_G * 0.5, 0], [WALL_T, EXT_H_G, 12 + WALL_T]);
wall('ext_e_u', 'stone_wall', [14, 4 + EXT_H_U * 0.5, 0], [WALL_T, EXT_H_U, 12 + WALL_T]);

// Wing south walls at Z=-6 (basement crypt/lab + ground/upper wings)
wall('wing_s_w_b', 'stone_wall', [-8, -2, -10], [12 + WALL_T, EXT_H_B, WALL_T]); // crypt south
wall('wing_s_e_b', 'stone_wall', [8, -2, -6], [12 + WALL_T, EXT_H_B, WALL_T]); // lab south
wall('wing_s_w_g', 'stone_wall', [-10, EXT_H_G * 0.5, -6], [8 + WALL_T, EXT_H_G, WALL_T]);
wall('wing_s_e_g', 'stone_wall', [10, EXT_H_G * 0.5, -6], [8 + WALL_T, EXT_H_G, WALL_T]);
wall('wing_s_w_u', 'stone_wall', [-10, 4 + EXT_H_U * 0.5, -6], [8 + WALL_T, EXT_H_U, WALL_T]);
wall('wing_s_e_u', 'stone_wall', [10, 4 + EXT_H_U * 0.5, -6], [8 + WALL_T, EXT_H_U, WALL_T]);

// Vestibule side walls X=±4, Z [-12,-6]
wall('vest_w_g', 'stone_wall', [-4, EXT_H_G * 0.5, -9], [WALL_T, EXT_H_G, 6 + WALL_T]);
wall('vest_e_g', 'stone_wall', [4, EXT_H_G * 0.5, -9], [WALL_T, EXT_H_G, 6 + WALL_T]);
wall('vest_w_u', 'stone_wall', [-4, 4 + EXT_H_U * 0.5, -9], [WALL_T, EXT_H_U, 6 + WALL_T]);
wall('vest_e_u', 'stone_wall', [4, 4 + EXT_H_U * 0.5, -9], [WALL_T, EXT_H_U, 6 + WALL_T]);

// Foyer atrium perimeter (tall walls with doorway cuts via segmented walls)
// South foyer at Z=-6 — opening into vestibule |X|<2.2
wall('foyer_s_w', 'stone_wall', [-4.1, ATRIUM_H * 0.5, -6], [3.8, ATRIUM_H, WALL_T]);
wall('foyer_s_e', 'stone_wall', [4.1, ATRIUM_H * 0.5, -6], [3.8, ATRIUM_H, WALL_T]);
wall('foyer_s_lintel', 'stone_wall', [0, 3.2, -6], [4.4, 1.6, WALL_T]); // above door

// North foyer at Z=6 — openings to north chambers
wall('foyer_n_w', 'stone_wall', [-4.1, ATRIUM_H * 0.5, 6], [3.8, ATRIUM_H, WALL_T]);
wall('foyer_n_e', 'stone_wall', [4.1, ATRIUM_H * 0.5, 6], [3.8, ATRIUM_H, WALL_T]);
wall('foyer_n_lintel', 'stone_wall', [0, 3.2, 6], [4.4, 1.6, WALL_T]);

// West foyer at X=-6 — opening to west hall (ground) + gallery
wall('foyer_w_s', 'stone_wall', [-6, ATRIUM_H * 0.5, -4.1], [WALL_T, ATRIUM_H, 3.8]);
wall('foyer_w_n', 'stone_wall', [-6, ATRIUM_H * 0.5, 4.1], [WALL_T, ATRIUM_H, 3.8]);
wall('foyer_w_lintel', 'stone_wall', [-6, 3.2, 0], [WALL_T, 1.6, 4.4]);

// East foyer at X=6
wall('foyer_e_s', 'stone_wall', [6, ATRIUM_H * 0.5, -4.1], [WALL_T, ATRIUM_H, 3.8]);
wall('foyer_e_n', 'stone_wall', [6, ATRIUM_H * 0.5, 4.1], [WALL_T, ATRIUM_H, 3.8]);
wall('foyer_e_lintel', 'stone_wall', [6, 3.2, 0], [WALL_T, 1.6, 4.4]);

// Interior partitions — basement
wall('b_crypt_lab_div', 'stone_wall', [0, -2, 2], [WALL_T, EXT_H_B, 8], true); // corridor flanks
wall('b_crypt_e', 'stone_wall', [-2, -2, -3], [WALL_T, EXT_H_B, 14 + WALL_T]);
wall('b_lab_w', 'stone_wall', [2, -2, 2], [WALL_T, EXT_H_B, 16 + WALL_T]);
wall('b_store_s', 'stone_wall', [-4, -2, 4], [12 + WALL_T, EXT_H_B, WALL_T]);
// Alcove dividers in crypt
wall('b_alcove_1', 'stone_wall', [-10, -2, -2], [WALL_T, EXT_H_B, 4]);
wall('b_alcove_2', 'stone_wall', [-6, -2, 1], [WALL_T, EXT_H_B, 4]);
// Lab benches as low walls
wall('b_lab_bench_a', 'stone_wall', [8, -3.25, 0], [6, 1.5, 0.75]);
wall('b_lab_bench_b', 'stone_wall', [10, -3.25, 6], [0.75, 1.5, 5]);

// Dining / library interior walls (ground)
wall('g_dining_split_w', 'stone_wall', [-12.25, EXT_H_G * 0.5, 0], [3.5, EXT_H_G, WALL_T]);
wall('g_lib_shelf_w', 'stone_wall', [10, EXT_H_G * 0.5, -2], [WALL_T, EXT_H_G, 6]);
wall('g_north_div', 'stone_wall', [0, EXT_H_G * 0.5, 9], [WALL_T, EXT_H_G, 6 + WALL_T]);

// Upper bedroom partitions
wall('u_bed_w_div', 'stone_wall', [-10, 4 + EXT_H_U * 0.5, 0], [WALL_T, EXT_H_U, 8]);
wall('u_bed_e_div', 'stone_wall', [10, 4 + EXT_H_U * 0.5, 0], [WALL_T, EXT_H_U, 8]);
wall('u_hall_div', 'stone_wall', [0, 4 + EXT_H_U * 0.5, 9], [WALL_T, EXT_H_U, 6 + WALL_T]);

// Gallery railings (open atrium edge).
// North rail is split — gaps at twin grand-stair landings (x ≈ ±3.25, width 2).
railing('rail_s', 0, 4, -4, 8, 0.15);
railing('rail_n_w', -5.25, 4, 4, 1.5, 0.15); // x -6 .. -4.5
railing('rail_n_mid', 0, 4, 4, 4.0, 0.15); // x -2 .. 2 (between stairs)
railing('rail_n_e', 5.25, 4, 4, 1.5, 0.15); // x 4.5 .. 6
railing('rail_w', -4, 4, 0, 0.15, 8);
railing('rail_e', 4, 4, 0, 0.15, 8);

// Service stair shaft walls (open core) — three sides, leave north open to dining_n landing
wall('shaft_w_b', 'stone_wall', [-7.5, -2, 0], [WALL_T, EXT_H_B, 2 + WALL_T]);
wall('shaft_e_b', 'stone_wall', [-5.5, -2, 0], [WALL_T, EXT_H_B, 2 + WALL_T]);
wall('shaft_s_b', 'stone_wall', [-6.5, -2, -1], [2 + WALL_T, EXT_H_B, WALL_T]);
wall('shaft_w_g', 'stone_wall', [-7.5, EXT_H_G * 0.5, 0], [WALL_T, EXT_H_G, 2 + WALL_T]);
wall('shaft_e_g', 'stone_wall', [-5.5, EXT_H_G * 0.5, 0], [WALL_T, EXT_H_G, 2 + WALL_T]);
wall('shaft_s_g', 'stone_wall', [-6.5, EXT_H_G * 0.5, -1], [2 + WALL_T, EXT_H_G, WALL_T]);
wall('shaft_w_u', 'stone_wall', [-7.5, 4 + EXT_H_U * 0.5, 0], [WALL_T, EXT_H_U, 2 + WALL_T]);
wall('shaft_e_u', 'stone_wall', [-5.5, 4 + EXT_H_U * 0.5, 0], [WALL_T, EXT_H_U, 2 + WALL_T]);
wall('shaft_s_u', 'stone_wall', [-6.5, 4 + EXT_H_U * 0.5, -1], [2 + WALL_T, EXT_H_U, WALL_T]);

// ── Stairs (visual treads; not walkable until controller supports Y) ──────────
// Service: basement → ground inside shaft, rising +Z
stairRun({
  idPrefix: 'stair_svc_bg',
  origin: [-6.5, -4, -0.875],
  totalRise: 4,
  runDepth: 1.75,
  width: 1.5,
  axis: 'z',
  dir: 1,
  risePer: 0.25,
});
// Service: ground → upper (continues in same shaft)
stairRun({
  idPrefix: 'stair_svc_gu',
  origin: [-6.5, 0, -0.875],
  totalRise: 4,
  runDepth: 1.75,
  width: 1.5,
  axis: 'z',
  dir: 1,
  risePer: 0.25,
});

// Grand twin staircases in foyer: south → north toward gallery, rise 0→4
stairRun({
  idPrefix: 'stair_grand_w',
  origin: [-3.25, 0, -3],
  totalRise: 4,
  runDepth: 7,
  width: 2.0,
  axis: 'z',
  dir: 1,
  risePer: 0.25,
});
stairRun({
  idPrefix: 'stair_grand_e',
  origin: [3.25, 0, -3],
  totalRise: 4,
  runDepth: 7,
  width: 2.0,
  axis: 'z',
  dir: 1,
  risePer: 0.25,
});

// ── Props ────────────────────────────────────────────────────────────────────
// Crypt pillars
pillar('pillar_crypt_a', -11, -4, -6, 4, 0.55);
pillar('pillar_crypt_b', -11, -4, 0, 4, 0.55);
pillar('pillar_crypt_c', -5, -4, -6, 4, 0.55);
pillar('pillar_crypt_d', -5, -4, 0, 4, 0.55);
// Foyer pillars (rise through atrium)
pillar('pillar_foyer_sw', -4.5, 0, -4.5, 8, 0.6);
pillar('pillar_foyer_se', 4.5, 0, -4.5, 8, 0.6);
pillar('pillar_foyer_nw', -4.5, 0, 4.5, 8, 0.6);
pillar('pillar_foyer_ne', 4.5, 0, 4.5, 8, 0.6);

crate('crate_storage_a', -8, -4, 8, [1.0, 1.0, 1.0], 0.2);
crate('crate_storage_b', -6, -4, 10, [0.9, 0.9, 0.9], -0.4);
crate('crate_storage_c', -6, -3.1, 10, [0.7, 0.7, 0.7], 0.5);
crate('crate_lab_a', 12, -4, -4, [1.1, 0.9, 0.9], 0.1);

// Dining room
furniture('furn_table_dining', 'table_dining', -11.5, 0, -3.5, 0);
furniture('furn_chair_dining_n', 'chair_wood', -11.5, 0, -2.2, 0);
furniture('furn_chair_dining_s', 'chair_wood', -11.5, 0, -4.8, 3.14159);
furniture('furn_chair_dining_w', 'chair_wood', -12.8, 0, -3.5, 1.5708);
furniture('furn_chair_dining_e', 'chair_wood', -10.2, 0, -3.5, -1.5708);
furniture('furn_cabinet_dining', 'cabinet_sideboard', -12.5, 0, 4.5, 1.5708);

// Library
furniture('furn_shelf_lib_a', 'bookshelf', 12.5, 0, -4, 1.5708);
furniture('furn_shelf_lib_b', 'bookshelf', 12.5, 0, 0, 1.5708);
furniture('furn_shelf_lib_c', 'bookshelf', 12.5, 0, 4, 1.5708);
furniture('furn_desk_lib', 'desk_writing', 8.5, 0, 3.5, 3.14159);
furniture('furn_chair_lib', 'chair_wood', 8.5, 0, 2.3, 3.14159);

// Foyer / north
furniture('furn_bench_foyer', 'bench_wood', 0, 0, 4.5, 0);
furniture('furn_cabinet_north', 'cabinet_sideboard', -4.5, 0, 10.5, 0);

// Basement
furniture('furn_altar_crypt', 'altar_crypt', -8, -4, -7, 0.2);
furniture('furn_bench_crypt', 'bench_wood', -12, -4, 2, 1.5708);
furniture('furn_desk_lab', 'desk_writing', 6, -4, -3, 0);
furniture('furn_chair_lab', 'chair_wood', 6, -4, -1.8, 0);

// Upper bedrooms
furniture('furn_bed_w', 'bed_simple', -12, 4, -3.5, 1.5708);
furniture('furn_desk_bed_w', 'desk_writing', -8.5, 4, -4.5, 0);
furniture('furn_chair_bed_w', 'chair_wood', -8.5, 4, -3.3, 0);
furniture('furn_bed_e', 'bed_simple', 12, 4, 3.5, -1.5708);
furniture('furn_shelf_bed_e', 'bookshelf', 13.2, 4, -3, 1.5708);
furniture('furn_bench_upper_n', 'bench_wood', 0, 4, 10.5, 0);

beam('beam_foyer_x', 0, 7.6, 0, 11, 0.3, 0.35);
beam('beam_foyer_z', 0, 7.5, 0, 0.35, 0.3, 11);
beam('beam_crypt', -8, -0.4, -3, 10, 0.25, 0.3);

// ── Doorways (decorative frames at major openings) ───────────────────────────
// Frames assume Z-facing openings (existing buildDoorFrame).
door('door_vest_foyer', 'g_vestibule', 'g_foyer', [0, 1.4, -6], [2.4, 2.8, 0.5]);
door('door_foyer_north', 'g_foyer', 'g_north_w', [0, 1.4, 6], [2.4, 2.8, 0.5]);
door('door_crypt_corr', 'b_crypt', 'b_corridor', [-2, -2.6, 2], [2.2, 2.8, 0.5]);
door('door_lab_corr', 'b_lab', 'b_corridor', [2, -2.6, 2], [2.2, 2.8, 0.5]);

// ── Lights ───────────────────────────────────────────────────────────────────
light('lt_foyer_center', [0, 6.5, 0], '#ffd8a8', 110, 24, 2, true);
light('lt_foyer_sw', [-4, 3.5, -4], '#ffb070', 55, 14, 2, false);
light('lt_foyer_se', [4, 3.5, -4], '#ffb070', 55, 14, 2, false);
light('lt_vest', [0, 2.8, -9], '#e8c090', 45, 12, 2, false);
light('lt_dining', [-11, 2.8, 2], '#d4a070', 50, 14, 2, false);
light('lt_library', [10, 2.8, 0], '#c8b090', 50, 14, 2, false);
light('lt_north', [0, 2.8, 9], '#d0b080', 40, 12, 2, false);
light('lt_crypt', [-8, -1.5, -3], '#a89070', 45, 16, 2, false);
light('lt_lab', [8, -1.2, 2], '#80c0ff', 60, 16, 2, false);
light('lt_storage', [-4, -1.5, 8], '#b09070', 35, 12, 2, false);
light('lt_gallery_n', [0, 6.2, 5], '#ffd0a0', 40, 12, 2, false);
light('lt_gallery_s', [0, 6.2, -5], '#ffd0a0', 40, 12, 2, false);
light('lt_bed_w', [-10, 6.2, 0], '#e8c090', 35, 12, 2, false);
light('lt_bed_e', [10, 6.2, 0], '#e8c090', 35, 12, 2, false);

// ── Characters — spread across floors; keep vestibule / foyer spawn clear ────
function cultist(id, x, y, z, yaw = 0) {
  characters.push({
    id,
    characterId: 'cultist_ranged',
    position: snap3([x, y, z]),
    yaw,
  });
}

// Ground
cultist('cultist_dining', -11.5, 0, 3.5, 1.57); // west dining, faces east
cultist('cultist_library', 11.5, 0, -2, -1.57); // library, faces west
cultist('cultist_north', -3, 0, 9.5, 3.14159); // north chamber, faces south

// Basement
cultist('cultist_crypt', -9, -4, -5, 0.4); // crypt
cultist('cultist_lab', 9, -4, 4, -2.2); // lab
cultist('cultist_storage', -5, -4, 9, 3.0); // storage

// Upper
cultist('cultist_bed_w', -11, 4, 3, 1.2); // west bedroom
cultist('cultist_bed_e', 11, 4, -3, -1.0); // east bedroom
cultist('cultist_upper_n', 2.5, 4, 9, 3.14159); // upper north hall


const map = {
  schemaVersion: 3,
  id: 'mansion_vertical_test',
  name: 'Gothic Mansion Vertical Test',
  description:
    'Three-level Gothic mansion (~28×24 m) for vertical architecture / texture-grid tests. Floors at Y=-4 / 0 / +4 with walkable stair treads (0.25 m rise, max step 0.35 m).',
  coordinateSystem: 'rightHandedYUp',
  units: 'meters',
  rotationUnits: 'radians',
  player: {
    id: 'player_spawn',
    spawnPosition: [0, 0, -9],
    spawnYaw: 0,
    eyeHeight: 1.7,
    radius: 0.35,
    walkSpeed: 4.2,
    lookSensitivity: 0.0022,
    weaponId: 'pistol_placeholder',
    maxHealth: 100,
  },
  atmosphere: {
    fog: { enabled: true, color: '#0a0807', near: 3, far: 42 },
    ambient: { color: '#2a2218', intensity: 0.48 },
    background: '#070605',
  },
  materials: {
    stone_floor: {
      id: 'stone_floor',
      albedo: '/textures/stone-floor.png',
      color: '#c8b8a0',
      repeatPerMeter: [1, 1],
      roughness: 0.92,
      metalness: 0.02,
    },
    stone_wall: {
      id: 'stone_wall',
      albedo: '/textures/stone-wall.png',
      color: '#b5a48c',
      repeatPerMeter: [1, 1],
      roughness: 0.95,
      metalness: 0.0,
    },
    ceiling: {
      id: 'ceiling',
      albedo: '/textures/ceiling.png',
      color: '#9a9084',
      repeatPerMeter: [1, 1],
      roughness: 0.97,
      metalness: 0.0,
    },
    wood: {
      id: 'wood',
      albedo: '/textures/wood.png',
      color: '#c49a6c',
      repeatPerMeter: [1, 1],
      roughness: 0.85,
      metalness: 0.0,
    },
    pillar_stone: {
      id: 'pillar_stone',
      albedo: '/textures/pillar.png',
      color: '#d0c4b0',
      repeatPerMeter: [1, 0.5],
      roughness: 0.9,
      metalness: 0.05,
    },
  },
  rooms,
  walls,
  doorways,
  objects,
  characters,
  lights,
};

// ── Validation ───────────────────────────────────────────────────────────────
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const ids = new Set();
function unique(id, kind) {
  assert(id && typeof id === 'string', `${kind} missing id`);
  assert(!ids.has(id), `Duplicate id: ${id}`);
  ids.add(id);
}

assert(map.schemaVersion === 3, 'schemaVersion');
unique(map.player.id, 'player');

for (const r of rooms) {
  unique(r.id, 'room');
  unique(r.floor.id, 'floor');
  unique(r.ceiling.id, 'ceil');
  const { min, max } = r.bounds;
  assert(max[0] > min[0] && max[1] > min[1] && max[2] > min[2], `bad bounds ${r.id}`);
  // grid snap
  for (const v of [...min, ...max]) {
    assert(Math.abs(v / SNAP - Math.round(v / SNAP)) < 1e-9, `unsnapped bound in ${r.id}: ${v}`);
  }
}

for (const w of walls) {
  unique(w.id, 'wall');
  assert(w.size.every((s) => s > 0), `bad size ${w.id}`);
}

for (const o of objects) unique(o.id, 'object');
for (const d of doorways) unique(d.id, 'door');
for (const l of lights) unique(l.id, 'light');
for (const c of characters) unique(c.id, 'character');

// Footprint check
let minX = Infinity;
let maxX = -Infinity;
let minZ = Infinity;
let maxZ = -Infinity;
for (const r of rooms) {
  minX = Math.min(minX, r.bounds.min[0]);
  maxX = Math.max(maxX, r.bounds.max[0]);
  minZ = Math.min(minZ, r.bounds.min[2]);
  maxZ = Math.max(maxZ, r.bounds.max[2]);
}
const spanX = maxX - minX;
const spanZ = maxZ - minZ;
assert(spanX >= 27 && spanX <= 30, `footprint X ${spanX} not ~28`);
assert(spanZ >= 23 && spanZ <= 26, `footprint Z ${spanZ} not ~24`);

const floors = { basement: 0, ground: 0, upper: 0 };
for (const r of rooms) {
  const y0 = r.bounds.min[1];
  if (y0 < -1) floors.basement++;
  else if (y0 < 2) floors.ground++;
  else floors.upper++;
}
assert(floors.basement >= 4, 'need basement rooms');
assert(floors.ground >= 5, 'need ground rooms');
assert(floors.upper >= 6, 'need upper rooms');

writeFileSync(OUT, `${JSON.stringify(map, null, 2)}\n`);
console.log(`Wrote ${OUT}`);
console.log(
  JSON.stringify(
    {
      rooms: rooms.length,
      walls: walls.length,
      objects: objects.length,
      doorways: doorways.length,
      lights: lights.length,
      footprint: { x: spanX, z: spanZ, minX, maxX, minZ, maxZ },
      floors,
      uniqueIds: ids.size,
    },
    null,
    2,
  ),
);
