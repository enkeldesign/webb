from pathlib import Path

path = Path('turn-lab/tests/achievements-production.mjs')
text = path.read_text()
old = r'''    /"\/turn\/achievements\/challenge-expansion-r166\.js\?revision=r166-bella-records": "\/turn\/achievements\/challenge-expansion-r166\.js\?revision=r256-achievement-polling"/,
    'Installed builds must route old challenge-achievement modules to the event-driven implementation'
'''
new = r'''    /"\/turn\/achievements\/challenge-expansion-r166\.js\?revision=r166-bella-records": "\/turn\/achievements\/challenge-expansion-r166\.js\?revision=r256-achievement-polling&build=\d{8}-r\d+"/,
    'Installed builds must route old challenge-achievement modules to the current build of the event-driven implementation'
'''
if old not in text:
    raise SystemExit('stale challenge route assertion not found')
path.write_text(text.replace(old, new, 1))
