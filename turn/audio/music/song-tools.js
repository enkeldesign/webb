function freezeSequence(sequence, label) {
  if (!Array.isArray(sequence) || sequence.length === 0) {
    throw new TypeError(`TURN music ${label} must be a non-empty sequence.`);
  }
  return Object.freeze(sequence.slice());
}

export function bars(...barPatterns) {
  const sequence = [];
  for (const [barIndex, source] of barPatterns.entries()) {
    const tokens = String(source).trim().split(/\s+/).filter(Boolean);
    if (tokens.length !== 16) {
      throw new RangeError(`TURN music bar ${barIndex + 1} must contain 16 sixteenth-note steps; received ${tokens.length}.`);
    }
    sequence.push(...tokens.map((token) => token === '-' ? null : token));
  }
  return Object.freeze(sequence);
}

export function makeSection({ name, lead, bass, arp, drums, leadVoice = 'lead' }) {
  const section = {
    name: String(name || '').trim(),
    leadVoice,
    lead: freezeSequence(lead, `${name} lead`),
    bass: freezeSequence(bass, `${name} bass`),
    arp: freezeSequence(arp, `${name} arp`),
    drums: freezeSequence(drums, `${name} drums`)
  };
  const length = section.lead.length;
  for (const lane of ['bass', 'arp', 'drums']) {
    if (section[lane].length !== length) {
      throw new RangeError(`TURN music ${section.name} ${lane} must contain ${length} steps.`);
    }
  }
  if (!section.name) throw new TypeError('TURN music sections need a name.');
  return Object.freeze(section);
}

export function makeSong({ id, name, bpm, sections, arrangement }) {
  const songId = String(id || '').trim();
  const songName = String(name || '').trim();
  const tempo = Number(bpm);
  if (!songId || !songName) throw new TypeError('TURN music songs need an id and name.');
  if (!Number.isFinite(tempo) || tempo < 70 || tempo > 180) {
    throw new RangeError(`TURN music ${songId} BPM must be between 70 and 180.`);
  }
  if (!Array.isArray(sections) || sections.length < 3) {
    throw new RangeError(`TURN music ${songId} needs tune, chorus and bridge sections.`);
  }
  const byName = new Map(sections.map((section) => [section.name, section]));
  for (const required of ['tune', 'chorus', 'bridge']) {
    if (!byName.has(required)) throw new RangeError(`TURN music ${songId} is missing its ${required}.`);
  }
  if (!Array.isArray(arrangement) || arrangement.length !== 6) {
    throw new RangeError(`TURN music ${songId} must have exactly six arrangement parts.`);
  }
  const arranged = arrangement.map((sectionName) => {
    const section = byName.get(sectionName);
    if (!section) throw new RangeError(`TURN music ${songId} references unknown section ${sectionName}.`);
    return section;
  });
  return Object.freeze({
    id: songId,
    name: songName,
    bpm: tempo,
    sections: Object.freeze(sections.slice()),
    arrangement: Object.freeze(arranged),
    form: Object.freeze(arrangement.slice())
  });
}
