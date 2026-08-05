import './carrier-branding.mjs?build=20260806-carriers-r1';

async function startPostal() {
  await import('./main.mjs?build=20260806-layout-r1');
  await import('./management-ui.mjs?build=20260806-management-r2');
  document.dispatchEvent(new CustomEvent('postal-ui-ready'));
}

startPostal().catch((error) => {
  const loading = document.querySelector('#loadingCard');
  if (loading) {
    loading.innerHTML = '<span aria-hidden="true">!</span><span>POSTAL could not start. Reload the page to try again.</span>';
    loading.setAttribute('role', 'alert');
  }
  console.error('POSTAL bootstrap failed', error);
});
