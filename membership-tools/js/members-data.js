/**
 * IN-NOLA Membership Portal - Mock Member Database
 * This is a client-side POC. Production would use a secure backend.
 */

const MEMBERS_DB = {
    // Demo members with various statuses
    members: [
        {
            id: 'MEM-2025-001',
            email: 'john.murphy@example.com',
            password: 'demo123', // In production, this would be hashed on server
            name: 'John Murphy',
            memberType: 'Individual',
            joinDate: '2025-01-15',
            expirationDate: '2027-01-15',
            status: 'active'
        },
        {
            id: 'MEM-2025-002',
            email: 'mary.oconnor@example.com',
            password: 'demo456',
            name: "Mary O'Connor",
            memberType: 'Family',
            joinDate: '2025-02-20',
            expirationDate: '2027-02-20',
            status: 'active'
        },
        {
            id: 'MEM-2023-015',
            email: 'patrick.walsh@example.com',
            password: 'demo789',
            name: 'Patrick Walsh',
            memberType: 'Lifetime',
            joinDate: '2023-06-10',
            expirationDate: '2099-12-31', // Lifetime members never expire
            status: 'active'
        },
        {
            id: 'MEM-2024-042',
            email: 'sean.brennan@example.com',
            password: 'expired1',
            name: 'Sean Brennan',
            memberType: 'Individual',
            joinDate: '2024-12-01',
            expirationDate: '2025-12-01', // Expired
            status: 'expired'
        }
    ],

    // Admin PINs for scanner access
    adminPins: ['112233', '445566', '778899'],

    // Secret key for signature generation (POC only - not secure)
    signatureKey: 'innola-poc-2024'
};

/**
 * Find a member by email
 * @param {string} email
 * @returns {Object|null} Member object or null
 */
function findMemberByEmail(email) {
    return MEMBERS_DB.members.find(m => m.email.toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Find a member by ID
 * @param {string} id
 * @returns {Object|null} Member object or null
 */
function findMemberById(id) {
    return MEMBERS_DB.members.find(m => m.id === id) || null;
}

/**
 * Validate admin PIN
 * @param {string} pin
 * @returns {boolean}
 */
function validateAdminPin(pin) {
    return MEMBERS_DB.adminPins.includes(pin);
}

/**
 * Check if a member's membership is currently valid
 * @param {Object} member
 * @returns {boolean}
 */
function isMembershipValid(member) {
    if (!member) return false;
    const today = new Date();
    const expDate = new Date(member.expirationDate);
    return expDate >= today;
}

/**
 * Generate a simple signature for QR data (POC only)
 * In production, this would be a cryptographic signature from the server
 * @param {string} data
 * @returns {string}
 */
function generateSignature(data) {
    // Simple hash-like function for POC
    let hash = 0;
    const str = data + MEMBERS_DB.signatureKey;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
}

/**
 * Verify a signature
 * @param {string} data
 * @param {string} signature
 * @returns {boolean}
 */
function verifySignature(data, signature) {
    return generateSignature(data) === signature;
}

// Export for use in other modules
window.MembersDB = {
    findMemberByEmail,
    findMemberById,
    validateAdminPin,
    isMembershipValid,
    generateSignature,
    verifySignature
};
