// App navigation: the conventions of an installed app on a phone.
//
// - Back. GARAGE and every open modal are layers on one back stack, mirrored in the
//   browser history. Android's back gesture, the browser's back button and Safari's
//   own edge swipe close the top layer instead of leaving TURN. Back works exactly
//   like Escape (or the layer's own close control), so each layer keeps its own close
//   path. Back during a race pauses it (race/race-pause.js): a stray gesture never
//   ends it, and back from PAUSED resumes, as its Escape does. At the start line
//   there is nothing to pause, so back does nothing there.
// - Edge swipe. The installed iOS app has no system back gesture, so a swipe from the
//   left edge of GARAGE does it: the screen follows the finger with ROADBOOK beneath,
//   and a release far or fast enough goes back.
// - Drag to dismiss. A bottom sheet follows a downward drag (from anywhere when its
//   content is scrolled to the top), a side menu a drag toward its edge; a release
//   far or fast enough closes it the same way back does.

const INSTALL_KEY = '__turnAppNavigation';
const STATE_KEY = 'turnNav';
const EDGE = 24;
const SLOP = 10;
const COMMIT_SHARE = 0.3;
const FLICK = 0.45;
const SETTLE_MS = 220;
const LEAVING_MS = 1500;
const NO_DRAG = 'input, textarea, select, [contenteditable], [data-turn-no-drag]';

export function installAppNavigation({ windowRef = globalThis, documentRef = globalThis.document } = {}) {
  if (!windowRef?.history || !documentRef?.body) return null;
  if (windowRef[INSTALL_KEY]) return windowRef[INSTALL_KEY];

  const history = windowRef.history;
  const body = documentRef.body;
  const openOrder = new Map();
  const leaving = new Map();
  let sequence = 0;
  let depth = 0;
  let settling = 0;
  let frame = 0;

  const reduced = () => windowRef.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

  // ---------- Layers ----------

  function isModal(dialog) {
    try {
      return dialog.matches(':modal');
    } catch {
      return true;
    }
  }

  function openDialogs() {
    const open = [...documentRef.querySelectorAll('dialog[open]')]
      .filter((dialog) => isModal(dialog) && dialog.dataset.turnNav !== 'off');
    for (const dialog of open) if (!openOrder.has(dialog)) openOrder.set(dialog, (sequence += 1));
    for (const dialog of openOrder.keys()) if (!open.includes(dialog)) openOrder.delete(dialog);
    return open.sort((a, b) => openOrder.get(a) - openOrder.get(b));
  }

  function garage() {
    return body.classList.contains('turn-garage-open') ? documentRef.querySelector('.garage') : null;
  }

  function layers() {
    const stack = [];
    if (body.classList.contains('turn-race-active')) {
      stack.push({ key: 'race', back: () => windowRef.__turnRacePause?.pause('player') === true });
    }
    const screen = garage();
    if (screen) stack.push({ key: screen, back: () => garageBack(screen) });
    for (const dialog of openDialogs()) stack.push({ key: dialog, back: () => dismissDialog(dialog) });
    return stack.filter((layer) => !leaving.has(layer.key));
  }

  function garageBack(screen) {
    const back = screen.querySelector('.garage-back');
    if (!back || back.disabled || !back.getClientRects().length) return false;
    back.click();
    return true;
  }

  function closeControl(dialog) {
    const controls = dialog.querySelectorAll('[data-dialog-close], .turn-pr-close, .turn-home-sheet-close, .m8-dialog-head > button');
    for (const control of controls) {
      if (control.closest('dialog') === dialog && !control.disabled && control.getClientRects().length) return control;
    }
    return null;
  }

  // The layer's own close control when it has one, else exactly what Escape does: a
  // cancelable cancel, then close. A dialog that refuses Escape refuses back too.
  function dismissDialog(dialog) {
    if (!dialog.open) return true;
    const control = closeControl(dialog);
    if (control) {
      control.click();
      return true;
    }
    if (!dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) return false;
    if (dialog.open) dialog.close();
    return true;
  }

  // A layer on its way out (GARAGE animates) does not count while it leaves, so its
  // history entry is not pushed back in the meantime.
  function markLeaving(key) {
    if (typeof key !== 'object') return;
    const timer = windowRef.setTimeout(() => {
      leaving.delete(key);
      schedule();
    }, LEAVING_MS);
    leaving.set(key, timer);
  }

  function pruneLeaving() {
    for (const [key, timer] of leaving) {
      const gone = key.isConnected === false || (key.tagName === 'DIALOG' && !key.open)
        || (key.classList?.contains('garage') && !garage());
      if (gone) {
        windowRef.clearTimeout(timer);
        leaving.delete(key);
      }
    }
  }

  // ---------- History ----------

  function entry(level) {
    const state = history.state && typeof history.state === 'object' ? history.state : {};
    return { ...state, [STATE_KEY]: { depth: level } };
  }

  function reconcile() {
    frame = 0;
    pruneLeaving();
    if (settling) return;
    const target = layers().length;
    try {
      while (depth < target) {
        history.pushState(entry(depth + 1), '');
        depth += 1;
      }
    } catch {
      // WebKit limits pushState bursts; the next change tries again.
    }
    if (depth > target) {
      const steps = depth - target;
      depth = target;
      settling += 1;
      history.go(-steps);
    }
  }

  function schedule() {
    if (!frame) frame = windowRef.requestAnimationFrame(reconcile);
  }

  windowRef.addEventListener('popstate', (event) => {
    const reached = Number(event.state?.[STATE_KEY]?.depth) || 0;
    if (settling) {
      settling -= 1;
      depth = reached;
      schedule();
      return;
    }
    if (reached < depth) {
      let steps = depth - reached;
      depth = reached;
      const stack = layers();
      // Close from the top. A layer that declines stays; its entry comes back below.
      while (steps > 0 && stack.length) {
        const layer = stack.pop();
        if (!layer.back()) break;
        markLeaving(layer.key);
        steps -= 1;
      }
    } else {
      depth = reached;
    }
    schedule();
  });

  try {
    history.replaceState(entry(0), '');
  } catch {
    // Without history access, back simply leaves, as before.
  }

  const observer = new MutationObserver(schedule);
  observer.observe(body, { attributes: true, attributeFilter: ['class'] });
  observer.observe(documentRef.documentElement, { subtree: true, attributes: true, attributeFilter: ['open'] });
  documentRef.addEventListener('close', schedule, true);
  schedule();

  // ---------- Shared gesture plumbing ----------

  function measureInset(side) {
    const probe = documentRef.createElement('i');
    probe.style.cssText = `position:fixed;left:-9999px;top:0;width:env(safe-area-inset-${side}, 0px);height:1px;visibility:hidden;pointer-events:none;`;
    body.appendChild(probe);
    const size = probe.getBoundingClientRect().width;
    probe.remove();
    return size;
  }

  function scrollerWithin(target, boundary, axis) {
    for (let node = target; node && node !== boundary.parentElement; node = node.parentElement) {
      const style = windowRef.getComputedStyle(node);
      const overflow = axis === 'y' ? style.overflowY : style.overflowX;
      const room = axis === 'y' ? node.scrollHeight - node.clientHeight : node.scrollWidth - node.clientWidth;
      if (/(auto|scroll)/.test(overflow) && room > 1) return node;
    }
    return null;
  }

  function settle(element, transform, done) {
    if (reduced()) {
      element.style.transition = 'none';
      element.style.transform = transform;
      done?.();
      return;
    }
    element.style.transition = `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
    element.style.transform = transform;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      element.removeEventListener('transitionend', finish);
      done?.();
    };
    element.addEventListener('transitionend', finish);
    windowRef.setTimeout(finish, SETTLE_MS + 80);
  }

  // A drag that moved must not end as a tap on whatever it started on.
  // Only the browser's own click: TURN's programmatic close clicks go through.
  function swallowNextClick() {
    const swallow = (event) => {
      if (!event.isTrusted) return;
      event.preventDefault();
      event.stopPropagation();
      documentRef.removeEventListener('click', swallow, true);
    };
    documentRef.addEventListener('click', swallow, true);
    windowRef.setTimeout(() => documentRef.removeEventListener('click', swallow, true), 400);
  }

  // Follows one touch: onMove(event, dx, dy) from where it started, then
  // onEnd(cancelled, velocity) with the velocity of its last few moves in px/ms.
  function track(touch, onMove, onEnd) {
    const start = { x: touch.clientX, y: touch.clientY };
    const samples = [{ ...start, t: performance.now() }];
    const id = touch.identifier;
    const find = (list) => [...list].find((item) => item.identifier === id);
    // A touch keeps the element it started on even after that element leaves the page
    // (GARAGE closing under the finger), and its events then stop at that element.
    const targets = [documentRef];
    if (touch.target && touch.target !== documentRef && typeof touch.target.addEventListener === 'function') {
      targets.push(touch.target);
    }
    let seen = null;
    const fresh = (event) => {
      if (event === seen) return false;
      seen = event;
      return true;
    };
    const move = (event) => {
      if (!fresh(event)) return;
      const point = find(event.changedTouches);
      if (!point) return;
      samples.push({ x: point.clientX, y: point.clientY, t: performance.now() });
      if (samples.length > 6) samples.shift();
      onMove(event, point.clientX - start.x, point.clientY - start.y);
    };
    const end = (event) => {
      if (!fresh(event) || !find(event.changedTouches)) return;
      for (const target of targets) {
        target.removeEventListener('touchmove', move, { passive: false });
        target.removeEventListener('touchend', end);
        target.removeEventListener('touchcancel', end);
      }
      const first = samples[0];
      const last = samples[samples.length - 1];
      const elapsed = Math.max(1, last.t - first.t);
      onEnd(event.type === 'touchcancel', { vx: (last.x - first.x) / elapsed, vy: (last.y - first.y) / elapsed });
    };
    for (const target of targets) {
      target.addEventListener('touchmove', move, { passive: false });
      target.addEventListener('touchend', end);
      target.addEventListener('touchcancel', end);
    }
  }

  // ---------- Drag to dismiss ----------

  function movingPart(dialog) {
    const background = windowRef.getComputedStyle(dialog).backgroundColor;
    const transparent = background === 'transparent' || /rgba\(.*,\s*0\)$/.test(background);
    return transparent && dialog.firstElementChild ? dialog.firstElementChild : dialog;
  }

  // Which way the dialog leaves: a bottom sheet down, a side menu toward its edge. A
  // centred card has no drag. The slack covers a sheet still rising into place.
  function presentation(dialog) {
    const panel = movingPart(dialog);
    const box = panel.getBoundingClientRect();
    const width = documentRef.documentElement.clientWidth;
    const height = windowRef.innerHeight;
    const slack = 32;
    const atBottom = box.bottom >= height - 2 && box.bottom <= height + slack;
    const atRight = box.right >= width - 2 && box.right <= width + slack;
    if (atBottom && box.top > 1 && box.width >= width - 2) return { panel, axis: 'y', travel: box.height };
    if (atRight && box.left > 1 && box.height >= height - 2) return { panel, axis: 'x', travel: box.width };
    return null;
  }

  function addGrabber(dialog) {
    const shape = presentation(dialog);
    if (!shape || shape.axis !== 'y' || shape.panel.querySelector(':scope > .turn-sheet-grabber')) return;
    if (windowRef.getComputedStyle(shape.panel).position === 'static') shape.panel.classList.add('turn-sheet-anchor');
    const grabber = documentRef.createElement('span');
    grabber.className = 'turn-sheet-grabber';
    grabber.setAttribute('aria-hidden', 'true');
    shape.panel.prepend(grabber);
  }

  const grabberObserver = new MutationObserver((records) => {
    for (const record of records) {
      if (record.target.tagName === 'DIALOG' && record.target.open) windowRef.requestAnimationFrame(() => addGrabber(record.target));
    }
  });
  grabberObserver.observe(documentRef.documentElement, { subtree: true, attributes: true, attributeFilter: ['open'] });

  function startSheetDrag(event, dialog) {
    const touch = event.changedTouches[0];
    const shape = presentation(dialog);
    if (!shape || !shape.panel.contains(event.target) || event.target.closest(NO_DRAG)) return;
    const { panel, axis, travel } = shape;
    const scroller = scrollerWithin(event.target, panel, axis);
    if (axis === 'y' && scroller && scroller.scrollTop > 0) return;
    let dragging = false;
    let abandoned = false;
    let offset = 0;
    track(touch, (moveEvent, dx, dy) => {
      if (abandoned) return;
      const along = axis === 'y' ? dy : dx;
      const across = axis === 'y' ? dx : dy;
      if (!dragging) {
        if (Math.abs(along) < SLOP && Math.abs(across) < SLOP) return;
        if (along < SLOP || Math.abs(across) > along) {
          abandoned = true;
          return;
        }
        dragging = true;
        panel.style.transition = 'none';
        dialog.classList.add('turn-nav-dragging');
      }
      moveEvent.preventDefault();
      offset = Math.max(0, along - SLOP);
      panel.style.transform = axis === 'y' ? `translate3d(0, ${offset}px, 0)` : `translate3d(${offset}px, 0, 0)`;
      dialog.style.setProperty('--turn-nav-drag', String(Math.min(1, offset / travel)));
    }, (cancelled, velocity) => {
      if (!dragging) return;
      swallowNextClick();
      const speed = axis === 'y' ? velocity.vy : velocity.vx;
      const dismiss = !cancelled && (offset > travel * COMMIT_SHARE || (speed > FLICK && offset > 24));
      const reset = () => {
        panel.style.transition = '';
        panel.style.transform = '';
        dialog.style.removeProperty('--turn-nav-drag');
        dialog.classList.remove('turn-nav-dragging');
      };
      if (!dismiss) {
        settle(panel, 'translate3d(0, 0, 0)', reset);
        return;
      }
      const away = axis === 'y' ? `translate3d(0, ${travel + 24}px, 0)` : `translate3d(${travel + 24}px, 0, 0)`;
      dialog.style.setProperty('--turn-nav-drag', '1');
      settle(panel, away, () => {
        const closed = dismissDialog(dialog);
        if (closed && !dialog.open) reset();
        else if (closed) dialog.addEventListener('close', reset, { once: true });
        else settle(panel, 'translate3d(0, 0, 0)', reset);
      });
    });
  }

  // ---------- Edge swipe back (installed iOS app) ----------

  function edgeSwipeAvailable() {
    const nav = windowRef.navigator;
    if (nav?.standalone === true) return true;
    const installed = windowRef.matchMedia?.('(display-mode: standalone)')?.matches
      || windowRef.matchMedia?.('(display-mode: fullscreen)')?.matches;
    const ios = /iP(hone|ad|od)/.test(nav?.platform || '') || (nav?.platform === 'MacIntel' && nav?.maxTouchPoints > 1);
    return Boolean(installed && ios);
  }

  let safeLeft = 0;
  const refreshInsets = () => {
    safeLeft = measureInset('left');
  };
  windowRef.addEventListener('resize', refreshInsets, { passive: true });
  refreshInsets();

  // The edge zone: the notch's empty strip in landscape, else 24px.
  const edgeZone = () => Math.max(EDGE, safeLeft);

  function edgeStart(touch) {
    return touch.clientX <= edgeZone();
  }

  // The edge belongs to back, as in any iOS app: it does not reach the car viewer.
  documentRef.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' && event.clientX <= edgeZone() && garage()
      && edgeSwipeAvailable() && !openDialogs().length) {
      event.stopPropagation();
    }
  }, true);

  function startEdgeSwipe(event, screen) {
    const touch = event.changedTouches[0];
    const width = documentRef.documentElement.clientWidth;
    const home = documentRef.querySelector('.m8-home');
    const revealHome = Boolean(home?.hidden);
    const homeStyle = revealHome ? { transform: home.style.transform, pointerEvents: home.style.pointerEvents } : null;
    // ROADBOOK hides again only behind a GARAGE that is still open. The browser's own
    // back gesture can close GARAGE mid-swipe and cancel the touch (#1036).
    const hideHome = () => {
      if (revealHome && home.isConnected && screen.isConnected && garage() === screen) home.hidden = true;
    };
    let scrim = null;
    let dragging = false;
    let abandoned = false;
    let offset = 0;

    const paint = () => {
      const progress = Math.min(1, offset / width);
      screen.style.transform = `translate3d(${offset}px, 0, 0)`;
      if (scrim) scrim.style.opacity = String(0.18 * (1 - progress));
      if (revealHome) home.style.transform = `translate3d(${-0.3 * width * (1 - progress)}px, 0, 0)`;
    };

    const cleanUp = () => {
      screen.style.transition = '';
      screen.style.transform = '';
      screen.style.boxShadow = '';
      screen.classList.remove('turn-nav-dragging');
      scrim?.remove();
      if (revealHome && home.isConnected) {
        home.style.transition = '';
        home.style.transform = homeStyle.transform;
        home.style.pointerEvents = homeStyle.pointerEvents;
      }
    };

    track(touch, (moveEvent, dx, dy) => {
      if (abandoned) return;
      if (!dragging) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        if (dx < SLOP || Math.abs(dy) > dx) {
          abandoned = true;
          return;
        }
        dragging = true;
        screen.style.transition = 'none';
        screen.style.boxShadow = '-12px 0 28px rgb(8 9 10 / 0.28)';
        screen.classList.add('turn-nav-dragging');
        scrim = documentRef.createElement('div');
        scrim.className = 'turn-nav-scrim';
        body.appendChild(scrim);
        if (revealHome) {
          home.style.pointerEvents = 'none';
          home.hidden = false;
        }
      }
      moveEvent.preventDefault();
      offset = Math.max(0, dx - SLOP);
      paint();
    }, (cancelled, velocity) => {
      if (!dragging) return;
      swallowNextClick();
      const commit = !cancelled && (offset > width * 0.35 || (velocity.vx > FLICK && offset > 24));
      if (!commit) {
        if (revealHome) {
          home.style.transition = reduced() ? 'none' : `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
          home.style.transform = `translate3d(${-0.3 * width}px, 0, 0)`;
        }
        if (scrim) scrim.style.opacity = '0.18';
        settle(screen, 'translate3d(0, 0, 0)', () => {
          hideHome();
          cleanUp();
        });
        return;
      }
      if (revealHome) {
        home.style.transition = reduced() ? 'none' : `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
        home.style.transform = 'translate3d(0, 0, 0)';
      }
      if (scrim) scrim.style.opacity = '0';
      settle(screen, `translate3d(${width}px, 0, 0)`, () => {
        const went = garageBack(screen);
        if (went) markLeaving(screen);
        else hideHome();
        cleanUp();
        schedule();
      });
    });
  }

  // ---------- Gesture entry ----------

  // Cheap checks first: during a race every touch passes through here.
  documentRef.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1 || !documentRef.querySelector('dialog[open], .garage')) return;
    const dialogs = openDialogs();
    const top = dialogs[dialogs.length - 1];
    if (top) {
      startSheetDrag(event, top);
      return;
    }
    const screen = garage();
    if (screen && edgeSwipeAvailable() && edgeStart(event.changedTouches[0])) startEdgeSwipe(event, screen);
  }, { passive: true, capture: true });

  const api = Object.freeze({
    depth: () => depth,
    layers: () => layers().map((layer) => (typeof layer.key === 'string' ? layer.key : layer.key.className || layer.key.tagName)),
    back: () => history.back(),
    edgeSwipeAvailable
  });
  windowRef[INSTALL_KEY] = api;
  return api;
}
