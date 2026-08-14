import { MENU_SONG, SONGBOOK, songForTrack } from './music/songbook.js?revision=r197-audio-mix';
import { createToneRuntime } from './music/tone-runtime.js?revision=r184-score-v2';
import { createDrumRuntime } from './music/drum-runtime.js?revision=r184-score-v2';
import { LEAD_VOICES, BASS_VOICES, ARP_VOICES, DRUM_KITS } from './music/instrument-bank.js?revision=r184-score-v2';
import { installMusicControls } from './music/music-controls.js?revision=r184-score-v2';

const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
const MUSIC_VOLUME_STORAGE_KEY = 'turn-racing-music-volume-v1';
const MUSIC_LAST_VOLUME_STORAGE_KEY = 'turn-racing-music-last-volume-v1';
const DEFAULT_VOLUME = 100;
const STEPS_PER_BEAT = 4;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.12;
const DESIGNED_MASTER_GAIN = 0.54;

const NOTE_INDEX = Object.freeze({
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
});

let installed = false;
let context = null;
let masterGain = null;
let noiseBuffer = null;
let schedulerTimer = 0;
let activeSong = MENU_SONG;
let currentSection = 0;
let currentStep = 0;
let nextStepTime = 0;
let stepSeconds = stepDurationFor(activeSong);
let playing = false;
let soundEnabled = true;
let musicVolume = readStoredNumber(MUSIC_VOLUME_STORAGE_KEY, DEFAULT_VOLUME);
let lastNonZeroVolume = readStoredNumber(MUSIC_LAST_VOLUME_STORAGE_KEY, DEFAULT_VOLUME);
let controls = null;
let selectedTrackId = 'countryside';
let tones = null;
let drums = null;

function clamp(value, min, max, fallback = min) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}
function readStoredNumber(key, fallback) {
  try {
    const stored = globalThis.localStorage?.getItem(key);
    if (stored == null || stored === '') return fallback;
    const value = Number(stored);
    return Number.isFinite(value) ? clamp(value, 0, 100, fallback) : fallback;
  } catch (_) { return fallback; }
}
function writeStoredNumber(key, value) {
  try { globalThis.localStorage?.setItem(key, String(Math.round(value))); return true; }
  catch (_) { return false; }
}
function stepDurationFor(song) { return (60 / song.bpm) / STEPS_PER_BEAT; }
function noteToFrequency(note) {
  const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note);
  if (!match) return 440;
  const midi = NOTE_INDEX[match[1]] + (Number(match[2]) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}
function makeGain(value = 1) {
  if (!context || typeof globalThis.GainNode !== 'function') return null;
  return new globalThis.GainNode(context, { gain: value });
}
function makeNoiseBuffer() {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}
function ensureGraph() {
  if (context || !AudioContextClass || typeof globalThis.GainNode !== 'function') return Boolean(context);
  try { context = new AudioContextClass({ latencyHint: 'playback' }); }
  catch (_) { context = new AudioContextClass(); }
  masterGain = makeGain(0);
  if (!masterGain) { void context.close?.(); context = null; return false; }
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -11;
  compressor.knee.value = 20;
  compressor.ratio.value = 2.8;
  compressor.attack.value = 0.012;
  compressor.release.value = 0.26;
  masterGain.connect(compressor);
  compressor.connect(context.destination);
  noiseBuffer = makeNoiseBuffer();
  tones = createToneRuntime({ context, masterGain, noteToFrequency, getStepSeconds: () => stepSeconds });
  drums = createDrumRuntime({ context, masterGain, noiseBuffer });
  return true;
}
function activeSection() { return activeSong.arrangement[currentSection]; }
function scheduleStep(step, time) {
  const section = activeSection();
  tones?.playLead(section.lead[step], time, section.leadVoice || 'lead');
  tones?.playBass(section.bass[step], time, section.bassVoice || 'warm');
  tones?.playArp(section.arp[step], time, section.arpVoice || 'soft');
  drums?.play(section.drums[step], time, section.drumKit || 'classic');
}
function stepSpacing(step) {
  const swing = clamp(Number(activeSong.swing || 0), 0, .24, 0);
  return stepSeconds * (step % 2 === 0 ? 1 + swing : 1 - swing);
}
function advanceStep() {
  const section = activeSection();
  const completedStep = currentStep;
  currentStep += 1;
  if (currentStep >= section.lead.length) { currentStep = 0; currentSection = (currentSection + 1) % activeSong.arrangement.length; }
  nextStepTime += stepSpacing(completedStep);
}
function scheduler() {
  if (!playing || !context || context.state !== 'running') return;
  while (playing && nextStepTime < context.currentTime + SCHEDULE_AHEAD_SECONDS) { scheduleStep(currentStep, nextStepTime); advanceStep(); }
  schedulerTimer = globalThis.setTimeout(scheduler, LOOKAHEAD_MS);
}
function clearScheduler() { globalThis.clearTimeout(schedulerTimer); schedulerTimer = 0; }
function resetSongPosition() { currentSection = 0; currentStep = 0; }
function switchSong(nextSong, { restart = true } = {}) {
  if (!nextSong || nextSong.id === activeSong.id) { if (restart && nextSong?.id === activeSong.id) resetSongPosition(); return activeSong; }
  activeSong = nextSong; stepSeconds = stepDurationFor(activeSong); resetSongPosition();
  if (playing && context?.state === 'running') { clearScheduler(); tones?.stop(); drums?.stop(); nextStepTime = context.currentTime + .045; scheduler(); }
  globalThis.dispatchEvent?.(new CustomEvent('turn:music-song-changed', { detail: { songId: activeSong.id, songName: activeSong.name, bpm: activeSong.bpm, key: activeSong.key, style: activeSong.style } }));
  return activeSong;
}
function resolveTrackId(detail = {}) { return detail.trackId || selectedTrackId || globalThis.__turnGetTrackId?.() || globalThis.__turnRuntime?.state?.trackId || 'countryside'; }
function handleTrackChanged(event) {
  selectedTrackId = event.detail?.trackId || selectedTrackId;
  if (globalThis.__turnRuntime?.state?.running === true) switchSong(songForTrack(selectedTrackId), { restart: true });
}
function handleUiStateChange(event) {
  const detail = event.detail || {};
  if (detail.trackId) selectedTrackId = detail.trackId;
  if (detail.running === true) {
    const trackId = globalThis.__turnGetTrackId?.() || resolveTrackId(detail);
    selectedTrackId = trackId; switchSong(songForTrack(trackId), { restart: false }); return;
  }
  switchSong(MENU_SONG, { restart: false });
}
function applyMasterVolume() {
  if (!context || !masterGain) return;
  const now=context.currentTime; const gain=soundEnabled&&musicVolume>0?DESIGNED_MASTER_GAIN*(musicVolume/100):0;
  try { masterGain.gain.cancelScheduledValues(now); masterGain.gain.setTargetAtTime(gain,now,.04); }
  catch (_) { masterGain.gain.value=gain; }
}
async function startPlayback({ restart = false } = {}) {
  if (!soundEnabled || musicVolume <= 0 || document.visibilityState === 'hidden') return false;
  if (!ensureGraph()) return false;
  if (restart) resetSongPosition();
  try { if (context.state !== 'running') await context.resume(); } catch (_) { return false; }
  if (context.state !== 'running') return false;
  applyMasterVolume();
  if (!playing) { playing=true; nextStepTime=context.currentTime+.05; scheduler(); }
  return true;
}
async function stopPlayback({ reset = false } = {}) {
  playing=false; clearScheduler(); tones?.stop(); drums?.stop(); if(reset)resetSongPosition(); if(!context)return; applyMasterVolume();
  try { if(context.state==='running') await context.suspend(); } catch (_) {}
}
function shouldPlay() { return soundEnabled && musicVolume > 0 && document.visibilityState !== 'hidden'; }
function setVolume(nextVolume,{restart=false}={}) {
  const previous=musicVolume; musicVolume=clamp(Number(nextVolume),0,100,DEFAULT_VOLUME);
  if(musicVolume>0){lastNonZeroVolume=musicVolume;writeStoredNumber(MUSIC_LAST_VOLUME_STORAGE_KEY,lastNonZeroVolume);}
  writeStoredNumber(MUSIC_VOLUME_STORAGE_KEY,musicVolume); controls?.sync();
  if(musicVolume<=0||!soundEnabled){void stopPlayback({reset:musicVolume<=0});return musicVolume;}
  if(context&&context.state==='running')applyMasterVolume();
  if(previous<=0||restart||!playing)void startPlayback({restart:previous<=0||restart});
  return musicVolume;
}
function toggleMusic(){if(musicVolume>0)return setVolume(0);return setVolume(clamp(lastNonZeroVolume||DEFAULT_VOLUME,1,100,DEFAULT_VOLUME),{restart:true});}
function setSystemSoundEnabled(enabled){soundEnabled=Boolean(enabled);if(!soundEnabled)void stopPlayback({reset:false});else if(musicVolume>0)void startPlayback({restart:false});}

function installMusicStylesheet() {
  if (document.getElementById('turn-racing-music-stylesheet')) return;
  const link = document.createElement('link');
  link.id = 'turn-racing-music-stylesheet';
  link.rel = 'stylesheet';
  link.href = '/turn/audio/music/music-controls.css?revision=r184-score-v2';
  document.head.appendChild(link);
}

function handleVisibilityChange(){if(document.visibilityState==='hidden'){void stopPlayback({reset:false});return;}if(shouldPlay())void startPlayback({restart:false});}
function handleUserActivation(){if(!shouldPlay()||playing)return;void startPlayback({restart:false});}

export function installRacingMusic({ home = document.querySelector('.m8-home') } = {}) {
  if(installed)return globalThis.__turnRacingMusic;
  installed=true;soundEnabled=globalThis.__turnAudioPreferences?.getSettings?.().audioEnabled!==false;selectedTrackId=globalThis.__turnGetTrackId?.()||globalThis.__turnRuntime?.state?.trackId||selectedTrackId;
  installMusicStylesheet();
  controls = installMusicControls({
    home,
    getVolume: () => musicVolume,
    setVolume,
    toggleMusic,
    setSystemSoundEnabled
  });
  document.addEventListener('pointerdown',handleUserActivation,{capture:true,passive:true});document.addEventListener('keydown',handleUserActivation,{capture:true});document.addEventListener('visibilitychange',handleVisibilityChange,{passive:true});globalThis.addEventListener('turn:track-changed',handleTrackChanged);globalThis.addEventListener('turn:ui-state-change',handleUiStateChange);globalThis.addEventListener('pagehide',()=>void stopPlayback({reset:false}),{passive:true});
  if(globalThis.__turnRuntime?.state?.running===true)switchSong(songForTrack(selectedTrackId),{restart:true});if(shouldPlay())void startPlayback({restart:false});
  const api=Object.freeze({
    timbre:'score-v5-multi-instrument',
    instruments:Object.freeze({lead:Object.freeze(Object.keys(LEAD_VOICES)),bass:Object.freeze(Object.keys(BASS_VOICES)),arp:Object.freeze(Object.keys(ARP_VOICES)),drums:Object.freeze(Object.keys(DRUM_KITS))}),
    songs:Object.freeze(SONGBOOK.map((song)=>Object.freeze({id:song.id,name:song.name,bpm:song.bpm,key:song.key,style:song.style,swing:song.swing,form:song.form}))),
    get bpm(){return activeSong.bpm;},get songId(){return activeSong.id;},get songName(){return activeSong.name;},get arrangement(){return activeSong.form;},get volume(){return musicVolume;},get enabled(){return musicVolume>0;},get playing(){return playing;},get state(){return context?.state||'not-created';},
    setVolume,toggle:toggleMusic,start:()=>startPlayback({restart:false}),stop:()=>setVolume(0),syncControls:()=>controls?.sync()
  });
  globalThis.__turnRacingMusic=api;return api;
}
