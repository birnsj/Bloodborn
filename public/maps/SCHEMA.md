# BloodBound Level Schema (Combat Presentation)

Portable, engine-independent level definitions. No Three.js or PixiJS types.

## Coordinate system

- **Right-handed, Y-up**
- **1 unit = 1 meter** (`units: "meters"`)
- **Rotation units:** radians (`rotationUnits: "radians"`)
- Player **yaw** is rotation around +Y. At yaw `0`, the camera faces **-Z**.

## Top-level fields

| Field | Purpose |
|-------|---------|
| `schemaVersion` | Integer schema version (`3` still valid) |
| `id`, `name` | Level identity |
| `coordinateSystem` | `"rightHandedYUp"` |
| `units` | `"meters"` |
| `rotationUnits` | `"radians"` |
| `player` | Spawn, eye height, radius, speed, look sensitivity, `weaponId`, `maxHealth` |
| `atmosphere` | Fog, ambient light, background color |
| `materials` | Named material defs |
| `rooms` | Bounds + floor/ceiling material refs |
| `walls` | Solid box segments |
| `doorways` | Metadata + optional wood frames |
| `objects` | Placed prop instances |
| `characters` | Character / enemy instances |
| `lights` | Point lights |

## Player

- `maxHealth` — starting / max hit points
- `weaponId` — key into `/data/weapons.json`

On death, press **R** to restart the encounter (player + enemies reset; weapon re-equips).

## Characters

Level instances in `characters[]`:

- `id`, `characterId`, `position`, optional `yaw` (initial facing)

Definitions in `/data/characters.json`:

### AI / combat

- `moveSpeed`, `detectRange`, `loseRange`
- `attackRange`, `attackInterval`, `attackDamage`, `attackWindup`
- `runDistance` — chase uses `run` clip beyond this distance (anim only)
- `preferRangeMin` / `preferRangeMax` — combat spacing band (backpedal / strafe / approach)
- `searchTime` — seconds to pursue `lastSeen` after LOS loss
- `requireLosToDetect`

### Animation

- `spritesheet` — single even-grid atlas JSON (legacy / simple)
- `spritesheets` — optional map of sheet id → atlas JSON URL for multi-sheet characters
- Per-clip `spritesheet` or `sheet` id — which atlas supplies that clip’s frames
- `anchor` — Three.js `Sprite.center` pivot `[x, y]` (default **`[0.5, 0]` feet/bottom**)
- `facingMode` — `"mirror5"` (default) or `"unique8"`
- `blendMs` — optional crossfade duration (0 = off)
- `animations` — clip map with optional `directions`, `events`, fps, priority

SVG masters and approved cell/sheet sizes: `/sprites/ART_SPEC.md`. Cultist production cells are **256×512** on **2048×2048** sheets.

When chasing without LOS, AI faces movement toward `lastSeen` (not the live player). Attack still faces the player. Death/dead clips do not camera-mirror.

Steering uses cylinder-vs-AABB collision. No navmesh.

### Dev anim preview

`?preview=1` (or backtick in-game): force cultist clips 1–8, yaw with `[` `]`, weapon clips Q/E/F/G/V, R reload while alive. Does not change combat stats.

## Weapons

`/data/weapons.json`:

- Combat: `damage`, `fireInterval`, `range` (hitscan timing independent of view polish)
- `view.spritesheet` — single atlas (legacy) **or** `view.sheets` — `[{ id, spritesheet }]`
- `view.animations` — `idle`, `walk`, `fire`, `recoil`, `reload`, `equip`, `lower` (+ muzzle overlay)
- Per-clip optional `sheet` id when using multi-sheet
- Production cells: **512×512** on **2048×2048** sheets (`pistol-fp-a` / `pistol-fp-b`)
- `view.baseScale` / `minScale` / `maxScale` — readable FP presence across resolutions
- `view.screenOffset` / `anchor` — lower-right grip placement (`[0.62, 0.92]` typical)
- Authored **walk** replaces procedural bob when present; else bob/sway amplitudes apply
- Fire chains to **recoil** then idle; cosmetic reload after `reloadEvery` shots
- SVG masters → `npm run export-svg-sprites`

## Assets

`/assets/assets.json` types: `primitive`, `glb`.

## Sprites

Even-grid only; approved sizes only. See [ART_SPEC.md](../sprites/ART_SPEC.md).  
Validate with `npm run validate-sprites`. Export with `npm run export-svg-sprites`.
