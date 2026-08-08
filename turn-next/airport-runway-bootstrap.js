// TURN NEXT-only import-map bootstrap for the AIRPORT: RUNWAY prototype.
// This deliberately overrides only the canonical track modules needed by the prototype.
const map = document.createElement('script');
map.type = 'importmap';
map.textContent = JSON.stringify({
  imports: {
    '/turn/tracks/catalog.js?source=20260729-r118-m8': '/turn-next/airport-runway-catalog.js',
    '/turn/tracks/catalog.js?build=20260808-r162': '/turn-next/airport-runway-catalog.js',
    './tracks/catalog.js?build=20260808-r162': '/turn-next/airport-runway-catalog.js',
    './tracks/catalog.js': '/turn-next/airport-runway-catalog.js',
    './tracks/registry.js?build=20260808-r162': '/turn-next/airport-runway-registry.js',
    './tracks/registry.js': '/turn-next/airport-runway-registry.js',
    './tracks/pace-notes.js?build=20260808-r162': '/turn-next/airport-runway-pace-notes.js',
    './tracks/pace-notes.js': '/turn-next/airport-runway-pace-notes.js'
  }
});
document.currentScript.after(map);
