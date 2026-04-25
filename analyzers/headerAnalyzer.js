function parseHeaders(rawHeaders) {
  const lines = (rawHeaders || '').split(/\r?\n/);
  const map = {};

  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      map[key] = value;
    }
  }

  return map;
}

function analyze(rawHeaders) {
  const headers = parseHeaders(rawHeaders);

  return {
    received: Object.keys(headers).filter((key) => key.startsWith('received')).length,
    returnPath: headers['return-path'] || null,
    messageId: headers['message-id'] || null,
    from: headers.from || null,
    to: headers.to || null,
    subject: headers.subject || null
  };
}

module.exports = { analyze, parseHeaders };
