// LENS Lab width fix
// Runs after page load to constrain landing page containers
function fixWidth() {
  const sections = document.querySelectorAll(
    '.home-section.wg-markdown, .home-section.wg-people, .home-section.wg-contact'
  );
  sections.forEach(function(section) {
    const container = section.querySelector('.container');
    if (container) {
      container.style.setProperty('max-width', '740px', 'important');
      container.style.setProperty('width', '740px', 'important');
    }
  });
}

document.addEventListener('DOMContentLoaded', fixWidth);
window.addEventListener('load', fixWidth);
