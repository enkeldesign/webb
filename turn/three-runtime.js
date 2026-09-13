import * as NativeThree from 'three-native';
import { graphicsProfile, graphicsPixelRatio } from './graphics-profile.js';

export * from 'three-native';

const ADD_PATCH = Symbol.for('turn.lowGraphics.object3d.add');

function suppressLowGraphicsObject(root) {
  if (!graphicsProfile.lowGraphics || !root) return;
  root.traverse?.((node) => {
    if (node?.isPointLight) {
      node.visible = false;
      node.intensity = 0;
      if (node.userData) node.userData.turnLowGraphicsDisabledLight = true;
    }
    if (node?.userData?.turnOutline) {
      node.visible = false;
      node.userData.turnLowGraphicsHiddenOutline = true;
    }
    if (node?.castShadow) node.castShadow = false;
  });
}

function installObjectAddPolicy() {
  if (!graphicsProfile.lowGraphics) return;
  const prototype = NativeThree.Object3D.prototype;
  if (prototype[ADD_PATCH]) return;
  const originalAdd = prototype.add;
  Object.defineProperty(prototype, ADD_PATCH, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: originalAdd
  });
  prototype.add = function addWithLowGraphicsPolicy(...objects) {
    const result = originalAdd.apply(this, objects);
    for (const object of objects) suppressLowGraphicsObject(object);
    // Some legacy contour helpers tag turnOutline immediately after add().
    // Recheck after the current synchronous construction pass without paying
    // for a scene traversal every rendered frame.
    queueMicrotask(() => {
      for (const object of objects) suppressLowGraphicsObject(object);
    });
    return result;
  };
}

installObjectAddPolicy();

export class PointLight extends NativeThree.PointLight {
  constructor(...args) {
    super(...args);
    if (graphicsProfile.lowGraphics) {
      this.visible = false;
      this.intensity = 0;
      this.userData.turnLowGraphicsDisabledLight = true;
    }
  }
}

export class WebGLRenderer extends NativeThree.WebGLRenderer {
  constructor(parameters = {}) {
    const rendererParameters = graphicsProfile.lowGraphics
      ? { ...parameters, antialias: false }
      : parameters;
    super(rendererParameters);

    if (!graphicsProfile.lowGraphics) return;

    const nativeSetPixelRatio = this.setPixelRatio.bind(this);
    this.setPixelRatio = (value) => nativeSetPixelRatio(graphicsPixelRatio(value));
    this.setPixelRatio(globalThis.devicePixelRatio || 1);

    this.shadowMap.enabled = false;
    try {
      Object.defineProperty(this.shadowMap, 'enabled', {
        configurable: true,
        enumerable: true,
        get: () => false,
        set: () => false
      });
    } catch (_) {}
  }
}

function sweepRuntimeScene(runtime = globalThis.__turnRuntime) {
  if (!graphicsProfile.lowGraphics) return;
  suppressLowGraphicsObject(runtime?.scene);
  if (runtime?.renderer?.shadowMap) runtime.renderer.shadowMap.enabled = false;
}

if (graphicsProfile.lowGraphics && globalThis.addEventListener) {
  globalThis.addEventListener('turn:runtime-ready', (event) => {
    sweepRuntimeScene(event.detail || globalThis.__turnRuntime);
  });
  globalThis.addEventListener('turn:track-changed', () => {
    queueMicrotask(() => sweepRuntimeScene());
  });
  queueMicrotask(() => sweepRuntimeScene());
}
