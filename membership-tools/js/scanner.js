/**
 * IN-NOLA Membership Portal - QR Scanner & Verification
 */

let html5QrCode = null;
let isScanning = false;

/**
 * Verify QR code data
 * @param {string} qrString - Raw QR code string
 * @returns {Object} Verification result
 */
function verifyQRData(qrString) {
    try {
        const data = JSON.parse(qrString);

        // Check required fields
        if (!data.v || !data.id || !data.n || !data.e || !data.t || !data.sig) {
            return {
                valid: false,
                status: 'invalid',
                message: 'Invalid QR code format'
            };
        }

        // Verify signature
        const sigData = data.id + '|' + data.e + '|' + data.t;
        if (!window.MembersDB.verifySignature(sigData, data.sig)) {
            return {
                valid: false,
                status: 'invalid',
                message: 'QR code signature is invalid - possible tampering'
            };
        }

        // Check if member exists
        const member = window.MembersDB.findMemberById(data.id);
        if (!member) {
            return {
                valid: false,
                status: 'invalid',
                message: 'Member not found in database'
            };
        }

        // Check expiration
        const expirationDate = new Date(data.e);
        const today = new Date();

        if (expirationDate < today) {
            return {
                valid: false,
                status: 'expired',
                message: 'Membership has expired',
                member: {
                    id: member.id,
                    name: member.name,
                    type: member.memberType,
                    expiredOn: data.e
                }
            };
        }

        // Valid!
        return {
            valid: true,
            status: 'valid',
            message: 'Member in Good Standing',
            member: {
                id: member.id,
                name: member.name,
                type: member.memberType,
                validUntil: data.e
            }
        };

    } catch (e) {
        return {
            valid: false,
            status: 'invalid',
            message: 'Could not read QR code data'
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
            iconEl.textContent = '✓';
            break;
        case 'expired':
            iconEl.textContent = '⚠';
            break;
        case 'invalid':
            iconEl.textContent = '✗';
            break;
    }

    // Set status text
    textEl.textContent = result.message;

    // Set member info if available
    if (result.member) {
        let html = `
            <p><strong>Name:</strong> ${result.member.name}</p>
            <p><strong>ID:</strong> ${result.member.id}</p>
            <p><strong>Type:</strong> ${result.member.type}</p>
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
 * QR code scan success callback
 * @param {string} decodedText - Decoded QR code text
 */
function onScanSuccess(decodedText) {
    // Stop scanning
    stopScanner();

    // Verify and display result
    const result = verifyQRData(decodedText);
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
