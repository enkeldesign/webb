document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll("meta[name='theme-color'][media]").forEach(el => el.remove());
  const themeToggle = document.getElementById('theme-toggle');
  const themeFeedback = document.getElementById('sr-theme-feedback');
  if (!themeToggle) return;
  const updateThemeColor = color => {
    let meta = document.querySelector("meta[name='theme-color']");
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', color);
  };
  const updateThemeFeedback = isDark => {
    const msgs = {
      dark: { text: 'Mörkt färgschema aktiverat.', lang: 'sv' },
      light: { text: 'Ljust färgschema aktiverat.', lang: 'sv' }
    };
    const { text, lang } = isDark ? msgs.dark : msgs.light;
    themeFeedback.setAttribute('lang', lang);
    themeFeedback.textContent = text;
  };
  const handleThemeToggleChange = e => {
    const isDark = e.target.checked;
    e.target.setAttribute('aria-checked', isDark.toString());
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    updateThemeColor(isDark ? '#313131' : '#f4f4f4');
    updateThemeFeedback(isDark);
  };
  const handleThemeToggleKeydown = e => {
    if (e.key === 'Enter') {
      e.target.checked = !e.target.checked;
      e.preventDefault();
      e.target.dispatchEvent(new Event('change'));
    }
  };
  themeToggle.addEventListener('change', handleThemeToggleChange);
  themeToggle.addEventListener('keydown', handleThemeToggleKeydown);
});
const copyEmail = () => {
  const email = "erik@enkel.design";
  navigator.clipboard.writeText(email)
    .then(() => { alert(`${email} kopierat till urklipp.`); })
    .catch(err => { console.error('Error copying text:', err); });
};