import fs from 'node:fs/promises';

const path = 'turn-lab/tests/garage-production.mjs';
let source = await fs.readFile(path, 'utf8');

const releaseAnchor = "const releaseTarget = (filePath) => `${filePath}?build=${release.cacheKey}`;\n";
const releaseReplacement = `${releaseAnchor}const wheelRevision = 'r211-steering-wheels';\nconst vehicleCatalogTarget = \`${'${releaseTarget(\'./vehicle/catalog.js\')}'}&wheel=${'${wheelRevision}'}\`;\nconst carModelBridgeTarget = \`${'${releaseTarget(\'./vehicle/emergency-livery-models.js\')}'}&wheel=${'${wheelRevision}'}\`;\n`;
if (!source.includes(releaseAnchor)) throw new Error('releaseTarget anchor not found');
source = source.replace(releaseAnchor, releaseReplacement);

const oldAssertions = `assert.equal(imports['./vehicle/catalog.js?build=20260720-r19'], releaseTarget('./vehicle/catalog.js'));\nassert.equal(imports['./vehicle/catalog.js?build=20260720-r20'], releaseTarget('./vehicle/catalog.js'));\nassert.equal(imports['./vehicle/car-models.js?build=20260720-r19'], releaseTarget('./vehicle/emergency-livery-models.js'));\nassert.equal(imports['./vehicle/car-models.js?build=20260720-r22'], releaseTarget('./vehicle/emergency-livery-models.js'));`;
const newAssertions = `assert.equal(imports['./vehicle/catalog.js?build=20260720-r19'], vehicleCatalogTarget);\nassert.equal(imports['./vehicle/catalog.js?build=20260720-r20'], vehicleCatalogTarget);\nassert.equal(imports['./vehicle/car-models.js?build=20260720-r19'], carModelBridgeTarget);\nassert.equal(imports['./vehicle/car-models.js?build=20260720-r22'], carModelBridgeTarget);`;
if (!source.includes(oldAssertions)) throw new Error('garage vehicle import-map assertions not found exactly');
source = source.replace(oldAssertions, newAssertions);

await fs.writeFile(path, source);
console.log('Garage regression now asserts the steering-wheel vehicle cache revision.');
