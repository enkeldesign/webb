const FEEDBACK_EMAIL = 'erik@enkel.design';
const FEEDBACK_SUBJECT = 'TURN feedback';
const FEEDBACK_VERSION = 'r137-feedback-above-fold';

let installed = false;

function openDialog(dialog, trigger) {
  dialog.__turnReturnFocus = trigger;
  const card = dialog.querySelector('.m8-dialog-card');
  if (card) card.scrollTop = 0;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  dialog.querySelector('[data-dialog-close]')?.focus();
}

function closeDialog(dialog) {
  if (typeof dialog.close === 'function' && dialog.open) {
    dialog.close();
    return;
  }
  dialog.removeAttribute('open');
  dialog.__turnReturnFocus?.focus?.();
}

function copyWithFallback(text) {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.setAttribute('aria-hidden', 'true');
  field.style.position = 'fixed';
  field.style.inset = '0 auto auto -9999px';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  field.setSelectionRange(0, field.value.length);
  const copied = document.execCommand?.('copy') === true;
  field.remove();
  return copied;
}

async function copyEmailAddress(button, status) {
  let copied = false;
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(FEEDBACK_EMAIL);
      copied = true;
    } else {
      copied = copyWithFallback(FEEDBACK_EMAIL);
    }
  } catch (_) {
    copied = copyWithFallback(FEEDBACK_EMAIL);
  }

  status.textContent = copied
    ? `Email address copied: ${FEEDBACK_EMAIL}`
    : `Could not copy automatically. The email address is ${FEEDBACK_EMAIL}.`;

  if (copied) {
    const originalLabel = button.textContent;
    button.textContent = 'COPIED';
    globalThis.setTimeout?.(() => {
      button.textContent = originalLabel;
    }, 1800);
  }
}

function attributionMarkup() {
  return `
    <p>TURN is shaped by inclusive and universal design so everyone can play, regardless of ability or how they interact with the game.</p>
    <p>© 2026 <a href="https://enkel.design/" target="_blank" rel="noreferrer">enkel.design</a>. Created by Erik Jansson, aided by OpenAI Codex. Drive By Ear™ is inspired by <a href="https://ceal.cs.columbia.edu/rad/" target="_blank" rel="noreferrer">RAD – Racing Auditory Display</a>.</p>`;
}

function createFeedbackDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'm8-dialog m8-feedback-dialog';
  dialog.setAttribute('aria-labelledby', 'm8FeedbackTitle');
  dialog.dataset.feedbackVersion = FEEDBACK_VERSION;
  dialog.innerHTML = `
    <article class="m8-dialog-card m8-feedback-card">
      <header class="m8-dialog-head">
        <div><span>HELP MAKE TURN BETTER</span><h2 id="m8FeedbackTitle">GIVE FEEDBACK</h2></div>
        <button type="button" data-dialog-close aria-label="Close Give Feedback">×</button>
      </header>

      <div class="m8-feedback-content">
        <p class="m8-feedback-lead">Found a bug, an accessibility barrier or something that made TURN harder to use? Tell us what happened and what you expected.</p>
        <p>Feature ideas and improvement suggestions are welcome too. Feedback from every kind of player helps make TURN better for everyone. Mention your device, browser or assistive technology when it is relevant.</p>

        <div class="m8-feedback-actions">
          <a class="m8-feedback-email" href="mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}">EMAIL FEEDBACK</a>
          <button class="m8-feedback-copy" type="button">COPY EMAIL ADDRESS</button>
        </div>
        <p class="m8-feedback-status" role="status" aria-live="polite"></p>
      </div>
    </article>`;
  document.body.appendChild(dialog);
  return dialog;
}

function createAboutDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'm8-dialog m8-about-dialog';
  dialog.setAttribute('aria-labelledby', 'm8AboutTitle');
  dialog.innerHTML = `
    <article class="m8-dialog-card m8-about-card">
      <header class="m8-dialog-head">
        <div><span>THE GAME</span><h2 id="m8AboutTitle">ABOUT TURN</h2></div>
        <button type="button" data-dialog-close aria-label="Close About TURN">×</button>
      </header>

      <div class="m8-about-content">
        <p class="m8-about-lead">TURN is a racing game about tilt steering, personal rivals and learning to drive by ear.</p>
        ${attributionMarkup()}
      </div>
    </article>`;
  document.body.appendChild(dialog);
  return dialog;
}

function installDialogBehavior(dialog, trigger, onClose = null) {
  const closeButton = dialog.querySelector('[data-dialog-close]');
  trigger.addEventListener('click', () => openDialog(dialog, trigger));
  closeButton.addEventListener('click', () => closeDialog(dialog));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
  dialog.addEventListener('close', () => {
    onClose?.();
    dialog.__turnReturnFocus?.focus?.();
  });
}

function createAboutTrigger() {
  const header = document.querySelector('.m8-home-head');
  const buildLabel = header?.querySelector('.m8-home-build');
  if (!header || !buildLabel) {
    throw new Error('TURN About could not find the Home build information.');
  }

  const meta = document.createElement('div');
  meta.className = 'm8-home-meta';
  buildLabel.replaceWith(meta);
  meta.appendChild(buildLabel);

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'm8-about-trigger';
  trigger.textContent = 'ABOUT TURN';
  trigger.setAttribute('aria-haspopup', 'dialog');
  meta.appendChild(trigger);

  return { meta, trigger, buildLabel };
}

export function installHomeFeedback() {
  if (installed) return globalThis.__turnHomeFeedback;

  const menu = document.querySelector('.m8-home-menu');
  const status = menu?.querySelector('.m8-home-status');
  if (!menu || !status) {
    throw new Error('TURN feedback could not find the complete Home menu.');
  }

  const feedbackTrigger = document.createElement('button');
  feedbackTrigger.type = 'button';
  feedbackTrigger.className = 'm8-feedback-button';
  feedbackTrigger.textContent = 'GIVE FEEDBACK';
  feedbackTrigger.setAttribute('aria-haspopup', 'dialog');
  menu.insertBefore(feedbackTrigger, status);

  const { meta, trigger: aboutTrigger, buildLabel } = createAboutTrigger();
  const feedbackDialog = createFeedbackDialog();
  const aboutDialog = createAboutDialog();
  const copyButton = feedbackDialog.querySelector('.m8-feedback-copy');
  const feedbackStatus = feedbackDialog.querySelector('.m8-feedback-status');

  installDialogBehavior(feedbackDialog, feedbackTrigger, () => {
    feedbackStatus.textContent = '';
  });
  installDialogBehavior(aboutDialog, aboutTrigger);
  copyButton.addEventListener('click', () => copyEmailAddress(copyButton, feedbackStatus));

  installed = true;
  globalThis.__turnHomeFeedback = Object.freeze({
    version: FEEDBACK_VERSION,
    email: FEEDBACK_EMAIL,
    trigger: feedbackTrigger,
    dialog: feedbackDialog,
    open: () => openDialog(feedbackDialog, feedbackTrigger),
    close: () => closeDialog(feedbackDialog),
    about: Object.freeze({
      meta,
      trigger: aboutTrigger,
      buildLabel,
      dialog: aboutDialog,
      open: () => openDialog(aboutDialog, aboutTrigger),
      close: () => closeDialog(aboutDialog)
    })
  });
  return globalThis.__turnHomeFeedback;
}
