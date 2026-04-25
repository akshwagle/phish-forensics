const punycode = require('punycode');

const KNOWN_BRANDS = [
  'google',
  'paypal',
  'amazon',
  'microsoft',
  'apple',
  'facebook',
  'instagram',
  'netflix',
  'bank',
  'chase',
  'wellsfargo',
  'citibank',
  'github',
  'twitter',
  'x.com',
  'linkedin',
  'dropbox'
];

const CONFUSABLES = {
  а: 'a',
  А: 'a',
  е: 'e',
  Е: 'e',
  о: 'o',
  О: 'o',
  р: 'p',
  Р: 'p',
  с: 'c',
  С: 'c',
  х: 'x',
  Х: 'x',
  у: 'y',
  У: 'y',
  і: 'i',
  І: 'i',
  ӏ: 'l',
  Ɩ: 'l',
  ɡ: 'g',
  զ: 'g',
  ԁ: 'd',
  մ: 'm',
  т: 't',
  Τ: 't',
  ν: 'v',
  ѵ: 'v',
  ք: 'q',
  ԛ: 'q',
  ԝ: 'w',
  ԉ: 'n',
  ј: 'j',
  Ј: 'j',
  Β: 'b',
  Ь: 'b',
  ѕ: 's',
  Զ: 'z',
  Զ: 'z',
  0: 'o',
  1: 'l',
  I: 'l',
  '|': 'l',
  '!': 'i',
  '$': 's',
  '@': 'a'
};

const SEQUENCE_CONFUSABLES = {
  rn: 'm',
  vv: 'w',
  cl: 'd',
  ci: 'a'
};

function hasNonASCII(domain) {
  return /[^\x00-\x7F]/.test(String(domain || ''));
}

function decodePunycode(domain) {
  const value = String(domain || '').trim().toLowerCase();
  if (!value) {
    return '';
  }
  try {
    return value
      .split('.')
      .map((label) => (label.startsWith('xn--') ? punycode.toUnicode(label) : label))
      .join('.');
  } catch (_) {
    return value;
  }
}

function normalizeDomain(domain) {
  const decoded = decodePunycode(domain);
  let normalized = '';

  for (const char of decoded) {
    normalized += CONFUSABLES[char] || char.toLowerCase();
  }

  for (const [sequence, replacement] of Object.entries(SEQUENCE_CONFUSABLES)) {
    normalized = normalized.replace(new RegExp(sequence, 'g'), replacement);
  }

  normalized = normalized.replace(/[^a-z0-9.-]/g, '');
  return normalized;
}

function getDomainRoot(domain) {
  const host = String(domain || '').toLowerCase();
  const parts = host.split('.').filter(Boolean);
  if (!parts.length) {
    return '';
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return parts[parts.length - 2];
}

function isIpLikeHost(host) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(String(host || '').trim());
}

function compareAgainstBrands(originalDomain, normalizedDomain) {
  const originalRoot = getDomainRoot(originalDomain);
  const normalizedRoot = getDomainRoot(normalizedDomain);

  for (const brand of KNOWN_BRANDS) {
    const brandRoot = getDomainRoot(brand);
    const originalHas = originalRoot.includes(brandRoot);
    const normalizedHas = normalizedRoot.includes(brandRoot);
    if (normalizedHas && !originalHas) {
      return brand;
    }
  }

  return null;
}

function levenshtein(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  const dp = Array.from({ length: s.length + 1 }, (_, i) => [i]);

  for (let j = 1; j <= t.length; j += 1) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= s.length; i += 1) {
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[s.length][t.length];
}

function checkTypoSquat(domain) {
  const rawRoot = getDomainRoot(String(domain || '').toLowerCase());
  const normalizedRoot = getDomainRoot(normalizeDomain(domain));
  if (!rawRoot || !normalizedRoot || isIpLikeHost(rawRoot)) {
    return { isTypoSquat: false, closestBrand: null, distance: null };
  }

  let best = { brand: null, distance: Infinity };
  for (const brand of KNOWN_BRANDS) {
    const brandRoot = getDomainRoot(brand);
    const distance = Math.min(levenshtein(rawRoot, brandRoot), levenshtein(normalizedRoot, brandRoot));
    if (distance < best.distance) {
      best = { brand, distance };
    }
  }

  if (best.distance <= 2 && rawRoot !== getDomainRoot(best.brand)) {
    return {
      isTypoSquat: true,
      closestBrand: best.brand,
      distance: best.distance
    };
  }

  return { isTypoSquat: false, closestBrand: best.brand, distance: best.distance };
}

function detectHomograph(domain) {
  const original = String(domain || '').trim().toLowerCase();
  if (isIpLikeHost(original)) {
    return {
      isHomograph: false,
      normalized: original,
      suspectedTarget: null,
      evidence: ['ip-host'],
      suspicious: false,
      reason: 'ip-host',
      ascii: original
    };
  }

  const decoded = decodePunycode(original);
  const normalized = normalizeDomain(original);
  const suspectedTarget = compareAgainstBrands(decoded, normalized);
  const evidence = [];

  if (!original) {
    return {
      isHomograph: false,
      normalized: '',
      suspectedTarget: null,
      evidence: ['empty-domain'],
      suspicious: false,
      reason: 'no-domain',
      ascii: ''
    };
  }

  if (hasNonASCII(decoded)) {
    evidence.push('contains-non-ascii-characters');
  }
  if (original.includes('xn--')) {
    evidence.push('contains-punycode-label');
  }
  if (decoded !== normalized) {
    evidence.push('confusables-normalized-difference');
  }
  if (suspectedTarget) {
    evidence.push(`normalized-resembles-brand:${suspectedTarget}`);
  }

  const isHomograph = evidence.length > 0 && (decoded !== normalized || Boolean(suspectedTarget));

  return {
    isHomograph,
    normalized,
    suspectedTarget,
    evidence,
    suspicious: isHomograph,
    reason: evidence.join(',') || 'clean',
    ascii: normalized
  };
}

module.exports = {
  KNOWN_BRANDS,
  CONFUSABLES,
  hasNonASCII,
  decodePunycode,
  normalizeDomain,
  detectHomograph,
  checkTypoSquat
};
