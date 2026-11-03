# BloodBound Sprite ART_SPEC (SVG Masters → PNG Runtime)

Even-grid atlases only. **SVG** is the editable master. **PNG** is the runtime format.

## Approved dimensions (hard rule)

Sheet width/height and every cell width/height must be one of:

`128` · `256` · `512` · `1024` · `2048`

- Cells need not be square (e.g. `256×512`).
- Sheet longest edge ≤ **2048**; max sheet **2048×2048**.
- Sheet size = `columns × cellWidth` by `rows × cellHeight` (exact).
- No rotated frames, no per-frame trimming, no uneven packing.
- Cell index is **row-major**: `index = row * columns + col`.

Legacy sheets that violate this (`128×192`, `1920×1536`, `1024×1536`) live under `legacy/` after cutover and are not validated as masters.

## SVG master layout

Path pattern: `public/sprites/{weapons|characters}/svg/{name}.svg`  
Manifest: same basename `{name}.atlas.json` beside the SVG.

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">
  <g id="layer-guides" data-export="false">…</g>
  <g id="layer-art">
    <g id="cell_0_0">
      <g id="idle_0">…native vector only…</g>
    </g>
  </g>
</svg>
```

- Native vector paths/shapes only — **no embedded raster**.
- No baked backgrounds, labels, borders, or checkerboards in exportable art.
- Guides/pivots go in `layer-guides` with `data-export="false"`.
- Artwork may undersize the cell; **never stretch to fill**.
- Shared grip (weapon) or feet (enemy) guides across frames.

Export: `npm run export-svg-sprites` → PNG + grid sidecar JSON.

## Sidecar JSON (runtime PNG)

```json
{
  "image": "pistol-fp-a.png",
  "cellWidth": 512,
  "cellHeight": 512,
  "columns": 4,
  "rows": 4,
  "anchor": [0.62, 0.92],
  "sourceSvg": "svg/pistol-fp-a.svg",
  "animations": {
    "idle": { "start": 0, "count": 4 }
  },
  "frameNames": { "0": "idle_0" }
}
```

Gameplay JSON references **clip names**, not pixel rects.

## Weapon — pistol FP (mirror N/A)

| Sheet | Cell | Grid | Contents |
|-------|------|------|----------|
| `pistol-fp-a` | 512×512 | 4×4 on 2048×2048 | idle 4, walk 4, fire 4, recoil 4 |
| `pistol-fp-b` | 512×512 | 4×4 on 2048×2048 | reload 6, equip 4, lower 4, muzzle 2 |

- Grip **anchor `[0.62, 0.92]`** (cell space); screen via `weapons.json` `view.screenOffset` / scale clamps.
- Authored **walk** replaces procedural bob when the clip exists.
- Fire → recoil → idle; muzzle overlay on `muzzle` event.
- Multi-sheet: `view.sheets` + per-clip `sheet` id (or single `spritesheet` for legacy).

## Enemy — cultist (mirror5)

| Sheet | Cell | Grid | Contents |
|-------|------|------|----------|
| `cultist-idle` | 256×512 | 8×4 on 2048×2048 | idle 5×4 + death 6 + dead 1 |
| `cultist-walk` | 256×512 | 8×4 | walk 5×6 |
| `cultist-run` | 256×512 | 8×4 | run 5×6 |
| `cultist-alert-hit` | 256×512 | 8×4 | alert 5×3 + hit 5×3 |
| `cultist-attack` | 256×512 | 8×4 | attack 5×4 |

- Dirs: `front`, `frontSide`, `side`, `backSide`, `back` (left via mirror).
- Range keys: `{anim}_{dir}` e.g. `walk_frontSide`.
- **Anchor `[0.5, 0]`** — Three.js feet/bottom. Do not use `[0.5, 1]` for feet.
- World height **1.8 m**; width from cell aspect (`1.8 * 256/512 = 0.9 m`).
- Death/dead: non-directional; **no camera mirror** while those clips play.
- `characters.json` may list `spritesheets` map or per-clip `spritesheet`.

## Clip priorities

dead/death 100 · hit 60 · attack/fire/reload/equip/lower/recoil 40–50 · alert 20 · run/walk 10 · idle 0

## Anim events

| Event | Source | Purpose |
|-------|--------|---------|
| `fire` | enemy attack | Damage sync |
| `footstep` | walk/run | AudioBus |
| `muzzle` | weapon fire | Flash + AudioBus |

## Dev preview

`?preview=1` or backtick: cultist **1–8**, yaw **[ ]**, weapon **Q/E/F/G/V**, **R** reload while alive.

## Editor workflow

1. Edit SVG masters under `…/svg/`
2. Keep matching `*.atlas.json` manifests
3. `npm run export-svg-sprites`
4. `npm run validate-sprites`
5. Point `weapons.json` / `characters.json` at new sidecars when ready

## Out of scope

New levels, weapons, enemies, inventory, navmesh, ammo systems, art-editor UI.
