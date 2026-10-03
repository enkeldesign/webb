import * as NativeThree from 'three-native';
import { graphicsProfile, graphicsPixelRatio } from '/turn/graphics-profile.js';

export * from 'three-native';

export class PointLight extends NativeThree.PointLight {
  constructor(...args) {
    super(...args);
    if (graphicsProfile.lowGraphics) {
      // Disable real point-light illumination before the light can enter a scene.
      // Visible lamp meshes, emissive materials and halos remain untouched.
      this.visible = false;
      this.intensity = 0;
      this.userData.turnLowGraphicsDisabledLight = true;
    }
  }
}

// three.js gives each renderer its own methods (setAnimationLoop, setSize, …) in its
// constructor, so a policy patched onto the prototype never runs (#1045). A policy
// registers here instead and wraps each renderer TURN creates from then on.
const rendererHooks = [];
export function onWebGLRendererCreated(hook) {
  if (typeof hook === 'function') rendererHooks.push(hook);
}

export class WebGLRenderer extends NativeThree.WebGLRenderer {
  constructor(parameters = {}) {
    const rendererParameters = graphicsProfile.lowGraphics
      ? { ...parameters, antialias: true }
      : parameters;
    super(rendererParameters);
    for (const hook of rendererHooks) hook(this);

    if (!graphicsProfile.lowGraphics) return;

    const nativeSetPixelRatio = this.setPixelRatio.bind(this);
    this.setPixelRatio = (value) => nativeSetPixelRatio(graphicsPixelRatio(value));
    this.setPixelRatio(globalThis.devicePixelRatio || 1);
  }
}
