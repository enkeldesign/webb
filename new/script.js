const copyButton = document.querySelector("[data-copy-email]");
const copyStatus = document.querySelector("#copy-status");

if (copyButton && copyStatus) {
  const originalLabel = copyButton.textContent;
  copyButton.hidden = false;

  copyButton.addEventListener("click", async () => {
    const email = copyButton.dataset.copyEmail;

    try {
      await navigator.clipboard.writeText(email);
      copyButton.textContent = "Kopierad";
      copyStatus.textContent = `E-postadressen ${email} har kopierats.`;

      window.setTimeout(() => {
        copyButton.textContent = originalLabel;
      }, 2500);
    } catch {
      copyStatus.textContent = `Det gick inte att kopiera. Adressen är ${email}.`;
    }
  });
}
