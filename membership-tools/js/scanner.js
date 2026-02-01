/**
 * IN-NOLA Membership Portal - QR Scanner & Verification
 * Uses backend API for verification
 */

let html5QrCode = null;
let isScanning = false;

/**
 * Verify QR code data via API
 * @param {string} qrString - Raw QR code string
 * @returns {Promise<Object>} Verification result
 */
async function verifyQRData(qrString) {
    try {
        const data = JSON.parse(qrString);

        // Check required fields for static QR format
        if (!data.v || !data.id || !data.sig) {
            return {
                valid: false,
                status: 'invalid',
                message: 'Invalid QR code format'
            };
        }

        // Call API to verify
        const response = await fetch(
            `/api/members/verify?id=${encodeURIComponent(data.id)}&sig=${encodeURIComponent(data.sig)}`
        );

        const result = await response.json();
        return result;

    } catch (e) {
        // Check if it's a JSON parse error
        if (e instanceof SyntaxError) {
            return {
                valid: false,
                status: 'invalid',
                message: 'Could not read QR code data'
            };
        }

        // Network error
        return {
            valid: false,
            status: 'error',
            message: 'Cannot connect to verification server'
        };
    }
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
 * Display verification result
 * @param {Object} result - Verification result object
 */
function showResult(result) {
    const resultEl = document.getElementById('verificationResult');
    const iconEl = document.getElementById('statusIcon');
    const textEl = document.getElementById('statusText');
    const infoEl = document.getElementById('memberInfo');

    // Set status class
    resultEl.className = 'verification-result show ' + result.status;

    // Set icon
    switch (result.status) {
        case 'valid':
            iconEl.textContent = '\u2713';
            break;
        case 'expired':
            iconEl.textContent = '\u26A0';
            break;
        case 'invalid':
        case 'error':
            iconEl.textContent = '\u2717';
            break;
    }

    // Set status text
    textEl.textContent = result.message;

    // Set member info if available
    if (result.member) {
        let html = `
            <p><strong>Name:</strong> ${escapeHtml(result.member.name)}</p>
            <p><strong>ID:</strong> ${escapeHtml(result.member.id)}</p>
            <p><strong>Type:</strong> ${escapeHtml(result.member.type)}</p>
        `;

        if (result.status === 'valid') {
            html += `<p><strong>Valid Until:</strong> ${formatDate(result.member.validUntil)}</p>`;
        } else if (result.status === 'expired') {
            html += `<p><strong>Expired On:</strong> ${formatDate(result.member.expiredOn)}</p>`;
        }

        infoEl.innerHTML = html;
        infoEl.style.display = 'block';
    } else {
        infoEl.style.display = 'none';
    }

    resultEl.style.display = 'block';
}

/**
 * Hide the result display
 */
function hideResult() {
    document.getElementById('verificationResult').style.display = 'none';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * QR code scan success callback
 * @param {string} decodedText - Decoded QR code text
 */
async function onScanSuccess(decodedText) {
    // Stop scanning
    stopScanner();

    // Verify and display result
    const result = await verifyQRData(decodedText);
    showResult(result);

    // Play sound feedback (if available)
    try {
        const audio = new AudioContext();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.frequency.value = result.valid ? 800 : 300;
        gain.gain.value = 0.1;
        oscillator.start();
        setTimeout(() => oscillator.stop(), 150);
    } catch (e) {
        // Audio not available, ignore
    }
}

/**
 * Start the QR scanner
 */
function startScanner() {
    if (isScanning) return;

    hideResult();

    const readerEl = document.getElementById('reader');
    readerEl.style.display = 'block';

    html5QrCode = new Html5Qrcode('reader');

    html5QrCode.start(
        { facingMode: 'environment' }, // Back camera
        {
            fps: 10,
            qrbox: { width: 250, height: 250 }
        },
        onScanSuccess,
        (errorMessage) => {
            // Ignore scan errors - just means no QR found yet
        }
    ).then(() => {
        isScanning = true;
        document.getElementById('startScanBtn').style.display = 'none';
        document.getElementById('stopScanBtn').style.display = 'inline-block';
    }).catch((err) => {
        console.error('Error starting scanner:', err);
        alert('Could not start camera. Please ensure camera permissions are granted.');
    });
}

/**
 * Stop the QR scanner
 */
function stopScanner() {
    if (!isScanning || !html5QrCode) return;

    html5QrCode.stop().then(() => {
        isScanning = false;
        document.getElementById('reader').style.display = 'none';
        document.getElementById('startScanBtn').style.display = 'inline-block';
        document.getElementById('stopScanBtn').style.display = 'none';
    }).catch((err) => {
        console.error('Error stopping scanner:', err);
    });
}

/**
 * Reset scanner to scan again
 */
function scanAgain() {
    hideResult();
    startScanner();
}

// Export for use in HTML
window.Scanner = {
    verifyQRData,
    showResult,
    hideResult,
    startScanner,
    stopScanner,
    scanAgain
};
