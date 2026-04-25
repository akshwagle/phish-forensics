const KNOWN_LEGIT = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'microsoft.com',
  'office.com',
  'windows.com',
  'google.com',
  'googlemail.com',
  'youtube.com',
  'gmail.google.com',
  'amazon.com',
  'aws.amazon.com',
  'apple.com',
  'icloud.apple.com',
  'paypal.com',
  'stripe.com',
  'visa.com',
  'mastercard.com',
  'discover.com',
  'americanexpress.com',
  'chase.com',
  'wellsfargo.com',
  'bankofamerica.com',
  'citibank.com',
  'capitalone.com',
  'hsbc.com',
  'barclays.com',
  'netflix.com',
  'spotify.com',
  'dropbox.com',
  'box.com',
  'adobe.com',
  'salesforce.com',
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'linkedin.com',
  'x.com',
  'twitter.com',
  'facebook.com',
  'instagram.com',
  'whatsapp.com',
  'telegram.org',
  'zoom.us',
  'slack.com',
  'notion.so',
  'atlassian.com',
  'cloudflare.com',
  'digitalocean.com',
  'oracle.com',
  'ibm.com',
  'sap.com',
  'docusign.com',
  'intuit.com',
  'quickbooks.com'
];

const KNOWN_PHISH_INDICATORS = [
  '.duckdns.org',
  '.no-ip.org',
  '.ddns.net',
  '.hopto.org',
  '.zapto.org',
  '.serveftp.com',
  '.sytes.net',
  '.dynu.net',
  '.freedynamicdns.net',
  '.myftp.org',
  '.ns01.us',
  '.onion.to',
  '.publicvm.com',
  '.ru.com',
  '.tk',
  '.ml',
  '.ga',
  '.cf',
  '.gq'
];

function normalizeDomain(input) {
  return String(input || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
}

function isLegitDomain(domain) {
  return KNOWN_LEGIT.some((entry) => domain === entry || domain.endsWith(`.${entry}`));
}

function hasSuspiciousIndicator(domain) {
  return KNOWN_PHISH_INDICATORS.some((indicator) => domain === indicator.replace(/^\./, '') || domain.endsWith(indicator));
}

function checkReputation(domain) {
  const value = normalizeDomain(domain);
  if (!value) {
    return 'unknown';
  }
  if (isLegitDomain(value)) {
    return 'legit';
  }
  if (hasSuspiciousIndicator(value)) {
    return 'suspicious';
  }
  return 'unknown';
}

function checkDomain(domain) {
  const reputation = checkReputation(domain);
  return { domain: normalizeDomain(domain), reputation };
}

function checkDomains(domains) {
  return { domains: (domains || []).map((item) => checkDomain(item)) };
}

module.exports = {
  KNOWN_LEGIT,
  KNOWN_PHISH_INDICATORS,
  checkReputation,
  checkDomain,
  checkDomains
};
