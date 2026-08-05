import { ShiftSimulation } from './sim.mjs';

const PATCH_FLAG = Symbol.for('postal.carrierBrandingPatch');

export const CARRIER_BRANDING = Object.freeze({
  nordpost: Object.freeze({ name: 'NordPost', code: 'NP', tone: 'blue', color: '#00A6D6' }),
  dlh: Object.freeze({ name: 'DLH', code: 'DLH', tone: 'yellow', color: '#FFCC00' }),
  brang: Object.freeze({ name: 'Brang', code: 'B', tone: 'green', color: '#59B847' }),
  usp: Object.freeze({ name: 'DB Stänker', code: 'DBS', tone: 'red', color: '#EC0016' })
});

export function applyCarrierBranding(job) {
  if (!job) return job;
  const brand = CARRIER_BRANDING[job.carrierId];
  if (!brand) return job;
  job.carrierName = brand.name;
  job.carrierCode = brand.code;
  job.carrierTone = brand.tone;
  return job;
}

function brandJobs(jobs) {
  if (!Array.isArray(jobs)) return;
  jobs.forEach(applyCarrierBranding);
}

function patchSimulation() {
  const prototype = ShiftSimulation.prototype;
  if (prototype[PATCH_FLAG]) return;
  Object.defineProperty(prototype, PATCH_FLAG, { value: true });

  const originalSnapshot = prototype.snapshot;
  prototype.snapshot = function snapshotWithCurrentCarrierBranding() {
    brandJobs(this.state?.jobs);
    const snapshot = originalSnapshot.call(this);
    brandJobs(snapshot.jobs);
    applyCarrierBranding(snapshot.selectedJob);
    return snapshot;
  };
}

function installCarrierColors() {
  if (document.querySelector('#postalCarrierColors')) return;
  const style = document.createElement('style');
  style.id = 'postalCarrierColors';
  style.textContent = `
    .parcel-batch[data-tone="blue"] .carrier-code,
    .carrier-legend [data-tone="blue"] { background: ${CARRIER_BRANDING.nordpost.color} !important; color: #10131a; }
    .parcel-batch[data-tone="yellow"] .carrier-code,
    .carrier-legend [data-tone="yellow"] { background: ${CARRIER_BRANDING.dlh.color} !important; color: #10131a; }
    .parcel-batch[data-tone="green"] .carrier-code,
    .carrier-legend [data-tone="green"] { background: ${CARRIER_BRANDING.brang.color} !important; color: #10131a; }
    .parcel-batch[data-tone="red"] .carrier-code,
    .carrier-legend [data-tone="red"] { background: ${CARRIER_BRANDING.usp.color} !important; color: #fff; }
  `;
  document.head.append(style);
}

function updateCarrierLegends(root = document) {
  root.querySelectorAll?.('.carrier-legend').forEach((legend) => {
    const entries = [
      ['NP', 'blue', 'NordPost'],
      ['DLH', 'yellow', 'DLH'],
      ['B', 'green', 'Brang'],
      ['DBS', 'red', 'DB Stänker']
    ];
    [...legend.querySelectorAll('span')].forEach((item, index) => {
      const entry = entries[index];
      if (!entry) return;
      item.textContent = entry[0];
      item.dataset.tone = entry[1];
      item.setAttribute('aria-label', entry[2]);
    });
  });
}

patchSimulation();

if (typeof document !== 'undefined') {
  installCarrierColors();
  updateCarrierLegends();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('.carrier-legend') || node.querySelector('.carrier-legend')) {
          updateCarrierLegends(node.matches('.carrier-legend') ? node.parentElement : node);
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
