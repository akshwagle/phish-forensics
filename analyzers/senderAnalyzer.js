const { parseHeaders } = require('./headerAnalyzer');

function analyze(rawHeaders) {
  const headers = parseHeaders(rawHeaders || '');
  const auth = (headers['authentication-results'] || '').toLowerCase();

  const spf = auth.includes('spf=pass') ? 'pass' : auth.includes('spf=fail') ? 'fail' : 'unknown';
  const dkim = auth.includes('dkim=pass') ? 'pass' : auth.includes('dkim=fail') ? 'fail' : 'unknown';
  const dmarc = auth.includes('dmarc=pass') ? 'pass' : auth.includes('dmarc=fail') ? 'fail' : 'unknown';

  return { spf, dkim, dmarc };
}

module.exports = { analyze };
