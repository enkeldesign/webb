'use strict';
const CITIES = {
  sundsvall: {
    id: 'sundsvall', name: 'Sundsvall', short: 'SUN', hub: 'Sundsvall terminal',
    towns: ['Sundsvall', 'Timrå', 'Söråker', 'Härnösand', 'Ånge'],
    coord: [17.3069, 62.3908], gateway: 'stockholm',
    crew: [
      { name: 'Mira', role: 'Inbound lead', assetKey: 'workerSunMira' },
      { name: 'Leo', role: 'Express sort', assetKey: 'workerSunLeo' },
      { name: 'Sam', role: 'Local routes', assetKey: 'workerSunSam' }
    ]
  },
  stockholm: {
    id: 'stockholm', name: 'Stockholm', short: 'STO', hub: 'Stockholm terminal',
    towns: ['Stockholm', 'Solna', 'Nacka', 'Södertälje', 'Uppsala'],
    coord: [18.0686, 59.3293], gateway: 'stockholm',
    crew: [
      { name: 'Amina', role: 'International desk', assetKey: 'workerStoAmina' },
      { name: 'Freja', role: 'Priority sort', assetKey: 'workerStoFreja' },
      { name: 'Viktor', role: 'National handoff', assetKey: 'workerStoViktor' }
    ]
  },
  goteborg: {
    id: 'goteborg', name: 'Göteborg', short: 'GBG', hub: 'Göteborg terminal',
    towns: ['Göteborg', 'Mölndal', 'Kungälv', 'Kungsbacka', 'Borås'],
    coord: [11.9746, 57.7089], gateway: 'goteborg',
    crew: [
      { name: 'Elin', role: 'Dock lead', assetKey: 'workerGbgElin' },
      { name: 'Nils', role: 'Regional sort', assetKey: 'workerGbgNils' },
      { name: 'Omar', role: 'Export desk', assetKey: 'workerGbgOmar' }
    ]
  }
};

const CITY_IDS = Object.keys(CITIES);
const FOCUS_MODES = ['late', 'complaints', 'express', 'international'];

const COUNTRY_CITY_HINTS = {
  Denmark: 'goteborg', Germany: 'goteborg', Netherlands: 'goteborg', Norway: 'goteborg',
  Finland: 'stockholm', USA: 'stockholm', 'United States': 'stockholm', UK: 'stockholm', France: 'goteborg'
};

const LOCAL_CITY_BY_TOWN = new Map();
for (const [cityId, city] of Object.entries(CITIES)) {
  for (const town of city.towns) LOCAL_CITY_BY_TOWN.set(town, cityId);
}

let idCounter = 10000;
function makePackageId(prefix = 'PKG') {
  idCounter += 1;
  return `${prefix}-${String(idCounter).padStart(5, '0')}`;
}

function cityForPlace(place) {
  return LOCAL_CITY_BY_TOWN.get(place) || null;
}

function gatewayForCountry(country) {
  return COUNTRY_CITY_HINTS[country] || 'stockholm';
}

function isInternationalPlace(place, country) {
  return Boolean(country && country !== 'Sweden') || !LOCAL_CITY_BY_TOWN.has(place);
}

function packageScore(pkg, focus = 'late', clock = 0) {
  const age = Math.max(0, clock - pkg.createdAt);
  const slack = pkg.deadline - clock;
  let score = age * 0.015;
  if (pkg.service === 'express') score += 34;
  if (pkg.complaint) score += 44;
  if (pkg.issue) score += 24;
  if (slack < 40) score += 28;
  if (slack < 15) score += 38;
  if (slack < 0) score += 80;
  if (pkg.international) score += 12;
  if (pkg.priorityFlag) score += 55;
  if (focus === 'late' && slack < 40) score += 75;
  if (focus === 'complaints' && pkg.complaint) score += 105;
  if (focus === 'express' && pkg.service === 'express') score += 95;
  if (focus === 'international' && pkg.international) score += 85;
  return score;
}

function nextLegForPackage(pkg) {
  const originCity = cityForPlace(pkg.origin.place) || pkg.origin.cityId || null;
  const destinationCity = cityForPlace(pkg.destination.place) || pkg.destination.cityId || null;
  const currentCity = pkg.cityId || cityForPlace(pkg.location) || null;

  if (pkg.destination.country !== 'Sweden') {
    const gateway = gatewayForCountry(pkg.destination.country);
    if (!currentCity) return { kind: 'inbound', to: originCity || gateway };
    if (currentCity !== gateway) return { kind: 'national', from: currentCity, to: gateway };
    return { kind: 'international', from: gateway, to: pkg.destination.country };
  }

  if (pkg.origin.country !== 'Sweden' && !currentCity) {
    return { kind: 'international-in', from: pkg.origin.country, to: gatewayForCountry(pkg.origin.country) };
  }

  if (!destinationCity) return { kind: 'manual' };
  if (!currentCity) return { kind: 'national', from: originCity || 'stockholm', to: destinationCity };
  if (currentCity !== destinationCity) return { kind: 'national', from: currentCity, to: destinationCity };
  return { kind: 'regional', from: currentCity, to: pkg.destination.place };
}

function trace(pkg, clock, label, place) {
  pkg.trace.push({ t: clock, label, place: place || pkg.location });
}

function createWorker(cityId, index) {
  const profile = CITIES[cityId].crew[index];
  return {
    id: `${cityId}-w${index + 1}`,
    cityId,
    name: profile.name,
    role: profile.role,
    assetKey: profile.assetKey,
    task: 'Waiting for work',
    packageId: null,
    progress: 0,
    total: 5.5 + index * 0.7,
    handled: 0
  };
}

function createTruck(id, kind, from, to, capacity = 7) {
  return {
    id, kind, from, to, state: 'waiting', progress: 0, duration: kind === 'regional' ? 12 : 20,
    load: [], capacity, departures: 0, wait: 0
  };
}

function blankCityState(cityId) {
  const city = CITIES[cityId];
  const regional = city.towns.filter(t => t !== city.name).map((town, i) => createTruck(`${cityId}-r${i + 1}`, 'regional', cityId, town, 5));
  regional.unshift(createTruck(`${cityId}-r0`, 'regional', cityId, city.name, 5));
  return {
    cityId,
    queues: { arrived: [], readyLocal: [], readyNational: [], readyInternational: [], held: [] },
    workers: [0, 1, 2].map(i => createWorker(cityId, i)),
    regionalTrucks: regional,
    processed: 0,
    delivered: 0
  };
}
