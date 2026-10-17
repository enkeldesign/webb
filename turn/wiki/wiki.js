// Progressive enhancement only. Article content, links and disclosures are HTML.
(() => {
  const preference = document.querySelector('#wiki-theme');
  const media = globalThis.matchMedia('(prefers-color-scheme: dark)');
  let selected = 'system';
  try { selected = localStorage.getItem('turn-theme-v1') || 'system'; } catch { /* Storage is optional. */ }
  if (!['system', 'light', 'dark'].includes(selected)) selected = 'system';
  const applyTheme = () => {
    document.documentElement.dataset.theme = selected === 'dark' || (selected === 'system' && media.matches) ? 'dark' : 'light';
  };
  if (preference) {
    preference.value = selected;
    preference.closest('label').hidden = false;
    preference.addEventListener('change', () => {
      selected = preference.value;
      try { localStorage.setItem('turn-theme-v1', selected); } catch { /* Keep the choice for this visit. */ }
      applyTheme();
    });
  }
  media.addEventListener('change', applyTheme);
  applyTheme();

  const input = document.querySelector('#wiki-query');
  if (input) {
    const form = input.closest('form');
    const items = [...document.querySelectorAll('[data-search]')];
    const status = document.querySelector('#search-status');
    const empty = document.querySelector('#no-results');
    const normalize = (value) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const searchable = items.map((item) => normalize(item.dataset.search));
    let timer;
    function filter(updateUrl = true) {
      const query = input.value.trim().slice(0, 120);
      const words = normalize(query).split(/\s+/).filter(Boolean);
      let count = 0;
      items.forEach((item, index) => {
        item.hidden = !words.every((word) => searchable[index].includes(word));
        if (!item.hidden) count++;
      });
      status.textContent = `${count} ${count === 1 ? 'article' : 'articles'}${query ? ` for “${query}”` : ''}`;
      empty.hidden = count !== 0;
      if (updateUrl) {
        const url = new URL(globalThis.location.href);
        if (query) url.searchParams.set('q', query);
        else url.searchParams.delete('q');
        globalThis.history.replaceState(null, '', url);
      }
    }
    function fromUrl() {
      input.value = (new URL(globalThis.location.href).searchParams.get('q') || '').slice(0, 120);
      filter(false);
    }
    input.addEventListener('input', () => {
      globalThis.clearTimeout(timer);
      timer = globalThis.setTimeout(filter, 150);
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      globalThis.clearTimeout(timer);
      filter();
    });
    globalThis.addEventListener('popstate', fromUrl);
    fromUrl();
  }

  // Fragment links into hidden-achievement spoilers still land on readable content.
  function revealFragment() {
    const id = globalThis.location.hash.slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    const disclosure = target?.closest('details');
    if (disclosure && !disclosure.open) {
      disclosure.open = true;
      target.scrollIntoView();
    }
  }
  globalThis.addEventListener('hashchange', revealFragment);
  revealFragment();
})();
