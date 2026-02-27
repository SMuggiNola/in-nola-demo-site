/**
 * Shared admin authentication guard for IN-NOLA admin pages.
 *
 * Include this script on any page that requires board-member login.
 * It checks sessionStorage for a valid session and redirects to the
 * login page at /admin-portal/ if the user is not authenticated.
 *
 * Scanner role is restricted to scanner.html only.
 *
 * After login, the user is sent back to the page they originally tried to visit.
 */
(function () {
  if (sessionStorage.getItem('boardAuth') !== 'true') {
    var returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = '/admin-portal/index.html?return=' + returnUrl;
    return;
  }

  // Scanner role gate: can only access scanner.html
  if (sessionStorage.getItem('userRole') === 'scanner') {
    var onScannerPage = window.location.pathname.indexOf('scanner.html') !== -1;
    if (!onScannerPage) {
      window.location.href = '/membership-tools/scanner.html';
    }
  }
})();

/** Return the stored admin password for use in API calls. */
function getAdminPassword() {
  return sessionStorage.getItem('adminPassword') || '';
}

/** Return the logged-in user's role ('admin', 'board', or 'scanner'). */
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
