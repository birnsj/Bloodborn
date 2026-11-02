# BloodBound Level Schema (Phase 2)

Portable, engine-independent level definitions. No Three.js or PixiJS types.

## Coordinate system

- **Right-handed, Y-up**
- **1 unit = 1 meter** (`units: "meters"`)
- **Rotation units:** radians (`rotationUnits: "radians"`)
- Player **yaw** is rotation around +Y. At yaw `0`, the camera faces **-Z**.

## Top-level fields

| Field | Purpose |
|-------|---------|
| `schemaVersion` | Integer schema version (`2` for Phase 2) |
| `id`, `name` | Level identity |
| `coordinateSystem` | `"rightHandedYUp"` |
| `units` | `"meters"` |
| `rotationUnits` | `"radians"` |
| `player` | Spawn, eye height, radius, speed, look sensitivity, optional `weaponId` |
| `atmosphere` | Fog, ambient light, background color |
| `materials` | Named material defs (albedo path, PBR params, tiling) |
| `rooms` | Bounds + floor/ceiling material refs |
| `walls` | Solid box segments (door openings = gaps between segments) |
| `doorways` | Metadata + optional wood frames |
| `objects` | Placed instances resolved through the asset registry |
| `characters` | Stationary character instances (Phase 2) |
| `lights` | Point lights (position, color, intensity, distance, decay, castShadow) |

## Objects

Each object instance:

- `id` — persistent unique instance ID
- `assetId` — visual asset from `/assets/assets.json`
- `position` — `[x, y, z]` meters (typically object origin at floor contact)
- `rotation` — `[x, y, z]` radians (Euler XYZ)
- `scale` — `[x, y, z]` visual scale
- `collision` — gameplay collider, **independent of the visual asset**
- `properties` — optional extensible bag

## Characters (Phase 2)

Level instances in `characters[]`:

- `id` — unique instance ID
- `characterId` — definition key from `/data/characters.json`
- `position` — `[x, y, z]` floor contact
- `yaw` — optional facing hint (billboards still face the camera)

Character definitions (`/data/characters.json`) hold `maxHealth`, `hitRadius`, `height`, and sprite paths (`idle` / `hit` / `dead`).

## Weapons (Phase 2)

Weapon definitions live in `/data/weapons.json` (damage, fireInterval, range, Pixi view/spritesheet refs).  
The equipped weapon is selected via `player.weaponId`.

Combat stats are portable; rendering libraries consume them at runtime only.

## Assets

See `/assets/assets.json`. Types:

- `primitive` — box / cylinder / pillar / beam
- `glb` — external glTF/GLB file URL
