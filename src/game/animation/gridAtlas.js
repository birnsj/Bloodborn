import * as THREE from 'three';

/**
 * Load an even-grid sprite atlas (editor-replaceable).
 * Sidecar: { image, cellWidth, cellHeight, columns, rows, animations: { name: { start, count } } }
 */
export async function loadGridAtlas(jsonUrl, textureLoader, textureCache) {
  const response = await fetch(jsonUrl);
  if (!response.ok) {
    throw new Error(`Failed to load grid atlas: ${jsonUrl}`);
  }
  const atlas = await response.json();

  if (!atlas.cellWidth || !atlas.cellHeight || !atlas.columns || !atlas.rows) {
    throw new Error(`Grid atlas missing cell/grid fields: ${jsonUrl}`);
  }

  const base = jsonUrl.slice(0, jsonUrl.lastIndexOf('/') + 1);
  const imageUrl = base + atlas.image;
  const sheetTexture = await loadTexture(imageUrl, textureLoader, textureCache);

  const sheetW = sheetTexture.image.width;
  const sheetH = sheetTexture.image.height;
  const { cellWidth: cw, cellHeight: ch, columns, rows } = atlas;

  if (sheetW !== cw * columns || sheetH !== ch * rows) {
    console.warn(
      `Grid atlas size mismatch ${jsonUrl}: image ${sheetW}x${sheetH}, expected ${cw * columns}x${ch * rows}`,
    );
  }

  const cellTextures = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const index = row * columns + col;
      const x = col * cw;
      const y = row * ch;
      const tex = sheetTexture.clone();
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.repeat.set(cw / sheetW, ch / sheetH);
      tex.offset.set(x / sheetW, 1 - (y + ch) / sheetH);
      tex.needsUpdate = true;
      tex.userData.frameWidth = cw;
      tex.userData.frameHeight = ch;
      tex.userData.cellIndex = index;
      cellTextures[index] = tex;
      textureCache.set(`${jsonUrl}::cell:${index}`, tex);
    }
  }

  /** Map animation range name -> list of frame texture keys / synthetic names */
  const frameTextures = {};
  const animRanges = atlas.animations ?? {};

  for (const [animName, range] of Object.entries(animRanges)) {
    const start = range.start ?? 0;
    const count = range.count ?? 1;
    const names = [];
    for (let i = 0; i < count; i++) {
      const cellIndex = start + i;
      const frameName = `${animName}_${i}`;
      frameTextures[frameName] = cellTextures[cellIndex];
      names.push(frameName);
    }
    // Also expose bare anim name as first frame for convenience
    if (names.length && !frameTextures[animName]) {
      frameTextures[animName] = frameTextures[names[0]];
    }
  }

  return {
    atlas,
    frameTextures,
    cellTextures,
    cellWidth: cw,
    cellHeight: ch,
    animRanges,
  };
}

/**
 * Expand grid anim ranges into AnimPlayer clip defs with optional directions.
 * clipsConfig from characters.json animations section.
 */
export function buildClipsFromGrid(clipsConfig, animRanges) {
  const clips = {};
  for (const [name, cfg] of Object.entries(clipsConfig ?? {})) {
    const directions = cfg.directions === true;
    if (directions) {
      const frames = {};
      for (const dir of ['front', 'frontSide', 'side', 'backSide', 'back', 'frontSideL', 'sideL', 'backSideL']) {
        const rangeKey = `${name}_${dir}`;
        const range = animRanges[rangeKey];
        if (!range) continue;
        const count = range.count ?? 1;
        const list = [];
        for (let i = 0; i < count; i++) list.push(`${rangeKey}_${i}`);
        frames[dir] = list;
      }
      // Fallback: non-directional range named exactly `name`
      if (!Object.keys(frames).length && animRanges[name]) {
        const range = animRanges[name];
        const list = [];
        for (let i = 0; i < (range.count ?? 1); i++) list.push(`${name}_${i}`);
        clips[name] = { ...cfg, directions: false, frames: list };
        continue;
      }
      clips[name] = { ...cfg, frames };
    } else if (Array.isArray(cfg.frames)) {
      clips[name] = { ...cfg };
    } else if (animRanges[name]) {
      const range = animRanges[name];
      const list = [];
      for (let i = 0; i < (range.count ?? 1); i++) list.push(`${name}_${i}`);
      clips[name] = { ...cfg, frames: list };
    } else {
      clips[name] = { ...cfg };
    }
  }
  return clips;
}

function loadTexture(url, loader, cache) {
  if (cache.has(url)) return Promise.resolve(cache.get(url));
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        cache.set(url, texture);
        resolve(texture);
      },
      undefined,
      () => reject(new Error(`Failed to load texture: ${url}`)),
    );
  });
}
