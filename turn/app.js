const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';

function withBuild(path) {
  const url = new URL(path, import.meta.url);
  if (buildKey) url.searchParams.set('build', buildKey);
  return url.href;
}

const { installPerformanceProfile } = await import(withBuild('./performance-profile.js'));
installPerformanceProfile();

const { installCoveredRenderingGuard } = await import(withBuild('./render/covered-rendering.js'));
installCoveredRenderingGuard();

const { installTurnAudio } = await import(withBuild('./audio/audio-system.js'));
installTurnAudio();

const { installUniversalDrivingSoundscape } = await import(
  withBuild('./audio/driving-soundscape.js')
);
installUniversalDrivingSoundscape();

const { installLapResultToast } = await import(withBuild('./ui/lap-result-toast.js'));
installLapResultToast();

const { installRivalOnboarding } = await import(withBuild('./ui/rival-onboarding.js'));
installRivalOnboarding();

const { installSportsSedanEasterEggUi } = await import(withBuild('./vehicle/sports-sedan-easter-egg.js'));
installSportsSedanEasterEggUi();

const { installHarborHiddenFaceOrientation } = await import(withBuild('./tracks/harbor-hidden-face-r89.js'));
installHarborHiddenFaceOrientation();

await import(withBuild('./input/analog-gas.js'));
await import(withBuild('./ui/gameplay-controls.js'));
const { installRaceSpeech } = await import(withBuild('./ui/race-speech.js'));
installRaceSpeech();
const { installRacePositionLayout } = await import(withBuild('./ui/race-position-layout.js'));
installRacePositionLayout();
await import(withBuild('./main.js'));

await Promise.all([
  import(withBuild('./render/world.js')),
  import(withBuild('./ui/spectate.js')),
  import(withBuild('./ui/back-to-lot.js'))
]);

await import(withBuild('./ui/in-game-menu.js'));

console.info(`TURN: ${globalThis.__TURN_BUILD__?.id || 'development'} loaded from the static module graph.`);
