const KNOWN_BAD = ['ph1shing-domain.tld', 'bad-login-check.com', 'secure-verify-now.net'];
const KNOWN_GOOD = ['google.com', 'microsoft.com', 'github.com'];

function checkDomain(domain) {
  const value = String(domain || '').toLowerCase();

  if (!value) {
    return { domain: value, reputation: 'unknown' };
  }

  if (KNOWN_BAD.includes(value)) {
    return { domain: value, reputation: 'bad' };
  }

  if (KNOWN_GOOD.includes(value)) {
    return { domain: value, reputation: 'good' };
  }

  return { domain: value, reputation: 'unknown' };
}

function checkDomains(domains) {
  const results = (domains || []).map((d) => checkDomain(d));
  return { domains: results };
}

module.exports = { checkDomain, checkDomains };
