document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll(
    '.home-section.wg-markdown .container, .home-section.wg-people .container, .home-section.wg-contact .container'
  ).forEach(function(el) {
    el.style.setProperty('max-width', '740px', 'important');
    el.style.setProperty('width', '740px', 'important');
  });
});
