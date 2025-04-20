import CryptoJS from 'crypto-js';

export const decryptPrice = (encrypted) => {
  console.log('🧪 Encrypted input:', encrypted);

  const secret = process.env.REACT_APP_ENCRYPT_SECRET;
  console.log('🔑 Secret in FE:', secret);

  if (!secret || !encrypted) {
    console.warn('⚠️ Missing secret or encrypted value');
    return 0;
  }

  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, secret);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    console.log('🧩 Decrypted string:', decrypted);

    return parseFloat(decrypted);
  } catch (err) {
    console.error('❌ Decryption failed:', err);
    return 0;
  }
};