document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  const themeFeedback = document.getElementById('sr-theme-feedback');
  if (!themeToggle) return;
  const updateThemeColor = (color) => {
    const themeMetaTags = document.querySelectorAll('meta[name="theme-color"][data-user-theme]');
    if (themeMetaTags.length === 0) {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('data-user-theme', 'true');
      meta.setAttribute('content', color);
      document.head.appendChild(meta);
    } else {
      themeMetaTags.forEach(meta => meta.setAttribute('content', color));
    }
  };
  const updateThemeFeedback = (isDark) => {
    const messages = {
      dark: { text: 'Dark mode activated.', lang: 'sv' },
      light: { text: 'Light mode activated.', lang: 'sv' }
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
    .then(() => {
      alert(`${email} copied to clipboard.`);
    })
    .catch(err => {
      console.error('Error copying text:', err);
    });
};