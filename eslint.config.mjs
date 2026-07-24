const readonlyGlobals = {
  console: 'readonly',
  localStorage: 'readonly',
  process: 'readonly',
  URL: 'readonly'
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
      'turn/race/game-state.js',
      'turn/race/lap-system.js',
      'turn/race/replay-system.js',
      'turn/race/rival-storage.js',
      'turn/race/track-spatial-index.js',
      'turn/vehicle/catalog.js',
      'turn/vehicle/physics.js',
      'turn/tracks/catalog.js',
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
