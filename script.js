document.addEventListener('DOMContentLoaded', function() {
    const themeToggle = document.querySelector('footer input[type="checkbox"]');
    if (themeToggle) {
        themeToggle.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                this.checked = !this.checked;
                event.preventDefault();
            }
        });
    }
});
