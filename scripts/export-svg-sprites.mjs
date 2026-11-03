/**
 * Rasterize SVG masters to PNG atlases using atlas manifests.
 * Strips data-export="false" layers before render.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';
import { APPROVED } from './lib/svgSheet.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const spritesRoot = path.join(root, 'public', 'sprites');

function findManifests(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) findManifests(full, list);
    else if (name.endsWith('.atlas.json')) list.push(full);
  }
  return list;
}

function stripNonExportLayers(svgText) {
  // Remove groups marked data-export="false" (guides).
  return svgText.replace(
    /<g\b[^>]*\bdata-export\s*=\s*["']false["'][^>]*>[\s\S]*?<\/g>/gi,
    '',
  );
}

function assertApprovedDim(n, label, file) {
  if (!APPROVED.has(n)) {
    throw new Error(`${file}: ${label}=${n} not approved`);
  }
}

const manifests = findManifests(spritesRoot);
if (!manifests.length) {
  console.error('No *.atlas.json manifests found under public/sprites');
  process.exit(1);
}

for (const manifestPath of manifests) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const dir = path.dirname(manifestPath);
  const svgName = path.basename(manifestPath, '.atlas.json') + '.svg';
  const svgPath = path.join(dir, svgName);
  if (!fs.existsSync(svgPath)) {
    console.error('Missing SVG for', manifestPath);
    process.exit(1);
  }

  assertApprovedDim(manifest.cellWidth, 'cellWidth', manifestPath);
  assertApprovedDim(manifest.cellHeight, 'cellHeight', manifestPath);
  const sheetW = manifest.cellWidth * manifest.columns;
  const sheetH = manifest.cellHeight * manifest.rows;
  assertApprovedDim(sheetW, 'sheetWidth', manifestPath);
  assertApprovedDim(sheetH, 'sheetHeight', manifestPath);

  let svg = fs.readFileSync(svgPath, 'utf8');
  svg = stripNonExportLayers(svg);

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: sheetW },
    background: 'rgba(0,0,0,0)',
  });
  const pngData = resvg.render().asPng();

  const outDir = path.join(spritesRoot, manifest.outDir ?? path.basename(path.dirname(dir)));
  fs.mkdirSync(outDir, { recursive: true });
  const pngPath = path.join(outDir, manifest.image);
  fs.writeFileSync(pngPath, pngData);

  const sidecar = {
    image: manifest.image,
    cellWidth: manifest.cellWidth,
    cellHeight: manifest.cellHeight,
    columns: manifest.columns,
    rows: manifest.rows,
    anchor: manifest.anchor,
    sourceSvg: manifest.sourceSvg,
    animations: manifest.animations,
  };
  if (manifest.frameNames) sidecar.frameNames = manifest.frameNames;
  if (manifest.muzzleHint) sidecar.muzzleHint = manifest.muzzleHint;

  const jsonPath = path.join(outDir, manifest.image.replace(/\.png$/i, '.json'));
  fs.writeFileSync(jsonPath, JSON.stringify(sidecar, null, 2));
  console.log('Exported', path.relative(root, pngPath), `(${sheetW}x${sheetH})`);
}

console.log(`Exported ${manifests.length} SVG sprite sheet(s).`);
