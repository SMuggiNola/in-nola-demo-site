document.addEventListener('DOMContentLoaded', () => {
  // 1. Fetch and inject the header, then fix nav paths
  fetch('../header.html')
    .then(response => {
      if (!response.ok) throw new Error('Could not fetch header.html');
      return response.text();
    })
    .then(data => {
      const headerPlaceholder = document.getElementById('main-header-placeholder');
      if (headerPlaceholder) {
        headerPlaceholder.innerHTML = data;
        adjustNavPaths();
        setActiveNavLink();
      }
    })
    .catch(error => console.error('Error injecting header:', error));

  // 2. Adjust navigation paths for relative depth
  function adjustNavPaths() {
    const path = window.location.pathname;
    const isIndex = path.endsWith('/') || path.endsWith('/index.html');
    const depth = isIndex ? path.split('/').length - 2 : path.split('/').length - 2;

    if (depth > 0) {
      const prefix = '../'.repeat(depth);
      const navLinks = document.querySelectorAll('.nav-link');
      navLinks.forEach(link => {
        const originalHref = link.getAttribute('href');
        if (originalHref && !originalHref.startsWith('http')) {
          link.setAttribute('href', prefix + originalHref);
        }
      });
    }
  }

  // 3. Set the active navigation link
  function setActiveNavLink() {
    const navLinks = document.querySelectorAll('.nav-link');
    const currentPage = window.location.pathname;

    let highestMatchLength = 0;
    let activeLink = null;

    navLinks.forEach(link => {
      const linkPath = new URL(link.href).pathname;

      // Exact match for index pages
      if (linkPath.endsWith('index.html') && currentPage.endsWith('index.html') && linkPath === currentPage) {
        activeLink = link;
        return;
      }
      
      // Find the link that has the longest matching prefix for the current page
      if (!linkPath.endsWith('index.html') && currentPage.startsWith(linkPath)) {
        if (linkPath.length > highestMatchLength) {
          highestMatchLength = linkPath.length;
          activeLink = link;
        }
      }
    });

    if (activeLink) {
      activeLink.classList.add('active');
    } else {
      // Default to highlighting "Home" if no other link matches
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

