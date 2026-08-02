const MOBILE_DEVICE_CLASS = 'turn-phone-tablet-device';
const DESKTOP_DEVICE_CLASS = 'turn-desktop-device';

export function isTurnPhoneOrTablet(environment = globalThis) {
  const navigatorRef = environment.navigator || {};
  const userAgent = String(navigatorRef.userAgent || '');
  const platform = String(navigatorRef.platform || '');
  const touchPoints = Number(navigatorRef.maxTouchPoints) || 0;
  const userAgentMobile = navigatorRef.userAgentData?.mobile === true;
  const ios = /iPad|iPhone|iPod/i.test(userAgent)
    || (platform === 'MacIntel' && touchPoints > 1);
  const android = /Android/i.test(userAgent);
  const coarsePointer = environment.matchMedia?.('(any-pointer: coarse)')?.matches === true;

  return userAgentMobile || ios || android || (touchPoints > 0 && coarsePointer);
}

export function installDeviceSupportMessage({ environment = globalThis } = {}) {
  const documentRef = environment.document;
  const root = documentRef?.documentElement;
  const panel = documentRef?.querySelector('.rotate-panel');
  const card = panel?.querySelector('.rotate-card');
  const title = card?.querySelector('strong');
  if (!root || !panel || !card || !title) {
    return Object.freeze({ installed: false, device: 'unknown' });
  }

  const mobileDevice = isTurnPhoneOrTablet(environment);
  const device = mobileDevice ? 'phone-tablet' : 'desktop';
  root.classList.toggle(MOBILE_DEVICE_CLASS, mobileDevice);
  root.classList.toggle(DESKTOP_DEVICE_CLASS, !mobileDevice);
  root.dataset.turnDeviceClass = device;

  title.id = 'turnDeviceSupportTitle';
  const detail = documentRef.createElement('span');
  detail.id = 'turnDeviceSupportDetail';
  detail.className = 'turn-device-support-detail';

  if (mobileDevice) {
    title.textContent = 'ROTATE YOUR DEVICE TO LANDSCAPE';
    detail.textContent = 'TURN uses the device as a steering wheel while racing.';
  } else {
    title.textContent = 'TURN IS MADE FOR PHONES AND TABLETS';
    detail.textContent = 'Open TURN on a phone or tablet. Rotate that device to landscape before racing.';
  }

  card.querySelector('.turn-device-support-detail')?.remove();
  card.appendChild(detail);
  panel.removeAttribute('aria-label');
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', title.id);
  panel.setAttribute('aria-describedby', detail.id);

  const api = Object.freeze({ installed: true, device, mobileDevice, panel, title, detail });
  environment.__turnDeviceSupport = api;
  return api;
}
