import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Since 1.25.0 every stylesheet is authored at its rendered size. A copy cached from
// an earlier release (authored for the retired 0.75 runtime rewriter) renders a third
// too large, so no player-facing stylesheet may load under a URL that survives a
// release: every reference carries the current build, or passes through a loader
// that adds it. Covers entry HTML links, CSS @import and stylesheet URLs in modules.
const root = fileURLToPath(new URL('../', import.meta.url));
const release = JSON.parse(await fs.readFile(path.join(root, 'turn/release.json'), 'utf8'));
const build = `build=${release.cacheKey}`;

// Developer pages keep their own stylesheets and the legacy rewriter.
const DEVELOPER_ONLY = /^turn\/(?:stats|audio\/music\/tracker)|^turn\/design-reference\.css$/;

async function walk(dir, pattern, out = []) {
  for (const entry of await fs.readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) await walk(relative, pattern, out);
    else if (pattern.test(entry.name)) out.push(relative);
  }
  return out;
}

function stylesheetPath(url, fromFile) {
  const clean = url.split(/[?#]/)[0];
  if (/^https?:/.test(clean)) return null;
  const resolved = clean.startsWith('/')
    ? clean.slice(1)
    : path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), clean));
  return resolved.endsWith('.css') ? resolved : null;
}

const problems = [];
function check(file, url, bound, how) {
  const target = stylesheetPath(url, file);
  if (!target || DEVELOPER_ONLY.test(target)) return;
  if (!/^(?:turn|yourturn)\//.test(target)) return;
  if (!bound) problems.push(`${file}: ${how} ${url}`);
}

// Entry HTML: every stylesheet link carries the current build.
const entries = ['turn/index.html', 'turn-lab/index.html', 'yourturn/index.html', 'turn-next/index.html'];
for (const file of entries) {
  const html = await fs.readFile(path.join(root, file), 'utf8');
  const base = /<base href="\/turn\/">/.test(html) ? 'turn/index.html' : file;
  for (const [, href] of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) {
    check(base, href, href.includes(build), 'links');
  }
}

// CSS @import: the imported sheet carries the current build.
for (const file of [...await walk('turn', /\.css$/), ...await walk('yourturn', /\.css$/)]) {
  if (DEVELOPER_ONLY.test(file)) continue;
  const css = await fs.readFile(path.join(root, file), 'utf8');
  for (const [, url] of css.matchAll(/@import\s+url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    check(file, url, url.includes(build), 'imports');
  }
}

// Modules: a stylesheet URL is build-bound when it carries the current build, is a
// template with the runtime build key, or the module's loader adds the build.
for (const file of await walk('turn', /\.js$/)) {
  if (/^turn\/(?:stats|audio\/music\/tracker)/.test(file)) continue;
  const source = await fs.readFile(path.join(root, file), 'utf8');
  if (!/\.css\b/.test(source)) continue;
  const loaderAddsBuild = /searchParams\.set\(\s*'build'/.test(source);
  for (const [, quote, url] of source.matchAll(/(['`])((?:\.{1,2}\/|\/turn\/)[^'`\s]*?\.css(?:\?[^'`\s]*)?)\1/g)) {
    const bound = url.includes(build) || (quote === '`' && /\$\{buildKey\}/.test(url)) || loaderAddsBuild;
    check(file, url, bound, 'loads');
  }
}

// A module that writes a build-bound stylesheet URL is itself fetched under a
// release-bound URL, or a cached copy of the module would request the old sheet.
const literalLoaders = [];
for (const file of await walk('turn', /\.js$/)) {
  const source = await fs.readFile(path.join(root, file), 'utf8');
  if (new RegExp(`\\.href = '[^']+\\.css\\?${build}'`).test(source)) literalLoaders.push(`/${file}`);
}
assert.ok(literalLoaders.length >= 3, 'The literal stylesheet loaders are found');
for (const file of ['turn/index.html', 'turn-lab/index.html', 'yourturn/index.html']) {
  const html = await fs.readFile(path.join(root, file), 'utf8');
  const imports = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  for (const loader of literalLoaders) {
    for (const [specifier, target] of Object.entries(imports)) {
      if (specifier.split('?')[0] === loader || target.split('?')[0] === loader) {
        if (!target.includes(build)) problems.push(`${file}: import map routes ${specifier} to ${target}`);
      }
    }
  }
}

assert.deepEqual(problems, [], 'Every player-facing stylesheet URL must change with each release');
console.log('Every player-facing stylesheet URL carries the current build.');
