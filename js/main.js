document.addEventListener('DOMContentLoaded', () => {

  // Function to determine the correct asset path prefix
  function getPathPrefix() {
    const path = window.location.pathname;
    const pathSegments = path.split('/').filter(segment => segment.length > 0 && !segment.endsWith('.html'));
    const depth = pathSegments.length;

    if (depth === 0) {
      return './';
    }
    return '../'.repeat(depth);
  }

  const pathPrefix = getPathPrefix();

  // 1. Fetch and inject the header
  fetch(`${pathPrefix}header.html`)
    .then(response => {
      if (!response.ok) throw new Error(`Could not fetch header.html from ${pathPrefix}header.html`);
      return response.text();
    })
    .then(data => {
      const headerPlaceholder = document.getElementById('main-header-placeholder');
      if (headerPlaceholder) {
        headerPlaceholder.innerHTML = data;
        setActiveNavLink();
      }
    })
    .catch(error => console.error('Error injecting header:', error));

  // 2. Fetch and inject the footer
  fetch(`${pathPrefix}footer.html`)
    .then(response => {
      if (!response.ok) throw new Error(`Could not fetch footer.html from ${pathPrefix}footer.html`);
      return response.text();
    })
    .then(data => {
      const footerPlaceholder = document.getElementById('main-footer-placeholder');
      if (footerPlaceholder) {
        footerPlaceholder.innerHTML = data;
      }
    })
    .catch(error => console.error('Error injecting footer:', error));

  // 3. Set the active navigation link
  function setActiveNavLink() {
    const navLinks = document.querySelectorAll('.nav-link');
    const currentPage = window.location.pathname;

    let activeLink = null;

    navLinks.forEach(link => {
      const linkUrl = new URL(link.href);
      const linkPath = linkUrl.pathname;
      
      // Normalize paths to remove 'index.html' for comparison
      const normLinkPath = linkPath.endsWith('/index.html') ? linkPath.slice(0, -10) : linkPath;
      const normCurrentPath = currentPage.endsWith('/index.html') ? currentPage.slice(0, -10) : currentPage;

      if (normLinkPath === normCurrentPath) {
        activeLink = link;
        return; // Exact match found, no need to check further
      }
    });

    if (activeLink) {
      activeLink.classList.add('active');
    } else { // Fallback for root
      const homeLink = document.querySelector('.nav-link[href$="index.html"]');
      if (homeLink && (currentPage === '/' || currentPage.endsWith('/index.html'))) {
          homeLink.classList.add('active');
      }
    }
  }
  
  // 4. Fade in main content
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    const isHomePage = document.body.id === 'landing';
    const fadeInDelay = isHomePage ? 2000 : 100;
    setTimeout(() => mainContent.classList.add('fade-in'), fadeInDelay);
  }

  // 5. Event card toggle logic
  document.querySelectorAll('.event-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.more-btn')) return;
      card.classList.toggle('open');
      const symbol = card.querySelector('.event-header .toggle');
      if (symbol) {
        symbol.textContent = card.classList.contains('open') ? '−' : '+';
      }
    });
  });
});

