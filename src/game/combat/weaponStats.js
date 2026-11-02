/**
 * Portable weapon definitions — no Three.js / PixiJS imports.
 */
export async function loadWeapons(url = '/data/weapons.json') {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load weapons (${response.status}): ${url}`);
  }
  const data = await response.json();
  for (const [id, def] of Object.entries(data)) {
    validateWeapon(id, def);
  }
  return data;
}

export function getWeapon(weapons, weaponId) {
  const def = weapons[weaponId];
  if (!def) throw new Error(`Unknown weaponId: ${weaponId}`);
  return def;
}

function validateWeapon(id, def) {
  if (!def || typeof def !== 'object') {
    throw new Error(`Invalid weapon: ${id}`);
  }
  for (const key of ['damage', 'fireInterval', 'range', 'view']) {
    if (def[key] === undefined) {
      throw new Error(`Weapon ${id} missing "${key}"`);
    }
  }
  if (!def.view.spritesheet || !def.view.idleFrames?.length || !def.view.fireFrames?.length) {
    throw new Error(`Weapon ${id} has incomplete view definition`);
  }
}
