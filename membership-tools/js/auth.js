/**
 * IN-NOLA Membership Portal - Authentication Logic
 * Uses unified /api/auth endpoint for all logins
 */

const AUTH_KEY = 'innola_member_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Attempt to log in via unified /api/auth
 * @param {string} username
 * @param {string} password
 * @returns {Promise<Object>} Result with success status and user/error
 */
async function login(username, password) {
    try {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || 'Invalid username or PIN' };
        }

        const user = data.user;

        // Create session with membership + role data from API
        const session = {
            username: user.username,
            role: user.role,
            displayName: user.displayName,
            boardId: user.boardId,
            memberId: user.memberId,
            name: user.displayName,
            email: user.email || '',
            memberType: user.memberType,
            joinDate: user.joinDate,
            expirationDate: user.expirationDate,
            qrSignature: user.qrSignature,
            apiToken: data.apiToken,
            loginTime: Date.now(),
            expiresAt: Date.now() + SESSION_DURATION
        };

        localStorage.setItem(AUTH_KEY, JSON.stringify(session));

        return { success: true, user: user };

    } catch (error) {
        console.warn('API login failed, running locally?', error);
        return { success: false, error: 'Cannot connect to server. Please use the deployed site.' };
    }
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
 * Get the current logged-in member's data from session
 * @returns {Object|null} Member object or null
 */
function getCurrentMember() {
    const session = getSession();
    if (!session || !session.memberId) return null;

    return {
        id: session.memberId,
        name: session.displayName || session.name,
        email: session.email,
        memberType: session.memberType,
        joinDate: session.joinDate,
        expirationDate: session.expirationDate,
        qrSignature: session.qrSignature
    };
}

/**
 * Get the current user's role
 * @returns {string|null} Role string or null
 */
function getUserRole() {
    const session = getSession();
    return session ? session.role : null;
}

/**
 * Check if current member's membership is valid
 * @returns {boolean}
 */
function isMembershipValid() {
    const member = getCurrentMember();
    if (!member) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(member.expirationDate);
    return expDate >= today;
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
    getUserRole,
    isMembershipValid,
    requireAuth,
    redirectIfAuthenticated
};
