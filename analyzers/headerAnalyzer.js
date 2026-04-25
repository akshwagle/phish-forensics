function unfoldHeaders(rawEmail) {
  return String(rawEmail || '').replace(/\r?\n[ \t]+/g, ' ');
}

function parseHeaders(rawEmail) {
  const unfolded = unfoldHeaders(rawEmail);
  const lines = unfolded.split(/\r?\n/);
  const map = {};

  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(value);
  }

  return map;
}

function firstHeader(headers, key) {
  const values = headers[key.toLowerCase()];
  return values && values.length ? values[0] : null;
}

function parseEmailAddress(value) {
  if (!value) {
    return { displayName: null, email: null, domain: null };
  }

  const angle = value.match(/^(.*?)<([^>]+)>/);
  const emailRaw = angle ? angle[2].trim() : (value.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/) || [null])[0];
  const displayNameRaw = angle ? angle[1].replace(/["']/g, '').trim() : null;
  const domain = emailRaw && emailRaw.includes('@') ? emailRaw.split('@').pop().toLowerCase() : null;

  return {
    displayName: displayNameRaw || null,
    email: emailRaw ? emailRaw.toLowerCase() : null,
    domain
  };
}

function parseAuthResults(authenticationResultsValue) {
  const value = String(authenticationResultsValue || '').toLowerCase();
  const readResult = (name) => {
    if (new RegExp(`${name}=pass`).test(value)) {
      return 'pass';
    }
    if (new RegExp(`${name}=fail`).test(value)) {
      return 'fail';
    }
    if (new RegExp(`${name}=(softfail|neutral|none|temperror|permerror)`).test(value)) {
      return 'softfail';
    }
    return 'unknown';
  };

  return {
    spf: readResult('spf'),
    dkim: readResult('dkim'),
    dmarc: readResult('dmarc')
  };
}

function getOriginIp(receivedHeaders) {
  const chain = receivedHeaders || [];
  const candidate = chain.length ? chain[chain.length - 1] : '';
  const ipv4 = candidate.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  const ipv6 = candidate.match(/\b(?:[A-Fa-f0-9]{1,4}:){2,}[A-Fa-f0-9]{1,4}\b/);
  return (ipv4 && ipv4[0]) || (ipv6 && ipv6[0]) || null;
}

function analyzeHeaders(rawEmail) {
  const headers = parseHeaders(rawEmail);

  const from = parseEmailAddress(firstHeader(headers, 'from'));
  const replyTo = parseEmailAddress(firstHeader(headers, 'reply-to'));
  const returnPath = parseEmailAddress(firstHeader(headers, 'return-path'));
  const authenticationResults = parseAuthResults(firstHeader(headers, 'authentication-results'));
  const receivedChain = headers.received || [];
  const mismatches = [];
  const flags = [];

  if (from.domain && returnPath.domain && from.domain !== returnPath.domain) {
    mismatches.push({
      type: 'from_vs_return_path_domain',
      fromDomain: from.domain,
      returnPathDomain: returnPath.domain
    });
    flags.push('From domain differs from Return-Path domain');
  }

  if (replyTo.email && from.email && replyTo.email !== from.email) {
    mismatches.push({
      type: 'reply_to_vs_from',
      from: from.email,
      replyTo: replyTo.email
    });
    flags.push('Reply-To differs from From address');
  }

  if (authenticationResults.spf === 'fail') {
    flags.push('SPF failed');
  }
  if (authenticationResults.dkim === 'fail') {
    flags.push('DKIM failed');
  }
  if (authenticationResults.dmarc === 'fail') {
    flags.push('DMARC failed');
  }

  return {
    extracted: {
      from: firstHeader(headers, 'from'),
      replyTo: firstHeader(headers, 'reply-to'),
      returnPath: firstHeader(headers, 'return-path'),
      messageId: firstHeader(headers, 'message-id'),
      date: firstHeader(headers, 'date'),
      xMailer: firstHeader(headers, 'x-mailer')
    },
    mismatches,
    authResults: authenticationResults,
    hopCount: receivedChain.length,
    originIP: getOriginIp(receivedChain),
    flags
  };
}

function analyze(rawEmail) {
  return analyzeHeaders(rawEmail);
}

module.exports = { analyzeHeaders, analyze, parseHeaders };
