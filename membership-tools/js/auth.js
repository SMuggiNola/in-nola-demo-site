/**
 * IN-NOLA Membership Portal - Authentication Logic
 */

const AUTH_KEY = 'innola_member_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Attempt to log in a member
 * @param {string} email
 * @param {string} password
 * @returns {Object} Result with success status and member/error
 */
function login(email, password) {
    const member = window.MembersDB.findMemberByEmail(email);

    if (!member) {
        return { success: false, error: 'Invalid email or password' };
    }

    if (member.password !== password) {
        return { success: false, error: 'Invalid email or password' };
    }

    // Create session
    const session = {
        memberId: member.id,
        email: member.email,
        name: member.name,
        loginTime: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION
    };

    localStorage.setItem(AUTH_KEY, JSON.stringify(session));

    return { success: true, member: member };
}

/**
 * Check if user is currently logged in with valid session
 * @returns {Object|null} Session object or null
 */
function getSession() {
    const sessionStr = localStorage.getItem(AUTH_KEY);
    if (!sessionStr) return null;

    try {
        const session = JSON.parse(sessionStr);

        // Check if session has expired
        if (Date.now() > session.expiresAt) {
            logout();
            return null;
        }

        return session;
    } catch (e) {
        logout();
        return null;
    }
}

/**
 * Get the current logged-in member's data
 * @returns {Object|null} Member object or null
 */
function getCurrentMember() {
    const session = getSession();
    if (!session) return null;

    return window.MembersDB.findMemberById(session.memberId);
}

/**
 * Log out the current user
 */
function logout() {
    localStorage.removeItem(AUTH_KEY);
}

/**
 * Require authentication - redirect to login if not authenticated
 * @param {string} redirectUrl - URL to redirect to if not authenticated
 */
function requireAuth(redirectUrl = 'index.html') {
    if (!getSession()) {
        window.location.href = redirectUrl;
        return false;
    }
    return true;
}

/**
 * Redirect if already authenticated
 * @param {string} redirectUrl - URL to redirect to if authenticated
 */
function redirectIfAuthenticated(redirectUrl = 'certificate.html') {
    if (getSession()) {
        window.location.href = redirectUrl;
        return true;
    }
    return false;
}

// Export for use in other modules
window.Auth = {
    login,
    logout,
    getSession,
    getCurrentMember,
    requireAuth,
    redirectIfAuthenticated
};
