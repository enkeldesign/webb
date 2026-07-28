const CARDINAL_WORDS = Object.freeze([
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty'
]);

const ORDINAL_WORDS = Object.freeze([
  'zeroth',
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'thirteenth',
  'fourteenth',
  'fifteenth',
  'sixteenth',
  'seventeenth',
  'eighteenth',
  'nineteenth',
  'twentieth'
]);

const DIGIT_WORDS = Object.freeze([
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine'
]);

export function cardinalWord(value) {
  const number = normalizeCount(value);
  return CARDINAL_WORDS[number] || String(number);
}

export function ordinalWord(value) {
  const number = normalizeCount(value, 1);
  if (ORDINAL_WORDS[number]) return ORDINAL_WORDS[number];

  const remainder100 = number % 100;
  const remainder10 = number % 10;
  const suffix = remainder100 >= 11 && remainder100 <= 13
    ? 'th'
    : remainder10 === 1
      ? 'st'
      : remainder10 === 2
        ? 'nd'
        : remainder10 === 3
          ? 'rd'
          : 'th';
  return `${number}${suffix}`;
}

export function spokenPosition(position, total) {
  return `${ordinalWord(position)} of ${cardinalWord(total)}`;
}

export function spokenRivalCount(count) {
  const rivals = normalizeCount(count);
  return `${cardinalWord(rivals)} ${rivals === 1 ? 'rival' : 'rivals'}`;
}

export function spokenLapTime(seconds) {
  if (!Number.isFinite(Number(seconds))) return 'no time';

  const totalMilliseconds = Math.max(0, Math.floor(Number(seconds) * 1000 + 0.000001));
  const minutes = Math.floor(totalMilliseconds / 60000);
  const remainingMilliseconds = totalMilliseconds - minutes * 60000;
  const wholeSeconds = Math.floor(remainingMilliseconds / 1000);
  const milliseconds = remainingMilliseconds - wholeSeconds * 1000;
  const parts = [];

  if (minutes > 0) {
    parts.push(`${cardinalWord(minutes)} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }

  const secondsWord = cardinalWord(wholeSeconds);
  if (milliseconds > 0) {
    const decimal = String(milliseconds)
      .padStart(3, '0')
      .split('')
      .map((digit) => DIGIT_WORDS[Number(digit)])
      .join(' ');
    parts.push(`${secondsWord} point ${decimal} seconds`);
  } else {
    parts.push(`${secondsWord} ${wholeSeconds === 1 ? 'second' : 'seconds'}`);
  }

  return parts.join(', ');
}

export function lapResultAnnouncement({ position, time } = {}) {
  return `Lap. Position: ${ordinalWord(position)}. Time: ${spokenLapTime(time)}.`;
}

export function lapVoidAnnouncement(reason) {
  return reason === 'missed-checkpoint'
    ? 'Lap void. Stay on the track.'
    : 'Lap void. Try again.';
}

export function setLiveAnnouncement(element, message) {
  if (!element) return;
  const nextMessage = String(message || '').trim();
  const revision = (Number(element.dataset.announcementRevision) || 0) + 1;
  element.dataset.announcementRevision = String(revision);
  element.textContent = '';

  queueMicrotask(() => {
    if (Number(element.dataset.announcementRevision) !== revision) return;
    element.textContent = nextMessage;
  });
}

function normalizeCount(value, fallback = 0) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}
