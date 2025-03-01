document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  const themeFeedback = document.getElementById('sr-theme-feedback');

  if (!themeToggle) return;

  const updateThemeColor = (color) => {
    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.remove();
    themeMeta = document.createElement('meta');
    themeMeta.setAttribute('name', 'theme-color');
    themeMeta.setAttribute('content', color);
    document.head.appendChild(themeMeta);
  };

  const updateThemeFeedback = (isDark) => {
    const messages = {
      dark: { text: 'Mörkt färgschema aktiverat.', lang: 'sv' },
      light: { text: 'Ljust färgschema aktiverat.', lang: 'sv' },
    };
    const { text, lang } = isDark ? messages.dark : messages.light;
    themeFeedback.setAttribute('lang', lang);
    themeFeedback.textContent = text;
  };

  const handleThemeToggleChange = (event) => {
    const isDark = event.target.checked;
    event.target.setAttribute('aria-checked', isDark.toString());
    updateThemeColor(isDark ? '#313131' : '#f4f4f4');
    updateThemeFeedback(isDark);
  };

  const handleThemeToggleKeydown = (event) => {
    if (event.key === 'Enter') {
      event.target.checked = !event.target.checked;
      event.preventDefault();
      event.target.dispatchEvent(new Event('change'));
    }
  };

  themeToggle.addEventListener('change', handleThemeToggleChange);
  themeToggle.addEventListener('keydown', handleThemeToggleKeydown);
});

const copyEmail = () => {
  const email = "erik@enkel.design";
  navigator.clipboard.writeText(email)
    .then(() => alert(`${email} kopierat till urklipp.`))
    .catch(err => console.error('Error copying text:', err));
};