import * as THREE from 'three';

/**
 * Applies atmosphere and point lights defined in the level JSON.
 */
export function applyAtmosphere(scene, atmosphere = {}) {
  const bg = atmosphere.background ?? '#070605';
  scene.background = new THREE.Color(bg);

  if (atmosphere.fog?.enabled) {
    scene.fog = new THREE.Fog(
      atmosphere.fog.color ?? bg,
      atmosphere.fog.near ?? 2,
      atmosphere.fog.far ?? 30,
    );
  } else {
    scene.fog = null;
  }

  const ambientDef = atmosphere.ambient ?? {};
  const ambient = new THREE.AmbientLight(
    ambientDef.color ?? '#1a1410',
    ambientDef.intensity ?? 0.25,
  );
  ambient.name = 'ambient_light';
  scene.add(ambient);
  return ambient;
}

export function createLights(lightDefs = [], options = {}) {
  const { maxShadowLights = 3 } = options;
  const lights = [];
  let shadowCount = 0;

  for (const def of lightDefs) {
    if (def.type !== 'point') {
      console.warn(`Unsupported light type "${def.type}" on ${def.id}`);
      continue;
    }

    const light = new THREE.PointLight(
      def.color ?? '#ffaa55',
      def.intensity ?? 3,
      def.distance ?? 10,
      def.decay ?? 2,
    );
    light.name = def.id;
    light.position.fromArray(def.position);

    const wantsShadow = Boolean(def.castShadow) && shadowCount < maxShadowLights;
    if (wantsShadow) {
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.camera.near = 0.2;
      light.shadow.camera.far = def.distance ?? 10;
      light.shadow.bias = -0.005;
      shadowCount += 1;
    }

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 10, 10),
      new THREE.MeshBasicMaterial({ color: def.color ?? '#ffaa55' }),
    );
    bulb.name = `${def.id}_bulb`;
    light.add(bulb);

    lights.push(light);
  }

  return lights;
}

export function disposeLights(lights) {
  for (const light of lights) {
    if (light.shadow?.map) {
      light.shadow.map.dispose();
    }
    const bulb = light.children[0];
    if (bulb) {
      bulb.geometry?.dispose();
      bulb.material?.dispose();
    }
  }
}
