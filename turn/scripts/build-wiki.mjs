import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ARTICLES, CAR_ADVICE, PERK_ADVICE, TECHNIQUES, TRACK_ADVICE } from '../wiki/content.mjs';

const ROOT = new URL('../../', import.meta.url);
const WIKI = new URL('../wiki/', import.meta.url);
const BASE = '/turn/wiki/';
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const list = (items) => `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
const section = (title, body, id = slug(title)) => `<section aria-labelledby="${id}"><h2 id="${id}">${escapeHtml(title)}</h2>${body}</section>`;
const paragraph = (value) => `<p>${value}</p>`;
const badge = (text, type = '') => `<span class="badge ${type}">${escapeHtml(text)}</span>`;

// Build time only: reuse the game's precise track sampling with the already-vendored
// Three copy. Neither Three nor any game module is shipped to the wiki's browser.
let registered = false;
async function gameData() {
  if (!registered) {
    const three = new URL('../../postal/vendor/three.module.min.js', import.meta.url).href;
    register(`data:text/javascript,${encodeURIComponent(`export async function resolve(s,c,n){return s==='three'?{url:${JSON.stringify(three)},shortCircuit:true}:n(s,c);}`)}`);
    registered = true;
  }
  const [cars, tracks, perks, road, achievements, categories, maps, history, icons, view, shift] = await Promise.all([
    import('../vehicle/catalog.js'), import('../tracks/definitions.js'), import('../vehicle/perks.js'),
    import('../progression/trophy-road.js'), import('../achievements/catalog.js'),
    import('../achievements/catalog-base.js'), import('../tracks/catalog.js'),
    import('../content/about-history.js'), import('../ui/authored-icons.js'),
    import('../garage/car-view.js'), import('../vehicle/shift-profile.js')
  ]);
  return { ...cars, ...tracks, ...perks, ...road, ...achievements, CATEGORY_LABELS: categories.CATEGORY_LABELS, ...maps, ...history, ...icons, ...view, ...shift };
}

export async function renderWiki() {
  const game = await gameData();
  const release = JSON.parse(await fs.readFile(new URL('../release.json', import.meta.url), 'utf8'));
  const { CAR_CATALOG: cars, TRACK_DEFINITIONS: tracks, VEHICLE_PERKS: perks, TROPHY_ROAD_REWARDS: rewards, ACHIEVEMENTS: achievements, VEHICLE_STAT_LEGEND: stats } = game;
  for (const [items, advice, label] of [[cars, CAR_ADVICE, 'car'], [tracks, TRACK_ADVICE, 'track'], [perks, PERK_ADVICE, 'perk']]) {
    assert.deepEqual(Object.keys(advice).sort(), items.map(({ id }) => id).sort(), `Wiki ${label} advice must cover the current catalog exactly`);
  }
  const pages = new Map();
  const carPath = (id) => `cars/${slug(cars.find((car) => car.id === id).name)}`;
  const url = (path = '') => BASE + (path ? `${path.replace(/\/$/, '')}/` : '');
  const link = (path, label) => `<a href="${url(path.split('#')[0])}${path.includes('#') ? '#' + path.split('#')[1] : ''}">${escapeHtml(label || pages.get(path)?.title || path)}</a>`;
  const copy = (text) => escapeHtml(text).replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (_, path, title) => link(path, title));
  const add = (path, page) => {
    assert(!pages.has(path), `Duplicate wiki page: ${path}`);
    pages.set(path, { path, ...page });
  };
  const assetIcon = (name) => `<span class="asset-icon" aria-hidden="true" style="--icon: url('/turn/assets/trophy-road/${name}.svg')"></span>`;
  const icon = (name = 'map') => ['shift', 'perkulator'].includes(name) ? assetIcon(name)
    : `<span class="line-icon" aria-hidden="true">${name === 'perk' ? game.TROPHY_ROAD_REWARD_ICONS.perk : (game.ICONS[name] || game.ICONS.map)}</span>`;
  const carImage = (id, large = false) => `<img class="car-image" src="/turn/assets/cars/stills/${id}.webp" alt="" width="${game.CAR_VIEW.still.width}" height="${game.CAR_VIEW.still.height}" ${large ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
  const trophyLink = (reward) => reward ? link(`progress/trophy-road#${reward.id}`, `${reward.threshold.toLocaleString('en-US')} trophies · ${reward.shortTitle}`) : 'Available from the start';
  const facts = (entries) => `<dl class="facts">${entries.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
  const cards = (paths) => `<ul class="card-grid">${paths.map((path) => {
    const p = pages.get(path);
    assert(p, `Unknown card: ${path}`);
    return `<li><a class="card ${p.carId ? 'car-card' : ''}" href="${url(path)}">${p.carId ? carImage(p.carId) : p.trackId ? assetIcon(p.trackId) : icon(p.icon)}<span class="card-copy"><strong>${escapeHtml(p.title)}</strong><span>${escapeHtml(p.teaser || p.intro)}</span>${p.badges || ''}</span></a></li>`;
  }).join('')}</ul>`;
  const related = (paths) => section('Related', `<ul class="related">${[...new Set(paths)].map((path) => {
    assert(pages.has(path), `Unknown related article: ${path}`);
    return `<li>${link(path, pages.get(path).title)}<span aria-hidden="true"> →</span></li>`;
  }).join('')}</ul>`, 'related');

  // Maps are drawn from the very same centreline the race uses. The text description
  // and advice carry the useful information for someone who cannot see the diagram.
  function trackMap(track, description) {
    const runtime = game.createTrackRuntime(track.id, track.sampleCount || game.TRACK_SAMPLE_COUNT);
    const points = runtime.samples.filter((_, i) => i % Math.ceil(runtime.samples.length / 160) === 0).map(({ point }) => point);
    const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x));
    const minZ = Math.min(...points.map((p) => p.z)), maxZ = Math.max(...points.map((p) => p.z));
    const scale = Math.min(480 / (maxX - minX), 250 / (maxZ - minZ));
    const pos = (p) => [((p.x - (minX + maxX) / 2) * scale + 280).toFixed(1), ((p.z - (minZ + maxZ) / 2) * scale + 160).toFixed(1)];
    const coordinates = points.map(pos);
    return { length: (runtime.trackLength / 1000).toFixed(2), html: `<figure class="track-map"><svg viewBox="0 0 560 320" role="img" aria-labelledby="map-title map-description"><title id="map-title">${escapeHtml(track.name)} route</title><desc id="map-description">${escapeHtml(description)}</desc><path class="map-road" d="M${coordinates.map((p) => p.join(',')).join(' L')} Z"/><path class="map-centre" d="M${coordinates.map((p) => p.join(',')).join(' L')} Z"/><circle class="map-start" cx="${coordinates[0][0]}" cy="${coordinates[0][1]}" r="9"/></svg><figcaption>Route from the game · Circle marks the start/finish.<br>${escapeHtml(description)}</figcaption></figure>` };
  }
  function statBars(car) {
    return `<dl class="stat-bars">${stats.map(({ key, label }) => `<div><dt>${escapeHtml(label)}</dt><dd><span class="stat-track" aria-hidden="true"><span style="--score: ${car.stats[key]}"></span></span><strong>${car.stats[key]}<span class="sr-only"> out of </span><span aria-hidden="true">/</span>5</strong></dd></div>`).join('')}</dl>`;
  }
  function exampleShift(car) {
    const amount = game.vehicleShiftAmount(car.id, true);
    const keys = stats.map(({ key }) => key);
    const combinations = [];
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 5; b++) for (let c = b + 1; c < 6; c++) {
      const down = [keys[a], keys[b], keys[c]];
      if (game.isVehicleShiftConfigurationValid(car.stats, down, amount)) combinations.push(down);
    }
    assert(combinations.length, `No valid SHIFT example for ${car.id}`);
    const down = combinations[0], labels = (selected) => stats.filter(({ key }) => selected.includes(key)).map(({ label }) => label).join(', ');
    return paragraph(`${car.id === 'sedan' ? 'With DOUBLE SHIFT unlocked, one legal example moves two points per attribute. ' : 'One legal example moves one point per attribute. '}Lower <strong>${labels(down)}</strong>; raise <strong>${labels(keys.filter((key) => !down.includes(key)))}</strong>. Try the two states on the same section to feel the trade-off.`)
      + paragraph(`${link('skills/shift', 'Set up SHIFT in GARAGE')} after ${trophyLink(game.getTrophyRoadReward('shift'))}.${car.id === 'sedan' ? ' DOUBLE SHIFT has its own later unlock.' : ''}`);
  }
  for (const car of [...cars].sort((a, b) => (game.rewardForVehicle(a.id)?.threshold || 0) - (game.rewardForVehicle(b.id)?.threshold || 0))) {
    const [personality, how, build, trackId, installedId] = CAR_ADVICE[car.id];
    const perk = game.originalVehiclePerk(car.id);
    const carReward = game.rewardForVehicle(car.id);
    const perkReward = game.rewardForVehiclePerk(car.id) || carReward;
    add(carPath(car.id), { title: car.name, group: 'Cars', icon: 'wheel', carId: car.id, intro: personality, teaser: how, aliases: `${car.id} ${perk.title}`,
      body: () => `<div class="car-hero"><figure>${carImage(car.id, true)}<figcaption>${escapeHtml(car.name)} · Factory paint</figcaption></figure><div>${statBars(car)}<p class="muted">${game.VEHICLE_STAT_BUDGET} base points · ${link('cars/stats', 'What the stats mean')}</p></div></div>`
        + facts([['Car unlock', trophyLink(carReward)], ['Original perk', link(`perks/${perk.id}`, perk.title)], ['Perk unlock', trophyLink(perkReward)]])
        + section('How it drives', paragraph(copy(how)))
        + section('Original perk', paragraph(copy(perk.description)) + paragraph(`${badge(perk.rarity, `rarity-${perk.rarity}`)} ${perk.installable ? 'Can also be installed on other cars through PERKULATOR.' : 'Stays with this car.'}`))
        + section('Try a build', paragraph(copy(build)) + paragraph(`Practice: ${link(`tracks/${trackId}`, tracks.find((t) => t.id === trackId).name)}. ${link(`perks/${installedId}`, `Explore ${game.getVehiclePerk(installedId).title}`)}.`))
        + section('Example SHIFT setup', exampleShift(car)),
      related: [`perks/${perk.id}`, `tracks/${trackId}`, 'skills/shift', 'perks/perkulator', 'progress/trophy-road'] });
  }
  for (const perk of perks) {
    const [use, interaction, carId, technique] = PERK_ADVICE[perk.id];
    add(`perks/${perk.id}`, { title: perk.title, group: 'Perks', icon: 'perk', intro: perk.description, badges: badge(perk.rarity, `rarity-${perk.rarity}`),
      aliases: `${perk.id} ${perk.vehicleIds.map((id) => cars.find((c) => c.id === id).name).join(' ')} ${perk.rarity}`,
      body: () => `<div class="perk-banner">${icon('perk')}${badge(perk.rarity, `rarity-${perk.rarity}`)}<strong>${perk.installable ? 'INSTALLABLE' : 'STAYS WITH ITS CAR'}</strong></div>`
        + facts([['Original car', perk.vehicleIds.map((id) => link(carPath(id), cars.find((c) => c.id === id).name)).join(' · ')], ['Unlock', trophyLink(game.rewardForVehiclePerk(perk.vehicleIds[0]) || game.rewardForVehicle(perk.vehicleIds[0]))]])
        + section('Use it', paragraph(copy(use))) + section('Make it work together', paragraph(copy(interaction)))
        + section('Try it on', `<div class="mini-car">${carImage(carId)}<div>${link(carPath(carId), cars.find((c) => c.id === carId).name)}${paragraph(perk.installable ? 'An illustrative pairing once the car, perk and PERKULATOR are unlocked. Compare it with the same car’s original setup.' : 'This is a vehicle-defining perk. Add an eligible INSTALLED perk beside it through PERKULATOR.')}</div></div>`)
        + section('Installing', paragraph(perk.installable ? 'Unlock its source car and the perk, then choose it in PERKULATOR. No cloning or collecting copies is needed. It uses the one INSTALLED slot and cannot duplicate the destination car’s own perk.' : 'This LEGENDARY perk cannot be cloned or installed on another car. Its original car can still equip one eligible INSTALLED perk.')),
      related: [...new Set([carPath(perk.vehicleIds[0]), `skills/${technique}`, 'perks/perkulator', 'perks/build-ideas', 'progress/trophy-road'])] });
  }
  for (const track of tracks) {
    const advice = TRACK_ADVICE[track.id], map = trackMap(track, advice.map);
    add(`tracks/${track.id}`, { title: track.name, group: 'Tracks', trackId: track.id, intro: track.description, badges: badge(track.difficulty, `difficulty-${track.difficulty.toLowerCase()}`),
      body: () => `<div class="track-hero">${map.html}<div>${badge(track.difficulty, `difficulty-${track.difficulty.toLowerCase()}`)}${facts([['Format', 'Circuit · continuous laps'], ['Length', `≈ ${map.length} km`], ['Unlock', trophyLink(game.rewardForTrack(track.id))]])}</div></div>`
        + section('Read the route', paragraph(copy(advice.sections)))
        + section('Find time', paragraph(copy(advice.advice)))
        + section('Practise here', paragraph(copy(advice.practice)) + paragraph(`Try ${link(carPath(advice.car), cars.find((c) => c.id === advice.car).name)} and ${link(`skills/${advice.technique}`, TECHNIQUES.find((t) => t.id === advice.technique).title)}.`))
        + section('Track goals', list(game.trackAchievements(track.id).filter((a) => !a.hidden).map((a) => link(`progress/achievements#${a.id}`, a.title))) + paragraph(`Exact requirements and trophy values: ${link('progress/achievements', 'Achievements')}. Hidden discoveries are under its spoiler disclosure.`))
        + (['midnight-city', 'mountain'].includes(track.id) ? section('A first taste', paragraph(track.id === 'mountain' ? 'EXCURSION previews this course in the MONSTER TRUCK.' : 'PATROL previews this course in the POLICE CAR.')) : ''),
      related: [`skills/${advice.technique}`, carPath(advice.car), 'start/drive-by-ear', 'start/spectate', 'progress/challenges'] });
  }
  const driveSequence = (items) => `<ol class="drive-sequence">${items.map(([label, text, color]) => `<li class="cue-${color}"><strong>${label}</strong><span>${escapeHtml(text)}</span></li>`).join('')}</ol>`;
  const chargeSequence = () => driveSequence([['DRIFT', 'Fill BOOST', 'drift'], ['DRIFT', 'Build OVERCHARGE', 'overcharge'], ['GAS', 'Catch and hold', 'gas'], ['BOOST', 'Spend the KICK', 'boost']]);
  for (const t of TECHNIQUES) add(`skills/${t.id}`, { ...t, group: 'Skills',
    body: () => (t.id === 'overcharge' ? chargeSequence() : `<div class="technique-banner">${icon(t.icon)}<span>${escapeHtml(t.intro)}</span></div>`)
      + (t.reward ? paragraph(`Unlock: ${trophyLink(game.getTrophyRoadReward(t.reward))}.`) : '')
      + [['What it does', t.what], ['How to do it', t.how], ['Why use it', t.why], ['Timing', t.timing], ['Advanced', t.advanced]].map(([title, text]) => section(title, paragraph(copy(text)))).join('')
      + section('Practise it', paragraph(`Try ${link(`tracks/${t.practice}`, tracks.find((track) => track.id === t.practice).name)}. ${link('start/tutorials', 'Tutorials')} give you a guided starting point.`))
  });
  const controlsVisual = () => `<figure class="control-figure"><div class="pad-picture" aria-hidden="true"><div class="pad-extra">LOCK ←</div><div class="pad-face"><span class="cue-drift">DRIFT</span><span class="cue-boost">BOOST</span><span class="cue-gas">GAS</span><span class="cue-brake">BRAKE</span></div><div class="pad-extra">→ SHIFT<br><br>→ REVERSE</div></div><figcaption>Drive pad · Slide between actions without lifting your thumb.<br>LOCK extends DRIFT, SHIFT extends GAS, and REVERSE extends BRAKE. Layout mirrors for left-handed controls.</figcaption></figure>`;
  const visuals = {
    start: () => `<div class="start-picture">${carImage('classic', true)}${driveSequence([['STEER', 'Find a comfortable neutral', 'gas'], ['DRIVE', 'Learn the pad', 'drift'], ['FINISH', 'Race your first rival', 'boost']])}</div>`,
    controls: controlsVisual,
    sound: () => driveSequence([['GUIDANCE', 'Where to steer', 'gas'], ['PACE NOTES', 'What comes next', 'drift'], ['CAR SOUNDS', 'What is happening now', 'boost']]),
    build: () => `<div class="build-picture">${carImage('race', true)}<div>${badge('ORIGINAL · APEX GRIP', 'rarity-epic')}<span class="build-plus" aria-hidden="true">+</span>${badge('INSTALLED · TORQUE', 'rarity-epic')}<p>Example: Race Car with TORQUE</p></div></div>`,
    ideas: () => `<div class="car-lineup" aria-hidden="true">${['vintage-racer', 'race', 'toy-racer', 'race-future'].map((id) => carImage(id)).join('')}</div>`,
    tutorials: () => `<div class="car-lineup" aria-hidden="true">${['classic', 'tractor'].map((id) => carImage(id)).join('')}</div>`
  };
  for (const article of ARTICLES) add(article.path, { ...article,
    body: () => (article.visual ? visuals[article.visual]() : '')
      + (article.reward ? paragraph(`Unlock: ${trophyLink(game.getTrophyRoadReward(article.reward))}.`) : '')
      + article.sections.map(([title, text]) => section(title, paragraph(copy(text)))).join('')
  });

  const rewardLinks = (reward) => {
    if (reward.trackIds) return reward.trackIds.map((id) => link(`tracks/${id}`, tracks.find((t) => t.id === id).name)).join(' · ');
    if (reward.vehicleIds) return reward.vehicleIds.map((id) => link(carPath(id), cars.find((c) => c.id === id).name)).join(' · ');
    if (reward.vehicleId) return link(`perks/${game.originalVehiclePerk(reward.vehicleId).id}`, reward.perkTitle);
    if (reward.id === 'perkulator') return link('perks/perkulator', 'PERKULATOR');
    if (reward.id === 'paintjob') return link('cars', 'GARAGE and cars');
    return link(`skills/${reward.id}`, reward.title);
  };
  add('progress/trophy-road', { title: 'Trophy Road', group: 'Progress', icon: 'trophy', intro: 'The unlock route, in one place. Earn trophies through achievements and challenges.',
    body: () => paragraph('The starting cars and EASY tracks are available immediately. Older profiles may retain earlier unlocks; this is the current reward order.')
      + `<ol class="reward-road">${rewards.map((reward) => `<li id="${reward.id}"><span class="reward-threshold">${reward.threshold.toLocaleString('en-US')}<small>trophies</small></span><div><h2>${escapeHtml(reward.title)}</h2><p>${rewardLinks(reward)}</p><p>${escapeHtml(reward.description.replace(/<[^>]+>/g, ' '))}</p>${reward.id === 'drift-attack' ? paragraph(`Also unlocks the Truck’s ${link('perks/torque', 'TORQUE')}.`) : ''}</div></li>`).join('')}</ol>`,
    related: ['progress/achievements', 'progress/challenges', 'cars', 'tracks', 'perks/builds'] });
  const achievementEntry = (a) => `<li id="${a.id}" class="achievement"><div class="achievement-symbol">${icon(a.icon)}</div><div><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.description)}</p>${a.recommendation ? `<p class="muted">${escapeHtml(a.recommendation)}</p>` : ''}${a.trackId ? paragraph(link(`tracks/${a.trackId}`, tracks.find((t) => t.id === a.trackId).name)) : ''}</div><strong class="trophies">${a.trophies}<span>trophies</span></strong></li>`;
  add('progress/achievements', { title: 'Achievements', group: 'Progress', icon: 'trophy', intro: 'Every current goal, its exact requirement and its trophy reward. Hidden discoveries stay folded until you choose to reveal them.', aliases: achievements.filter((a) => !a.hidden && !a.calibrationPending).map((a) => a.title).join(' '),
    body: () => `<nav class="jump-links" aria-label="Achievement categories">${Object.entries(game.CATEGORY_LABELS).map(([id, title]) => link(`progress/achievements#${id}`, title)).join('')}${link('progress/achievements#secrets', 'Hidden discoveries')}</nav>`
      + Object.entries(game.CATEGORY_LABELS).map(([id, title]) => section(title, `<ul class="achievement-list">${achievements.filter((a) => a.category === id && !a.hidden && !a.calibrationPending).map(achievementEntry).join('')}</ul>`, id)).join('')
      + `<details class="spoilers" id="secrets"><summary>Reveal hidden discoveries — spoilers</summary><ul class="achievement-list">${achievements.filter((a) => a.hidden && !a.calibrationPending).map(achievementEntry).join('')}</ul></details>`,
    related: ['progress/trophy-road', 'progress/challenges', 'skills/drift-attack', 'skills/flow'] });
  add('cars/stats', { title: 'Car stats', group: 'Cars', icon: 'wheel', intro: 'Six attributes. Eighteen base points per car. Different ways to spend them.',
    body: () => `<dl class="stat-legend">${stats.map((s) => `<div><dt>${escapeHtml(s.label)}</dt><dd>${escapeHtml(s.description)}</dd></div>`).join('')}</dl>`
      + section('Compare the garage', `<p>Base stats before SHIFT or active perk effects. Scroll the table horizontally on a narrow screen.</p><div class="table-scroll" role="region" aria-label="Car attribute comparison" tabindex="0"><table><caption>All cars · base attributes out of 5</caption><thead><tr><th scope="col">Car</th>${stats.map((s) => `<th scope="col">${escapeHtml(s.label)}</th>`).join('')}</tr></thead><tbody>${cars.map((car) => `<tr><th scope="row">${link(carPath(car.id), car.name)}</th>${stats.map((s) => `<td>${car.stats[s.key]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`)
      + section('Read the whole build', paragraph('A stat bar is a baseline. SHIFT redistributes attributes, while perks may build a stat or change handling during a lap. Compare the same car in the same state before deciding what helped.')),
    related: ['cars', 'skills/shift', 'perks', 'perks/build-ideas'] });
  add('whats-new', { title: 'What’s new', group: 'Help', icon: 'flag', intro: `TURN ${release.version} · Player-facing milestones.`,
    body: () => [...game.CHANGELOG].reverse().map(({ date, entries }, index) => index < 3
      ? section(date, entries.map(([title, text]) => `<h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>`).join(''))
      : `<details><summary>${escapeHtml(date)}</summary>${entries.map(([title, text]) => `<h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>`).join('')}</details>`).join(''),
    related: ['start/getting-started', 'progress/trophy-road', 'perks/perkulator'] });

  // The six sections, in the order a player meets them (#1246). An index lists its
  // pages, or groups them when a section holds two kinds of page.
  const MECHANICS = ['drift', 'boost', 'overcharge', 'lock', 'shift', 'flow', 'drift-attack'];
  const sections = [
    ['start', 'Start', 'flag', 'Your first laps, the controls and the ways to play.', ['start/getting-started', 'start/controls', 'start/drive-by-ear', 'start/tutorials', 'start/rivals', 'start/spectate', 'start/your-turn']],
    ['tracks', 'Tracks', 'map', 'Eight places to learn a line, chase a record and find your rhythm.', tracks.map((t) => `tracks/${t.id}`)],
    ['cars', 'Cars', 'wheel', 'Find a car by its personality, then inspect the facts.', [...pages.keys()].filter((p) => p.startsWith('cars/') && p !== 'cars/stats')],
    ['perks', 'Perks', 'perk', 'Read the effect, find its original car and build around it.', [['Builds', ['perks/builds', 'perks/perkulator', 'perks/build-ideas']], ['Perks', perks.map((p) => `perks/${p.id}`)]]],
    ['skills', 'Skills', 'drift', 'Learn the action. Understand the timing. Make it work in a lap.', [['Mechanics', MECHANICS.map((id) => `skills/${id}`)], ['Techniques', TECHNIQUES.filter((t) => !MECHANICS.includes(t.id)).map((t) => `skills/${t.id}`)]]],
    ['progress', 'Progress', 'trophy', 'Trophies, unlocks and the goals that earn them.', ['progress/trophy-road', 'progress/achievements', 'progress/challenges']]
  ];
  assert.deepEqual(TECHNIQUES.map((t) => t.id).slice(0, MECHANICS.length), MECHANICS, 'Skills list mechanics first');
  for (const [path, title, sectionIcon, intro, children] of sections) add(path, { title, group: title, icon: sectionIcon, intro, index: true,
    body: () => (Array.isArray(children[0]) ? children.map(([heading, paths]) => section(heading, cards(paths))).join('') : cards(children)),
    related: path === 'cars' ? ['cars/stats', 'perks/builds', 'progress/trophy-road'] : undefined });
  // The compact home is a routing surface, not an encyclopedia article.
  add('', { title: 'TURN Wiki', intro: 'Find your car. Learn the line. Make the next lap count.', home: true,
    body: () => `<div class="home-art" aria-hidden="true">${carImage('vintage-racer', true)}${carImage('classic', true)}${carImage('race-future', true)}</div>`
      + searchForm('home-search')
      + section('Start here', cards(['start/getting-started', 'start/controls', 'skills/drift', 'start/drive-by-ear']))
      + section('Explore TURN', cards(sections.map(([path]) => path)))
      + section('Popular', `<nav class="jump-links" aria-label="Popular articles">${['skills/drift', 'skills/boost', 'skills/shift', 'tracks/countryside', 'perks/perkulator'].map((p) => link(p, pages.get(p).title)).join('')}</nav>`) });
  function searchForm(id) {
    return `<form class="search-form" role="search" action="${url('search')}" method="get"><label for="${id}">Search the wiki</label><div><input id="${id}" type="search" name="q" placeholder="Try drift, full tank, Harbor…" maxlength="120"><button type="submit">SEARCH</button></div></form>`;
  }
  add('search', { title: 'Find something', group: 'Search', intro: 'Search titles, descriptions and familiar terms. Or browse every article below.',
    body: () => searchForm('wiki-query') + '<p id="search-status" role="status" aria-live="polite" aria-atomic="true">All articles</p>'
      + `<ul class="search-results">${[...pages.values()].filter((p) => p.path && p.path !== 'search').map((p) => `<li data-search="${escapeHtml(`${p.title} ${p.intro} ${p.aliases || ''} ${p.group}`.toLowerCase())}"><a href="${url(p.path)}"><small>${escapeHtml(p.group)}</small><strong>${escapeHtml(p.title)}</strong><span>${escapeHtml(p.intro)}</span></a></li>`).join('')}</ul>`
      + '<p id="no-results" hidden>No matching articles. Try a shorter term, or browse the sections in the menu.</p><noscript><p>Use your browser’s Find command to search this complete article list.</p></noscript>' });
  const nav = sections.map(([path, title]) => [path, title.toUpperCase()]);
  const footerLinks = ['settings', 'install', 'accessibility', 'terminology', 'whats-new'];
  const logo = '/turn/TURNicon.PNG?icon=20260803-profile-512';
  const themeBoot = `(()=>{let p='system';try{p=localStorage.getItem('turn-theme-v1')||p}catch{}document.documentElement.dataset.theme=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'})();`;
  const rendered = new Map();
  for (const [path, page] of pages) {
    const active = path.split('/')[0];
    const parent = path.includes('/') ? path.split('/')[0] : '';
    const parentTitle = pages.get(parent)?.title;
    const body = page.body();
    const html = `<!doctype html>
<!-- Generated by turn/scripts/build-wiki.mjs. Edit wiki/content.mjs for advice. -->
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(page.title)}${page.home ? '' : ' · TURN Wiki'}</title><meta name="description" content="${escapeHtml(page.intro)}"><link rel="canonical" href="https://enkel.design${url(path)}"><link rel="icon" href="${logo}" type="image/png" sizes="512x512"><script>${themeBoot}</script><link rel="stylesheet" href="/turn/design-tokens.css?build=${release.cacheKey}"><link rel="stylesheet" href="/turn/design-scale.css?build=${release.cacheKey}"><link rel="stylesheet" href="${BASE}wiki.css?build=${release.cacheKey}"><script defer src="${BASE}wiki.js?build=${release.cacheKey}"></script></head>
<body><a class="skip-link" href="#main">Skip to content</a><header class="site-header"><div class="header-bar"><a class="brand" href="${BASE}" aria-label="TURN Wiki home"><img src="${logo}" width="40" height="40" alt=""><span>TURN <small>WIKI</small></span></a><div class="header-actions">${page.home ? '' : `<a class="search-link" href="${url('search')}">SEARCH</a>`}<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="wiki-sections" hidden>MENU</button></div></div><nav class="primary-nav" id="wiki-sections" aria-label="Wiki sections"><ul>${nav.map(([p, title]) => `<li><a href="${url(p)}"${active === p ? (path === p ? ' aria-current="page"' : ' aria-current="true"') : ''}>${title}</a></li>`).join('')}</ul><a class="button play-button" href="/turn/">PLAY TURN</a></nav></header>
<main id="main" tabindex="-1" class="${page.home ? 'home' : page.index ? 'index-page' : 'article-page'}">${page.home ? '' : `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li>${link('', 'Wiki')}</li>${parent && parentTitle ? `<li>${link(parent, parentTitle)}</li>` : ''}<li aria-current="page">${escapeHtml(page.title)}</li></ol></nav>`}<header class="page-heading"><p class="eyebrow">${escapeHtml(page.home ? 'THE PLAYER GUIDE' : page.group || 'TURN')}</p><h1>${escapeHtml(page.title)}</h1><p class="intro">${escapeHtml(page.intro)}</p></header>${body}${page.related ? related(page.related) : ''}</main>
<footer class="site-footer"><div><a class="brand footer-brand" href="${BASE}">TURN WIKI</a><p>Learn it here. Drive it in TURN.</p><small>TURN ${release.version} · ${release.id}</small></div><div class="footer-links">${footerLinks.map((p) => link(p, pages.get(p).title)).join('')}<a href="#main">Back to top</a></div><label class="theme-control" hidden>Appearance<select id="wiki-theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></footer></body></html>\n`;
    rendered.set(`${path ? path + '/' : ''}index.html`, html);
  }
  // Pages that moved in the #1246 revamp keep their old address: a small page that sends
  // a visitor, and any #section they asked for, to the new one.
  const moved = {
    'getting-started': 'start/getting-started', 'getting-started/controls': 'start/controls', 'getting-started/drive-by-ear': 'start/drive-by-ear',
    builds: 'perks/builds', 'builds/perkulator': 'perks/perkulator', 'builds/ideas': 'perks/build-ideas',
    driving: 'skills', ...Object.fromEntries(TECHNIQUES.map((t) => [`driving/${t.id}`, `skills/${t.id}`])),
    play: 'start', 'play/rivals': 'start/rivals', 'play/spectate': 'start/spectate', 'play/your-turn': 'start/your-turn', 'play/tutorials': 'start/tutorials', 'play/challenges': 'progress/challenges',
    reference: 'progress', 'reference/trophy-road': 'progress/trophy-road', 'reference/achievements': 'progress/achievements', 'reference/car-stats': 'cars/stats',
    'reference/whats-new': 'whats-new', 'reference/accessibility': 'accessibility', 'reference/settings': 'settings', 'reference/terminology': 'terminology', 'reference/install': 'install'
  };
  for (const [from, to] of Object.entries(moved)) {
    assert(!pages.has(from) && pages.has(to), `Wiki redirect ${from} → ${to}`);
    const target = url(to);
    rendered.set(`${from}/index.html`, `<!doctype html>
<!-- Generated by turn/scripts/build-wiki.mjs: this page moved (#1246). -->
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(pages.get(to).title)} · TURN Wiki</title><meta name="robots" content="noindex"><link rel="canonical" href="https://enkel.design${target}"><meta http-equiv="refresh" content="0; url=${target}"><script>location.replace(${JSON.stringify(target)} + location.hash)</script></head>
<body><p>This page moved to <a href="${target}">${escapeHtml(pages.get(to).title)}</a>.</p></body></html>\n`);
  }
  // Fail the build on editorial dead ends, missing shared assets or a stale anchor.
  for (const [name, html] of rendered) {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(ids.length, new Set(ids).size, `Duplicate id in ${name}`);
    for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (href.startsWith(BASE)) {
        const parsed = new URL(href, 'https://enkel.design');
        if (!parsed.pathname.endsWith('/')) continue;
        const target = rendered.get(parsed.pathname.slice(BASE.length) + 'index.html');
        assert(target, `${name} has a broken wiki link: ${href}`);
        if (parsed.hash) assert(target.includes(`id="${parsed.hash.slice(1)}"`), `${name} has a broken anchor: ${href}`);
      } else if (href.startsWith('/turn/') && !href.endsWith('/')) {
        const pathname = new URL(href, 'https://enkel.design').pathname;
        await fs.access(new URL(pathname.slice(1), ROOT));
      }
    }
  }
  return { rendered, release, counts: { pages: pages.size, cars: cars.length, tracks: tracks.length, perks: perks.length, achievements: achievements.filter((a) => !a.calibrationPending).length } };
}

export async function buildWiki({ write = false } = {}) {
  const { rendered, counts } = await renderWiki();
  let changed = false;
  const previous = JSON.parse(await fs.readFile(new URL('generated-pages.json', WIKI), 'utf8').catch(() => '[]'));
  for (const name of previous.filter((name) => !rendered.has(name))) {
    assert(/^(?:[a-z0-9-]+\/)*index\.html$/.test(name), 'Unsafe generated page path');
    if (write) { await fs.rm(new URL(name, WIKI), { force: true }); changed = true; }
    else assert.fail(`Stale wiki page: ${name}. Run node turn/scripts/release.mjs --write`);
  }
  rendered.set('generated-pages.json', JSON.stringify([...rendered.keys()], null, 2) + '\n');
  for (const [name, expected] of rendered) {
    const target = new URL(name, WIKI);
    const current = await fs.readFile(target, 'utf8').catch(() => '');
    if (current === expected) continue;
    if (!write) assert.fail(`Wiki is stale: ${name}. Run node turn/scripts/release.mjs --write`);
    await fs.mkdir(new URL('./', target), { recursive: true });
    await fs.writeFile(target, expected);
    changed = true;
  }
  return { changed, counts };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await buildWiki({ write: process.argv.includes('--write') });
  console.log(`TURN Wiki ${JSON.stringify(result)}`);
}
