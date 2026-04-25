const { detectHomograph, checkTypoSquat } = require('./homographDetector');
function isIpHost(host) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(String(host || ''));
}

function severityFromScore(score) {
  if (score <= 20) {
    return 'safe';
  }
  if (score <= 50) {
    return 'suspicious';
  }
  if (score <= 80) {
    return 'dangerous';
  }
  return 'critical';
}

function scoreEmail(allFindings) {
  const findings = allFindings || {};
  const breakdown = {};
  const reasons = [];
  let total = 0;

  const add = (key, points, reason) => {
    if (points <= 0) {
      return;
    }
    breakdown[key] = (breakdown[key] || 0) + points;
    reasons.push({ reason, points });
    total += points;
  };

  const header = findings.headerResult || findings.header || {};
  const sender = findings.senderResult || findings.sender || {};
  const content = findings.contentResult || findings.content || {};
  const urls = findings.urlResult?.urls || findings.urls || [];
  const attachments = findings.attachmentResult?.attachments || findings.attachments || [];

  const auth = header.authResults || findings.authResults || {};
  if (header.mismatches?.some((m) => m.type === 'from_vs_return_path_domain')) {
    add('senderMismatch', 20, 'From/Return-Path mismatch');
  }
  if (sender.mismatch) {
    add('displayNameImpersonation', 20, 'Display-name impersonation');
  }

  if (auth.spf === 'fail') {
    add('spfFail', 15, 'SPF failed');
  }
  if (auth.dkim === 'fail') {
    add('dkimFail', 15, 'DKIM failed');
  }
  if (auth.dmarc === 'fail') {
    add('dmarcFail', 15, 'DMARC failed');
  }

  if (content.credentialRequest) {
    add('credentialRequest', 15, 'Credential request language');
  }
  if ((content.urgencyScore || 0) > 0) {
    add('urgencyLanguage', 10, 'Urgency language detected');
  }
  if ((content.threatScore || 0) > 0) {
    add('threatLanguage', 10, 'Threat language detected');
  }

  let suspiciousUrlFlagCount = 0;
  for (const entry of urls) {
    const flags = entry.flags || [];
    suspiciousUrlFlagCount += flags.length;
    if (flags.some((f) => /ip address/i.test(f))) {
      add('ipAsDomain', 15, 'URL uses IP address as domain');
    }

    let host = '';
    try {
      host = new URL(entry.finalDestination || entry.original || '').hostname;
    } catch (_) {
      host = '';
    }
    if (host && !isIpHost(host)) {
      const homograph = detectHomograph(host);
      if (homograph.isHomograph) {
        add('homograph', 35, `Homograph indicators for ${host}`);
      }
      const typo = checkTypoSquat(host);
      if (typo.isTypoSquat) {
        add('typosquat', 25, `Typosquat similarity to ${typo.closestBrand}`);
      }
    }
  }
  add('suspiciousUrlFlags', Math.min(25, suspiciousUrlFlagCount * 5), 'Multiple suspicious URL indicators');

  const dangerousAttachment = attachments.some((a) => String(a.riskLevel || '').toLowerCase() === 'high');
  if (dangerousAttachment) {
    add('dangerousAttachment', 30, 'Dangerous attachment detected');
  }

  const score = Math.max(0, Math.min(100, total));
  const topReasons = reasons
    .sort((a, b) => b.points - a.points)
    .slice(0, 5)
    .map((item) => item.reason);

  return {
    score,
    severity: severityFromScore(score),
    breakdown,
    topReasons
  };
}

function score(allFindings) {
  return scoreEmail(allFindings);
}

module.exports = { scoreEmail, score };
