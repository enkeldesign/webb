import {
  CUSTOM_CAR_PERKS,
  CUSTOM_CAR_STAT_ROWS,
  PART_CATEGORIES,
  PARTS_BY_CATEGORY,
  getPart,
  getPerk
} from './parts-manifest.js';
import {
  CUSTOM_CAR_STAT_BUDGET,
  CUSTOM_CAR_STAT_MAX,
  CUSTOM_CAR_STAT_MIN,
  createDefaultCustomCarBuild,
  customCarStatTotal,
  normalizeCustomCarBuild,
  validateCustomCarBuild,
  withCustomCarBuildHash
} from './schema.js';
import { createCustomCarPreview } from './custom-car-renderer.js';

let activeDialog = null;

export function openBuildACar({ initialBuild = null, onSave = () => {} } = {}) {
  activeDialog?.close?.();
  const returnFocus = document.activeElement;
  let state = initialBuild
    ? normalizeCustomCarBuild(initialBuild, { now: initialBuild.updatedAt })
    : createDefaultCustomCarBuild();

  const dialog = document.createElement('dialog');
  dialog.className = 'build-a-car-dialog';
  dialog.setAttribute('aria-labelledby', 'buildACarTitle');
  dialog.innerHTML = `
    <div class="build-a-car-shell">
      <header class="build-a-car-heading">
        <div>
          <span>TURN LAB · PROTOTYPE 1</span>
          <h2 id="buildACarTitle" tabindex="-1">BUILD-A-CAR</h2>
          <p>Parts make the look. Eighteen points make the drive.</p>
        </div>
        <button class="build-a-car-close" type="button" aria-label="Close BUILD-A-CAR">×</button>
      </header>

      <div class="build-a-car-workspace">
        <section class="build-a-car-preview" aria-labelledby="buildACarPreviewTitle">
          <div class="build-a-car-preview-head">
            <span id="buildACarPreviewTitle">LIVE 3D PREVIEW</span>
            <small aria-hidden="true">DRAG TO ROTATE</small>
          </div>
          <div class="build-a-car-preview-host" aria-hidden="true">
            <span class="build-a-car-preview-loading">ASSEMBLING…</span>
          </div>
          <p class="build-a-car-preview-description"></p>
        </section>

        <form class="build-a-car-form">
          <section class="build-a-car-section" aria-labelledby="buildShapeTitle">
            <div class="build-a-car-section-heading">
              <span>01</span>
              <div><h3 id="buildShapeTitle">SHAPE</h3><p>Choose compatible parts from the Kenney kit.</p></div>
            </div>
            <div class="build-a-car-part-groups"></div>
          </section>

          <section class="build-a-car-section" aria-labelledby="buildPaintTitle">
            <div class="build-a-car-section-heading">
              <span>02</span>
              <div><h3 id="buildPaintTitle">PAINT</h3><p>Three semantic colour channels.</p></div>
            </div>
            <div class="build-a-car-paints"></div>
          </section>

          <section class="build-a-car-section" aria-labelledby="buildStatsTitle">
            <div class="build-a-car-section-heading">
              <span>03</span>
              <div><h3 id="buildStatsTitle">ATTRIBUTES</h3><p>Min 1 · Max 5 · All 18 points must be used.</p></div>
            </div>
            <div class="build-a-car-points" role="status" aria-live="polite" aria-atomic="true"></div>
            <div class="build-a-car-stats"></div>
          </section>

          <fieldset class="build-a-car-section build-a-car-perks">
            <legend><span>04</span><strong>CHOOSE ONE PERK</strong></legend>
            <div class="build-a-car-perk-options"></div>
          </fieldset>

          <section class="build-a-car-section" aria-labelledby="buildIdentityTitle">
            <div class="build-a-car-section-heading">
              <span>05</span>
              <div><h3 id="buildIdentityTitle">IDENTITY</h3><p>Name the single LAB garage slot.</p></div>
            </div>
            <label class="build-a-car-name">
              <span>CAR NAME</span>
              <input type="text" maxlength="20" autocomplete="off" spellcheck="false">
            </label>
          </section>
        </form>
      </div>

      <footer class="build-a-car-footer">
        <div class="build-a-car-footer-tools">
          <button class="build-a-car-secondary build-a-car-random" type="button">RANDOM BUILD</button>
          <button class="build-a-car-secondary build-a-car-reset" type="button">RESET</button>
        </div>
        <p class="build-a-car-save-reason" id="buildACarSaveReason"></p>
        <button class="build-a-car-save" type="button" aria-describedby="buildACarSaveReason">SAVE BUILD</button>
      </footer>
      <p class="build-a-car-live sr-only" role="status" aria-live="polite" aria-atomic="true"></p>
    </div>
  `;
  document.body.appendChild(dialog);
  activeDialog = dialog;

  const partGroups = dialog.querySelector('.build-a-car-part-groups');
  const paints = dialog.querySelector('.build-a-car-paints');
  const stats = dialog.querySelector('.build-a-car-stats');
  const perkOptions = dialog.querySelector('.build-a-car-perk-options');
  const points = dialog.querySelector('.build-a-car-points');
  const nameInput = dialog.querySelector('.build-a-car-name input');
  const saveButton = dialog.querySelector('.build-a-car-save');
  const saveReason = dialog.querySelector('.build-a-car-save-reason');
  const live = dialog.querySelector('.build-a-car-live');
  const previewDescription = dialog.querySelector('.build-a-car-preview-description');
  const preview = createCustomCarPreview(dialog.querySelector('.build-a-car-preview-host'));
  let previewGeneration = 0;
  let previewRequest = 0;
  let disposed = false;

  nameInput.value = state.name;
  renderPartGroups();
  renderPaintControls();
  renderStatControls();
  renderPerks();
  syncAll({ announce: false });

  dialog.querySelector('.build-a-car-close').addEventListener('click', () => dialog.close('cancel'));
  dialog.querySelector('.build-a-car-reset').addEventListener('click', () => {
    state = createDefaultCustomCarBuild(state.createdAt);
    nameInput.value = state.name;
    syncAll({ announce: true, message: 'Build reset to the prototype defaults.' });
  });
  dialog.querySelector('.build-a-car-random').addEventListener('click', () => {
    state = randomBuild(state);
    nameInput.value = state.name;
    syncAll({ announce: true, message: 'Random compatible build assembled.' });
  });
  nameInput.addEventListener('input', () => {
    state = withCustomCarBuildHash({ ...state, name: nameInput.value });
    syncValidation();
  });
  saveButton.addEventListener('click', () => {
    const candidate = normalizeCustomCarBuild({ ...state, name: nameInput.value });
    const validation = validateCustomCarBuild(candidate);
    if (!validation.valid) {
      syncValidation();
      live.textContent = validation.errors[0];
      return;
    }
    try {
      onSave(candidate);
      dialog.close('saved');
    } catch (error) {
      const message = "Build not saved. TURN LAB could not access this browser's storage.";
      saveReason.textContent = message;
      live.textContent = message;
      console.warn('TURN LAB: BUILD-A-CAR save failed.', error);
    }
  });

  dialog.addEventListener('close', cleanup, { once: true });
  dialog.showModal();
  requestAnimationFrame(() => dialog.querySelector('#buildACarTitle')?.focus());
  return dialog;

  function renderPartGroups() {
    const fragment = document.createDocumentFragment();
    for (const category of PART_CATEGORIES) {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'build-a-car-part-group';
      const legend = document.createElement('legend');
      legend.textContent = category.label;
      const options = document.createElement('div');
      options.className = 'build-a-car-part-options';
      for (const part of PARTS_BY_CATEGORY[category.id]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'build-a-car-part';
        button.dataset.category = category.id;
        button.dataset.partId = part.id;
        button.innerHTML = `<strong>${part.label}</strong><small>${part.description}</small>`;
        button.addEventListener('click', () => {
          state = withCustomCarBuildHash({
            ...state,
            parts: { ...state.parts, [category.id]: part.id }
          });
          syncAll({ announce: true, message: `${category.label}: ${part.label}.` });
        });
        options.appendChild(button);
      }
      fieldset.append(legend, options);
      fragment.appendChild(fieldset);
    }
    partGroups.replaceChildren(fragment);
  }

  function renderPaintControls() {
    const rows = [
      ['primary', 'PRIMARY'],
      ['secondary', 'SECONDARY'],
      ['accent', 'ACCENT']
    ];
    paints.replaceChildren(...rows.map(([id, label]) => {
      const wrapper = document.createElement('label');
      wrapper.className = 'build-a-car-paint';
      wrapper.innerHTML = `<span>${label}</span><input type="color"><output></output>`;
      const input = wrapper.querySelector('input');
      input.value = state.colors[id];
      input.setAttribute('aria-label', `${label.toLowerCase()} paint colour`);
      input.addEventListener('input', () => {
        state = withCustomCarBuildHash({
          ...state,
          colors: { ...state.colors, [id]: input.value.toLowerCase() }
        });
        syncAll({ announce: false });
      });
      return wrapper;
    }));
  }

  function renderStatControls() {
    stats.replaceChildren(...CUSTOM_CAR_STAT_ROWS.map(({ id, label }) => {
      const row = document.createElement('div');
      row.className = 'build-a-car-stat';
      row.dataset.statId = id;
      row.innerHTML = `
        <span>${label}</span>
        <button type="button" data-delta="-1" aria-label="Decrease ${label.toLowerCase()}">−</button>
        <output aria-label="${label} value"></output>
        <i aria-hidden="true"></i>
        <button type="button" data-delta="1" aria-label="Increase ${label.toLowerCase()}">+</button>
      `;
      row.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', () => {
          const next = state.stats[id] + Number(button.dataset.delta);
          if (next < CUSTOM_CAR_STAT_MIN || next > CUSTOM_CAR_STAT_MAX) return;
          state = withCustomCarBuildHash({
            ...state,
            stats: { ...state.stats, [id]: next }
          });
          syncAll({ announce: false });
        });
      });
      return row;
    }));
  }

  function renderPerks() {
    perkOptions.replaceChildren(...CUSTOM_CAR_PERKS.map((perk) => {
      const label = document.createElement('label');
      label.className = 'build-a-car-perk';
      label.innerHTML = `
        <input type="radio" name="build-a-car-perk" value="${perk.id}">
        <span><strong>${perk.label}</strong><small>${perk.description}</small></span>
      `;
      label.querySelector('input').addEventListener('change', () => {
        state = withCustomCarBuildHash({ ...state, perkId: perk.id });
        syncAll({ announce: true, message: `${perk.label} perk selected.` });
      });
      return label;
    }));
  }

  function syncAll({ announce = false, message = '' } = {}) {
    for (const button of dialog.querySelectorAll('.build-a-car-part')) {
      const selected = state.parts[button.dataset.category] === button.dataset.partId;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    dialog.querySelectorAll('.build-a-car-paint').forEach((control, index) => {
      const channel = ['primary', 'secondary', 'accent'][index];
      control.querySelector('input').value = state.colors[channel];
      control.querySelector('output').textContent = state.colors[channel].toUpperCase();
    });
    for (const row of dialog.querySelectorAll('.build-a-car-stat')) {
      const value = state.stats[row.dataset.statId];
      row.querySelector('output').textContent = value;
      row.querySelector('i').innerHTML = Array.from({ length: 5 }, (_, index) => (
        `<b class="${index < value ? 'is-full' : ''}"></b>`
      )).join('');
      row.querySelector('[data-delta="-1"]').disabled = value <= CUSTOM_CAR_STAT_MIN;
      row.querySelector('[data-delta="1"]').disabled = value >= CUSTOM_CAR_STAT_MAX;
    }
    dialog.querySelectorAll('.build-a-car-perk input').forEach((input) => {
      input.checked = input.value === state.perkId;
    });
    syncValidation();
    syncPreview();
    if (announce) live.textContent = message;
  }

  function syncValidation() {
    state = withCustomCarBuildHash({ ...state, name: nameInput.value });
    const validation = validateCustomCarBuild(state);
    const remaining = CUSTOM_CAR_STAT_BUDGET - validation.total;
    points.classList.toggle('is-valid', remaining === 0);
    points.classList.toggle('is-over', remaining < 0);
    points.textContent = remaining === 0
      ? `18 / 18 POINTS · READY`
      : remaining > 0
        ? `${validation.total} / 18 POINTS · ${remaining} LEFT`
        : `${validation.total} / 18 POINTS · ${Math.abs(remaining)} OVER`;
    saveButton.disabled = !validation.valid;
    saveReason.textContent = validation.valid
      ? 'Ready to save in the isolated TURN LAB garage slot.'
      : validation.errors[0] || 'Complete the build before saving.';
  }

  function syncPreview() {
    const generation = ++previewGeneration;
    const build = withCustomCarBuildHash(state);
    previewDescription.textContent = describeBuild(build);
    cancelAnimationFrame(previewRequest);
    previewRequest = requestAnimationFrame(() => {
      void preview.setBuild(build).catch((error) => {
        if (disposed || generation !== previewGeneration) return;
        previewDescription.textContent = 'The 3D preview could not be assembled. Your choices are still available.';
        console.warn('TURN LAB: BUILD-A-CAR preview failed.', error);
      });
    });
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(previewRequest);
    preview.dispose();
    dialog.remove();
    if (activeDialog === dialog) activeDialog = null;
    returnFocus?.focus?.();
  }
}

function describeBuild(build) {
  const body = getPart('body', build.parts.body)?.label;
  const cabin = getPart('cabin', build.parts.cabin)?.label;
  const wheels = getPart('wheels', build.parts.wheels)?.label;
  const spoiler = getPart('spoiler', build.parts.spoiler)?.label;
  const roof = getPart('roofAccessory', build.parts.roofAccessory)?.label;
  const lights = getPart('lights', build.parts.lights)?.label;
  const perk = getPerk(build.perkId)?.label;
  return `${body} body, ${cabin} cabin, ${wheels} wheels, ${spoiler} spoiler, ${roof}, ${lights} lights. ${perk} perk.`;
}

function randomBuild(previous) {
  const parts = Object.fromEntries(PART_CATEGORIES.map(({ id }) => {
    const choices = PARTS_BY_CATEGORY[id];
    return [id, choices[Math.floor(Math.random() * choices.length)].id];
  }));
  const stats = Object.fromEntries(CUSTOM_CAR_STAT_ROWS.map(({ id }) => [id, CUSTOM_CAR_STAT_MIN]));
  let remaining = CUSTOM_CAR_STAT_BUDGET - CUSTOM_CAR_STAT_ROWS.length * CUSTOM_CAR_STAT_MIN;
  while (remaining > 0) {
    const row = CUSTOM_CAR_STAT_ROWS[Math.floor(Math.random() * CUSTOM_CAR_STAT_ROWS.length)];
    if (stats[row.id] >= CUSTOM_CAR_STAT_MAX) continue;
    stats[row.id] += 1;
    remaining -= 1;
  }
  const perk = CUSTOM_CAR_PERKS[Math.floor(Math.random() * CUSTOM_CAR_PERKS.length)];
  return withCustomCarBuildHash({
    ...previous,
    parts,
    stats,
    perkId: perk.id,
    updatedAt: new Date().toISOString()
  });
}
