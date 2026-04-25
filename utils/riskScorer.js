function score(signals) {
  let total = 0;
  const reasons = [];

  const sender = signals.senderResult || {};
  if (sender.spf === 'fail') {
    total += 20;
    reasons.push('SPF fail');
  }
  if (sender.dkim === 'fail') {
    total += 20;
    reasons.push('DKIM fail');
  }
  if (sender.dmarc === 'fail') {
    total += 20;
    reasons.push('DMARC fail');
  }

  const content = signals.contentResult || {};
  if ((content.urgencyScore || 0) > 50) {
    total += 15;
    reasons.push('High urgency language');
  }

  const attachment = signals.attachmentResult || {};
  if ((attachment.suspiciousCount || 0) > 0) {
    total += Math.min(15, attachment.suspiciousCount * 5);
    reasons.push('Suspicious attachment types');
  }

  const urls = signals.urlResult?.urls || [];
  const homographCount = urls.filter((u) => u.homograph?.suspicious).length;
  if (homographCount > 0) {
    total += Math.min(10, homographCount * 5);
    reasons.push('Possible homograph domains');
  }

  const badRepCount = (signals.reputationResult?.domains || []).filter((d) => d.reputation === 'bad').length;
  if (badRepCount > 0) {
    total += Math.min(20, badRepCount * 10);
    reasons.push('Known bad domain reputation');
  }

  return {
    score: Math.max(0, Math.min(100, total)),
    level: total >= 70 ? 'high' : total >= 40 ? 'medium' : 'low',
    reasons
  };
}

module.exports = { score };
