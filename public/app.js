const API_BASE = 'http://localhost:3001';

const samples = {
  paypal: `From: PayPal Security <alerts@paypa1-alerts.top>
Reply-To: verification@security-checker-paypal.xyz
Return-Path: bounce@mailer-payments.click
Authentication-Results: mx.google.com; spf=fail dkim=fail dmarc=fail
Received: from unknown (185.244.25.44)
Subject: Account Suspended - Verify now

Dear Customer,
Your account has been suspended. Verify within 24 hours immediately!
Click to login: https://bit.ly/paypal-restore
`,
  bec: `From: "CEO John Miller" <johnmiller.exec@gmail.com>
Reply-To: transfers@vendor-invoice.work
Return-Path: ceo-office@mailer.work
Authentication-Results: spf=fail dkim=neutral dmarc=fail
Subject: Wire transfer needed today

Hi,
Act now. Need confidential transfer of $47,900 to vendor before final notice from legal.
`,
  m365: `From: Microsoft 365 Team <security@micrоsoft-login.top>
Reply-To: noreply@msverify.top
Return-Path: notify@msverify.top
Authentication-Results: spf=pass dkim=fail dmarc=fail

Dear User,
Your account will be locked. verify your password now at https://microsoft-help-secure.com/login/microsoft
`,
  crypto: `From: Crypto Airdrop <reward@coin-drop.xyz>
Reply-To: claim@coin-drop.xyz
Return-Path: reward@coin-drop.xyz
Authentication-Results: spf=softfail dkim=fail dmarc=fail

You've won an exclusive airdrop!!! Claim your prize immediately!!!
`,
  newsletter: `From: GitHub <noreply@github.com>
Reply-To: noreply@github.com
Return-Path: noreply@github.com
Authentication-Results: mx.google.com; spf=pass dkim=pass dmarc=pass
Subject: Octoverse newsletter

Hello developer,
This is your monthly product update from GitHub.
`
};

const progressStages = ['Parsing headers...', 'Unshortening URLs...', 'Detecting homographs...', 'AI analysis...'];
const state = { activeTab: 'paste', latestAnalysis: null, latestPayload: null };

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

function splitHeadersAndBody(rawEmail) {
  const text = String(rawEmail || '');
  const separator = text.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
  const [headers, ...rest] = text.split(separator);
  return { headers: headers || '', content: rest.join('\n\n') || '' };
}

function inferUrls(text) {
  return String(text || '').match(/https?:\/\/[^\s<>"']+/g) || [];
}

function inferAttachments(rawEmail) {
  const matches = String(rawEmail || '').match(/filename\*?=(?:\"([^\"]+)\"|([^;\s]+))/gi) || [];
  return matches.map((entry) => entry.split('=')[1].replace(/["']/g, ''));
}

function getPayload() {
  const raw = el.rawEmail.value.trim();
  const { headers, content } = splitHeadersAndBody(raw);
  return { rawEmail: raw, headers, content, urls: inferUrls(raw), attachments: inferAttachments(raw) };
}

function setTab(tabId) {
  state.activeTab = tabId;
  el.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === tabId));
  el.tabContents.forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${tabId}`));
}

function severityText(value) {
  if (value >= 81) return 'CRITICAL THREAT';
  if (value >= 51) return 'DANGEROUS';
  if (value >= 21) return 'SUSPICIOUS';
  return 'SAFE';
}

function severityColor(score) {
  if (score >= 81) return '#ff3b5c';
  if (score >= 51) return '#ff6f3b';
  if (score >= 21) return '#ffaa00';
  return '#00ff88';
}

function highlightContent(content, flags) {
  let output = content || '';
  const phrases = [];
  (flags || []).forEach((item) => {
    const fragment = item.split(':')[1] || item;
    fragment
      .split(',')
      .map((part) => part.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(Boolean)
      .forEach((part) => phrases.push(part));
  });
  phrases.slice(0, 12).forEach((phrase) => {
    const rgx = new RegExp(`(${phrase})`, 'ig');
    output = output.replace(rgx, '<span class="highlight" title="Urgency tactic: creates false time pressure">$1</span>');
  });
  return output || 'No body content provided.';
}

function animateGauge(targetScore) {
  const circumference = 553;
  const duration = 1500;
  const start = performance.now();
  function frame(now) {
    const progress = Math.min(1, (now - start) / duration);
    const current = Math.round(targetScore * progress);
    const offset = circumference - (circumference * current) / 100;
    el.riskScore.textContent = String(current);
    el.gaugeFill.style.strokeDashoffset = `${offset}`;
    if (progress < 1) requestAnimationFrame(frame);
  }
  el.gaugeFill.style.stroke = severityColor(targetScore);
  requestAnimationFrame(frame);
}

function createFlagCard(reason, index) {
  const div = document.createElement('div');
  div.className = 'red-flag-card';
  div.innerHTML = `
    <div class="severity-bar"></div>
    <div class="red-flag-main">
      <strong>${reason}</strong>
      <small>Evidence: heuristic signal #${index + 1}</small>
    </div>
    <button class="expand-btn">details</button>
    <div class="red-flag-detail">Technical detail: This indicator contributed strongly to the final risk score and aligns with common phishing tradecraft.</div>
  `;
  const button = div.querySelector('.expand-btn');
  const detail = div.querySelector('.red-flag-detail');
  button.addEventListener('click', () => detail.classList.toggle('open'));
  setTimeout(() => div.classList.add('show'), 130 + index * 90);
  return div;
}

function renderUrlTable(urls) {
  el.urlTableBody.innerHTML = '';
  (urls || []).forEach((entry) => {
    const tr = document.createElement('tr');
    tr.classList.add('scan-row');
    let host = '';
    try {
      host = new URL(entry.finalDestination || entry.original).hostname;
    } catch (_) {
      host = '';
    }
    const homographLine = entry.homograph?.isHomograph
      ? `Detected: ${host}<br/>Looks like: ${entry.homograph.normalized || 'n/a'}`
      : 'None';
    const flags = (entry.flags || [])
      .map((f) => `<span class="badge ${/ip|homograph|credential|brand/i.test(f) ? 'danger' : 'warn'}">${f}</span>`)
      .join('');
    tr.innerHTML = `
      <td><a href="#" data-url="${entry.original}">${entry.original}</a></td>
      <td>${entry.finalDestination || entry.original}</td>
      <td>${entry.hops?.length || 0}</td>
      <td>${flags || '<span class="badge ok">clean</span>'}</td>
      <td>${homographLine}</td>
    `;
    tr.querySelector('a').addEventListener('click', (evt) => {
      evt.preventDefault();
      const url = evt.currentTarget.dataset.url;
      alert(`Preview only: ${url}\nPotential destination intent inferred from flags and redirection patterns.`);
    });
    el.urlTableBody.appendChild(tr);
  });
}

function renderAuthPills(authResults = {}) {
  el.authPills.innerHTML = '';
  ['spf', 'dkim', 'dmarc'].forEach((k) => {
    const value = authResults[k] || 'unknown';
    const pill = document.createElement('span');
    pill.className = `pill ${value === 'pass' ? 'pass' : value === 'fail' ? 'fail' : 'unknown'}`;
    pill.textContent = `${k.toUpperCase()}: ${value}`;
    el.authPills.appendChild(pill);
  });
}

function renderWordCloud(flags = []) {
  el.wordCloud.innerHTML = '';
  const words = flags.flatMap((item) => item.split(/[:,]/).map((t) => t.trim()).filter(Boolean));
  words.slice(0, 20).forEach((word, i) => {
    const span = document.createElement('span');
    span.textContent = word;
    span.style.fontSize = `${0.75 + ((i % 6) + 1) * 0.11}rem`;
    span.style.opacity = `${0.65 + (i % 5) * 0.06}`;
    el.wordCloud.appendChild(span);
  });
}

function revealReport() {
  const items = [...document.querySelectorAll('.reveal-item')];
  items.forEach((item, idx) => setTimeout(() => item.classList.add('show'), idx * 100));
}

function parseReasoningSSE(rawText) {
  return rawText
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, ''))
    .filter((line) => line !== '[DONE]');
}

async function streamReasoning(context) {
  el.reasoningStream.classList.remove('hidden');
  el.reasoningStream.textContent = '';
  try {
    const res = await fetch(`${API_BASE}/api/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context })
    });
    const raw = await res.text();
    const chunks = parseReasoningSSE(raw);
    let cursor = 0;
    const combined = chunks.join('\n');
    const timer = setInterval(() => {
      cursor += 1;
      el.reasoningStream.textContent = combined.slice(0, cursor);
      if (cursor >= combined.length) clearInterval(timer);
    }, 12);
  } catch (error) {
    el.reasoningStream.textContent = `Reasoning stream failed: ${error.message}`;
  }
}

async function runProgressAnimation() {
  el.progressTrack.textContent = '';
  for (const stage of progressStages) {
    el.progressTrack.textContent = `> ${stage}`;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 450));
  }
}

async function runAnalysis() {
  const payload = getPayload();
  if (!payload.rawEmail.trim()) {
    alert('Please provide raw email content first.');
    return;
  }
  state.latestPayload = payload;
  el.emptyState.classList.add('hidden');
  el.reportRoot.classList.add('hidden');
  el.skeletonState.classList.remove('hidden');
  await runProgressAnimation();
  let data;
  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    data = await res.json();
  } catch (error) {
    data = {
      risk: { score: 0, severity: 'safe', topReasons: [`API error: ${error.message}`] },
      ai: { summary: 'Unable to reach backend AI service.' },
      signals: { headerResult: {}, senderResult: {}, contentResult: {}, urlResult: { urls: [] }, attachmentResult: {} }
    };
  }
  state.latestAnalysis = data;
  renderReport(data, payload);
}

function renderReport(data, payload) {
  el.skeletonState.classList.add('hidden');
  el.reportRoot.classList.remove('hidden');
  const risk = data.risk || { score: 0, topReasons: [] };
  const score = Math.max(0, Math.min(100, risk.score || 0));
  el.severityLabel.textContent = severityText(score);
  el.aiSummary.textContent = data.ai?.summary || data.ai?.response || 'AI summary unavailable.';
  animateGauge(score);
  el.redFlagsList.innerHTML = '';
  const topReasons = risk.topReasons || risk.reasons || ['No major red flags detected.'];
  topReasons.slice(0, 5).forEach((reason, index) => el.redFlagsList.appendChild(createFlagCard(reason, index)));
  const urls = (data.signals?.urlResult?.urls || []).map((u) => ({ ...u, homograph: u.homograph || { isHomograph: false } }));
  renderUrlTable(urls);
  const header = data.signals?.headerResult || {};
  const sender = data.signals?.senderResult || {};
  el.senderPanel.innerHTML = [
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
  const contentFlags = data.signals?.contentResult?.redFlags || [];
  el.highlightedEmail.innerHTML = highlightContent(payload.content || payload.rawEmail, contentFlags);
  renderWordCloud(contentFlags);
  const ai = data.ai || {};
  el.attribution.innerHTML = [
    `Attack Type: ${ai.attackType || 'other'}`,
    `Sophistication: ${ai.sophistication || 'unknown'}`,
    `Likely Target: ${ai.likelyTarget || 'unknown'}`,
    `Confidence: ${ai.confidenceScore ?? 0}`
  ].join('\n');
  const tactics = [
    ['Initial Access: Phishing', contentFlags.length ? 'Observed' : 'Possible'],
    ['Credential Access', data.signals?.contentResult?.credentialRequest ? 'Observed' : 'No'],
    ['Defense Evasion', header.authResults?.spf === 'fail' || header.authResults?.dkim === 'fail' ? 'Observed' : 'Unknown'],
    ['Collection', /invoice|account|login/i.test(payload.rawEmail) ? 'Likely' : 'Unknown']
  ];
  el.tacticsMatrix.innerHTML = tactics.map((t) => `<tr><td>${t[0]}</td><td>${t[1]}</td></tr>`).join('');
  el.reasoningStream.classList.add('hidden');
  el.reasoningStream.textContent = '';
  revealReport();
}

function hashReportId(data) {
  const input = JSON.stringify(data || {}).slice(0, 800);
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `PHL-${Math.abs(hash).toString(16).toUpperCase()}`;
}

async function downloadPdf() {
  const target = document.getElementById('reportRoot');
  if (target.classList.contains('hidden')) {
    alert('Run an analysis first.');
    return;
  }
  const canvas = await html2canvas(target, { scale: 2, backgroundColor: '#0a0e1a' });
  const image = canvas.toDataURL('image/png');
  const pdf = new window.jspdf.jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  const width = 555;
  const height = (canvas.height * width) / canvas.width;
  pdf.addImage(image, 'PNG', 20, 20, width, height);
  pdf.save(`phishlens-report-${Date.now()}.pdf`);
}

function collectIocs() {
  const data = state.latestAnalysis || {};
  const urls = data.signals?.urlResult?.urls || [];
  const iocs = new Set();
  urls.forEach((entry) => {
    if (entry.original) iocs.add(entry.original);
    if (entry.finalDestination) iocs.add(entry.finalDestination);
    try {
      iocs.add(new URL(entry.finalDestination || entry.original).hostname);
    } catch (_) {
      // noop
    }
  });
  const text = [...iocs].join('\n') || 'No IOCs detected.';
  navigator.clipboard.writeText(text);
  alert('IOCs copied to clipboard.');
}

function shareAnalysis() {
  if (!state.latestAnalysis) {
    alert('Run an analysis first.');
    return;
  }
  const id = hashReportId(state.latestAnalysis);
  const shareLink = `${window.location.origin}${window.location.pathname}#report=${id}`;
  navigator.clipboard.writeText(shareLink);
  alert(`Share link copied: ${shareLink}`);
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
  const text = await file.text();
  el.rawEmail.value = text;
  el.uploadMeta.textContent = `Loaded ${file.name} (${Math.round(file.size / 1024)} KB)`;
  setTab('paste');
});
el.analyzeBtn.addEventListener('click', runAnalysis);
el.showReasoningBtn.addEventListener('click', () => streamReasoning(state.latestPayload || getPayload()));
el.downloadPdfBtn.addEventListener('click', downloadPdf);
el.copyIocsBtn.addEventListener('click', collectIocs);
el.shareAnalysisBtn.addEventListener('click', shareAnalysis);
el.rawEmail.value = samples.paypal;
