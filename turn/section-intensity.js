const REVISION = 'r532-countryside-nature-polish';

// COUNTRYSIDE originally divided the lap with translucent pink, green, orange and
// purple verge ribbons, matching T-shaped posts and delayed material recolouring.
// Those devices fought the authored rural palette and made neutral scenery read as
// bright pink ground. The track's distinct village, farm, orchard, woodland and lake
// now provide the section language naturally, so this compatibility hook deliberately
// installs no geometry and touches no materials.
export function installSectionIntensity({ world }) {
  if (!world) return null;
  const report = Object.freeze({
    revision: REVISION,
    colouredVerges: 0,
    repeaterPosts: 0,
    sceneryMaterialTints: 0,
    authoredDistrictsProvideSectionIdentity: true
  });
  world.userData.turnSectionIntensity = report;
  console.info('TURN: COUNTRYSIDE uses authored districts instead of colour overlays.');
  return report;
}

export { REVISION as SECTION_INTENSITY_REVISION };
