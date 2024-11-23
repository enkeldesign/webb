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


    function updateThemeFeedback(isDarkMode) {
      const messages = {
        dark: {
          text: 'Mörkt färgschema aktiverat.',
          lang: 'sv'
        },
        light: {
          text: 'Ljust färgschema aktiverat.',
          lang: 'sv'
        },
      };

      const message = isDarkMode ? messages.dark : messages.light;
      themeFeedback.setAttribute('lang', message.lang);
      themeFeedback.textContent = message.text;
    }


    themeToggle.addEventListener('change', function() {
      const isDarkMode = this.checked;
      this.setAttribute('aria-checked', isDarkMode.toString());


      updateThemeColor(isDarkMode ? '#313131' : '#f4f4f4');
      updateThemeFeedback(isDarkMode);
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


function copyEmail() {
  const email = "erik@enkel.design";
  navigator.clipboard.writeText(email)
    .then(() => {
      alert("erik@enkel.design kopierat till urklipp.");
    })
    .catch(err => {
      console.error('Error copying text: ', err);
    });
}