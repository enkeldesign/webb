const REVISION = 'r532-countryside-nature-polish';

// The authored village, farm, orchard, woodland and lake now distinguish each
// section. Legacy coloured verge ribbons, posts and material tinting are retired.
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
