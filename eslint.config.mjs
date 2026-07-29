const readonlyGlobals = {
  console: 'readonly',
  localStorage: 'readonly',
  process: 'readonly',
  URL: 'readonly',
  window: 'readonly',
  document: 'readonly',
  CustomEvent: 'readonly',
  requestAnimationFrame: 'readonly'
};

export default [
  {
    ignores: [
      'turn/assets/**',
      'turn/vendor/**',
      'turn-lab/**'
    ]
  },
  {
    files: [
      'turn/input/motion.js',
      'turn/platform/*.js',
      'turn/race/game-state.js',
      'turn/race/lap-system.js',
      'turn/race/replay-system.js',
      'turn/race/rival-storage.js',
      'turn/race/track-spatial-index.js',
      'turn/render/camera.js',
      'turn/render/covered-rendering.js',
      'turn/ui/track-select.js',
      'turn/vehicle/catalog.js',
      'turn/vehicle/physics.js',
      'turn/tracks/catalog.js',
      'turn/tracks/cliffside-layout.js',
      'turn/tracks/cliffside-world.js',
      'turn/tracks/cliffside-world-r76.js',
      'turn/tracks/definitions.js',
      'turn/tracks/elevation.js',
      'turn/tracks/registry.js',
      'turn/tracks/track-manager.js',
      'turn-next/safe-zone-bootstrap.js',
      'turn-tests/**/*.mjs'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: readonlyGlobals
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error'
    },
    rules: {
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-fallthrough': 'error',
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ]
    }
  }
];
