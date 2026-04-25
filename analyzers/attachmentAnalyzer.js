const DANGEROUS_EXTENSIONS = ['.exe', '.scr', '.bat', '.cmd', '.vbs', '.js', '.jar', '.iso', '.lnk', '.hta'];
const MACRO_EXTENSIONS = ['.docm', '.xlsm', '.pptm'];

function getExtension(filename) {
  const value = String(filename || '').toLowerCase();
  const index = value.lastIndexOf('.');
  return index >= 0 ? value.slice(index) : '';
}

function hasDoubleExtension(filename) {
  const value = String(filename || '').toLowerCase();
  return /\.[a-z0-9]{1,5}\.[a-z0-9]{1,5}$/.test(value);
}

function extractAttachmentsFromHeaders(rawEmail) {
  const source = String(rawEmail || '');
  const lines = source.split(/\r?\n/);
  const found = [];

  for (const line of lines) {
    if (!/^content-disposition:/i.test(line)) {
      continue;
    }

    const disposition = line.toLowerCase();
    if (!disposition.includes('attachment')) {
      continue;
    }

    const nameMatch = line.match(/filename\*?=(?:"([^"]+)"|([^;\s]+))/i);
    const filename = nameMatch ? (nameMatch[1] || nameMatch[2] || '').trim() : 'unnamed_attachment';
    found.push({ name: filename, header: line });
  }

  return found;
}

function classifyAttachment(name, headerLine) {
  const ext = getExtension(name);
  const reasons = [];
  let riskLevel = 'low';

  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    reasons.push(`Dangerous executable/script extension (${ext})`);
    riskLevel = 'high';
  }

  if (hasDoubleExtension(name)) {
    reasons.push('Double extension detected');
    riskLevel = 'high';
  }

  if (MACRO_EXTENSIONS.includes(ext)) {
    reasons.push(`Macro-enabled Office document (${ext})`);
    if (riskLevel !== 'high') {
      riskLevel = 'medium';
    }
  }

  if (ext === '.zip' && /password|encrypted/i.test(String(headerLine || ''))) {
    reasons.push('Password-protected ZIP indicator found');
    if (riskLevel !== 'high') {
      riskLevel = 'medium';
    }
  }

  return {
    name,
    type: ext || 'unknown',
    riskLevel,
    reason: reasons.length ? reasons.join('; ') : 'No obvious attachment risk signals'
  };
}

function analyzeAttachments(rawEmail) {
  const attachments = extractAttachmentsFromHeaders(rawEmail).map((item) =>
    classifyAttachment(item.name, item.header)
  );
  return { attachments };
}

function analyze(rawEmail) {
  return analyzeAttachments(rawEmail);
}

module.exports = { analyzeAttachments, analyze };
