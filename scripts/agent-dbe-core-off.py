from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path_name: str, old: str, new: str) -> None:
    path = ROOT / path_name
    source = path.read_text()
    if new in source:
        return
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path_name}, found {count}: {old[:90]!r}")
    path.write_text(source.replace(old, new, 1))


AUDIO = "turn/audio/audio-system.js"

replace_once(
    AUDIO,
    "const PACE_NOTE_GROUP_GAP_SECONDS = 0.22;\n",
    "const PACE_NOTE_GROUP_GAP_SECONDS = 0.22;\nconst DRIVE_BY_EAR_ENABLED = globalThis.__turnDriveByEarEnabled !== false;\n",
)

replace_once(
    AUDIO,
    """  window.addEventListener('pagehide', handlePageHide, { passive: true });
  window.addEventListener('turn:pace-note', handlePaceNoteAudio);
  window.addEventListener('turn:pace-note-silence', stopPaceNoteSources);
""",
    """  window.addEventListener('pagehide', handlePageHide, { passive: true });
  if (DRIVE_BY_EAR_ENABLED) {
    window.addEventListener('turn:pace-note', handlePaceNoteAudio);
    window.addEventListener('turn:pace-note-silence', stopPaceNoteSources);
  }
""",
)

replace_once(
    AUDIO,
    """  const nearestRivalDistance = Number(frame.nearestRivalDistance);
  const nearestRivalPan = clamp(Number(frame.nearestRivalPan) || 0, -1, 1);
""",
    """  const nearestRivalDistance = Number(frame.nearestRivalDistance);
  const nearestRivalPan = DRIVE_BY_EAR_ENABLED
    ? clamp(Number(frame.nearestRivalPan) || 0, -1, 1)
    : 0;
""",
)

replace_once(
    AUDIO,
    """  smooth(skidTone.frequency, 720 + speedRatio * 520 + strongSlip * 190, audioNow, 0.07);
  smooth(skidFilter.frequency, 980 + speedRatio * 520, audioNow, 0.09);
  smoothPan(driftPanner, clamp(Number(frame.driftPan) || 0, -1, 1), audioNow, 0.07);

  // Road-edge sound is physical rather than a special accessibility alert. It emerges on the
  // side nearest the edge and becomes rougher off road, so every player hears usable road position.
  const edgeProximity = clamp(Number(frame.edgeProximity) || 0, 0, 1);
  const recoveryUrgency = clamp(Number(frame.recoveryUrgency) || 0, 0, 1);
  const offRoad = active && Boolean(frame.offRoad);
  const edgeRumbleLevel = active ? Math.pow(edgeProximity, 1.65) * 0.018 : 0;
  const offRoadLevel = offRoad ? 0.026 + recoveryUrgency * 0.026 : 0;
  smooth(roadGain.gain, Math.max(edgeRumbleLevel, offRoadLevel), audioNow, offRoad ? 0.045 : 0.09);
  smooth(
    roadFilter.frequency,
    offRoad ? 300 + recoveryUrgency * 620 : 180 + edgeProximity * 720,
    audioNow,
    0.08
  );
  smoothPan(roadPanner, clamp(Number(frame.edgePan) || 0, -1, 1), audioNow, 0.065);
""",
    """  smooth(skidTone.frequency, 720 + speedRatio * 520 + strongSlip * 190, audioNow, 0.07);
  smooth(skidFilter.frequency, 980 + speedRatio * 520, audioNow, 0.09);
  if (DRIVE_BY_EAR_ENABLED) {
    smoothPan(driftPanner, clamp(Number(frame.driftPan) || 0, -1, 1), audioNow, 0.07);
  }

  let offRoad = false;
  if (DRIVE_BY_EAR_ENABLED) {
    // Road-edge sound is physical rather than a special accessibility alert. It emerges on the
    // side nearest the edge and becomes rougher off road, so every player hears usable road position.
    const edgeProximity = clamp(Number(frame.edgeProximity) || 0, 0, 1);
    const recoveryUrgency = clamp(Number(frame.recoveryUrgency) || 0, 0, 1);
    offRoad = active && Boolean(frame.offRoad);
    const edgeRumbleLevel = active ? Math.pow(edgeProximity, 1.65) * 0.018 : 0;
    const offRoadLevel = offRoad ? 0.026 + recoveryUrgency * 0.026 : 0;
    smooth(roadGain.gain, Math.max(edgeRumbleLevel, offRoadLevel), audioNow, offRoad ? 0.045 : 0.09);
    smooth(
      roadFilter.frequency,
      offRoad ? 300 + recoveryUrgency * 620 : 180 + edgeProximity * 720,
      audioNow,
      0.08
    );
    smoothPan(roadPanner, clamp(Number(frame.edgePan) || 0, -1, 1), audioNow, 0.065);
  }
""",
)

replace_once(
    AUDIO,
    """  updateRivalProximity(active, nearestRivalDistance, nearestRivalPan);
  updateDrivingGuidance(frame, { active, speed, offRoad, now: audioNow });
""",
    """  updateRivalProximity(active, nearestRivalDistance, nearestRivalPan);
  if (DRIVE_BY_EAR_ENABLED) {
    updateDrivingGuidance(frame, { active, speed, offRoad, now: audioNow });
  }
""",
)

replace_once(
    AUDIO,
    """  hardMute(boostGain.gain, now);
  hardMute(roadGain.gain, now);
  stopPaceNoteSources();
""",
    """  hardMute(boostGain.gain, now);
  if (roadGain) hardMute(roadGain.gain, now);
  if (DRIVE_BY_EAR_ENABLED) stopPaceNoteSources();
""",
)

replace_once(
    AUDIO,
    """  installEngineGraph();
  installDriftGraph();
  installBoostGraph();
  installRoadGuidanceGraph();
""",
    """  installEngineGraph();
  installDriftGraph();
  installBoostGraph();
  if (DRIVE_BY_EAR_ENABLED) installRoadGuidanceGraph();
""",
)

replace_once(
    AUDIO,
    """  driftPanner = createPannerNode();
""",
    """  driftPanner = DRIVE_BY_EAR_ENABLED ? createPannerNode() : context.createGain();
""",
)

TEST = "turn-lab/tests/drive-by-ear-production.mjs"
replace_once(
    TEST,
    """const [releaseSource, app, setting, style, menu, paceAudio] = await Promise.all([
""",
    """const [releaseSource, app, setting, style, menu, audio, paceAudio] = await Promise.all([
""",
)
replace_once(
    TEST,
    """  fs.readFile(new URL('../../turn/ui/in-game-menu.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/pace-notes.js', import.meta.url), 'utf8')
""",
    """  fs.readFile(new URL('../../turn/ui/in-game-menu.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/audio-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/pace-notes.js', import.meta.url), 'utf8')
""",
)
replace_once(
    TEST,
    """assert.match(menu, /if \\(soundGuideButton\\) soundGuideButton\\.hidden/, 'The Sound Guide must not advertise disabled processing');
assert.doesNotMatch(paceAudio, /AudioContext|webkitAudioContext/, 'The optional module must carry no dormant audio engine');
""",
    """assert.match(menu, /if \\(soundGuideButton\\) soundGuideButton\\.hidden/, 'The Sound Guide must not advertise disabled processing');
assert.match(audio, /DRIVE_BY_EAR_ENABLED = globalThis\\.__turnDriveByEarEnabled !== false/);
assert.match(audio, /if \\(DRIVE_BY_EAR_ENABLED\\) installRoadGuidanceGraph\\(\\)/, 'DBE off must not create the continuous road-noise graph');
assert.match(audio, /if \\(DRIVE_BY_EAR_ENABLED\\) \\{[\\s\\S]*updateDrivingGuidance/, 'DBE off must skip continuous guidance processing');
assert.match(audio, /DRIVE_BY_EAR_ENABLED \\? createPannerNode\\(\\) : context\\.createGain\\(\\)/, 'DBE off must avoid the spatial drift panner');
assert.doesNotMatch(paceAudio, /AudioContext|webkitAudioContext/, 'The optional module must carry no dormant audio engine');
""",
)

print("Core Drive By Ear shutdown applied.")
