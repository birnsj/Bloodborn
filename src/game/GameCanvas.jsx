import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { loadMap } from './mapLoader.js';
import { MaterialLibrary } from './materials.js';
import { AssetRegistry } from './assetRegistry.js';
import { buildLevel, disposeLevel } from './levelBuilder.js';
import { applyAtmosphere, createLights, disposeLights } from './lighting.js';
import { PlayerController } from './playerController.js';
import { PixiOverlay } from './overlay/PixiOverlay.js';
import { WeaponView } from './overlay/WeaponView.js';
import { loadWeapons, getWeapon } from './combat/weaponStats.js';
import { CombatSystem } from './combat/CombatSystem.js';
import { CharacterManager } from './characters/CharacterManager.js';

/**
 * Owns Three.js + PixiJS renderers and the shared animation loop.
 */
export default function GameCanvas({
  mapUrl,
  assetsUrl,
  onReady,
  onLockChange,
  onError,
  onCombatEvent,
}) {
  const mountRef = useRef(null);
  const onReadyRef = useRef(onReady);
  const onLockChangeRef = useRef(onLockChange);
  const onErrorRef = useRef(onError);
  const onCombatEventRef = useRef(onCombatEvent);

  useEffect(() => {
    onReadyRef.current = onReady;
    onLockChangeRef.current = onLockChange;
    onErrorRef.current = onError;
    onCombatEventRef.current = onCombatEvent;
  }, [onReady, onLockChange, onError, onCombatEvent]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let animationId = 0;
    let renderer;
    let scene;
    let camera;
    let player;
    let materials;
    let assets;
    let levelRoot;
    let ownedGeometries = [];
    let lights = [];
    let ambient;
    let onResize;
    let pixiOverlay;
    let weaponView;
    let combat;
    let characters;

    const clock = new THREE.Clock();

    async function boot() {
      try {
        const map = await loadMap(mapUrl);
        if (disposed) return;

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        renderer.setClearColor(0x070605, 1);
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.inset = '0';
        renderer.domElement.style.zIndex = '0';
        mount.appendChild(renderer.domElement);

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(
          70,
          mount.clientWidth / Math.max(mount.clientHeight, 1),
          0.08,
          80,
        );

        ambient = applyAtmosphere(scene, map.atmosphere);

        materials = new MaterialLibrary();
        await materials.loadFromMap(map);
        if (disposed) return;

        assets = new AssetRegistry(materials);
        await assets.load(assetsUrl);
        if (disposed) return;

        const level = buildLevel(map, materials, assets);
        levelRoot = level.root;
        ownedGeometries = level.ownedGeometries;
        scene.add(levelRoot);

        lights = createLights(map.lights);
        for (const light of lights) {
          scene.add(light);
        }

        characters = new CharacterManager();
        await characters.loadDefs('/data/characters.json');
        await characters.spawnFromLevel(map.characters ?? []);
        scene.add(characters.root);
        if (disposed) return;

        pixiOverlay = new PixiOverlay();
        await pixiOverlay.init(mount);
        if (disposed) return;

        const weapons = await loadWeapons('/data/weapons.json');
        const weaponId = map.player.weaponId ?? 'pistol_placeholder';
        const weaponDef = getWeapon(weapons, weaponId);
        weaponView = await WeaponView.create(pixiOverlay.stage, weaponDef);
        weaponView.layout(mount.clientWidth, mount.clientHeight);
        if (disposed) return;

        combat = new CombatSystem({
          camera,
          weaponDef,
          worldMeshes: level.raycastMeshes,
          characterManager: characters,
          weaponView,
          scene,
        });
        combat.onHitCharacter = (evt) => onCombatEventRef.current?.(evt);

        player = new PlayerController(
          camera,
          map.player,
          level.colliders,
          renderer.domElement,
        );
        player.setLockChangeCallback((locked) => onLockChangeRef.current?.(locked));
        player.attach();

        onResize = () => {
          if (!renderer || !camera || !mount) return;
          const w = mount.clientWidth;
          const h = Math.max(mount.clientHeight, 1);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
          pixiOverlay?.resize(w, h);
          weaponView?.layout(w, h);
        };
        window.addEventListener('resize', onResize);

        const tick = () => {
          if (disposed) return;
          animationId = requestAnimationFrame(tick);
          const delta = Math.min(clock.getDelta(), 0.05);

          player.update(delta);
          combat.update(delta, player.isLocked && player.keys.fire);
          characters.update(delta);
          weaponView.update(delta, {
            width: mount.clientWidth,
            height: mount.clientHeight,
          });

          renderer.render(scene, camera);
          pixiOverlay.render();
        };

        tick();
        onReadyRef.current?.();
      } catch (err) {
        console.error(err);
        onErrorRef.current?.(err.message ?? String(err));
      }
    }

    boot();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);

      if (onResize) {
        window.removeEventListener('resize', onResize);
      }

      player?.detach();
      combat?.dispose();
      weaponView?.destroy();
      pixiOverlay?.destroy();

      if (characters) {
        scene?.remove(characters.root);
        characters.dispose();
      }

      if (levelRoot) {
        scene?.remove(levelRoot);
        disposeLevel(levelRoot, ownedGeometries);
      }

      disposeLights(lights);
      for (const light of lights) {
        scene?.remove(light);
      }
      if (ambient) scene?.remove(ambient);

      assets?.dispose();
      materials?.dispose();

      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentElement === mount) {
          mount.removeChild(renderer.domElement);
        }
      }
    };
  }, [mapUrl, assetsUrl]);

  return <div className="game-canvas" ref={mountRef} />;
}
