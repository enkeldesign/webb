export function captureTieTone(base, before, time, voice, stepSeconds) {
  const body = [...base.graphs.keys()].find((source) => !before.has(source));
  if (!body) return null;
  const nodes = base.graphs.get(body) || [];
  return {
    body,
    harmonic: voice.harmonic ? nodes[1] : null,
    amp: nodes.at(-1),
    voice,
    attackEnd: time + Math.min(voice.attack, stepSeconds * voice.length * .45),
    end: time + stepSeconds * voice.length
  };
}
