'use strict';
let firstDayCelebration = false;
let tutorialLastStage = simulation.tutorialStage;

function tutorialIsActive() {
  return simulation.firstDay && simulation.tutorialStage !== 'complete';
}

function persistFirstDayComplete() {
  try { localStorage.setItem(FIRST_DAY_KEY, 'complete'); } catch {}
}

function handleTutorialFocusChosen(cityId) {
  if (!tutorialIsActive() || simulation.tutorialStage !== 'choose-focus' || cityId !== 'sundsvall') return;
  simulation.releaseChicagoCase();
  selectedPackageId = null;
  selectedTruckId = null;
  currentCityId = 'sundsvall';
  currentLevel = 'depot';
  buildScene();
  announce('Good. Each depot keeps its own focus. A DLH package from Chicago now needs you.');
}

function handleTutorialTruckDispatched(truck) {
  if (!tutorialIsActive() || !truck) return;
  const pkg = selectedPackageId ? simulation.packages.get(selectedPackageId) : null;
  if (!pkg || !truck.load.includes(pkg.id)) return;
  if (pkg.id === 'DAY1-1001' && truck.kind === 'regional') {
    simulation.tutorialStage = 'local-driving';
    currentLevel = 'region';
    buildScene();
  } else if (pkg.id === 'US-77104' && truck.kind === 'national') {
    simulation.tutorialStage = 'national-driving';
    currentLevel = 'sweden';
    buildScene();
  } else if (pkg.id === 'US-77104' && truck.kind === 'regional') {
    simulation.tutorialStage = 'timra-driving';
    currentCityId = 'sundsvall';
    currentLevel = 'region';
    buildScene();
  }
}

function updateFirstDayTutorial() {
  if (!tutorialIsActive()) return;
  const stage = simulation.tutorialStage;
  const first = simulation.packages.get('DAY1-1001');
  const chicago = simulation.packages.get('US-77104');

  if (stage === 'watch-sort' && first?.status === 'ready-local') {
    simulation.tutorialStage = 'load-local';
    selectedPackageId = first.id;
    currentCityId = 'sundsvall';
    currentLevel = 'region';
    buildScene();
  } else if (stage === 'local-driving' && first?.status === 'delivered') {
    simulation.releaseFirstDayWave();
    selectedPackageId = null;
    selectedTruckId = null;
    currentLevel = 'depot';
    buildScene();
  } else if (stage === 'watch-chicago-sort' && chicago?.status === 'ready-national') {
    simulation.tutorialStage = 'load-national';
    selectedPackageId = chicago.id;
    currentCityId = 'stockholm';
    currentLevel = 'sweden';
    buildScene();
  } else if (stage === 'national-driving' && chicago?.cityId === 'sundsvall' && ['arrived', 'sorting'].includes(chicago.status)) {
    simulation.tutorialStage = 'watch-sundsvall-sort';
    currentCityId = 'sundsvall';
    currentLevel = 'depot';
    buildScene();
  } else if (stage === 'watch-sundsvall-sort' && chicago?.status === 'ready-local') {
    simulation.tutorialStage = 'load-timra';
    selectedPackageId = chicago.id;
    currentCityId = 'sundsvall';
    currentLevel = 'region';
    buildScene();
  } else if (stage === 'timra-driving' && chicago?.status === 'delivered') {
    simulation.completeFirstDay();
    persistFirstDayComplete();
    selectedTruckId = null;
    firstDayCelebration = true;
    announce('First morning complete. Every package stayed visible from Chicago to Timrå.');
  }

  if (tutorialLastStage !== simulation.tutorialStage) {
    tutorialLastStage = simulation.tutorialStage;
    packageRailKey = '';
    updateUI(true);
  }
}

function tutorialInstruction() {
  if (firstDayCelebration) return {
    kicker: 'FIRST MORNING COMPLETE',
    title: 'The whole network is yours',
    meta: 'Keep the four carriers flowing. New packages are arriving.',
    action: 'KEEP OPERATING'
  };
  if (!tutorialIsActive()) return null;
  const stage = simulation.tutorialStage;
  const copy = {
    'select-package': selectedPackageId === 'DAY1-1001'
      ? ['FIRST PACKAGE', 'DLH · Söråker → Timrå', 'Send it into the highlighted Express sort.', 'SORT EXPRESS', 'start-tutorial-sort']
      : ['FIRST PACKAGE', 'Tap the yellow DLH package', 'Packages stay here while you change depot or scale.', 'SELECT DLH', 'select-suggested'],
    'watch-sort': ['SORTING', 'Leo is moving your package', 'Watch its card change when it reaches the regional dock.', 'WATCH', 'watch'],
    'load-local': ['TRUCK READY', 'Timrå route is waiting', 'Load the package, then choose when the truck leaves.', 'LOAD TRUCK', 'load-package'],
    'send-local': ['YOUR DECISION', 'Timrå truck loaded', 'Leaving early protects DLH; waiting improves utilisation.', 'SEND TO TIMRÅ', 'dispatch-truck'],
    'local-driving': ['ON THE ROAD', 'Follow the DLH package', 'The first delivery will unlock a four-carrier wave.', 'FOLLOW', 'follow'],
    'choose-focus': ['FOUR CARRIERS', 'Set Sundsvall’s team focus', 'Every depot keeps its own priority.', 'SET SUN FOCUS', 'open-focus'],
    'select-chicago': selectedPackageId === 'US-77104'
      ? ['MISSING SCAN', 'Chicago → Timrå', 'The breadcrumb shows where it stopped and what comes next.', 'SCAN CAGE', 'scan-cage']
      : ['NETWORK CASE', 'Find Chicago → Timrå', 'It remains visible even though it is in Stockholm.', 'SELECT PACKAGE', 'select-suggested'],
    'watch-chicago-sort': ['FOUND IN STOCKHOLM', 'DLH package is sorting', 'Next: send it north on national linehaul.', 'WATCH', 'watch'],
    'load-national': ['NATIONAL HANDOFF', 'Stockholm → Sundsvall', 'Put the package on the northbound linehaul.', 'LOAD LINEHAUL', 'load-package'],
    'send-national': ['YOUR DECISION', 'Northbound linehaul loaded', 'Send it when the load is worth the deadline risk.', 'SEND TO SUNDSVALL', 'dispatch-truck'],
    'national-driving': ['ACROSS SWEDEN', 'Chicago → Stockholm → Sundsvall', 'The selected package remains in the rail.', 'FOLLOW', 'follow'],
    'watch-sundsvall-sort': ['ARRIVED SUNDSVALL', 'One local handoff remains', 'The local team is preparing the Timrå route.', 'WATCH', 'watch'],
    'load-timra': ['FINAL HANDOFF', 'Sundsvall → Timrå', 'Load the regional truck for the last leg.', 'LOAD TRUCK', 'load-package'],
    'send-timra': ['FINAL DECISION', 'Timrå truck loaded', 'Complete the package’s four-stop journey.', 'SEND TO TIMRÅ', 'dispatch-truck'],
    'timra-driving': ['LAST MILE', 'The package is almost home', 'Watch the route finish.', 'FOLLOW', 'follow']
  }[stage];
  if (!copy) return null;
  return { kicker: copy[0], title: copy[1], meta: copy[2], action: copy[3], actionKey: copy[4] };
}
