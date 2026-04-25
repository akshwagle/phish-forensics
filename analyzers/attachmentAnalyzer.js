const SUSPICIOUS_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.js',
  '.vbs',
  '.scr',
  '.iso',
  '.dll',
  '.zip',
  '.rar',
  '.7z',
  '.docm',
  '.xlsm'
];

function analyze(attachments) {
  const flagged = [];

  for (const file of attachments || []) {
    const lowered = String(file).toLowerCase();
    const matched = SUSPICIOUS_EXTENSIONS.find((ext) => lowered.endsWith(ext));
    if (matched) {
      flagged.push({ file, extension: matched });
    }
  }

  return {
    total: (attachments || []).length,
    suspicious: flagged,
    suspiciousCount: flagged.length
  };
}

module.exports = { analyze };
