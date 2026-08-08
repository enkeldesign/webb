export const CHALLENGE_STORE_BASE_URL = 'https://turn-challenges.erik-jansson-ux.workers.dev';
export const CHALLENGE_SNAPSHOT_ID_PATTERN = /^[0123456789abcdefghjkmnpqrstvwxyz]{12}$/;

const DEFAULT_TIMEOUT_MS = 3500;
const DEFAULT_PUBLIC_BASE_URL = 'https://enkel.design/yourturn/';

export function snapshotIdFromLocation(locationRef = globalThis.location) {
  const query = new URLSearchParams(locationRef?.search || '');
  return normalizeSnapshotId(query.get('c'));
}

export function makeSnapshotChallengeUrl(snapshotId, {
  baseUrl = DEFAULT_PUBLIC_BASE_URL,
  reply = '',
  responder = ''
} = {}) {
  const id = normalizeSnapshotId(snapshotId);
  if (!id) throw new Error('YOUR TURN received an invalid short challenge ID.');

  const url = new URL(baseUrl);
  url.searchParams.set('c', id);
  url.searchParams.delete('share');
  if (reply) url.searchParams.set('reply', String(reply));
  else url.searchParams.delete('reply');
  if (responder) url.searchParams.set('responder', normalizeResponder(responder));
  else url.searchParams.delete('responder');
  url.hash = '';
  return url.href;
}

export function makeSelfContainedChallengeUrl(encoded, {
  baseUrl = DEFAULT_PUBLIC_BASE_URL,
  reply = '',
  responder = ''
} = {}) {
  const payload = normalizeEncodedPayload(encoded);
  const url = new URL(baseUrl);
  url.searchParams.delete('c');
  url.searchParams.set('share', '1');
  if (reply) url.searchParams.set('reply', String(reply));
  else url.searchParams.delete('reply');
  if (responder) url.searchParams.set('responder', normalizeResponder(responder));
  else url.searchParams.delete('responder');

  const fragment = new URLSearchParams();
  fragment.set('challenge', payload);
  url.hash = fragment.toString();
  return url.href;
}

export async function saveChallengeSnapshot(encoded, {
  fetchImpl = globalThis.fetch,
  serviceBaseUrl = CHALLENGE_STORE_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const payload = normalizeEncodedPayload(encoded);
  if (typeof fetchImpl !== 'function') throw new Error('Challenge storage is unavailable in this browser.');

  const response = await fetchWithTimeout(`${stripTrailingSlash(serviceBaseUrl)}/v1/challenges`, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ payload })
  }, { fetchImpl, timeoutMs });

  const body = await readJsonResponse(response);
  if (!response?.ok) {
    throw new Error(body?.message || `Challenge storage returned ${response?.status || 'an error'}.`);
  }

  const id = normalizeSnapshotId(body?.id);
  if (!id) throw new Error('Challenge storage returned an invalid short ID.');
  return id;
}

export async function loadChallengeSnapshot(snapshotId, {
  fetchImpl = globalThis.fetch,
  serviceBaseUrl = CHALLENGE_STORE_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const id = normalizeSnapshotId(snapshotId);
  if (!id) throw new Error('This short challenge link is incomplete.');
  if (typeof fetchImpl !== 'function') throw new Error('This browser cannot load short YOUR TURN links.');

  const response = await fetchWithTimeout(`${stripTrailingSlash(serviceBaseUrl)}/v1/challenges/${id}`, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    cache: 'default',
    headers: { 'Accept': 'application/json' }
  }, { fetchImpl, timeoutMs });

  const body = await readJsonResponse(response);
  if (!response?.ok) {
    if (response?.status === 404) throw new Error('This YOUR TURN challenge could not be found.');
    throw new Error(body?.message || `The challenge service returned ${response?.status || 'an error'}.`);
  }

  return normalizeEncodedPayload(body?.payload);
}

export async function makeShareableChallengeUrl(encoded, {
  baseUrl = DEFAULT_PUBLIC_BASE_URL,
  reply = '',
  responder = '',
  fetchImpl = globalThis.fetch,
  serviceBaseUrl = CHALLENGE_STORE_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const payload = normalizeEncodedPayload(encoded);
  const fallbackUrl = makeSelfContainedChallengeUrl(payload, { baseUrl, reply, responder });

  try {
    const snapshotId = await saveChallengeSnapshot(payload, {
      fetchImpl,
      serviceBaseUrl,
      timeoutMs
    });
    return Object.freeze({
      url: makeSnapshotChallengeUrl(snapshotId, { baseUrl, reply, responder }),
      snapshotId,
      usedSnapshot: true,
      fallbackUrl,
      error: null
    });
  } catch (error) {
    return Object.freeze({
      url: fallbackUrl,
      snapshotId: '',
      usedSnapshot: false,
      fallbackUrl,
      error: error instanceof Error ? error : new Error('Short challenge storage failed.')
    });
  }
}

function normalizeSnapshotId(value) {
  const id = String(value || '').trim().toLowerCase();
  return CHALLENGE_SNAPSHOT_ID_PATTERN.test(id) ? id : '';
}

function normalizeEncodedPayload(value) {
  const payload = String(value || '').trim();
  if (!/^(?:gz|raw)\.[A-Za-z0-9_-]+$/.test(payload)) {
    throw new Error('YOUR TURN challenge data is incomplete or damaged.');
  }
  return payload;
}

function normalizeResponder(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
}

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/g, '');
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}

async function fetchWithTimeout(url, init, { fetchImpl, timeoutMs }) {
  const duration = Math.max(250, Number(timeoutMs) || DEFAULT_TIMEOUT_MS);
  if (typeof AbortController !== 'function') return fetchImpl(url, init);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), duration);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Challenge storage took too long to respond.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
