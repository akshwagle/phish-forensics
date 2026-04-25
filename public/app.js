const API_BASE = 'http://localhost:3001';

const appState = {
  currentEmail: '',
  analysis: null,
  isAnalyzing: false
};

const samples = {
  paypal: `From: PayPal Security <alerts@paypal-security-check.top>
Reply-To: support@account-verify-center.click
Return-Path: bounce@mailer-security.top
Authentication-Results: mx.google.com; spf=fail dkim=fail dmarc=fail
Received: from suspicious-host (185.220.100.44)
Subject: PayPal Account Suspended

Dear Customer,
Your account is suspended. Verify within 24 hours immediately.
Click to login: https://bit.ly/pp-verify-now`,
  bec: `From: "Arjun Mehta, CEO" <arjun.ceo.office@gmail.com>
Reply-To: finance-team@urgent-vendor-payments.work
Return-Path: ceo.office@vendor-billing.work
Authentication-Results: mx.google.com; spf=fail dkim=neutral dmarc=fail
Subject: Urgent wire transfer before audit cutoff

Hi Priya,
I am in back-to-back board meetings and cannot talk.
Please process an urgent wire transfer of USD 48,750 to our new legal retainer account in the next 30 minutes.
Reply once done.`,
  m365: `From: M?cr?s?ft 365 Security <alerts@secure-m365-login.top>
Reply-To: noreply@m365-security-center.xyz
Return-Path: notify@security-gateway.top
Authentication-Results: mx.google.com; spf=pass dkim=fail dmarc=fail
Subject: Sign-in attempt blocked

Dear User,
Your account will be locked unless you verify your password now.
Use the secure portal: https://login-check-service.com/microsoft/verify`,
  crypto: `From: CryptoRewards <airdrop@chain-bonus.xyz>
Reply-To: claim@chain-bonus.xyz
Return-Path: no-reply@reward-chain.top
Authentication-Results: mx.google.com; spf=softfail dkim=fail dmarc=fail
Subject: Exclusive airdrop allocation

You've won a premium token drop!!! Claim your prize immediately!!!
Connect wallet and claim in 2 hours: https://is.gd/airdrophub`,
  newsletter: `From: GitHub News <noreply@github.com>
Reply-To: noreply@github.com
Return-Path: noreply@github.com
Authentication-Results: mx.google.com; spf=pass dkim=pass dmarc=pass
Subject: Your October developer newsletter

Hello developer,
Here is your monthly product update from GitHub with changelog highlights and event announcements.
Manage preferences at https://github.com/settings/notifications`
};

const el = {
  tabs: [...document.querySelectorAll('.tab')],
  tabContents: [...document.querySelectorAll('.tab-content')],
  rawEmail: document.getElementById('rawEmail'),
  emlUpload: document.getElementById('emlUpload'),
  uploadMeta: document.getElementById('uploadMeta'),
  samplePicker: document.getElementById('samplePicker'),
  loadSampleBtn: document.getElementById('loadSampleBtn'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  progressTrack: document.getElementById('progressTrack'),
  skeletonState: document.getElementById('skeletonState'),
  emptyState: document.getElementById('emptyState'),
  reportRoot: document.getElementById('reportRoot'),
  riskScore: document.getElementById('riskScore'),
  gaugeFill: document.getElementById('gaugeFill'),
  severityLabel: document.getElementById('severityLabel'),
  aiSummary: document.getElementById('aiSummary'),
  redFlagsList: document.getElementById('redFlagsList'),
  urlTableBody: document.getElementById('urlTableBody'),
  senderPanel: document.getElementById('senderPanel'),
  authPills: document.getElementById('authPills'),
  highlightedEmail: document.getElementById('highlightedEmail'),
  wordCloud: document.getElementById('wordCloud'),
  attribution: document.getElementById('attribution'),
  tacticsMatrix: document.getElementById('tacticsMatrix'),
  showReasoningBtn: document.getElementById('showReasoningBtn'),
  reasoningStream: document.getElementById('reasoningStream'),
  downloadPdfBtn: document.getElementById('downloadPdfBtn'),
  copyIocsBtn: document.getElementById('copyIocsBtn'),
  shareAnalysisBtn: document.getElementById('shareAnalysisBtn')
};

function setTab(tabId) {
  el.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === tabId));
  el.tabContents.forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${tabId}`));
}

function severityText(score) {
  if (score >= 81) return 'CRITICAL THREAT';
  if (score >= 51) return 'DANGEROUS';
  if (score >= 21) return 'SUSPICIOUS';
  return 'SAFE';
}

function severityColor(score) {
  if (score >= 81) return '#ff3b5c';
  if (score >= 51) return '#ff6f3b';
  if (score >= 21) return '#ffaa00';
  return '#00ff88';
}

function animateGauge(targetScore) {
  const circumference = 553;
  const duration = 1500;
  const started = performance.now();

  function tick(now) {
    const progress = Math.min(1, (now - started) / duration);
    const current = Math.round(targetScore * progress);
    const offset = circumference - (circumference * current) / 100;
    el.riskScore.textContent = String(current);
    el.gaugeFill.style.strokeDashoffset = `${offset}`;
    if (progress < 1) requestAnimationFrame(tick);
  }

  el.gaugeFill.style.stroke = severityColor(targetScore);
  requestAnimationFrame(tick);
}

function createFlagCard(reason, index) {
  const card = document.createElement('div');
  card.className = 'red-flag-card';
  card.innerHTML = `
    <div class="severity-bar"></div>
    <div class="red-flag-main">
      <strong>${reason}</strong>
      <small>Evidence stream #${index + 1}</small>
    </div>
    <button class="expand-btn">details</button>
    <div class="red-flag-detail">Forensic context: this signal had a high weighted contribution in the final risk score model.</div>
  `;
  const detail = card.querySelector('.red-flag-detail');
  card.querySelector('.expand-btn').addEventListener('click', () => detail.classList.toggle('open'));
  setTimeout(() => card.classList.add('show'), 100 + index * 90);
  return card;
}

function renderAuthPills(authResults = {}) {
  el.authPills.innerHTML = '';
  ['spf', 'dkim', 'dmarc'].forEach((key) => {
    const value = authResults[key] || 'unknown';
    const span = document.createElement('span');
    span.className = `pill ${value === 'pass' ? 'pass' : value === 'fail' ? 'fail' : 'unknown'}`;
    span.textContent = `${key.toUpperCase()}: ${value}`;
    el.authPills.appendChild(span);
  });
}

function renderUrlTable(urls = []) {
  el.urlTableBody.innerHTML = '';
  urls.forEach((entry) => {
    let host = 'n/a';
    try {
      host = new URL(entry.finalDestination || entry.original).hostname;
    } catch (_) {
      host = 'invalid-host';
    }

    const homographLine = entry.homograph?.isHomograph
      ? `Detected: ${host}<br/>Looks like: ${entry.homograph.normalized || 'n/a'}`
      : 'None';

    const flagsHtml = (entry.flags || [])
      .map((flag) => `<span class="badge ${/ip|homograph|brand|credential/i.test(flag) ? 'danger' : 'warn'}">${flag}</span>`)
      .join('');

    const row = document.createElement('tr');
    row.className = 'scan-row';
    row.innerHTML = `
      <td><a href="#" data-url="${entry.original}">${entry.original}</a></td>
      <td>${entry.finalDestination || entry.original}</td>
      <td>${entry.hops?.length || 0}</td>
      <td>${flagsHtml || '<span class="badge ok">clean</span>'}</td>
      <td>${homographLine}</td>
    `;

    row.querySelector('a').addEventListener('click', (event) => {
      event.preventDefault();
      alert(`Preview only: ${event.currentTarget.dataset.url}\nDestination intent summary: redirect chain suggests potential phishing lure.`);
    });

    el.urlTableBody.appendChild(row);
  });
}

function renderWordCloud(redFlags = []) {
  el.wordCloud.innerHTML = '';
  const words = redFlags.flatMap((line) => line.split(/[:,]/).map((part) => part.trim()).filter(Boolean));
  words.slice(0, 20).forEach((word, index) => {
    const span = document.createElement('span');
    span.textContent = word;
    span.style.fontSize = `${0.75 + ((index % 7) + 1) * 0.1}rem`;
    span.style.opacity = `${0.6 + (index % 4) * 0.1}`;
    el.wordCloud.appendChild(span);
  });
}

function highlightContent(emailBody, redFlags = []) {
  let html = String(emailBody || 'No content provided.');
  redFlags
    .flatMap((line) => line.split(/[:,]/).map((part) => part.trim()).filter(Boolean))
    .slice(0, 12)
    .forEach((phrase) => {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(${escaped})`, 'ig');
      html = html.replace(re, '<span class="highlight" title="Suspicious social engineering phrase">$1</span>');
    });
  return html;
}

function revealReport() {
  [...document.querySelectorAll('.reveal-item')].forEach((item, index) => {
    item.classList.remove('show');
    setTimeout(() => item.classList.add('show'), index * 100);
  });
}

function typewriter(text, target) {
  target.classList.remove('hidden');
  target.textContent = '';
  let i = 0;
  const timer = setInterval(() => {
    i += 1;
    target.textContent = text.slice(0, i);
    if (i >= text.length) clearInterval(timer);
  }, 10);
}

function renderReport(report) {
  const data = report || {};
  const signals = data.signals || {};
  const risk = data.risk || { score: 0, topReasons: [] };
  const score = Math.max(0, Math.min(100, risk.score || 0));

  el.skeletonState.classList.add('hidden');
  el.emptyState.classList.add('hidden');
  el.reportRoot.classList.remove('hidden');

  el.severityLabel.textContent = severityText(score);
  const displaySummary =
    data.ai?.summary && data.ai.summary.trim().length > 0
      ? data.ai.summary
      : 'Analysis complete. No specific threats detected.';
  el.aiSummary.textContent = displaySummary;
  animateGauge(score);

  const reasons = risk.topReasons || [];
  el.redFlagsList.innerHTML = '';
  reasons.slice(0, 5).forEach((reason, idx) => el.redFlagsList.appendChild(createFlagCard(reason, idx)));

  const homographMap = new Map((signals.homographResult?.domains || []).map((item) => [item.domain, item.result]));
  const enrichedUrls = (signals.urlResult?.urls || []).map((entry) => {
    try {
      const domain = new URL(entry.finalDestination || entry.original).hostname;
      return { ...entry, homograph: homographMap.get(domain) || entry.homograph || { isHomograph: false } };
    } catch (_) {
      return { ...entry, homograph: entry.homograph || { isHomograph: false } };
    }
  });

  renderUrlTable(enrichedUrls);

  const header = signals.headerResult || {};
  const sender = signals.senderResult || {};
  el.senderPanel.textContent = [
    `From: ${header.extracted?.from || 'n/a'}`,
    `Reply-To: ${header.extracted?.replyTo || 'n/a'}`,
    `Return-Path: ${header.extracted?.returnPath || 'n/a'}`,
    `Display Name: ${sender.displayName || 'n/a'}`,
    `Actual Email: ${sender.actualEmail || 'n/a'}`,
    `Mismatch: ${sender.mismatch ? 'YES' : 'No'}`,
    `Hop Count: ${header.hopCount || 0}`,
    `Origin IP: ${header.originIP || 'n/a'}`
  ].join('\n');

  renderAuthPills(header.authResults || {});

  const contentResult = signals.contentResult || {};
  el.highlightedEmail.innerHTML = highlightContent(appState.currentEmail, contentResult.redFlags || []);
  renderWordCloud(contentResult.redFlags || []);

  const ai = data.ai || {};
  el.attribution.textContent = [
    `Attack Type: ${ai.attackType || 'other'}`,
    `Sophistication: ${ai.sophistication || 'unknown'}`,
    `Likely Target: ${ai.likelyTarget || 'unknown'}`,
    `Confidence: ${ai.confidenceScore ?? 0}`,
    `Provider: ${ai.provider || 'n/a'}`
  ].join('\n');

  const matrixRows = [
    ['Initial Access: Phishing', (signals.urlResult?.urls || []).length ? 'Observed' : 'Possible'],
    ['Credential Access', contentResult.credentialRequest ? 'Observed' : 'No'],
    ['Defense Evasion', header.authResults?.spf === 'fail' || header.authResults?.dkim === 'fail' ? 'Observed' : 'Unknown'],
    ['Collection', /invoice|account|login|wire/i.test(appState.currentEmail) ? 'Likely' : 'Unknown']
  ];
  el.tacticsMatrix.innerHTML = matrixRows.map((row) => `<tr><td>${row[0]}</td><td>${row[1]}</td></tr>`).join('');

  revealReport();
}

function mergePartial(section, data) {
  if (!appState.analysis) {
    appState.analysis = { signals: {} };
  }

  if (section === 'ai') {
    appState.analysis.ai = data;
    return;
  }

  if (!appState.analysis.signals) {
    appState.analysis.signals = {};
  }
  appState.analysis.signals[section] = data;
}

async function analyze() {
  const rawEmail = el.rawEmail.value.trim();
  if (!rawEmail) {
    alert('Paste or load an email first.');
    return;
  }

  appState.currentEmail = rawEmail;
  appState.analysis = { signals: {} };
  appState.isAnalyzing = true;

  el.progressTrack.textContent = '> Starting forensic pipeline...';
  el.emptyState.classList.add('hidden');
  el.reportRoot.classList.add('hidden');
  el.skeletonState.classList.remove('hidden');

  try {
    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawEmail })
    });

    if (!response.ok || !response.body) {
      throw new Error(`Analyze request failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';

      chunks.forEach((chunk) => {
        const lines = chunk.split('\n');
        let eventName = 'message';
        let dataLine = '';

        lines.forEach((line) => {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          if (line.startsWith('data:')) dataLine += line.slice(5).trim();
        });

        if (!dataLine || dataLine === '[DONE]') return;

        let parsed;
        try {
          parsed = JSON.parse(dataLine);
        } catch (_) {
          return;
        }

        if (eventName === 'progress') {
          el.progressTrack.textContent = `> ${parsed.message}`;
        } else if (eventName === 'partial') {
          mergePartial(parsed.section, parsed.data);
          renderReport(appState.analysis);
        } else if (eventName === 'complete') {
          appState.analysis = parsed;
          renderReport(appState.analysis);
          el.progressTrack.textContent = '> Analysis complete';
        } else if (eventName === 'error') {
          throw new Error(parsed.error || 'Unknown stream error');
        }
      });
    }
  } catch (error) {
    el.progressTrack.textContent = `> Error: ${error.message}`;
    alert(`Analysis failed: ${error.message}`);
  } finally {
    appState.isAnalyzing = false;
    el.skeletonState.classList.add('hidden');
  }
}

function parseReasoningSSE(rawText) {
  return rawText
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, ''))
    .filter((line) => line !== '[DONE]');
}

async function streamReasoning() {
  if (!appState.analysis) {
    alert('Run analysis first.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: { rawEmail: appState.currentEmail, ...appState.analysis } })
    });
    const raw = await res.text();
    const pieces = parseReasoningSSE(raw);
    const streamText = pieces.join('\n');
    typewriter(streamText, el.reasoningStream);
  } catch (error) {
    typewriter(`Reasoning stream failed: ${error.message}`, el.reasoningStream);
  }
}

function reportId(report) {
  const input = JSON.stringify(report || {}).slice(0, 900);
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `PHL-${Math.abs(hash).toString(16).toUpperCase()}`;
}

async function downloadPdf() {
  if (!appState.analysis) {
    alert('Run analysis first.');
    return;
  }

  const report = document.getElementById('reportRoot');
  const canvas = await html2canvas(report, { scale: 2, backgroundColor: '#0a0e1a' });
  const image = canvas.toDataURL('image/png');
  const pdf = new window.jspdf.jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const title = `PhishLens Incident Report - ${new Date().toLocaleString()}`;
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(11);
  pdf.text(title, 24, 24);

  const imgWidth = pageWidth - 48;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  pdf.addImage(image, 'PNG', 24, 36, imgWidth, Math.min(imgHeight, pageHeight - 72));
  pdf.setFontSize(9);
  pdf.text(`Report ID: ${reportId(appState.analysis)}`, 24, pageHeight - 20);
  pdf.text('Generated by PhishLens', pageWidth - 130, pageHeight - 20);
  pdf.save(`PhishLens_Report_${Date.now()}.pdf`);
}

function copyIocs() {
  if (!appState.analysis) {
    alert('Run analysis first.');
    return;
  }

  const iocs = new Set();
  const urls = appState.analysis.signals?.urlResult?.urls || [];
  urls.forEach((entry) => {
    if (entry.original) iocs.add(entry.original);
    if (entry.finalDestination) iocs.add(entry.finalDestination);
    try {
      iocs.add(new URL(entry.finalDestination || entry.original).hostname);
    } catch (_) {
      // no-op
    }
  });

  const text = [...iocs].join('\n') || 'No IOCs found.';
  navigator.clipboard.writeText(text);
  alert('IOCs copied to clipboard.');
}

function shareAnalysis() {
  if (!appState.analysis) {
    alert('Run analysis first.');
    return;
  }
  const link = `${window.location.origin}${window.location.pathname}#report=${reportId(appState.analysis)}`;
  navigator.clipboard.writeText(link);
  alert(`Share link copied: ${link}`);
}

el.tabs.forEach((tab) => tab.addEventListener('click', () => setTab(tab.dataset.tab)));
el.loadSampleBtn.addEventListener('click', () => {
  el.rawEmail.value = samples[el.samplePicker.value];
  setTab('paste');
});
el.samplePicker.addEventListener('change', () => {
  el.rawEmail.value = samples[el.samplePicker.value];
});
el.emlUpload.addEventListener('change', async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  el.rawEmail.value = await file.text();
  el.uploadMeta.textContent = `Loaded ${file.name} (${Math.round(file.size / 1024)} KB)`;
  setTab('paste');
});

el.analyzeBtn.addEventListener('click', analyze);
el.showReasoningBtn.addEventListener('click', streamReasoning);
el.downloadPdfBtn.addEventListener('click', downloadPdf);
el.copyIocsBtn.addEventListener('click', copyIocs);
el.shareAnalysisBtn.addEventListener('click', shareAnalysis);

const params = new URLSearchParams(window.location.search);
const prefill = params.get('prefill');
if (prefill) {
  el.rawEmail.value = decodeURIComponent(prefill);
} else {
  el.rawEmail.value = samples.paypal;
}
