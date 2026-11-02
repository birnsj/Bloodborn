/**
 * Writes a minimal valid GLB (unit cube, brown-ish PBR material) for asset-swap tests.
 * Output: public/models/crate-test.glb
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'models');
fs.mkdirSync(outDir, { recursive: true });

const positions = new Float32Array([
  // +X
  0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
  // -X
  -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5,
  // +Y
  -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
  // -Y
  -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5,
  // +Z
  0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
  // -Z
  -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
]);

const normals = new Float32Array([
  1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
  -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
  0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
]);

const indices = new Uint16Array([
  0, 1, 2, 0, 2, 3,
  4, 5, 6, 4, 6, 7,
  8, 9, 10, 8, 10, 11,
  12, 13, 14, 12, 14, 15,
  16, 17, 18, 16, 18, 19,
  20, 21, 22, 20, 22, 23,
]);

function align4(n) {
  return (n + 3) & ~3;
}

function padBuffer(buf) {
  const padded = align4(buf.byteLength);
  if (padded === buf.byteLength) return Buffer.from(buf);
  const out = Buffer.alloc(padded);
  Buffer.from(buf).copy(out);
  return out;
}

const posBuf = padBuffer(Buffer.from(positions.buffer));
const nrmBuf = padBuffer(Buffer.from(normals.buffer));
const idxBuf = padBuffer(Buffer.from(indices.buffer));

const binChunks = [posBuf, nrmBuf, idxBuf];
const bin = Buffer.concat(binChunks);

let offset = 0;
const accessors = [];
const bufferViews = [];

function addView(buf, target) {
  const view = {
    buffer: 0,
    byteOffset: offset,
    byteLength: buf.byteLength - (buf.byteLength - (target === 34963 ? indices.byteLength : buf.byteLength === posBuf.byteLength || buf === nrmBuf ? 0 : 0)),
  };
  // Use exact unpadded lengths for accessors; byteLength on view can be padded.
  const exact =
    buf === posBuf ? positions.byteLength :
    buf === nrmBuf ? normals.byteLength :
    indices.byteLength;
  view.byteLength = exact;
  if (target) view.target = target;
  bufferViews.push(view);
  const viewIndex = bufferViews.length - 1;
  offset += buf.byteLength;
  return viewIndex;
}

// Rebuild with clearer offsets
bufferViews.length = 0;
offset = 0;

function pushView(exactLength, paddedBuf, target) {
  const view = {
    buffer: 0,
    byteOffset: offset,
    byteLength: exactLength,
  };
  if (target) view.target = target;
  bufferViews.push(view);
  const idx = bufferViews.length - 1;
  offset += paddedBuf.byteLength;
  return idx;
}

const posView = pushView(positions.byteLength, posBuf, 34962);
const nrmView = pushView(normals.byteLength, nrmBuf, 34962);
const idxView = pushView(indices.byteLength, idxBuf, 34963);

accessors.push({
  bufferView: posView,
  componentType: 5126,
  count: 24,
  type: 'VEC3',
  max: [0.5, 0.5, 0.5],
  min: [-0.5, -0.5, -0.5],
});
accessors.push({
  bufferView: nrmView,
  componentType: 5126,
  count: 24,
  type: 'VEC3',
});
accessors.push({
  bufferView: idxView,
  componentType: 5123,
  count: 36,
  type: 'SCALAR',
});

const gltf = {
  asset: { version: '2.0', generator: 'bloodbound-generate-test-glb' },
  buffers: [{ byteLength: bin.byteLength }],
  bufferViews,
  accessors,
  materials: [
    {
      name: 'crate_wood',
      pbrMetallicRoughness: {
        baseColorFactor: [0.55, 0.35, 0.18, 1],
        metallicFactor: 0,
        roughnessFactor: 0.85,
      },
    },
  ],
  meshes: [
    {
      name: 'crate',
      primitives: [
        {
          attributes: { POSITION: 0, NORMAL: 1 },
          indices: 2,
          material: 0,
        },
      ],
    },
  ],
  nodes: [{ name: 'crate', mesh: 0 }],
  scenes: [{ name: 'Scene', nodes: [0] }],
  scene: 0,
};

const json = Buffer.from(JSON.stringify(gltf));
const jsonPad = align4(json.byteLength) - json.byteLength;
const jsonChunk = Buffer.concat([json, Buffer.alloc(jsonPad, 0x20)]);
const binPad = align4(bin.byteLength) - bin.byteLength;
const binChunk = Buffer.concat([bin, Buffer.alloc(binPad, 0)]);

const totalLength = 12 + 8 + jsonChunk.byteLength + 8 + binChunk.byteLength;
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // glTF
header.writeUInt32LE(2, 4);
header.writeUInt32LE(totalLength, 8);

const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonChunk.byteLength, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4); // JSON

const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binChunk.byteLength, 0);
binHeader.writeUInt32LE(0x004e4942, 4); // BIN

const glb = Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
const outPath = path.join(outDir, 'crate-test.glb');
fs.writeFileSync(outPath, glb);
console.log('Wrote', outPath, `(${glb.byteLength} bytes)`);
