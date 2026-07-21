/**
 * Site-wide session helper (window.Session).
 *
 * The one canonical login session lives in localStorage under
 * 'innola_member_session' (written by whichever login door the user uses).
 * This helper reads it and mirrors it into the legacy sessionStorage keys that
 * admin-auth.js and the older admin pages still expect — so a single login is
 * recognised everywhere, regardless of which page reads which store.
 */
(function () {
  var AUTH_KEY = 'innola_member_session';

  function getSession() {
    try {
      var raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s.expiresAt && Date.now() > s.expiresAt) {
        localStorage.removeItem(AUTH_KEY);
        return null;
      }
      return s;
    } catch (e) {
      return null;
    }
  }

  function isActive() {
    var s = getSession();
    if (!s) return false;
    if (s.role === 'board' || s.role === 'architect') return true;
    if (!s.expirationDate) return false;
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return new Date(s.expirationDate) >= t;
  }

  // Mirror the canonical session into the legacy sessionStorage keys.
  function hydrate() {
    var s = getSession();
    if (s && sessionStorage.getItem('boardAuth') !== 'true') {
      sessionStorage.setItem('boardAuth', 'true');
      sessionStorage.setItem('boardUser', s.username || '');
      sessionStorage.setItem('userRole', s.role || '');
      sessionStorage.setItem('adminPassword', s.apiToken || '');
      sessionStorage.setItem('displayName', s.displayName || s.name || '');
      sessionStorage.setItem('boardId', s.boardId || '');
      sessionStorage.setItem('userEmail', s.email || '');
    } else if (!s && sessionStorage.getItem('boardAuth') === 'true') {
      // Canonical session gone (expired/logged out elsewhere) — clear the mirror.
      clearMirror();
    }
  }

  function clearMirror() {
    ['boardAuth', 'boardUser', 'userRole', 'adminPassword', 'displayName', 'boardId', 'userEmail']
      .forEach(function (k) { sessionStorage.removeItem(k); });
  }

  function logout() {
    localStorage.removeItem(AUTH_KEY);
    clearMirror();
  }

  window.Session = {
    getSession: getSession,
    isLoggedIn: function () { return !!getSession(); },
    role: function () { var s = getSession(); return s ? s.role : null; },
    username: function () { var s = getSession(); return s ? s.username : ''; },
    displayName: function () { var s = getSession(); return s ? (s.displayName || s.name || '') : ''; },
    memberId: function () { var s = getSession(); return s ? s.memberId : null; },
    apiToken: function () { var s = getSession(); return s ? s.apiToken : ''; },
    email: function () { var s = getSession(); return s ? s.email : ''; },
    isActive: isActive,
    isMember: function () { var r = this.role(); return r === 'member' || r === 'board' || r === 'architect'; },
    isBoard: function () { var r = this.role(); return r === 'board' || r === 'architect'; },
    isArchitect: function () { return this.role() === 'architect'; },
    hydrate: hydrate,
    logout: logout
  };

  // Run immediately so downstream scripts (admin-auth.js) see a hydrated session.
  hydrate();
})();


document.addEventListener('DOMContentLoaded', () => {

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

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

  // 1. Fetch and inject header/footer (skip if already inlined)
  const headerPlaceholder = document.getElementById('main-header-placeholder');
  if (headerPlaceholder) {
    fetch(`${pathPrefix}header.html`)
      .then(response => {
        if (!response.ok) throw new Error(`Could not fetch header.html from ${pathPrefix}header.html`);
        return response.text();
      })
      .then(data => {
        headerPlaceholder.innerHTML = data;
        setActiveNavLink();
      })
      .catch(error => console.error('Error injecting header:', error));
  } else {
    setActiveNavLink();
  }

  const footerPlaceholder = document.getElementById('main-footer-placeholder');
  if (footerPlaceholder) {
    fetch(`${pathPrefix}footer.html`)
      .then(response => {
        if (!response.ok) throw new Error(`Could not fetch footer.html from ${pathPrefix}footer.html`);
        return response.text();
      })
      .then(data => {
        footerPlaceholder.innerHTML = data;
      })
      .catch(error => console.error('Error injecting footer:', error));
  }

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

  // 4. Inject the floating account / login control (single, role-aware door)
  if (!document.querySelector('.floating-actions')) {
    const S = window.Session;
    const div = document.createElement('div');
    div.className = 'floating-actions';

    if (S && S.isLoggedIn()) {
      const first = escapeHtml((S.displayName() || 'Member').split(' ')[0]);
      let html =
        `<a href="${pathPrefix}membership-tools/certificate.html" class="floating-btn floating-btn-primary">` +
        `<span class="floating-btn-icon">☘</span> ${first}</a>`;
      if (S.isBoard()) {
        html +=
          `<a href="${pathPrefix}admin-portal/home.html" class="floating-btn floating-btn-tertiary">` +
          `<span class="floating-btn-icon">📋</span> Admin</a>`;
      }
      html +=
        `<button type="button" class="floating-btn floating-btn-secondary" id="sessionLogoutBtn">` +
        `<span class="floating-btn-icon">⏻</span> Log Out</button>`;
      div.innerHTML = html;
      document.body.appendChild(div);
      const lb = document.getElementById('sessionLogoutBtn');
      if (lb) lb.addEventListener('click', () => { S.logout(); window.location.reload(); });
    } else {
      const ret = encodeURIComponent(window.location.pathname + window.location.search);
      div.innerHTML =
        `<a href="${pathPrefix}membership-tools/index.html?return=${ret}" class="floating-btn floating-btn-primary">` +
        `<span class="floating-btn-icon">☘</span> Log In</a>`;
      document.body.appendChild(div);
    }
  }

  // 5. Fade in main content
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    const isHomePage = document.body.id === 'landing';
    const fadeInDelay = isHomePage ? 2800 : 100;
    setTimeout(() => mainContent.classList.add('fade-in'), fadeInDelay);
  }

  // 6. Event card toggle logic
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
