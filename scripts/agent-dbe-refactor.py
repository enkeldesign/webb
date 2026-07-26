from __future__ import annotations

import json
import subprocess
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative_path: str, old: str, new: str) -> None:
    path = ROOT / relative_path
    source = path.read_text()
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {relative_path}, found {count}: {old[:80]!r}")
    path.write_text(source.replace(old, new, 1))


def write(relative_path: str, content: str) -> None:
    path = ROOT / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(textwrap.dedent(content).lstrip())


replace_once(
    "turn/app.js",
    """const { installTurnAudio } = await import(withBuild('./audio/audio-system.js'));
installTurnAudio();

const { installUniversalDrivingSoundscape } = await import(
  withBuild('./audio/driving-soundscape.js')
);
installUniversalDrivingSoundscape();

const { installPaceNotes } = await import(withBuild('./audio/pace-notes.js'));
installPaceNotes();
""",
    """const { installDriveByEarSetting } = await import(
  withBuild('./ui/drive-by-ear-setting.js')
);
const driveByEarEnabled = installDriveByEarSetting();

const { installTurnAudio } = await import(withBuild('./audio/audio-system.js'));
installTurnAudio();

if (driveByEarEnabled) {
  const { installUniversalDrivingSoundscape } = await import(
    withBuild('./audio/driving-soundscape.js')
  );
  installUniversalDrivingSoundscape();

  const { installPaceNotes } = await import(withBuild('./audio/pace-notes.js'));
  installPaceNotes();
}
""",
)

replace_once(
    "turn/audio/audio-system.js",
    """const RIVAL_NEAR_ENTER_METERS = 10;
const RIVAL_NEAR_EXIT_METERS = 15;
""",
    """const RIVAL_NEAR_ENTER_METERS = 10;
const RIVAL_NEAR_EXIT_METERS = 15;
const PACE_NOTE_LEVEL = 0.052;
const PACE_NOTE_DURATION_SECONDS = 0.055;
const PACE_NOTE_STEP_SECONDS = 0.105;
const PACE_NOTE_GROUP_GAP_SECONDS = 0.22;
""",
)
replace_once(
    "turn/audio/audio-system.js",
    """let installed = false;
const cueTimes = new Map();
""",
    """let installed = false;
const cueTimes = new Map();
const activePaceNoteSources = new Set();
""",
)
replace_once(
    "turn/audio/audio-system.js",
    """  document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
  window.addEventListener('pagehide', handlePageHide, { passive: true });
""",
    """  document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
  window.addEventListener('pagehide', handlePageHide, { passive: true });
  window.addEventListener('turn:pace-note', handlePaceNoteAudio);
  window.addEventListener('turn:pace-note-silence', stopPaceNoteSources);
""",
)
replace_once(
    "turn/audio/audio-system.js",
    """  hardMute(boostGain.gain, now);
  hardMute(roadGain.gain, now);
  lastBoostActive = false;
""",
    """  hardMute(boostGain.gain, now);
  hardMute(roadGain.gain, now);
  stopPaceNoteSources();
  lastBoostActive = false;
""",
)
replace_once(
    "turn/audio/audio-system.js",
    """function resetGuidanceState() {
  lastTurnCueAt = -Infinity;
  lastRecoveryCueAt = -Infinity;
  wrongWayStartedAt = null;
  lastWrongWayCueAt = -Infinity;
}

function playCueNow(name, options = {}) {
""",
    """function resetGuidanceState() {
  lastTurnCueAt = -Infinity;
  lastRecoveryCueAt = -Infinity;
  wrongWayStartedAt = null;
  lastWrongWayCueAt = -Infinity;
}

function handlePaceNoteAudio(event) {
  const groups = Array.isArray(event.detail?.groups) ? event.detail.groups : [];
  if (!groups.length) return;

  void unlock().then((ready) => {
    if (ready) schedulePaceNoteGroups(groups);
  });
}

function schedulePaceNoteGroups(groups) {
  if (!context || context.state !== 'running' || !masterGain) return;
  let cursor = context.currentTime + 0.012;

  groups.forEach((group, groupIndex) => {
    const direction = Math.sign(Number(group?.direction) || 0);
    const severity = clamp(Math.round(Number(group?.severity) || 1), 1, 3);
    const pan = direction < 0 ? -0.96 : 0.96;

    for (let index = 0; index < severity; index += 1) {
      schedulePaceNoteBeep(cursor, pan, severity);
      cursor += PACE_NOTE_STEP_SECONDS;
    }

    if (groupIndex < groups.length - 1) {
      cursor += PACE_NOTE_GROUP_GAP_SECONDS - PACE_NOTE_STEP_SECONDS;
    }
  });
}

function schedulePaceNoteBeep(startAt, pan, severity) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const panner = createPannerNode();
  const endAt = startAt + PACE_NOTE_DURATION_SECONDS;
  const baseFrequency = 650 + severity * 38;

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(baseFrequency, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(baseFrequency * 1.13, endAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(PACE_NOTE_LEVEL, startAt + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  if (panner.pan) panner.pan.setValueAtTime(pan, startAt);
  oscillator.connect(gain);
  gain.connect(panner);
  panner.connect(masterGain);

  const record = { oscillator, gain, panner };
  activePaceNoteSources.add(record);
  oscillator.addEventListener('ended', () => {
    activePaceNoteSources.delete(record);
    oscillator.disconnect();
    gain.disconnect();
    panner.disconnect();
  }, { once: true });

  oscillator.start(startAt);
  oscillator.stop(endAt + 0.01);
}

function stopPaceNoteSources() {
  for (const record of activePaceNoteSources) {
    try {
      record.oscillator.stop();
    } catch (_) {}
  }
  activePaceNoteSources.clear();
}

function playCueNow(name, options = {}) {
""",
)

write(
    "turn/audio/pace-notes.js",
    r"""
    import {
      getTrackPaceNotes,
      speedAdjustedPaceNoteTrigger
    } from '../tracks/pace-notes.js';

    const PACE_NOTE_UPDATE_INTERVAL_MS = 1000 / 30;
    const MIN_TRIGGER_SPEED = 5;
    const MIN_FORWARD_ALIGNMENT = 0.35;
    const NOTE_DURATION_SECONDS = 0.055;
    const NOTE_STEP_SECONDS = 0.105;
    const GROUP_GAP_SECONDS = 0.22;

    let installed = false;
    let wrappedAudio = null;
    let activeTrackId = null;
    let activeLapKey = null;
    let firedNoteIds = new Set();
    let lastCheckedAt = -Infinity;

    export function installPaceNotes() {
      if (installed) return wrappedAudio || globalThis.__turnAudio;
      const baseAudio = globalThis.__turnAudio;
      if (!baseAudio) return null;

      installed = true;
      installResetListeners();

      wrappedAudio = Object.freeze({
        unlock: (...args) => baseAudio.unlock(...args),
        update(frame = {}, now = performance.now()) {
          if (now - lastCheckedAt >= PACE_NOTE_UPDATE_INTERVAL_MS) {
            updatePaceNoteState(globalThis.__turnRuntime, frame);
            lastCheckedAt = now;
          }
          baseAudio.update(frame, now);
        },
        cue: (...args) => baseAudio.cue(...args),
        silence: (...args) => baseAudio.silence(...args),
        get available() {
          return baseAudio.available;
        },
        get state() {
          return baseAudio.state;
        }
      });

      globalThis.__turnAudio = wrappedAudio;
      return wrappedAudio;
    }

    export function updatePaceNoteState(runtime, frame = {}) {
      const state = runtime?.state;
      const samples = runtime?.samples;
      const trackId = String(runtime?.trackId || state?.trackId || globalThis.__turnGetTrackId?.() || '');
      const notes = getTrackPaceNotes(trackId);

      if (!state || !Array.isArray(samples) || !notes.length) {
        resetPaceNotePassage(trackId || null, null);
        return null;
      }

      const lapKey = `${trackId}:${Math.max(1, Math.round(Number(state.lap) || 1))}`;
      if (trackId !== activeTrackId || lapKey !== activeLapKey) {
        resetPaceNotePassage(trackId, lapKey);
      }

      const speed = Math.max(0, Number(state.speed) || Number(frame.speed) || 0);
      const mode = String(state.mode || '');
      if (
        state.running !== true
        || mode === 'spectating'
        || frame.active === false
        || state.offRoad === true
        || speed < MIN_TRIGGER_SPEED
        || firedNoteIds.size >= notes.length
      ) return null;

      const sampleCount = samples.length;
      const index = normalizeIndex(state.nearestTrackIndex, sampleCount);
      const sample = samples[index];
      const forward = runtime.getForward?.();
      const headingAlignment = dot2(forward, sample?.tangent);
      const forwardSpeed = dot2(state.velocity, sample?.tangent);
      if (headingAlignment < MIN_FORWARD_ALIGNMENT || forwardSpeed < 2) return null;

      const progress = normalizeProgress(
        Number.isFinite(Number(state.progress)) ? Number(state.progress) : index / sampleCount
      );

      for (const note of notes) {
        if (firedNoteIds.has(note.id)) continue;
        const trigger = speedAdjustedPaceNoteTrigger(note, speed, runtime.maxSpeed);
        if (!progressInRange(progress, trigger, note.triggerEnd)) continue;

        firedNoteIds.add(note.id);
        publishPaceNote({
          id: note.id,
          trackId,
          progress,
          trigger,
          speed,
          groups: note.groups
        });
        return note;
      }

      return null;
    }

    export function resetPaceNotePassage(trackId = null, lapKey = null) {
      activeTrackId = trackId;
      activeLapKey = lapKey;
      firedNoteIds = new Set();
      lastCheckedAt = -Infinity;
    }

    export function progressInRange(progress, start, end) {
      const value = normalizeProgress(progress);
      const from = normalizeProgress(start);
      const to = normalizeProgress(end);
      return from <= to
        ? value >= from && value <= to
        : value >= from || value <= to;
    }

    export function paceNoteDuration(groups = []) {
      let duration = 0;
      groups.forEach((group, groupIndex) => {
        const count = clamp(Math.round(Number(group?.severity) || 1), 1, 3);
        duration += NOTE_DURATION_SECONDS + (count - 1) * NOTE_STEP_SECONDS;
        if (groupIndex < groups.length - 1) duration += GROUP_GAP_SECONDS;
      });
      return duration;
    }

    function installResetListeners() {
      if (typeof window === 'undefined') return;
      window.addEventListener('turn:track-changed', () => {
        resetPaceNotePassage();
        publishPaceNoteSilence();
      });
      window.addEventListener('turn:ui-state-change', (event) => {
        const reason = event.detail?.reason;
        if (!event.detail?.running || reason === 'race-reset') {
          resetPaceNotePassage();
          publishPaceNoteSilence();
        }
      });
    }

    function publishPaceNote(detail) {
      if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
      globalThis.dispatchEvent(new globalThis.CustomEvent('turn:pace-note', { detail }));
    }

    function publishPaceNoteSilence() {
      if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
      globalThis.dispatchEvent(new globalThis.CustomEvent('turn:pace-note-silence'));
    }

    function dot2(a, b) {
      return (Number(a?.x) || 0) * (Number(b?.x) || 0)
        + (Number(a?.z) || 0) * (Number(b?.z) || 0);
    }

    function normalizeIndex(value, length) {
      const index = Math.round(Number(value) || 0) % length;
      return index < 0 ? index + length : index;
    }

    function normalizeProgress(value) {
      const progress = Number(value) || 0;
      return ((progress % 1) + 1) % 1;
    }

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }
    """,
)

write(
    "turn/ui/drive-by-ear-setting.js",
    r"""
    export const DRIVE_BY_EAR_STORAGE_KEY = 'turn-drive-by-ear-v1';

    export function driveByEarEnabled(storage = getStorage()) {
      try {
        return storage?.getItem(DRIVE_BY_EAR_STORAGE_KEY) !== 'off';
      } catch (_) {
        return true;
      }
    }

    export function saveDriveByEarEnabled(enabled, storage = getStorage()) {
      try {
        storage?.setItem(DRIVE_BY_EAR_STORAGE_KEY, enabled ? 'on' : 'off');
        return true;
      } catch (_) {
        return false;
      }
    }

    export function installDriveByEarSetting({ reload = reloadPage } = {}) {
      const enabled = driveByEarEnabled();
      globalThis.__turnDriveByEarEnabled = enabled;
      if (typeof document === 'undefined') return enabled;

      installStylesheet();
      const startCard = document.querySelector('#intro .start-card');
      if (!startCard || startCard.querySelector('.drive-by-ear-card')) return enabled;

      const card = document.createElement('section');
      card.className = 'drive-by-ear-card';
      card.dataset.enabled = String(enabled);
      card.setAttribute('aria-labelledby', 'driveByEarTitle');
      card.innerHTML = `
        <div class="drive-by-ear-copy">
          <h2 id="driveByEarTitle">DRIVE BY EAR<sup>™</sup></h2>
          <p>Spatial sound turns the track into something you can follow by ear: corner pace notes, road-edge feedback, recovery guidance, drift direction and nearby rivals.</p>
        </div>
        <label class="drive-by-ear-toggle" for="driveByEarToggle">
          <input id="driveByEarToggle" type="checkbox">
          <span>
            <strong>Use Drive By Ear</strong>
            <small id="driveByEarHint">On by default for every player. Turning it off removes DBE processing and may improve performance on older devices.</small>
          </span>
        </label>
        <p class="drive-by-ear-status" role="status" aria-live="polite"></p>`;

      const checkbox = card.querySelector('input');
      const status = card.querySelector('.drive-by-ear-status');
      checkbox.checked = enabled;
      checkbox.setAttribute('aria-describedby', 'driveByEarHint');
      checkbox.addEventListener('change', () => {
        const nextEnabled = checkbox.checked;
        saveDriveByEarEnabled(nextEnabled);
        globalThis.__turnDriveByEarEnabled = nextEnabled;
        card.dataset.enabled = String(nextEnabled);
        checkbox.disabled = true;
        status.textContent = `Drive By Ear ${nextEnabled ? 'enabled' : 'disabled'}. Reloading TURN.`;
        requestAnimationFrame(reload);
      });

      const tagline = startCard.querySelector('.tagline');
      if (tagline) tagline.after(card);
      else startCard.appendChild(card);
      return enabled;
    }

    function installStylesheet() {
      if (document.querySelector('link[data-turn-drive-by-ear]')) return;
      const href = new URL('../drive-by-ear-setting.css', import.meta.url);
      const buildKey = globalThis.__TURN_BUILD__?.cacheKey;
      if (buildKey) href.searchParams.set('build', buildKey);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href.href;
      link.dataset.turnDriveByEar = '';
      document.head.appendChild(link);
    }

    function getStorage() {
      try {
        return globalThis.localStorage;
      } catch (_) {
        return null;
      }
    }

    function reloadPage() {
      globalThis.location?.reload();
    }
    """,
)

write(
    "turn/drive-by-ear-setting.css",
    r"""
    .drive-by-ear-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(230px, 0.85fr);
      gap: 12px 18px;
      align-items: center;
      margin: -6px 0 20px;
      padding: 14px 16px;
      border: 3px solid var(--ink);
      border-radius: 18px;
      background: linear-gradient(135deg, rgb(56 217 255 / 0.22), rgb(255 212 59 / 0.24));
      box-shadow: 4px 4px 0 var(--ink);
    }

    .drive-by-ear-copy h2 {
      margin: 0 0 5px;
      font-size: clamp(1rem, 2.2vw, 1.35rem);
      line-height: 1;
      letter-spacing: 0.035em;
    }

    .drive-by-ear-copy sup {
      margin-left: 0.12em;
      font-size: 0.48em;
      vertical-align: top;
    }

    .drive-by-ear-copy p,
    .drive-by-ear-toggle small,
    .drive-by-ear-status {
      margin: 0;
      font-size: 0.76rem;
      line-height: 1.3;
    }

    .drive-by-ear-toggle {
      display: flex;
      gap: 11px;
      align-items: flex-start;
      min-width: 0;
      padding: 10px 12px;
      border: 3px solid var(--ink);
      border-radius: 14px;
      background: var(--paper);
      cursor: pointer;
      touch-action: manipulation;
    }

    .drive-by-ear-toggle input {
      flex: 0 0 auto;
      width: 24px;
      height: 24px;
      margin: 1px 0 0;
      accent-color: var(--pink);
      cursor: pointer;
    }

    .drive-by-ear-toggle strong,
    .drive-by-ear-toggle small {
      display: block;
    }

    .drive-by-ear-toggle strong {
      margin-bottom: 3px;
      font-size: 0.86rem;
    }

    .drive-by-ear-status {
      grid-column: 1 / -1;
      min-height: 0;
    }

    @media (max-width: 720px) {
      .drive-by-ear-card {
        grid-template-columns: 1fr;
      }
    }

    @media (orientation: landscape) and (max-height: 500px) {
      .start-card {
        display: grid;
        grid-template-columns: minmax(96px, 0.25fr) minmax(0, 1fr);
        grid-template-areas:
          "kicker kicker"
          "logo tagline"
          "logo dbe"
          "actions actions"
          "status status";
        gap: 7px 18px;
        width: min(900px, calc(100vw - 42px));
        padding: 14px 18px;
      }

      .start-card .kicker {
        grid-area: kicker;
        margin-bottom: 0;
        justify-self: start;
      }

      .start-logo-heading {
        grid-area: logo;
        align-self: center;
      }

      .start-logo {
        width: min(27vh, 124px);
        max-width: 124px;
      }

      .tagline {
        grid-area: tagline;
        align-self: end;
        margin: 0;
        font-size: 0.88rem;
      }

      .drive-by-ear-card {
        grid-area: dbe;
        grid-template-columns: minmax(0, 1fr) minmax(220px, 0.9fr);
        gap: 8px 12px;
        margin: 0;
        padding: 8px 10px;
        box-shadow: 3px 3px 0 var(--ink);
      }

      .drive-by-ear-copy p,
      .drive-by-ear-toggle small {
        font-size: 0.68rem;
      }

      .drive-by-ear-toggle {
        padding: 7px 9px;
      }

      .actions {
        grid-area: actions;
        gap: 10px;
      }

      .actions button {
        min-height: 46px;
        padding: 8px 14px;
      }

      .status {
        grid-area: status;
        min-height: 0;
        margin: 2px 0 0;
      }
    }
    """,
)

replace_once(
    "turn/ui/in-game-menu.js",
    """  runtime.__inGameMenuInstalled = true;
  const { button: soundGuideButton } = createSoundGuide();
""",
    """  runtime.__inGameMenuInstalled = true;
  const soundGuideButton = globalThis.__turnDriveByEarEnabled === false
    ? null
    : createSoundGuide().button;
""",
)
replace_once(
    "turn/ui/in-game-menu.js",
    """    spectateButton,
    backToStartButton
  ];
""",
    """    spectateButton,
    backToStartButton
  ].filter(Boolean);
""",
)
replace_once(
    "turn/ui/in-game-menu.js",
    """      recalibrateButton.hidden = !visibility.startActions;
      soundGuideButton.hidden = !visibility.startActions;
      resetRivalsButton.hidden = !visibility.startActions;
""",
    """      recalibrateButton.hidden = !visibility.startActions;
      if (soundGuideButton) soundGuideButton.hidden = !visibility.startActions;
      resetRivalsButton.hidden = !visibility.startActions;
""",
)

write(
    "turn-lab/tests/pace-notes-production.mjs",
    r"""
    import assert from 'node:assert/strict';
    import fs from 'node:fs/promises';
    import {
      getTrackPaceNotes,
      speedAdjustedPaceNoteTrigger
    } from '../../turn/tracks/pace-notes.js';
    import {
      paceNoteDuration,
      progressInRange,
      resetPaceNotePassage,
      updatePaceNoteState
    } from '../../turn/audio/pace-notes.js';

    const [releaseSource, app, audio, paceAudio, paceMap, soundGuide] = await Promise.all([
      fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
      fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
      fs.readFile(new URL('../../turn/audio/audio-system.js', import.meta.url), 'utf8'),
      fs.readFile(new URL('../../turn/audio/pace-notes.js', import.meta.url), 'utf8'),
      fs.readFile(new URL('../../turn/tracks/pace-notes.js', import.meta.url), 'utf8'),
      fs.readFile(new URL('../../turn/ui/in-game-menu.js', import.meta.url), 'utf8')
    ]);
    const release = JSON.parse(releaseSource);

    const expectedMaps = Object.freeze({
      countryside: Object.freeze([
        [[1, 2]],
        [[1, 1]],
        [[1, 2]],
        [[1, 1]]
      ]),
      airport: Object.freeze([
        [[1, 2]],
        [[1, 1]],
        [[1, 2], [-1, 3]],
        [[1, 2]]
      ]),
      cliffside: Object.freeze([
        [[1, 2]],
        [[-1, 1]],
        [[1, 2]],
        [[-1, 1], [1, 2]],
        [[1, 1]]
      ]),
      harbor: Object.freeze([
        [[1, 2]],
        [[1, 3]],
        [[-1, 3]],
        [[1, 3]],
        [[1, 2]]
      ])
    });

    for (const [trackId, expectedGroups] of Object.entries(expectedMaps)) {
      const notes = getTrackPaceNotes(trackId);
      assert.equal(notes.length, expectedGroups.length, `${trackId} must expose every hand-placed sign from its supplied map`);
      assert.deepEqual(
        notes.map((note) => note.groups.map((group) => [group.direction, group.severity])),
        expectedGroups,
        `${trackId} must preserve the authored direction and severity sequence`
      );

      for (const note of notes) {
        const slowTrigger = speedAdjustedPaceNoteTrigger(note, 8, 88);
        const fastTrigger = speedAdjustedPaceNoteTrigger(note, 62, 88);
        assert.ok(fastTrigger <= slowTrigger, 'Higher speed must move a pace note toward the earlier edge of its authored zone');
        assert.ok(fastTrigger >= note.triggerStart && slowTrigger <= note.triggerEnd);
      }
    }
    assert.equal(getTrackPaceNotes('unknown').length, 0, 'Tracks without authored data must remain quiet');

    assert.equal(progressInRange(0.2, 0.1, 0.3), true);
    assert.equal(progressInRange(0.9, 0.95, 0.05), false);
    assert.equal(progressInRange(0.98, 0.95, 0.05), true, 'The generic trigger helper must support a zone that wraps over start/finish');
    assert.equal(progressInRange(0.02, 0.95, 0.05), true);
    assert.ok(paceNoteDuration([{ direction: 1, severity: 2 }, { direction: -1, severity: 3 }]) < 0.8, 'Linked notes must remain brief enough for racing');

    const samples = Array.from({ length: 720 }, (_, index) => ({
      point: { x: 0, z: index },
      tangent: { x: 0, z: 1 },
      normal: { x: -1, z: 0 }
    }));

    function makeRuntime({
      trackId = 'airport',
      progress = 0.2,
      speed = 35,
      lap = 1,
      offRoad = false,
      mode = 'racing',
      getForward = () => ({ x: 0, z: 1 })
    } = {}) {
      return {
        trackId,
        maxSpeed: 88,
        samples,
        state: {
          trackId,
          running: true,
          mode,
          lap,
          progress,
          nearestTrackIndex: Math.round(progress * samples.length) % samples.length,
          speed,
          offRoad,
          velocity: { x: 0, z: speed }
        },
        getForward
      };
    }

    function triggerProgress(trackId, noteIndex, speed = 35) {
      const note = getTrackPaceNotes(trackId)[noteIndex];
      return speedAdjustedPaceNoteTrigger(note, speed, 88) + 0.001;
    }

    for (const trackId of Object.keys(expectedMaps)) {
      resetPaceNotePassage();
      const progress = triggerProgress(trackId, 0);
      const firstPass = updatePaceNoteState(makeRuntime({ trackId, progress }), { active: true });
      assert.equal(firstPass?.id, `${trackId}-1`, `${trackId} must play its first authored sign`);
      assert.equal(
        updatePaceNoteState(makeRuntime({ trackId, progress: progress + 0.002 }), { active: true }),
        null,
        'A sign must play only once per lap passage'
      );

      const nextLapPass = updatePaceNoteState(makeRuntime({ trackId, progress, lap: 2 }), { active: true });
      assert.equal(nextLapPass?.id, `${trackId}-1`, 'A new lap must re-arm every track map');
    }

    resetPaceNotePassage();
    const airportProgress = triggerProgress('airport', 1);
    assert.equal(updatePaceNoteState(makeRuntime({ progress: airportProgress, offRoad: true }), { active: true }), null, 'Recovery must take priority over pace notes');
    assert.equal(updatePaceNoteState(makeRuntime({ progress: airportProgress, mode: 'spectating' }), { active: true }), null, 'Spectating must not trigger player navigation notes');

    resetPaceNotePassage();
    let forwardChecks = 0;
    const countedForward = () => {
      forwardChecks += 1;
      return { x: 0, z: 1 };
    };
    const notes = getTrackPaceNotes('airport');
    for (let index = 0; index < notes.length; index += 1) {
      updatePaceNoteState(makeRuntime({
        progress: triggerProgress('airport', index),
        getForward: countedForward
      }), { active: true });
    }
    const checksAfterFinalNote = forwardChecks;
    updatePaceNoteState(makeRuntime({
      progress: triggerProgress('airport', notes.length - 1) + 0.002,
      getForward: countedForward
    }), { active: true });
    assert.equal(forwardChecks, checksAfterFinalNote, 'Once every note has fired, the lap must skip geometry and heading work');

    assert.match(app, /const driveByEarEnabled = installDriveByEarSetting\(\)/);
    assert.match(app, /if \(driveByEarEnabled\) \{[\s\S]*installUniversalDrivingSoundscape\(\);[\s\S]*installPaceNotes\(\);/);
    assert.match(paceAudio, /PACE_NOTE_UPDATE_INTERVAL_MS = 1000 \/ 30/, 'Pace-note position checks must be capped at 30 Hz');
    assert.match(paceAudio, /now - lastCheckedAt >= PACE_NOTE_UPDATE_INTERVAL_MS/);
    assert.match(paceAudio, /baseAudio\.update\(frame, now\)/, 'Pace notes must remain inside the central audio update path');
    assert.match(paceAudio, /firedNoteIds\.size >= notes\.length/, 'A completed pace-note lap must take the fast path');
    assert.doesNotMatch(paceAudio, /AudioContext|webkitAudioContext|createOscillator|createDynamicsCompressor/, 'Pace notes must not create a second audio engine');
    assert.match(audio, /window\.addEventListener\('turn:pace-note', handlePaceNoteAudio\)/);
    assert.match(audio, /schedulePaceNoteBeep\(/);
    assert.match(audio, /panner\.connect\(masterGain\)/, 'Pace notes must enter the existing TURN master graph');
    assert.doesNotMatch(paceAudio, /requestAnimationFrame|setInterval/, 'Pace notes must not add another continuous loop');
    assert.match(paceAudio, /state\.offRoad === true/, 'Off-road recovery must suppress pace-note triggers');
    assert.match(paceAudio, /mode === 'spectating'/, 'Spectator mode must stay quiet');
    for (const trackName of ['COUNTRYSIDE', 'AIRPORT', 'CLIFFSIDE', 'HARBOR']) {
      assert.match(paceMap, new RegExp(`const ${trackName}_PACE_NOTES`), `${trackName} must keep an explicit authored pace-note map`);
    }
    assert.match(soundGuide, /<h4>PACE NOTES<\/h4>/);
    assert.match(soundGuide, /Before major corners, one to three dry beeps/);

    console.log(`TURN ${release.id} all-track auditory pace notes and shared audio graph passed.`);
    """,
)

write(
    "turn-lab/tests/drive-by-ear-production.mjs",
    r"""
    import assert from 'node:assert/strict';
    import fs from 'node:fs/promises';
    import {
      DRIVE_BY_EAR_STORAGE_KEY,
      driveByEarEnabled,
      saveDriveByEarEnabled
    } from '../../turn/ui/drive-by-ear-setting.js';

    const [releaseSource, app, setting, style, menu, paceAudio] = await Promise.all([
      fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
      fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
      fs.readFile(new URL('../../turn/ui/drive-by-ear-setting.js', import.meta.url), 'utf8'),
      fs.readFile(new URL('../../turn/drive-by-ear-setting.css', import.meta.url), 'utf8'),
      fs.readFile(new URL('../../turn/ui/in-game-menu.js', import.meta.url), 'utf8'),
      fs.readFile(new URL('../../turn/audio/pace-notes.js', import.meta.url), 'utf8')
    ]);
    const release = JSON.parse(releaseSource);

    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    };

    assert.equal(DRIVE_BY_EAR_STORAGE_KEY, 'turn-drive-by-ear-v1');
    assert.equal(driveByEarEnabled(storage), true, 'Drive By Ear must be enabled when no preference has been saved');
    assert.equal(saveDriveByEarEnabled(false, storage), true);
    assert.equal(driveByEarEnabled(storage), false);
    assert.equal(saveDriveByEarEnabled(true, storage), true);
    assert.equal(driveByEarEnabled(storage), true);
    assert.equal(driveByEarEnabled({ getItem: () => { throw new Error('blocked'); } }), true, 'Storage failures must preserve the universal default');

    assert.match(app, /installDriveByEarSetting/);
    assert.ok(app.indexOf('./ui/drive-by-ear-setting.js') < app.indexOf('./audio/audio-system.js'), 'The saved preference must be known before audio modules install');
    assert.match(app, /if \(driveByEarEnabled\) \{/);
    assert.ok(app.indexOf('if (driveByEarEnabled)') < app.indexOf('./audio/driving-soundscape.js'));
    assert.match(setting, /DRIVE BY EAR<sup>™<\/sup>/);
    assert.match(setting, /On by default for every player/);
    assert.match(setting, /may improve performance on older devices/);
    assert.match(setting, /requestAnimationFrame\(reload\)/, 'Changing the preference must reload into a clean module graph');
    assert.match(style, /\.drive-by-ear-card/);
    assert.match(style, /orientation: landscape/);
    assert.match(style, /max-height: 500px/, 'The new card must retain a compact phone-landscape layout');
    assert.match(menu, /globalThis\.__turnDriveByEarEnabled === false/);
    assert.match(menu, /if \(soundGuideButton\) soundGuideButton\.hidden/, 'The Sound Guide must not advertise disabled processing');
    assert.doesNotMatch(paceAudio, /AudioContext|webkitAudioContext/, 'The optional module must carry no dormant audio engine');

    console.log(`TURN ${release.id} Drive By Ear universal-default and true-off path passed.`);
    """,
)

replace_once(
    ".github/workflows/turn-lab-tests.yml",
    """      - name: Run all-track auditory pace-note regression
        run: node turn-lab/tests/pace-notes-production.mjs

      - name: Run production performance and diagnostics regression
""",
    """      - name: Run all-track auditory pace-note regression
        run: node turn-lab/tests/pace-notes-production.mjs

      - name: Run Drive By Ear preference and shutdown regression
        run: node turn-lab/tests/drive-by-ear-production.mjs

      - name: Run production performance and diagnostics regression
""",
)

release_path = ROOT / "turn/release.json"
release = json.loads(release_path.read_text())
release.update({
    "version": "1.17.0",
    "id": "2026.07.27-r97",
    "cacheKey": "20260727-r97",
})
release_path.write_text(json.dumps(release, indent=2) + "\n")
subprocess.run(["node", "turn/scripts/release.mjs", "--write"], cwd=ROOT, check=True)

print("Drive By Ear refactor applied.")
