/**
 * IN-NOLA Membership Portal - Certificate & QR Code Generation
 * Uses server-generated QR signature from session
 */

/**
 * Generate QR code data for a member using server signature
 * Static QR format: only member ID + signature (no expiration)
 * @param {Object} member - Member object with qrSignature from server
 * @returns {Object} QR data object
 */
function generateQRData(member) {
    return {
        v: 1,                          // Version
        id: member.id,                 // Member ID
        sig: member.qrSignature        // Server-generated HMAC signature
    };
}

/**
 * Create QR code element
 * @param {Object} member - Member object
 * @param {HTMLElement} container - Container element for QR code
 */
function createQRCode(member, container) {
    const qrData = generateQRData(member);
    const qrString = JSON.stringify(qrData);

    // Clear any existing QR code
    container.innerHTML = '';

    // Check if QRCode library is available
    if (typeof QRCode === 'undefined') {
        container.innerHTML = '<p style="color: red;">QR Code library not loaded</p>';
        return;
    }

    // Generate QR code
    new QRCode(container, {
        text: qrString,
        width: 200,
        height: 200,
        colorDark: '#0d2818',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
    });
}

/**
 * Format date for display
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Render the certificate for a member
 * @param {Object} member - Member object
 */
function renderCertificate(member) {
    // Set member name
    document.getElementById('memberName').textContent = member.name;

    // Set member type with appropriate class
    const typeEl = document.getElementById('memberType');
    typeEl.textContent = member.memberType + ' Member';
    if (member.memberType === 'Lifetime') {
        typeEl.classList.add('lifetime');
    }

    // Set dates
    document.getElementById('joinDate').textContent = formatDate(member.joinDate);

    const expDateEl = document.getElementById('expirationDate');
    if (member.memberType === 'Lifetime') {
        expDateEl.textContent = 'Never';
    } else {
        expDateEl.textContent = formatDate(member.expirationDate);
    }

    // Check if membership is valid and show warning if expired
    if (!window.Auth.isMembershipValid()) {
        const warningEl = document.createElement('div');
        warningEl.className = 'message error show';
        warningEl.textContent = 'Your membership has expired. Please renew to maintain benefits.';
        document.querySelector('.certificate-header').after(warningEl);
    }

    // Generate QR code
    const qrContainer = document.getElementById('qrCode');
    createQRCode(member, qrContainer);
}

// Export for use in other modules
window.Certificate = {
    generateQRData,
    createQRCode,
    formatDate,
    renderCertificate
};
