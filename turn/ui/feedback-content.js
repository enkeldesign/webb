export const FEEDBACK_EMAIL = 'erik@enkel.design';
const FEEDBACK_SUBJECT = 'TURN feedback';

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

export function createFeedbackContent({ className = '' } = {}) {
  const content = document.createElement('div');
  content.className = ['m8-feedback-content', className].filter(Boolean).join(' ');
  content.innerHTML = `
    <p class="m8-feedback-lead">Found a bug, an accessibility barrier or something that made TURN harder to use? Tell us what happened and what you expected.</p>
    <p>Feature ideas and improvement suggestions are welcome too. Feedback from every kind of player helps make TURN better for everyone. Mention your device, browser or assistive technology when it is relevant.</p>

    <div class="m8-feedback-actions">
      <a class="m8-feedback-email" href="mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}">EMAIL FEEDBACK</a>
      <button class="m8-feedback-copy" type="button">COPY EMAIL ADDRESS</button>
    </div>
    <p class="m8-feedback-status" role="status" aria-live="polite"></p>`;

  const copyButton = content.querySelector('.m8-feedback-copy');
  const status = content.querySelector('.m8-feedback-status');
  copyButton.addEventListener('click', () => copyEmailAddress(copyButton, status));

  return Object.freeze({
    element: content,
    clearStatus() {
      status.textContent = '';
    }
  });
}
