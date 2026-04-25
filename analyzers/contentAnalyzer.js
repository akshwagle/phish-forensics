const URGENCY_PATTERNS = [
  /urgent/i,
  /immediate action/i,
  /verify your account/i,
  /suspended/i,
  /password expires/i,
  /click here/i
];

function analyze(content) {
  const text = content || '';
  const matches = URGENCY_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);

  return {
    socialEngineeringSignals: matches,
    urgencyScore: Math.min(100, matches.length * 18)
  };
}

module.exports = { analyze };
