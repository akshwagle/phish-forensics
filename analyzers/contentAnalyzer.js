const URGENCY_PATTERNS = [
  /act now/i,
  /urgent/i,
  /expires in/i,
  /immediately/i,
  /final notice/i,
  /account suspended/i,
  /verify within 24 hours/i
];

const THREAT_PATTERNS = [
  /your account will be locked/i,
  /legal action/i,
  /police/i,
  /arrest/i
];

const GREED_PATTERNS = [
  /you['’]?ve won/i,
  /claim your prize/i,
  /refund pending/i,
  /tax return/i
];

const CREDENTIAL_PATTERNS = [/verify your password/i, /confirm your details/i, /click to login/i];
const GENERIC_GREETINGS = [/dear customer/i, /dear user/i, /dear sir\/madam/i];

function getMatches(text, patterns) {
  const hits = [];
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      hits.push(pattern.source);
    }
  }
  return hits;
}

function detectMixedCaseDomains(text) {
  const matches = text.match(/\b[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\b/g) || [];
  return matches.filter((domain) => /[a-z]/.test(domain) && /[A-Z]/.test(domain));
}

function analyzeContent(emailBody) {
  const text = String(emailBody || '');
  const urgencyHits = getMatches(text, URGENCY_PATTERNS);
  const threatHits = getMatches(text, THREAT_PATTERNS);
  const greedHits = getMatches(text, GREED_PATTERNS);
  const credentialHits = getMatches(text, CREDENTIAL_PATTERNS);
  const greetingHits = getMatches(text, GENERIC_GREETINGS);
  const exclamationCount = (text.match(/!/g) || []).length;
  const mixedCaseDomains = detectMixedCaseDomains(text);
  const redFlags = [];

  if (urgencyHits.length) {
    redFlags.push(`Urgency phrases detected: ${urgencyHits.join(', ')}`);
  }
  if (threatHits.length) {
    redFlags.push(`Threat language detected: ${threatHits.join(', ')}`);
  }
  if (greedHits.length) {
    redFlags.push(`Greed/reward language detected: ${greedHits.join(', ')}`);
  }
  if (credentialHits.length) {
    redFlags.push('Credential request language detected');
  }
  if (greetingHits.length) {
    redFlags.push('Generic greeting detected');
  }
  if (exclamationCount > 3) {
    redFlags.push('Excessive exclamation marks');
  }
  if (mixedCaseDomains.length) {
    redFlags.push(`Mixed-case domains in body: ${mixedCaseDomains.join(', ')}`);
  }

  return {
    urgencyScore: Math.min(100, urgencyHits.length * 20 + (exclamationCount > 3 ? 10 : 0)),
    threatScore: Math.min(100, threatHits.length * 25),
    greedScore: Math.min(100, greedHits.length * 25),
    credentialRequest: credentialHits.length > 0,
    genericGreeting: greetingHits.length > 0,
    redFlags
  };
}

function analyze(content) {
  return analyzeContent(content);
}

module.exports = { analyzeContent, analyze };
