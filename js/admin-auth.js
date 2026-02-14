/**
 * Shared admin authentication guard for IN-NOLA admin pages.
 *
 * Include this script on any page that requires board-member login.
 * It checks sessionStorage for a valid session and redirects to the
 * login page at /admin-portal/ if the user is not authenticated.
 *
 * After login, the user is sent back to the page they originally tried to visit.
 */
(function () {
  if (sessionStorage.getItem('boardAuth') !== 'true') {
    var returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = '/admin-portal/index.html?return=' + returnUrl;
  }
})();

/** Return the stored admin password for use in API calls. */
function getAdminPassword() {
  return sessionStorage.getItem('adminPassword') || '';
}

/** Return the logged-in user's role ('admin' or 'board'). */
function getUserRole() {
  return sessionStorage.getItem('userRole');
}

/** Clear all admin session data and redirect to login. */
function adminLogout() {
  sessionStorage.removeItem('boardAuth');
  sessionStorage.removeItem('boardUser');
  sessionStorage.removeItem('userRole');
  sessionStorage.removeItem('adminPassword');
  window.location.href = '/admin-portal/index.html';
}
