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
  }),
  'erik-seed-r1': Object.freeze({
    id: 'erik-seed-r1',
    challengerName: 'ERIK',
    trackId: 'countryside',
    time: 18.75,
    carId: 'sedan-sports',
    carColor: '#ffd1e6',
    carSecondaryColor: '#252a35',
    label: 'ERIK · START A FAMILY CHAIN'
  }),
  'friends-countryside-r1': Object.freeze({
    id: 'friends-countryside-r1',
    challengerName: 'ARVID',
    trackId: 'countryside',
    time: 15.4,
    carId: 'sedan-sports',
    carColor: '#ff4fa3',
    carSecondaryColor: '#252a35',
    racers: Object.freeze([
      Object.freeze({ id: 'mock-arvid', name: 'ARVID', time: 15.4, laneOffset: 0 }),
      Object.freeze({ id: 'mock-erik', name: 'ERIK', time: 16.1, laneOffset: 1.15 }),
      Object.freeze({ id: 'mock-kerstin', name: 'KERSTIN', time: 17.05, laneOffset: -1.15 })
    ]),
    label: 'ARVID + ERIK + KERSTIN · 3 cars'
  }),
  'erik-full-field-r1': Object.freeze({
    id: 'erik-full-field-r1',
    challengerName: 'ERIK',
    trackId: 'countryside',
    time: 15.4,
    carId: 'sedan-sports',
    carColor: '#ffd1e6',
    carSecondaryColor: '#252a35',
    racers: Object.freeze([
      Object.freeze({ id: 'mock-erik-first', name: 'ERIK', time: 15.4, laneOffset: 0 }),
      Object.freeze({ id: 'mock-arvid-second', name: 'ARVID', time: 16.0, laneOffset: 0.85 }),
      Object.freeze({ id: 'mock-kerstin-third', name: 'KERSTIN', time: 16.7, laneOffset: -0.85 }),
      Object.freeze({ id: 'mock-sol-fourth', name: 'SOL', time: 17.4, laneOffset: 1.55 })
    ]),
    label: 'ERIK FIRST · 4 rivals + YOU'
  })
});

export function getMockChallenge(id) {
  return MOCK_CHALLENGES[String(id || '')] || null;
}
