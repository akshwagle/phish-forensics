const { parseHeaders } = require('./headerAnalyzer');

const FREE_PROVIDERS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'protonmail.com',
  'aol.com'
];

const COMPANY_KEYWORDS = [
  'paypal',
  'microsoft',
  'apple',
  'google',
  'amazon',
  'bank',
  'support',
  'security',
  'billing'
];

function parseFromHeader(fromHeader) {
  const value = String(fromHeader || '');
  const angle = value.match(/^(.*?)<([^>]+)>/);
  const displayName = angle ? angle[1].replace(/["']/g, '').trim() : '';
  const actualEmail = angle ? angle[2].trim().toLowerCase() : (value.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/) || [''])[0].toLowerCase();
  const domain = actualEmail.includes('@') ? actualEmail.split('@').pop() : '';
  return { displayName, actualEmail, domain };
}

function analyzeSender(rawHeaders) {
  const headers = parseHeaders(rawHeaders || '');
  const fromHeader = (headers.from && headers.from[0]) || '';
  const { displayName, actualEmail, domain } = parseFromHeader(fromHeader);
  const flags = [];

  const lowerName = displayName.toLowerCase();
  const lowerDomain = domain.toLowerCase();
  const hasCompanyIndicator = COMPANY_KEYWORDS.some((word) => lowerName.includes(word));
  const mismatch = Boolean(hasCompanyIndicator && lowerDomain && !lowerName.includes(lowerDomain.split('.')[0]));
  const freeEmailImpersonation = Boolean(hasCompanyIndicator && FREE_PROVIDERS.includes(lowerDomain));

  if (mismatch) {
    flags.push('Display name likely impersonates an unrelated sender domain');
  }
  if (freeEmailImpersonation) {
    flags.push('Company-like sender using free email provider');
  }
  if (lowerDomain.endsWith('.top') || lowerDomain.endsWith('.xyz')) {
    flags.push('Sender domain appears likely newly registered (demo heuristic)');
  }

  return {
    displayName: displayName || null,
    actualEmail: actualEmail || null,
    mismatch,
    freeEmailImpersonation,
    flags
  };
}

function analyze(rawHeaders) {
  return analyzeSender(rawHeaders);
}

module.exports = { analyzeSender, analyze };
