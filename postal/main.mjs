import * as THREE_NS from 'three';
import { GLTFLoader as GLTFLoader_NS } from 'three/addons/loaders/GLTFLoader.js';

globalThis.THREE = THREE_NS;
globalThis.GLTFLoader = GLTFLoader_NS;

const scripts = [
  './runtime/model-data.js', './runtime/model-core.js', './runtime/model-flow.js', './runtime/model-ops.js',
  './runtime/app-foundation.js', './runtime/scene-depot.js', './runtime/scene-region.js', './runtime/scene-sweden.js',
  './runtime/visuals-ui-core.js', './runtime/ui-sheets.js', './runtime/interaction-boot.js'
];

function loadClassic(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => { script.remove(); resolve(); };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.append(script);
  });
}

for (const src of scripts) await loadClassic(src);
