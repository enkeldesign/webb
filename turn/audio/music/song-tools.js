function freezeSequence(sequence, label) {
  if (!Array.isArray(sequence) || sequence.length === 0) throw new TypeError(`TURN music ${label} must be a non-empty sequence.`);
  return Object.freeze(sequence.slice());
}

export function bars(...barPatterns) {
  const sequence = [];
  for (const [barIndex, source] of barPatterns.entries()) {
    const tokens = String(source).trim().split(/\s+/).filter(Boolean);
    if (tokens.length !== 16) throw new RangeError(`TURN music bar ${barIndex + 1} must contain 16 sixteenth-note steps; received ${tokens.length}.`);
    sequence.push(...tokens.map((token) => token === '-' ? null : token));
  }
  return Object.freeze(sequence);
}

function voiceName(value, fallback) { const normalized = String(value || fallback).trim(); return normalized || fallback; }
function validateTieSequence(sequence, label, { allowTies = true } = {}) {
  let activeNote = false;
  for (let step = 0; step < sequence.length; step += 1) {
    const token = sequence[step];
    if (token === '=') {
      if (!allowTies) throw new RangeError(`TURN music ${label} cannot use note ties.`);
      if (!activeNote) throw new RangeError(`TURN music ${label} tie at step ${step + 1} must immediately follow a note or another tie.`);
      continue;
    }
    activeNote = Boolean(token);
  }
}
function compileTieSequence(sequence) {
  if (!sequence.includes('=')) return sequence;
  const compiled = sequence.slice();
  for (let step = 0; step < compiled.length; step += 1) {
    const note = compiled[step];
    if (!note || note === '=') continue;
    let heldSteps = 1;
    while (step + heldSteps < compiled.length && compiled[step + heldSteps] === '=') heldSteps += 1;
    if (heldSteps === 1) continue;
    const event = { note, heldSteps };
    Object.defineProperties(event, {
      startStep: { value: step, writable: true },
      gateFactor: { value: heldSteps, writable: true }
    });
    compiled[step] = event;
    for (let offset = 1; offset < heldSteps; offset += 1) compiled[step + offset] = null;
  }
  return Object.freeze(compiled);
}
function finalizeTieGates(sections, swing) {
  for (const section of sections) for (const lane of ['lead', 'bass', 'arp']) for (const event of section[lane]) {
    if (!event || typeof event !== 'object' || !Number.isInteger(event.heldSteps)) continue;
    let gateFactor = 0;
    for (let offset = 0; offset < event.heldSteps; offset += 1) gateFactor += (event.startStep + offset) % 2 === 0 ? 1 + swing : 1 - swing;
    event.gateFactor = gateFactor;
    Object.freeze(event);
  }
}

export function makeSection({ name, harmony, lead, bass, arp, drums, leadVoice = 'lead', bassVoice = 'warm', arpVoice = 'soft', drumKit = 'classic' }) {
  const section = {
    name: String(name || '').trim(),
    harmony: Array.isArray(harmony) ? Object.freeze(harmony.map((chord) => String(chord).trim())) : null,
    leadVoice: voiceName(leadVoice, 'lead'), bassVoice: voiceName(bassVoice, 'warm'), arpVoice: voiceName(arpVoice, 'soft'), drumKit: voiceName(drumKit, 'classic'),
    lead: freezeSequence(lead, `${name} lead`), bass: freezeSequence(bass, `${name} bass`), arp: freezeSequence(arp, `${name} arp`), drums: freezeSequence(drums, `${name} drums`)
  };
  const length = section.lead.length;
  for (const lane of ['bass', 'arp', 'drums']) if (section[lane].length !== length) throw new RangeError(`TURN music ${section.name} ${lane} must contain ${length} steps.`);
  if (!section.name) throw new TypeError('TURN music sections need a name.');
  if (length % 16 !== 0) throw new RangeError(`TURN music ${section.name} must contain whole 16-step bars.`);
  for (const lane of ['lead', 'bass', 'arp']) { validateTieSequence(section[lane], `${section.name} ${lane}`); section[lane] = compileTieSequence(section[lane]); }
  validateTieSequence(section.drums, `${section.name} drums`, { allowTies: false });
  if (section.harmony == null) section.harmony = Object.freeze(Array.from({ length: length / 16 }, () => ''));
  else if (section.harmony.length !== length / 16) throw new RangeError(`TURN music ${section.name} harmony must name exactly one chord per bar.`);
  return Object.freeze(section);
}

export function makeSong({ id, name, bpm, key = '', style = '', swing = 0, sections, arrangement }) {
  const songId = String(id || '').trim(), songName = String(name || '').trim(), tempo = Number(bpm), groove = Number(swing || 0);
  if (!songId || !songName) throw new TypeError('TURN music songs need an id and name.');
  if (!Number.isFinite(tempo) || tempo < 70 || tempo > 180) throw new RangeError(`TURN music ${songId} BPM must be between 70 and 180.`);
  if (!Number.isFinite(groove) || groove < 0 || groove > 0.24) throw new RangeError(`TURN music ${songId} swing must be between 0 and 0.24.`);
  if (!Array.isArray(sections) || sections.length < 3) throw new RangeError(`TURN music ${songId} needs tune, chorus and bridge sections.`);
  const byName = new Map(sections.map((section) => [section.name, section]));
  if (byName.size !== sections.length) throw new RangeError(`TURN music ${songId} section names must be unique.`);
  for (const required of ['tune', 'chorus', 'bridge']) if (!byName.has(required)) throw new RangeError(`TURN music ${songId} is missing its ${required}.`);
  if (!Array.isArray(arrangement) || arrangement.length !== 6) throw new RangeError(`TURN music ${songId} must have exactly six arrangement parts.`);
  finalizeTieGates(sections, groove);
  const arranged = arrangement.map((sectionName) => { const section = byName.get(sectionName); if (!section) throw new RangeError(`TURN music ${songId} references unknown section ${sectionName}.`); return section; });
  return Object.freeze({ id: songId, name: songName, bpm: tempo, key: String(key || '').trim(), style: String(style || '').trim(), swing: groove, sections: Object.freeze(sections.slice()), arrangement: Object.freeze(arranged), form: Object.freeze(arrangement.slice()) });
}
