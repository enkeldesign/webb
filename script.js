document.addEventListener('DOMContentLoaded', function() {
  const themeToggle = document.getElementById('theme-toggle');
  const themeFeedback = document.getElementById('sr-theme-feedback');

  if (themeToggle) {
    function updateThemeColor(color) {
      let themeColorMetaTag = document.querySelector('meta[name="theme-color"][data-user-theme]');
      if (!themeColorMetaTag) {
        themeColorMetaTag = document.createElement('meta');
        themeColorMetaTag.setAttribute('name', 'theme-color');
        themeColorMetaTag.setAttribute('data-user-theme', 'true');
        document.head.appendChild(themeColorMetaTag);
      }
      themeColorMetaTag.setAttribute('content', color);
    }

    themeToggle.addEventListener('change', function() {
      const isDarkMode = this.checked;
      this.setAttribute('aria-checked', isDarkMode.toString());

      let message = '';

      if (isDarkMode) {
        updateThemeColor('#313131');
        message = 'Mörkt färgschema aktiverat.';
      } else {
        updateThemeColor('#f4f4f4');
        message = 'Ljust färgschema aktiverat.';
      }


      themeFeedback.setAttribute('lang', 'sv');
      themeFeedback.setAttribute('aria-atomic', 'true');
      themeFeedback.textContent = message;
    });

    themeToggle.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        this.checked = !this.checked;
        event.preventDefault();
        const changeEvent = new Event('change');
        this.dispatchEvent(changeEvent);
      }
    });
  }
});