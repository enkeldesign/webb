export const MOCK_CHALLENGES = Object.freeze({
  'sol-countryside-r1': Object.freeze({
    id: 'sol-countryside-r1',
    challengerName: 'SOL',
    trackId: 'countryside',
    time: 13.5,
    carId: 'sedan-sports',
    carColor: '#ff4fa3',
    carSecondaryColor: '#252a35',
    label: 'SOL · Countryside · 0:13.500'
  }),
  'sol-countryside-friendly': Object.freeze({
    id: 'sol-countryside-friendly',
    challengerName: 'SOL',
    trackId: 'countryside',
    time: 18.75,
    carId: 'sedan-sports',
    carColor: '#ff4fa3',
    carSecondaryColor: '#252a35',
    label: 'SOL · Countryside · 0:18.750'
  }),
  'alex-countryside-r1': Object.freeze({
    id: 'alex-countryside-r1',
    challengerName: 'ALEX',
    trackId: 'countryside',
    time: 16.25,
    carId: 'sedan',
    carColor: '#38d9ff',
    carSecondaryColor: '#fff8e8',
    label: 'ALEX · Countryside · 0:16.250'
  })
});

export function getMockChallenge(id) {
  return MOCK_CHALLENGES[String(id || '')] || null;
}
