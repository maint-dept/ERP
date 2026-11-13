/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Cryptographic Utility & Password Hashing Service
 * Implements salted SHA-256 hashing to ensure passwords are never stored in plain text.
 */

class CryptoService {
  /**
   * Generate a random hex salt of specified length
   */
  generateSalt(length = 16) {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const array = new Uint8Array(length);
      window.crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    // Fallback pseudo-random generator
    let salt = '';
    const chars = '0123456789abcdef';
    for (let i = 0; i < length * 2; i++) {
      salt += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return salt;
  }

  /**
   * Helper to encode strings to standard UTF-8 binary string
   * Ensures seamless unicode support (emojis, non-Latin scripts, symbols)
   */
  _toUtf8(str) {
    if (typeof str !== 'string') str = String(str || '');
    try {
      return unescape(encodeURIComponent(str));
    } catch (_) {
      return str;
    }
  }

  /**
   * Synchronous SHA-256 hashing implementation
   */
  sha256Sync(input) {
    let ascii = this._toUtf8(input);
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }

    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let lengthProperty = 'length';
    let i, j;
    let result = '';

    const words = [];
    const asciiBitLength = ascii[lengthProperty] * 8;

    let hash = [];
    let k = [];

    let primeCounter = 0;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) {
          isComposite[i] = candidate;
        }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }

    ascii += '\x80';
    while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return;
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
    words[words[lengthProperty]] = asciiBitLength;

    for (j = 0; j < words[lengthProperty]; ) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash;
      hash = hash.slice(0, 8);

      for (i = 0; i < 64; i++) {
        const w15 = w[i - 15],
          w2 = w[i - 2];

        const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] + s0 + w[i - 7] + s1) | 0;

        const s1_maj = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
        const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
        const t2 = (s1_maj + maj) | 0;

        const s1_ch = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
        const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
        const t1 = (hash[7] + s1_ch + ch + k[i] + w[i]) | 0;

        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }

      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }

    for (i = 0; i < 8; i++) {
      for (let b = 3; b >= 0; b--) {
        const byte = (hash[i] >> (b * 8)) & 255;
        result += (byte < 16 ? '0' : '') + byte.toString(16);
      }
    }
    return result;
  }

  /**
   * Hashes a password with a generated or provided salt.
   * Returns formatted string: `$sha256$<salt>$<hash>`
   */
  hashPassword(password, customSalt = null) {
    if (!password) return '';
    const salt = customSalt || this.generateSalt(16);
    const combined = `${salt}:${password}`;
    const hash = this.sha256Sync(combined);
    return `$sha256$${salt}$${hash}`;
  }

  /**
   * Verifies if raw password matches the stored password.
   * Seamlessly handles both `$sha256$` salted format and legacy plain-text passwords.
   */
  verifyPassword(rawPassword, storedPassword) {
    if (!rawPassword || !storedPassword) return false;

    // Check if stored password has salted sha256 format
    if (storedPassword.startsWith('$sha256$')) {
      const parts = storedPassword.split('$');
      // Format: ['', 'sha256', salt, hash]
      if (parts.length === 4) {
        const salt = parts[2];
        const expectedHash = parts[3];
        const computed = this.sha256Sync(`${salt}:${rawPassword}`);
        return computed.toLowerCase() === expectedHash.toLowerCase();
      }
    }

    // Direct match fallback for legacy passwords
    return rawPassword === storedPassword;
  }

  /**
   * Checks whether a password string is already in hashed format
   */
  isHashed(passwordStr) {
    return Boolean(passwordStr && passwordStr.startsWith('$sha256$'));
  }
}

export const cryptoService = new CryptoService();
