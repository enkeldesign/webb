# TURN NEXT

`/turn-next/` is TURN’s protected architecture test runtime.

## Current milestone: parity entry

The first milestone deliberately runs the current production module graph from `/turn/`. It exists to establish a permanent test URL and safe deployment boundary before core systems are moved into the new canonical source tree.

The staging bootstrap and entry page are generated from `turn/app.js` and `turn/index.html` by:

```text
node turn-next/scripts/build-parity-app.mjs
node turn-next/scripts/build-parity-entry.mjs
```

CI verifies that both generated files remain synchronized:

```text
node turn-next/scripts/build-parity-app.mjs --check
node turn-next/scripts/build-parity-entry.mjs --check
```

Do not edit `turn-next/app.js` or `turn-next/index.html` by hand. Edit the generators or production sources and regenerate them.

## Safety boundaries

- Production `/turn/` files are not modified by the TURN NEXT bootstrap.
- TURN NEXT prefixes all `localStorage` and `sessionStorage` keys before production modules load.
- It never copies production records automatically.
- Its manifest uses the separate `/turn-next/` application id, start URL and scope.
- The page is marked `noindex` and visibly labelled throughout gameplay.

## Transitional architecture

Reusing `/turn/` modules is temporary and intentional. This baseline proves that the staging URL, storage isolation and PWA identity work before gameplay modules are migrated behind explicit application and platform interfaces.

The target remains one canonical source tree that can build:

```text
Web / PWA
TURN NEXT staging
Capacitor iOS
Capacitor Android
```
