import { installQeDriveControls } from '/turn/input/qe-drive-controls.js';

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
