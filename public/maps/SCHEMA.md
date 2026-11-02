# BloodBound Level Schema (Phase 1)

Portable, engine-independent level definitions. No Three.js types or class names.

## Coordinate system

- **Right-handed, Y-up**
- **1 unit = 1 meter** (`units: "meters"`)
- **Rotation units:** radians (`rotationUnits: "radians"`)
- Player **yaw** is rotation around +Y. At yaw `0`, the camera faces **-Z**.

## Top-level fields

| Field | Purpose |
|-------|---------|
| `schemaVersion` | Integer schema version |
| `id`, `name` | Level identity |
| `coordinateSystem` | `"rightHandedYUp"` |
| `units` | `"meters"` |
| `rotationUnits` | `"radians"` |
| `player` | Spawn, eye height, radius, speed, look sensitivity |
| `atmosphere` | Fog, ambient light, background color |
| `materials` | Named material defs (albedo path, PBR params, tiling) |
| `rooms` | Bounds + floor/ceiling material refs |
| `walls` | Solid box segments (door openings = gaps between segments) |
| `doorways` | Metadata + optional wood frames |
| `objects` | Placed instances resolved through the asset registry |
| `lights` | Point lights (position, color, intensity, distance, decay, castShadow). Intensity is a portable scalar; the Three.js runtime interprets point intensity in physically based candela-scale units (typical torch values ~35–90). |

## Objects

Each object instance:

- `id` — persistent unique instance ID
- `assetId` — visual asset from `/assets/assets.json`
- `position` — `[x, y, z]` meters (typically object origin at floor contact)
- `rotation` — `[x, y, z]` radians (Euler XYZ)
- `scale` — `[x, y, z]` visual scale
- `collision` — gameplay collider, **independent of the visual asset**
  - `enabled` — boolean
  - `size` — `[x, y, z]` box extents in meters
  - `offset` — optional center offset from `position` (default: lift by half height)
- `properties` — optional extensible bag

Swapping `assetId` (primitive ↔ GLB) must not change `id`, transform, or `collision`.

## Assets

See `/assets/assets.json`. Types:

- `primitive` — box / cylinder / pillar / beam
- `glb` — external glTF/GLB file URL
