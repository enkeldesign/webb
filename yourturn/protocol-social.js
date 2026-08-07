export {
  MAX_CHALLENGE_RACERS,
  challengeFromLap,
  challengeLeader,
  challengeSender,
  challengeWithLap,
  createChallengeChainId,
  createRacerId,
  decodeChallenge,
  encodeChallenge,
  encodedChallengeFromLocation,
  formatChallengeTime,
  makeMockChallengeUrl,
  normalizeChallenge,
  normalizeChallengeName
} from '/yourturn/protocol.js?revision=r7';

import { normalizeChallengeName } from '/yourturn/protocol.js?revision=r7';

// Keep the replay payload in the URL fragment. Social preview crawlers do not send
// fragments to the server, so every generated challenge presents a short, stable
// /yourturn/?share=1 URL to Messages and other link-preview services while the
// recipient browser still receives the complete self-contained challenge.
export function makeChallengeUrl(encoded, {
  baseUrl = 'https://enkel.design/yourturn/',
  reply = '',
  responder = ''
} = {}) {
  const url = new URL(baseUrl);
  url.searchParams.delete('c');
  url.searchParams.set('share', '1');
  if (reply) url.searchParams.set('reply', reply);
  if (responder) url.searchParams.set('responder', normalizeChallengeName(responder));

  const fragment = new URLSearchParams();
  fragment.set('challenge', String(encoded || ''));
  url.hash = fragment.toString();
  return url.href;
}
