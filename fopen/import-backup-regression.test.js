const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync(require('path').join(__dirname, 'main.js'), 'utf8');

function extractFunction(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function: ${name}`);
  const bodyStart = src.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`Unbalanced function: ${name}`);
}

const snippet = [
  extractFunction('getDefaultState'),
  extractFunction('normalizeState'),
  extractFunction('looksLikeAppState'),
  extractFunction('extractStateFromBackup')
].join('\n\n');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(snippet, ctx);

const validBackups = [
  { stage: 'tournament', selectedTeams: ['A'], groups: [], schedule: [], results: {} },
  { state: { stage: 'draw', selectedTeams: [], groups: [], schedule: [], results: {} } },
  { sourceBackup: { stage: 'playoff', selectedTeams: [], groups: [], schedule: [], results: {} } },
  { sourceBackup: { state: { stage: 'select', selectedTeams: [], groups: [], schedule: [], results: {} } } },
  { backup: { stage: 'tournament', selectedTeams: [], groups: [], schedule: [], results: {} } },
  { data: { state: { stage: 'draw', selectedTeams: [], groups: [], schedule: [], results: {} } } }
];

for (const payload of validBackups) {
  const extracted = ctx.extractStateFromBackup(payload);
  const normalized = ctx.normalizeState(extracted);
  if (!normalized || typeof normalized !== 'object') throw new Error('normalizeState failed');
  if (!['select', 'draw', 'tournament', 'playoff'].includes(normalized.stage)) {
    throw new Error(`Unexpected stage: ${normalized.stage}`);
  }
}

let threw = false;
try {
  ctx.extractStateFromBackup({ version: 'x.y.z', meta: {} });
} catch {
  threw = true;
}
if (!threw) throw new Error('Expected invalid backup to throw');

console.log('import-backup regression tests passed');
