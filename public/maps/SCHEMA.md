# BloodBound Level Schema (Phase 3)

Portable, engine-independent level definitions. No Three.js or PixiJS types.

## Coordinate system

- **Right-handed, Y-up**
- **1 unit = 1 meter** (`units: "meters"`)
- **Rotation units:** radians (`rotationUnits: "radians"`)
- Player **yaw** is rotation around +Y. At yaw `0`, the camera faces **-Z**.

## Top-level fields

| Field | Purpose |
|-------|---------|
| `schemaVersion` | Integer schema version (`3` for Phase 3) |
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

- `maxHealth` — starting / max hit points (Phase 3)
- `weaponId` — key into `/data/weapons.json`

On death, press **R** to restart the encounter (player + enemies reset).

## Characters

Level instances in `characters[]`:

- `id`, `characterId`, `position`, optional `yaw`

Definitions in `/data/characters.json` may include AI fields:

- `moveSpeed`, `detectRange`, `loseRange`
- `attackRange`, `attackInterval`, `attackDamage`, `attackWindup`
- `requireLosToDetect`
- `spritesheet` + `animations` (`idle` / `walk` / `attack` / `hit` / `death`)

Steering uses the same cylinder-vs-AABB collision as the player. No navmesh.

## Weapons

See `/data/weapons.json` for damage, fire rate, range, and Pixi view/spritesheet refs.

## Assets

`/assets/assets.json` types: `primitive`, `glb`.
