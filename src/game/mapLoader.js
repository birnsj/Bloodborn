/**
 * Loads and validates a portable BloodBound level JSON document.
 */
export async function loadMap(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load map (${response.status}): ${url}`);
  }
  const map = await response.json();
  validateMap(map);
  return map;
}

function requireArray(obj, key, context) {
  if (!Array.isArray(obj[key])) {
    throw new Error(`${context}: missing array "${key}"`);
  }
}

function validateMap(map) {
  if (!map || typeof map !== 'object') {
    throw new Error('Map root must be an object');
  }
  if (!map.schemaVersion) {
    throw new Error('Map is missing "schemaVersion"');
  }
  if (!map.id) {
    throw new Error('Map is missing "id"');
  }
  if (!map.player?.spawnPosition) {
    throw new Error('Map is missing player.spawnPosition');
  }
  if (!map.materials || typeof map.materials !== 'object') {
    throw new Error('Map is missing materials dictionary');
  }

  requireArray(map, 'rooms', 'Map');
  requireArray(map, 'walls', 'Map');
  requireArray(map, 'objects', 'Map');
  requireArray(map, 'lights', 'Map');

  const ids = new Set();
  const track = (id, label) => {
    if (!id) throw new Error(`${label} is missing an id`);
    if (ids.has(id)) throw new Error(`Duplicate object id: ${id}`);
    ids.add(id);
  };

  track(map.player.id ?? 'player_spawn', 'player');
  map.rooms.forEach((room) => track(room.id, 'room'));
  map.walls.forEach((wall) => track(wall.id, 'wall'));
  map.objects.forEach((obj) => {
    track(obj.id, 'object');
    if (!obj.assetId) throw new Error(`Object ${obj.id} is missing assetId`);
  });
  map.lights.forEach((light) => track(light.id, 'light'));
  (map.doorways ?? []).forEach((door) => track(door.id, 'doorway'));
  (map.characters ?? []).forEach((character) => {
    track(character.id, 'character');
    if (!character.characterId) {
      throw new Error(`Character ${character.id} is missing characterId`);
    }
    if (!character.position) {
      throw new Error(`Character ${character.id} is missing position`);
    }
  });
}
