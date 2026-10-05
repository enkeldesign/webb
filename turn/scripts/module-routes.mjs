// One URL per module (#1045). A module the page reaches under two URLs runs twice,
// with two copies of its state, and a URL without the release key can bring back a
// module of another release. release.mjs walks the module graph from an entry page
// (TURN, and YOUR TURN, which runs TURN's game modules) and routes every URL the code
// asks for to the module's one URL for the release: the import map for imports, the
// release key on the entry page's tags.
import path from 'node:path';

const ORIGIN = 'https://enkel.design';
const TURN_DOCUMENT = '/turn/index.html';
const LOCAL = /^(?:[./]|https?:)/;

// Modules under these paths are versioned by their path (three.js) or belong to
// another page (YOUR TURN): left as they are.
function routed(pathname) {
  return pathname.startsWith('/turn/') && !pathname.startsWith('/turn/vendor/') && /\.m?js$/.test(pathname);
}

export function normalizedModuleRoutes(imports, documentUrl, { rejectConflicts = false } = {}) {
  const entries = new Map();
  for (const [specifier, target] of Object.entries(imports)) {
    const key = LOCAL.test(specifier) ? new URL(specifier, documentUrl).href : specifier;
    const value = LOCAL.test(target) ? new URL(target, documentUrl).href : target;
    if (rejectConflicts && entries.has(key) && entries.get(key) !== value) {
      throw new Error(`Conflicting import-map routes for ${key}: ${entries.get(key)} and ${value}`);
    }
    // Relative and absolute keys can normalize to the same URL. The browser
    // keeps the last entry, not the first raw spelling in the JSON object.
    entries.set(key, value);
  }
  return [...entries].sort(([left], [right]) => right.length - left.length);
}

// What the browser asks for (before the import map) and where the map sends it.
function resolve(specifier, importerUrl, entries) {
  const asked = LOCAL.test(specifier) ? new URL(specifier, importerUrl).href : specifier;
  for (const [key, target] of entries) {
    if (asked === key) return { asked, url: new URL(target) };
    if (key.endsWith('/') && asked.startsWith(key)) return { asked, url: new URL(`${target}${asked.slice(key.length)}`) };
  }
  return LOCAL.test(specifier) ? { asked, url: new URL(asked) } : null;
}

// Every module URL a source asks for, as the composition test reads them: static and
// dynamic imports, and the build-keyed helpers (withBuild, installStylesheet).
function references(source, importerUrl, release, entries) {
  const found = [];
  const add = (specifier, build = null) => {
    let value = specifier;
    if (build) {
      const url = new URL(specifier, importerUrl);
      url.searchParams.set('build', build);
      value = url.href;
    }
    const resolved = resolve(value, importerUrl, entries);
    if (resolved) found.push(resolved);
  };
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const [, specifier] of code.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g)) add(specifier);
  for (const [, specifier] of code.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) add(specifier);
  for (const [, specifier] of code.matchAll(/\bimport\s*\(\s*`([^`]*)`\s*\)/g)) {
    const value = specifier.replaceAll('${buildKey}', release.cacheKey);
    if (!value.includes('${')) add(value);
  }
  for (const [, specifier] of code.matchAll(/\bwithBuild\(\s*['"]([^'"]+)['"]\s*\)/g)) add(specifier, release.cacheKey);
  for (const [, specifier] of code.matchAll(/\bmoduleUrl\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    add(specifier, importerUrl.searchParams.get('build'));
  }
  // car-models.js: assetUrl('./assets/…') is relative to /turn/.
  for (const [, specifier] of code.matchAll(/\bassetUrl\(\s*['"]([^'"]+\.m?js)['"]\s*\)/g)) {
    add(`../${specifier.replace(/^\.\//, '')}`, release.cacheKey);
  }
  return found;
}

// The entry page's own tags load a file under the release key: a tag that has one
// keeps its suffix ("20261003-r376-social-browser"), a tag without one gains it.
export function bindEntryTags(document, release) {
  return document.replace(/(<script\b[^>]*\bsrc=")(\.\/[^"?]+\.m?js)\?([^"]+)(")/g, (tag, open, file, query, close) => {
    const params = new URLSearchParams(query);
    params.set('build', withRelease(params.get('build'), release));
    return `${open}${file}?${params.toString()}${close}`;
  });
}

function withRelease(build, release) {
  return /^\d{8}-r\d+/.test(build || '') ? build.replace(/^\d{8}-r\d+/, release.cacheKey) : release.cacheKey;
}

// Routes every URL the module graph asks for to the module's one URL. `read` returns a
// repository file's source as it ships (null when missing). `documentPath` is the
// entry page the import map belongs to.
export function routeModuleGraph(document, importMap, release, read, documentPath = TURN_DOCUMENT) {
  const DOCUMENT_URL = new URL(documentPath, ORIGIN);
  const imports = importMap.imports ||= {};
  // release.mjs updates some named routes before this graph pass. Bind all
  // local targets first, so a normal build bump is not a routing conflict.
  for (const [specifier, target] of Object.entries(imports)) {
    if (!LOCAL.test(target)) continue;
    const url = new URL(target, DOCUMENT_URL);
    if (url.origin !== ORIGIN || !routed(url.pathname)) continue;
    url.searchParams.set('build', withRelease(url.searchParams.get('build'), release));
    imports[specifier] = `${target.split(/[?#]/)[0]}?${url.searchParams}${url.hash}`;
  }
  const entries = normalizedModuleRoutes(imports, DOCUMENT_URL, { rejectConflicts: true });
  const canonical = new Map();
  const asked = new Map();
  const queue = [];

  for (const [, src] of document.matchAll(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/g)) {
    const url = new URL(src, DOCUMENT_URL);
    if (routed(url.pathname)) canonical.set(url.pathname, `${url.pathname}${url.search}`);
    queue.push(url);
  }

  // A module's one URL keeps the form the import map already gives it (its own key
  // first, else the first alias's), under this release's key.
  const preferredTarget = (pathname) => {
    const own = imports[pathname];
    const existing = [own, ...Object.values(imports)].find((target) =>
      typeof target === 'string' && LOCAL.test(target) && new URL(target, DOCUMENT_URL).pathname === pathname);
    const params = new URLSearchParams(existing ? new URL(existing, DOCUMENT_URL).search : '');
    params.set('build', withRelease(params.get('build'), release));
    return `${pathname}?${params.toString()}`;
  };

  const visited = new Set();
  while (queue.length) {
    const url = queue.shift();
    if (visited.has(url.href) || url.origin !== ORIGIN) continue;
    visited.add(url.href);
    const repositoryPath = decodeURIComponent(url.pathname).slice(1);
    if (!/\.m?js$/.test(repositoryPath) || repositoryPath.includes('..')) continue;
    const source = read(path.posix.normalize(repositoryPath));
    if (source === null) continue;
    for (const reference of references(source, url, release, entries)) {
      const pathname = reference.url.pathname;
      if (reference.url.origin === ORIGIN && routed(pathname) && !canonical.has(pathname)) {
        canonical.set(pathname, preferredTarget(pathname));
      }
      if (reference.url.origin === ORIGIN && routed(pathname) && /^https?:/.test(reference.asked)) {
        const askedUrl = new URL(reference.asked);
        if (askedUrl.origin === ORIGIN && askedUrl.pathname === pathname) {
          if (!asked.has(pathname)) asked.set(pathname, new Set());
          asked.get(pathname).add(`${askedUrl.pathname}${askedUrl.search}`);
        }
      }
      queue.push(reference.url);
    }
  }

  for (const [pathname, urls] of asked) {
    const target = canonical.get(pathname);
    for (const url of urls) {
      if (url !== target) imports[url] = target;
    }
  }
  // Earlier aliases of a module go where its new URLs go.
  for (const [specifier, target] of Object.entries(imports)) {
    if (!LOCAL.test(target)) continue;
    const url = new URL(target, DOCUMENT_URL);
    const routedTarget = url.origin === ORIGIN ? canonical.get(url.pathname) : null;
    if (!routedTarget) continue;
    if (LOCAL.test(specifier) && new URL(specifier, DOCUMENT_URL).href === new URL(routedTarget, DOCUMENT_URL).href) {
      delete imports[specifier];
    } else {
      // An alias written relative to /turn/ stays relative.
      imports[specifier] = target.startsWith('./') ? `.${routedTarget.slice('/turn'.length)}` : routedTarget;
    }
  }
  return importMap;
}
