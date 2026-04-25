const punycode = require('punycode');

function detectHomograph(domain) {
  const input = String(domain || '').trim();
  if (!input) {
    return { suspicious: false, reason: 'no-domain', ascii: '' };
  }

  const hasUnicode = /[^\x00-\x7F]/.test(input);
  const hasPunycode = input.includes('xn--');

  let ascii = input;
  try {
    ascii = punycode.toASCII(input);
  } catch (_) {
    ascii = input;
  }

  const suspicious = hasUnicode || hasPunycode;
  const reason = suspicious ? 'unicode-or-punycode-detected' : 'clean-ascii';

  return { suspicious, reason, ascii };
}

module.exports = { detectHomograph };
