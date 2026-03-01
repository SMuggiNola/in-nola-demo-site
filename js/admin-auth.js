/**
 * Shared admin authentication guard for IN-NOLA admin pages.
 *
 * Include this script on any page that requires board-member login.
 * It checks sessionStorage for a valid session and redirects to the
 * login page at /admin-portal/ if the user is not authenticated.
 *
 * Role gates:
 *   - scanner → scanner.html only
 *   - member  → /membership-tools/ pages only
 *
 * After login, the user is sent back to the page they originally tried to visit.
 */
(function () {
  if (sessionStorage.getItem('boardAuth') !== 'true') {
    var returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = '/admin-portal/index.html?return=' + returnUrl;
    return;
  }

  var role = sessionStorage.getItem('userRole');

  // Scanner role gate: can only access scanner page
  if (role === 'scanner') {
    var onScannerPage = /\/scanner(\.html)?$/.test(window.location.pathname);
    if (!onScannerPage) {
      window.location.href = '/membership-tools/scanner.html';
    }
  }

  // Member role gate: can only access /membership-tools/ pages
  if (role === 'member') {
    var onMemberPage = window.location.pathname.indexOf('/membership-tools/') !== -1;
    if (!onMemberPage) {
      window.location.href = '/membership-tools/certificate.html';
    }
  }
})();

/** Return the stored admin password for use in API calls. */
function getAdminPassword() {
  return sessionStorage.getItem('adminPassword') || '';
}

/** Return the logged-in user's role ('architect', 'board', 'scanner', or 'member'). */
function getUserRole() {
  return sessionStorage.getItem('userRole');
}

/** Return the logged-in user's display name. */
function getDisplayName() {
  return sessionStorage.getItem('displayName') || '';
}

/** Return the logged-in user's board member ID (e.g. 'shannon'). */
function getBoardId() {
  return sessionStorage.getItem('boardId') || null;
}

/** Clear all admin session data and redirect to login. */
function adminLogout() {
  sessionStorage.removeItem('boardAuth');
  sessionStorage.removeItem('boardUser');
  sessionStorage.removeItem('userRole');
  sessionStorage.removeItem('adminPassword');
  sessionStorage.removeItem('displayName');
  sessionStorage.removeItem('boardId');
  window.location.href = '/admin-portal/index.html';
}
