/**
 * IN-NOLA Membership Portal - Authentication Logic
 * Uses backend API for authentication
 */

const AUTH_KEY = 'innola_member_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Attempt to log in a member via API
 * @param {string} username
 * @param {string} pin
 * @returns {Promise<Object>} Result with success status and member/error
 */
async function login(username, pin) {
    try {
        const response = await fetch('/api/members/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, pin })
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || 'Invalid username or PIN' };
        }

        // Create session with member data from API
        const session = {
            memberId: data.member.id,
            name: data.member.name,
            email: data.member.email,
            memberType: data.member.memberType,
            joinDate: data.member.joinDate,
            expirationDate: data.member.expirationDate,
            qrSignature: data.member.qrSignature,
            loginTime: Date.now(),
            expiresAt: Date.now() + SESSION_DURATION
        };

        localStorage.setItem(AUTH_KEY, JSON.stringify(session));

        return { success: true, member: data.member };

    } catch (error) {
        // For local development fallback
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
    if (!session) return null;

    // Return member data from session (populated by API at login)
    return {
        id: session.memberId,
        name: session.name,
        email: session.email,
        memberType: session.memberType,
        joinDate: session.joinDate,
        expirationDate: session.expirationDate,
        qrSignature: session.qrSignature
    };
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
    isMembershipValid,
    requireAuth,
    redirectIfAuthenticated
};
