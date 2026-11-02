import { Application } from 'pixi.js';

/**
 * Transparent PixiJS overlay on top of the Three.js canvas.
 * Driven manually from the shared GameCanvas rAF (autoStart: false).
 */
export class PixiOverlay {
  constructor() {
    this.app = null;
    this.mount = null;
  }

  async init(mount) {
    this.mount = mount;
    const app = new Application();
    await app.init({
      backgroundAlpha: 0,
      antialias: false,
      autoStart: false,
      preference: 'webgl',
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      width: Math.max(mount.clientWidth, 1),
      height: Math.max(mount.clientHeight, 1),
    });

    const canvas = app.canvas;
    canvas.classList.add('pixi-overlay');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';
    mount.appendChild(canvas);

    this.app = app;
    return app;
  }

  get stage() {
    return this.app?.stage ?? null;
  }

  get screen() {
    return this.app?.screen ?? { width: 1, height: 1 };
  }

  resize(width, height) {
    if (!this.app) return;
    this.app.renderer.resize(Math.max(width, 1), Math.max(height, 1));
  }

  render() {
    this.app?.render();
  }

  destroy() {
    if (!this.app) return;
    const canvas = this.app.canvas;
    this.app.destroy(true, { children: true, texture: true });
    if (canvas?.parentElement === this.mount) {
      this.mount.removeChild(canvas);
    }
    this.app = null;
    this.mount = null;
  }
}
