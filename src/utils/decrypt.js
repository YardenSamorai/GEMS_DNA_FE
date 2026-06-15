import CryptoJS from 'crypto-js';

// Throttle the noisy console warnings to once every few seconds so the
// devtools doesn't get flooded if a list of stones all fail to decrypt.
let lastWarn = 0;
const warnOnce = (msg, extra) => {
  const now = Date.now();
  if (now - lastWarn < 5000) return;
  lastWarn = now;
  console.warn(msg, extra || '');
};

export const decryptPrice = (encrypted) => {
  const secret = process.env.REACT_APP_ENCRYPT_SECRET;

  if (!secret) {
    warnOnce('⚠️ REACT_APP_ENCRYPT_SECRET is not set in this build. ' +
      'Set it in Vercel → Settings → Environment Variables and redeploy.');
    return 0;
  }
  if (!encrypted) return 0;

  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, secret);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    const num = parseFloat(decrypted);
    if (!Number.isFinite(num)) {
      warnOnce('🔐 Price decryption failed — FE/BE secret mismatch.');
      return 0;
    }
    return num;
  } catch (err) {
    warnOnce('❌ Decryption threw — secret mismatch?', err.message);
    return 0;
  }
};