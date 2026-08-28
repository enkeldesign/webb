const RACING_TAG = 'racing';
const TIME_TRIALS_TAG = 'time-trials';
const NEW_TAG = 'new';

function normalizedValues(values) {
  if (values instanceof Set) return values;
  if (Array.isArray(values)) return new Set(values.filter(Boolean));
  return new Set(String(values || '').split(/\s+/).filter(Boolean));
}

export function achievementCardTags({ tags = '', category = '', unseen = false } = {}) {
  const normalized = new Set(String(tags || '').split(/\s+/).filter(Boolean));
  if (category) normalized.add(category);
  if (category === TIME_TRIALS_TAG) normalized.add(RACING_TAG);
  if (unseen === true) normalized.add(NEW_TAG);
  return normalized;
}

export function achievementCardMatchesFilters(
  card = {},
  { activeTags = [], activeStatuses = [] } = {}
) {
  const selectedTags = normalizedValues(activeTags);
  const selectedStatuses = normalizedValues(activeStatuses);
  const cardTags = achievementCardTags(card);
  const tagMatch = selectedTags.size === 0
    || [...selectedTags].some((tag) => cardTags.has(tag));
  const status = String(card.status || '');
  const statusMatch = selectedStatuses.size === 0
    || (selectedStatuses.has('unlocked') && status === 'unlocked')
    || (selectedStatuses.has('locked') && status !== 'unlocked');
  return tagMatch && statusMatch;
}
