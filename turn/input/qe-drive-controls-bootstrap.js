import { installQeDriveControls } from './qe-drive-controls.js?revision=r418-qe';

function bootstrap(attempt = 0) {
  const result = installQeDriveControls();
  if (result.installed) return;
  if (attempt < 300) requestAnimationFrame(() => bootstrap(attempt + 1));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootstrap(), { once: true });
} else {
  bootstrap();
}
