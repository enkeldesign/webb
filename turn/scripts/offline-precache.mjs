// Offline precache lists (#1030). For each installable entry page (TURN, TURN NEXT),
// every same-origin file the page can load: found by crawling its HTML, import map,
// modules, stylesheets and web manifest, plus the asset folders that code reaches
// through computed paths (car models, stills, scenery). release.mjs writes the lists
// and checks them, so a release never ships a list that misses a file it links.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const ORIGIN = 'https://enkel.design';

export const OFFLINE_ENTRIES = Object.freeze([
  Object.freeze({ scope: '/turn/', entry: 'turn/index.html', list: 'turn/offline-precache.json' }),
  Object.freeze({ scope: '/turn-next/', entry: 'turn-next/index.html', list: 'turn-next/offline-precache.json' })
]);

// Folders whose files code loads by computed paths (`${id}.glb`, `${carId}.webp`).
const ASSET_FOLDERS = Object.freeze(['turn/assets', 'turn/vendor']);
const ASSET_EXTENSIONS = new Set(['.js', '.mjs', '.json', '.glb', '.gltf', '.bin', '.obj', '.webp', '.png', '.jpg', '.jpeg', '.svg']);
const CRAWLED_EXTENSIONS = new Set(['.js', '.mjs', '.css', '.html', '.webmanifest']);
const FILE_EXTENSION = /\.(?:m?js|css|html|json|webmanifest|glb|gltf|bin|obj|webp|png|jpe?g|svg|ico|woff2?)$/i;

function repositoryPathFor(url) {
  if (url.origin !== ORIGIN) return null;
  const pathname = decodeURIComponent(url.pathname);
  if (!/^\/turn(?:-next)?\//.test(pathname) || pathname.includes('..')) return null;
  return pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.slice(1);
}

async function exists(repositoryPath) {
  try {
    return (await fs.stat(path.join(repositoryRoot, repositoryPath))).isFile();
  } catch {
    return false;
  }
}

function parseImportMap(html, baseUrl) {
  const source = html.match(/<script type=["']importmap["']>\s*([\s\S]*?)\s*<\/script>/i)?.[1];
  if (!source) return [];
  const imports = JSON.parse(source).imports || {};
  return Object.entries(imports).map(([specifier, target]) => [
    /^[./]/.test(specifier) ? new URL(specifier, baseUrl).href : specifier,
    new URL(target, baseUrl).href
  ]).sort(([a], [b]) => b.length - a.length);
}

function resolveSpecifier(specifier, importerUrl, importMap) {
  const key = /^[./]/.test(specifier) ? new URL(specifier, importerUrl).href : specifier;
  for (const [from, to] of importMap) {
    if (key === from) return new URL(to);
    if (from.endsWith('/') && key.startsWith(from)) return new URL(to + key.slice(from.length));
  }
  if (/^[./]/.test(specifier)) return new URL(specifier, importerUrl);
  return null;
}

// Every reference a file can make to another same-origin file, as URLs.
function references(source, fileUrl, extension, importMap) {
  const found = [];
  // A template literal may compute its query (`?build=${buildKey}`) but not its path.
  const add = (specifier) => {
    const pathPart = specifier?.trim().replace(/[?#].*$/, '');
    if (!pathPart || pathPart.includes('${')) return;
    const url = resolveSpecifier(pathPart, fileUrl, importMap);
    if (url) found.push(url);
  };
  if (extension === '.html') {
    for (const [, value] of source.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) add(value);
    for (const [, target] of importMap) found.push(new URL(target));
  }
  if (extension === '.css') {
    for (const [, value] of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) add(value);
    for (const [, value] of source.matchAll(/@import\s+["']([^"']+)["']/g)) add(value);
  }
  if (extension === '.webmanifest') {
    try {
      for (const icon of JSON.parse(source).icons || []) add(icon.src);
    } catch {
      // Not a manifest after all: nothing to follow.
    }
  }
  if (extension === '.js' || extension === '.mjs' || extension === '.html') {
    // Module specifiers, bare ones included (resolved through the import map).
    for (const [, value] of source.matchAll(/\b(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) add(value);
    // Path-like string literals: URLs built with new URL(), fetch(), withBuild() and loaders.
    for (const [, , value] of source.matchAll(/(["'`])((?:\.{1,2}\/|\/turn(?:-next)?\/)[^"'`\s]+?)\1/g)) {
      if (FILE_EXTENSION.test(value.replace(/[?#].*$/, ''))) add(value);
    }
  }
  return found;
}

async function listFolder(folder) {
  const out = [];
  let entries = [];
  try {
    entries = await fs.readdir(path.join(repositoryRoot, folder), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const child = `${folder}/${entry.name}`;
    if (entry.isDirectory()) out.push(...await listFolder(child));
    else if (ASSET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) out.push(child);
  }
  return out;
}

export async function buildPrecacheList({ entry }) {
  const entryUrl = new URL(`/${entry}`.replace(/index\.html$/, ''), ORIGIN);
  const html = await fs.readFile(path.join(repositoryRoot, entry), 'utf8');
  const importMap = parseImportMap(html, entryUrl);
  const files = new Set([entry]);
  const queue = [[entry, new URL(`/${entry}`, ORIGIN)]];
  while (queue.length) {
    const [repositoryPath, fileUrl] = queue.shift();
    const extension = path.extname(repositoryPath).toLowerCase();
    if (!CRAWLED_EXTENSIONS.has(extension)) continue;
    const source = await fs.readFile(path.join(repositoryRoot, repositoryPath), 'utf8');
    for (const url of references(source, fileUrl, extension, importMap)) {
      const target = repositoryPathFor(url);
      if (!target || files.has(target) || !(await exists(target))) continue;
      files.add(target);
      queue.push([target, new URL(`/${target}`, ORIGIN)]);
    }
  }
  for (const folder of ASSET_FOLDERS) for (const file of await listFolder(folder)) files.add(file);
  return { files: [...files].sort().map((file) => `/${file}`) };
}

export function renderPrecacheList(release, { files }) {
  return `${JSON.stringify({ release: release.cacheKey, files }, null, 2)}\n`;
}
