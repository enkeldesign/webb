const parts = ['./roller-coaster.1.part', './roller-coaster.2.part', './roller-coaster.3.part'];
const responses = await Promise.all(parts.map((url) => fetch(url)));
for (const response of responses) {
  if (!response.ok) throw new Error(`ROLLER COASTER: failed to load ${response.url} (${response.status})`);
}
const source = (await Promise.all(responses.map((response) => response.text()))).join('');
const objectUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(objectUrl);
} finally {
  URL.revokeObjectURL(objectUrl);
}
