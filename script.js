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

      if (isDarkMode) {
        updateThemeColor('#313131');

        themeFeedback.textContent = 'Mörkt färgschema. Dark theme.';
      } else {
        updateThemeColor('#f4f4f4');

        themeFeedback.textContent = 'Ljust färgschema. Light theme.';
      }
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