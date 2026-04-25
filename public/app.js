const API_BASE = 'http://localhost:3001';

const appState = {
  mode: 'email',
  currentInput: '',
  currentEmail: '', // legacy alias kept for PDF/IOC features
  analysis: null,
  isAnalyzing: false
};

/* ============================================================
   MODE METADATA — drives panel titles, button labels, loader copy,
   verdict eyebrow, and analyze() payload shape.
   ============================================================ */
const MODE_INFO = {
  email: {
    label: 'Email',
    panelTitle: 'Input',
    panelSub: 'Paste, upload, or load a sample',
    btnIdle: 'ANALYZE EMAIL',
    btnLoading: 'Analyzing…',
    loaderTitle: 'Analyzing email…',
    loaderSub: 'Scanning headers, links, and content',
    verdictTitle: 'Email Analysis Complete',
    emptyMessage: 'Paste an email and click Analyze to begin'
  },
  url: {
    label: 'URL',
    panelTitle: 'URL Scanner',
    panelSub: 'Single URL — checks domain, TLD, redirects, lookalikes',
    btnIdle: 'SCAN URL',
    btnLoading: 'Scanning…',
    loaderTitle: 'Scanning URL…',
    loaderSub: 'Inspecting domain, TLD, redirects and lookalikes',
    verdictTitle: 'URL Scan Complete',
    emptyMessage: 'Paste a URL and click Scan to begin'
  },
  sms: {
    label: 'SMS',
    panelTitle: 'SMS Analyzer',
    panelSub: 'Paste an SMS to detect smishing patterns',
    btnIdle: 'ANALYZE SMS',
    btnLoading: 'Analyzing…',
    loaderTitle: 'Analyzing SMS…',
    loaderSub: 'Detecting smishing patterns and shortened links',
    verdictTitle: 'SMS Analysis Complete',
    emptyMessage: 'Paste an SMS and click Analyze to begin'
  },
  job: {
    label: 'Job Offer',
    panelTitle: 'Recruiter / Job Offer',
    panelSub: 'Paste a recruiter message or job offer',
    btnIdle: 'ANALYZE OFFER',
    btnLoading: 'Analyzing…',
    loaderTitle: 'Analyzing job offer…',
    loaderSub: 'Checking sender domain, salary realism, and harvesting tactics',
    verdictTitle: 'Job Offer Analysis Complete',
    emptyMessage: 'Paste a recruiter message and click Analyze to begin'
  }
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

const urlSamples = {
  typo: 'https://paypa1-secure-login.com/account/verify',
  homograph: 'https://раypal.com/signin', // Cyrillic 'р' and 'а'
  shortener: 'https://bit.ly/account-update-now',
  subdomain: 'https://www.amazon.com.security-update.top/orders/sign-in',
  ip: 'http://185.244.25.44/login.html',
  legit: 'https://github.com'
};

const smsSamples = {
  bank: 'HDFC ALERT: Your account has been locked due to suspicious activity. Reactivate within 2 hours: http://hdfc-secure.click/verify Failure may permanently disable banking.',
  package: 'FedEx: Your package #FX2871 is held at customs. Pay $2.99 redelivery fee to release: http://fedex-redirect.click/pay',
  prize: "Congratulations! You've won an iPhone 15 Pro in the Amazon prime day giveaway. Claim within 1 hour: bit.ly/iphone-prize",
  otp: "Your OTP is 729812. Don't share. Reply YES to confirm transaction of Rs.45000. Call 1800-XXX immediately if not authorized.",
  emergency: 'Hi Mom, I lost my phone, this is my new number. Please send Rs.5000 via Google Pay to 9876543210 ASAP for emergency. Will explain later.',
  legit: 'Your delivery OTP is 4892. Share only with the BlueDart courier on arrival. Track at www.bluedart.com/tracking'
};

const jobSamples = {
  bigtech: `From: hr.recruiter@gmail.com
Subject: Senior Software Engineer at Google - Immediate Joining

Dear Candidate,

Greetings from Google Talent Acquisition Team!

We have shortlisted your profile for the Senior Software Engineer position with a CTC of $250,000/year, fully remote.

Please share your passport, PAN card, bank account details, address proof and 6 months of salary slips so we can process the offer letter today.

Position closes in 24 hours. Limited slots.

Regards,
Mark Stevens
Sr. Director, Talent Acquisition - Google`,
  deposit: `From: hr@payroll-onboarding.work
Subject: Welcome to ABC Tech - Onboarding

Hi,

Congratulations! You've been selected for the Data Analyst role at ABC Tech with a monthly salary of $4500.

To complete onboarding, please pay a refundable deposit of $499 via wire transfer for laptop courier within 24 hours. Bank details attached.

Once payment is received, your laptop and offer letter will be dispatched.`,
  dataentry: `From: jobs.global2026@outlook.com
Subject: Easy Work From Home - Earn $9000/month

We are hiring for simple data entry work. Earn $9000/month with just 2 hours/day.

No experience needed. Full training provided.

Send your bank account, Aadhaar, PAN and a recent photo to confirm registration. Limited slots, respond within 30 minutes.`,
  reship: `From: warehouse.ops@us-shipping-partners.com
Subject: Quality Control Associate - Remote, $4500/month

Easy remote work-from-home role. We will ship packages to your home address. You re-pack them and forward to our customers in another country.

We pay $4500/month + bonuses for each shipment.

Reply with your full address, photo ID, and bank details.`,
  legit: `From: jane.smith@netflix.com
Subject: Netflix Software Engineer - Interview Invite

Hi,

Thanks for applying to Netflix. I'd love to schedule a 30-min screening call this week to discuss the Senior Software Engineer (Streaming Platform) role.

Please share 2-3 time slots that work for you. No documents needed at this stage.

Best,
Jane Smith
Recruiting, Netflix`
};

const el = {
  tabs: [...document.querySelectorAll('.tab-switch .tab')],
  tabContents: [...document.querySelectorAll('.tab-content')],
  subtabs: [...document.querySelectorAll('.subtab')],
  subtabContents: [...document.querySelectorAll('.subtab-content')],
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
  confidenceMeta: document.getElementById('confidenceMeta'),
  detectionSourceMeta: document.getElementById('detectionSourceMeta'),
  providerMeta: document.getElementById('providerMeta'),
  recommendCard: document.getElementById('recommendCard'),
  recommendTitle: document.getElementById('recommendTitle'),
  recommendDetail: document.getElementById('recommendDetail'),
  redFlagsList: document.getElementById('redFlagsList'),
  redFlagsEmpty: document.getElementById('redFlagsEmpty'),
  evidenceSub: document.getElementById('evidenceSub'),
  overviewBullets: document.getElementById('overviewBullets'),
  riskFactorsList: document.getElementById('riskFactorsList'),
  senderKv: document.getElementById('senderKv'),
  urlTableBody: document.getElementById('urlTableBody'),
  senderPanel: document.getElementById('senderPanel'),
  authPills: document.getElementById('authPills'),
  contentTags: document.getElementById('contentTags'),
  highlightedEmail: document.getElementById('highlightedEmail'),
  wordCloud: document.getElementById('wordCloud'),
  attribution: document.getElementById('attribution'),
  tacticsMatrix: document.getElementById('tacticsMatrix'),
  showReasoningBtn: document.getElementById('showReasoningBtn'),
  reasoningStream: document.getElementById('reasoningStream'),
  rawJson: document.getElementById('rawJson'),
  copyJsonBtn: document.getElementById('copyJsonBtn'),
  reportPhishBtn: document.getElementById('reportPhishBtn'),
  copySummaryBtn: document.getElementById('copySummaryBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  downloadPdfBtn: document.getElementById('downloadPdfBtn'),
  copyIocsBtn: document.getElementById('copyIocsBtn'),
  shareAnalysisBtn: document.getElementById('shareAnalysisBtn'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeToggleLabel: document.getElementById('themeToggleLabel'),
  gaugeSubtitle: document.getElementById('gaugeSubtitle'),
  recommendIcon: document.getElementById('recommendIcon'),
  recommendActionBtn: document.getElementById('recommendActionBtn'),
  threatBarsCanvas: document.getElementById('threatBarsChart'),
  threatBarsEmpty: document.getElementById('threatBarsEmpty'),
  threatDonutCanvas: document.getElementById('threatDonutChart'),
  threatDonutLegend: document.getElementById('threatDonutLegend'),
  evidenceTimeline: document.getElementById('evidenceTimeline'),
  timelineSub: document.getElementById('timelineSub'),
  authChips: document.getElementById('authChips'),
  authVerdict: document.getElementById('authVerdict'),
  trustMeterFill: document.getElementById('trustMeterFill'),
  trustScoreValue: document.getElementById('trustScoreValue'),
  trustBars: document.getElementById('trustBars'),
  linkCardsList: document.getElementById('linkCardsList'),
  brandIcon: document.getElementById('brandIcon'),
  analyzeBtnLabel: document.getElementById('analyzeBtnLabel'),
  loaderSteps: document.getElementById('loaderSteps'),
  // multi-mode controls
  modeTabs: [...document.querySelectorAll('.mode-switch .mode-tab')],
  modePanels: [...document.querySelectorAll('.mode-panel')],
  panelTitle: document.getElementById('panelTitle'),
  panelSub: document.getElementById('panelSub'),
  loaderTitle: document.getElementById('loaderTitle'),
  loaderSub: document.getElementById('loaderSub'),
  verdictEyebrow: document.getElementById('verdictEyebrow'),
  // URL mode
  urlInput: document.getElementById('urlInput'),
  urlSamplePicker: document.getElementById('urlSamplePicker'),
  urlLoadSampleBtn: document.getElementById('urlLoadSampleBtn'),
  // SMS mode
  smsInput: document.getElementById('smsInput'),
  smsSamplePicker: document.getElementById('smsSamplePicker'),
  smsLoadSampleBtn: document.getElementById('smsLoadSampleBtn'),
  // Job mode
  jobInput: document.getElementById('jobInput'),
  jobSamplePicker: document.getElementById('jobSamplePicker'),
  jobLoadSampleBtn: document.getElementById('jobLoadSampleBtn')
};

const charts = { bars: null, donut: null };

/* === THEME TOGGLE ======================================== */
(function initTheme() {
  const saved = localStorage.getItem('phishlens-theme');
  if (saved === 'light') document.body.classList.add('theme-light');
  updateThemeLabel();
})();

function updateThemeLabel() {
  if (!el.themeToggleLabel) return;
  const isLight = document.body.classList.contains('theme-light');
  el.themeToggleLabel.textContent = isLight ? 'Dark' : 'Light';
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('theme-light');
  localStorage.setItem('phishlens-theme', isLight ? 'light' : 'dark');
  updateThemeLabel();
  if (appState.analysis) {
    try { renderReport(appState.analysis); } catch (_) { /* noop */ }
  }
}

if (el.themeToggleBtn) el.themeToggleBtn.addEventListener('click', toggleTheme);

function setTab(tabId) {
  el.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === tabId));
  el.tabContents.forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${tabId}`));
}

function setSubtab(subId) {
  el.subtabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.subtab === subId));
  el.subtabContents.forEach((panel) => panel.classList.toggle('active', panel.id === `sub-${subId}`));
}

function severityToneFromScore(score) {
  if (score > 80) return 'critical';
  if (score > 60) return 'high';
  if (score > 40) return 'moderate';
  if (score > 20) return 'low';
  return 'safe';
}

function recommendedActionFor(score) {
  if (score > 80) {
    return {
      tone: 'critical',
      icon: '🔴',
      title: 'Report and delete immediately',
      detail: 'Do not click links, open attachments, or reply. Forward to your security team and delete from your inbox.',
      button: 'Report this email'
    };
  }
  if (score > 60) {
    return {
      tone: 'high',
      icon: '🟠',
      title: 'Do not click any links',
      detail: 'Treat this as a high-confidence phishing attempt. Avoid all links and attachments and report it to your IT/security team.',
      button: 'Report this email'
    };
  }
  if (score > 40) {
    return {
      tone: 'moderate',
      icon: '🟡',
      title: 'Verify sender before responding',
      detail: 'Several phishing indicators present. Confirm the sender through a separate, trusted channel before taking any action.',
      button: 'Verify sender'
    };
  }
  if (score > 20) {
    return {
      tone: 'low',
      icon: '🟡',
      title: 'Verify sender before acting',
      detail: 'Some weak phishing signals detected. Take a second look at the sender domain and any links before responding.',
      button: 'Verify sender'
    };
  }
  return {
    tone: 'safe',
    icon: '🟢',
    title: 'Safe to read and respond',
    detail: 'No significant phishing signals detected. Standard caution still applies.',
    button: 'Mark as safe'
  };
}

function severityText(score) {
  if (score > 80) return 'CRITICAL THREAT';
  if (score > 60) return 'HIGH RISK';
  if (score > 40) return 'MODERATE';
  if (score > 20) return 'LOW RISK';
  return 'SAFE';
}

/* === SEVERITY PALETTE (Tailwind hues, theme-aware) ====== */
const SEV_PALETTE_DARK = {
  safe:     '#22c55e',
  low:      '#84cc16',
  moderate: '#f59e0b',
  high:     '#f97316',
  critical: '#ef4444',
  neutral:  '#64748b'
};
const SEV_PALETTE_LIGHT = {
  safe:     '#16a34a',
  low:      '#65a30d',
  moderate: '#d97706',
  high:     '#ea580c',
  critical: '#dc2626',
  neutral:  '#475569'
};

function palette() {
  return document.body.classList.contains('theme-light') ? SEV_PALETTE_LIGHT : SEV_PALETTE_DARK;
}

function severityColor(score) {
  const p = palette();
  if (score >= 76) return p.critical;
  if (score >= 51) return p.high;
  if (score >= 21) return p.moderate;
  if (score >= 1)  return p.low;
  return p.safe;
}

function severityHexForTone(tone) {
  return palette()[tone] || palette().neutral;
}

function animateGauge(targetScore) {
  const circumference = 553;
  const duration = 1500;
  const started = performance.now();

  function tick(now) {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(targetScore * eased);
    const offset = circumference - (circumference * current) / 100;
    el.riskScore.textContent = String(current);
    el.gaugeFill.style.strokeDashoffset = `${offset}`;
    el.gaugeFill.style.stroke = severityColor(current);
    if (progress < 1) requestAnimationFrame(tick);
  }

  const verdictCard = document.querySelector('.verdict-card');
  if (verdictCard) verdictCard.classList.toggle('gauge-pulse', targetScore >= 100);

  el.gaugeFill.style.stroke = severityColor(targetScore);
  requestAnimationFrame(tick);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createFlagCard(flag, index) {
  const label = typeof flag === 'string' ? flag : flag?.label || 'Unnamed signal';
  const evidence =
    typeof flag === 'object' && flag?.evidence
      ? flag.evidence
      : `Evidence stream #${index + 1}`;

  const card = document.createElement('div');
  card.className = 'red-flag-card';
  card.innerHTML = `
    <div class="severity-bar"></div>
    <div class="red-flag-main">
      <strong>${escapeHtml(label)}</strong>
      <small>${escapeHtml(evidence)}</small>
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
    // re-flow so the animation re-triggers on subsequent renders
    void item.offsetWidth; // eslint-disable-line no-unused-expressions
    setTimeout(() => item.classList.add('show'), index * 100);
  });
}

/* ============================================================
   v2 LOADING STATE — 3-state UI machine + cosmetic step ticker
   ============================================================ */

const LOADER_STEPS = [
  'Parsing email headers',
  'Checking sender authentication',
  'Analyzing links and URLs',
  'Running AI threat detection',
  'Generating risk assessment'
];

const loader = {
  intervalId: null,
  index: 0,
  stepDuration: 1800
};

function setStepState(idx, state) {
  if (!el.loaderSteps) return;
  const node = el.loaderSteps.querySelector(`.loader-step[data-step="${idx}"]`);
  if (!node) return;
  node.classList.remove('pending', 'running', 'done');
  node.classList.add(state);
}

function resetLoaderSteps() {
  if (!el.loaderSteps) return;
  el.loaderSteps.querySelectorAll('.loader-step').forEach((node) => {
    node.classList.remove('running', 'done');
    node.classList.add('pending');
  });
}

function stopStepTicker() {
  if (loader.intervalId) {
    clearInterval(loader.intervalId);
    loader.intervalId = null;
  }
}

function startStepTicker() {
  stopStepTicker();
  resetLoaderSteps();
  loader.index = 0;
  setStepState(0, 'running');
  loader.intervalId = setInterval(() => {
    setStepState(loader.index, 'done');
    loader.index += 1;
    if (loader.index < LOADER_STEPS.length) {
      setStepState(loader.index, 'running');
    } else {
      stopStepTicker();
    }
  }, loader.stepDuration);
}

function markAllStepsComplete() {
  stopStepTicker();
  LOADER_STEPS.forEach((_, i) => setStepState(i, 'done'));
}

function setUiState(state) {
  const btn = el.analyzeBtn;
  const spinner = btn ? btn.querySelector('.btn-spinner') : null;
  const info = MODE_INFO[appState.mode] || MODE_INFO.email;

  const apply = (showEmpty, showLoading, showReport, brandScan, btnLoading) => {
    if (el.emptyState) el.emptyState.classList.toggle('hidden', !showEmpty);
    if (el.skeletonState) el.skeletonState.classList.toggle('hidden', !showLoading);
    if (el.reportRoot) el.reportRoot.classList.toggle('hidden', !showReport);
    if (el.brandIcon) el.brandIcon.classList.toggle('scanning', brandScan);
    if (btn) {
      btn.classList.toggle('is-loading', btnLoading);
      btn.disabled = btnLoading;
    }
    if (spinner) spinner.classList.toggle('hidden', !btnLoading);
    if (el.analyzeBtnLabel) {
      el.analyzeBtnLabel.textContent = btnLoading ? info.btnLoading : info.btnIdle;
    }
  };

  if (state === 'loading') {
    apply(false, true, false, true, true);
  } else if (state === 'result') {
    apply(false, false, true, false, false);
    stopStepTicker();
  } else {
    apply(true, false, false, false, false);
    stopStepTicker();
  }
}

/* ============================================================
   MODE SWITCHER — toggles input panels + per-mode UI copy
   ============================================================ */
function setMode(modeId) {
  const id = MODE_INFO[modeId] ? modeId : 'email';
  appState.mode = id;
  const info = MODE_INFO[id];

  el.modeTabs.forEach((tab) => {
    const active = tab.dataset.mode === id;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  el.modePanels.forEach((panel) => {
    const active = panel.dataset.modePanel === id;
    panel.classList.toggle('active', active);
    if (active) panel.removeAttribute('hidden');
    else panel.setAttribute('hidden', '');
  });

  if (el.panelTitle) el.panelTitle.textContent = info.panelTitle;
  if (el.panelSub) el.panelSub.textContent = info.panelSub;
  if (el.loaderTitle) el.loaderTitle.textContent = info.loaderTitle;
  if (el.loaderSub) el.loaderSub.textContent = info.loaderSub;
  if (el.analyzeBtnLabel) el.analyzeBtnLabel.textContent = info.btnIdle;

  const emptyHeading = el.emptyState?.querySelector('h2');
  if (emptyHeading) emptyHeading.textContent = info.emptyMessage;

  // If we're flipping modes mid-session, reset to idle so old results don't linger.
  if (!appState.isAnalyzing) {
    setUiState('idle');
    if (el.progressTrack) el.progressTrack.textContent = 'Idle';
  }
}

function getCurrentInput() {
  switch (appState.mode) {
    case 'url': return (el.urlInput?.value || '').trim();
    case 'sms': return (el.smsInput?.value || '').trim();
    case 'job': return (el.jobInput?.value || '').trim();
    case 'email':
    default:    return (el.rawEmail?.value || '').trim();
  }
}

/* ============================================================
   v2 RESULTS PANEL — visual helpers
   ============================================================ */

const FLAG_WEIGHTS = [
  { match: /homograph|punycode|lookalike/i, weight: 95 },
  { match: /typo.?squat/i, weight: 88 },
  { match: /(corporate|brand).*(impersonat|mismatch|domain)|impersonat/i, weight: 92 },
  { match: /credential|password|harvest|recruitment.*scam|personal.?data/i, weight: 85 },
  { match: /attachment|payload|macro/i, weight: 82 },
  { match: /ip.?as.?domain|raw.?ip/i, weight: 78 },
  { match: /return.?path|reply-?to.*mismatch|from.*return/i, weight: 75 },
  { match: /\bspf\b/i, weight: 72 },
  { match: /\bdkim\b/i, weight: 70 },
  { match: /\bdmarc\b/i, weight: 70 },
  { match: /shortener|bit\.ly|tinyurl/i, weight: 65 },
  { match: /money|wire|transfer|invoice|payment/i, weight: 68 },
  { match: /threat.?language|fear/i, weight: 62 },
  { match: /urgency|act.?now|24.?hour/i, weight: 58 },
  { match: /greed|reward|prize|airdrop/i, weight: 55 },
  { match: /generic.?greeting/i, weight: 35 },
  { match: /deceptive|fake.*link|legit.?disguise/i, weight: 65 }
];

function severityWeightForFlag(label) {
  const text = String(label || '');
  for (const { match, weight } of FLAG_WEIGHTS) {
    if (match.test(text)) return weight;
  }
  return 60;
}

function severityToneFromWeight(weight) {
  if (weight >= 85) return 'critical';
  if (weight >= 70) return 'high';
  if (weight >= 50) return 'moderate';
  if (weight >= 30) return 'low';
  return 'safe';
}

const CATEGORY_RULES = [
  { name: 'Identity Spoofing',      tone: 'critical', match: /impersonat|spoof|mismatch|display.?name|brand|identity|corporate.*domain/i },
  { name: 'Authentication Failure', tone: 'high',     match: /\bspf\b|\bdkim\b|\bdmarc\b|return.?path|reply-?to|auth/i },
  { name: 'Malicious Links',        tone: 'high',     match: /url|link|redirect|homograph|shortener|punycode|hop|ip.?as|brand.?in.?url/i },
  { name: 'Data Harvesting',        tone: 'critical', match: /credential|password|harvest|personal.?data|resume|recruitment|data.*request/i },
  { name: 'Social Engineering',     tone: 'moderate', match: /urgenc|threat|greed|reward|prize|fear|act.?now|24.?hour|deceptive|scam|airdrop|generic.?greeting/i },
  { name: 'Malicious Payload',      tone: 'critical', match: /attachment|macro|payload|executable|\.exe|\.zip/i },
  { name: 'Money / Wire Fraud',     tone: 'high',     match: /money|wire|transfer|invoice|payment|usd|\$\d/i }
];

function categorizeFlag(label) {
  const text = String(label || '');
  for (const rule of CATEGORY_RULES) {
    if (rule.match.test(text)) return rule;
  }
  return { name: 'Other Indicator', tone: 'low', match: /./ };
}

function shortLabel(label, max) {
  const limit = max || 36;
  const s = String(label || '').replace(/\s+/g, ' ').trim();
  return s.length > limit ? `${s.slice(0, limit - 1)}…` : s;
}

function renderGaugeSubtitle(merged, score) {
  if (!el.gaugeSubtitle) return;
  const count = Math.min(5, merged.length);
  if (count === 0) {
    el.gaugeSubtitle.textContent = score <= 20
      ? 'No threat signals detected'
      : 'Low-confidence signals detected';
    return;
  }
  el.gaugeSubtitle.textContent = `${count} of 5 threat signals detected`;
}

function destroyChart(key) {
  if (charts[key]) {
    try { charts[key].destroy(); } catch (_) { /* noop */ }
    charts[key] = null;
  }
}

function renderThreatBars(merged) {
  if (!el.threatBarsCanvas || typeof Chart === 'undefined') return;
  destroyChart('bars');

  if (merged.length === 0) {
    if (el.threatBarsEmpty) el.threatBarsEmpty.classList.remove('hidden');
    el.threatBarsCanvas.style.display = 'none';
    return;
  }
  if (el.threatBarsEmpty) el.threatBarsEmpty.classList.add('hidden');
  el.threatBarsCanvas.style.display = 'block';

  const top = merged.slice(0, 5).map((flag) => {
    const label = typeof flag === 'string' ? flag : flag.label;
    const weight = severityWeightForFlag(label);
    const tone = severityToneFromWeight(weight);
    return { label: shortLabel(label, 38), weight, color: severityHexForTone(tone) };
  });

  const isLight = document.body.classList.contains('theme-light');
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const tickColor = isLight ? '#475569' : '#848d97';

  charts.bars = new Chart(el.threatBarsCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: top.map((d) => d.label),
      datasets: [{
        data: top.map((d) => d.weight),
        backgroundColor: top.map((d) => d.color),
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 18,
        maxBarThickness: 22
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutCubic' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => `Severity weight: ${ctx.parsed.x}%` }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: { color: tickColor, font: { size: 10 }, callback: (v) => `${v}%` },
          grid: { color: gridColor, drawBorder: false }
        },
        y: {
          ticks: { color: tickColor, font: { size: 11 } },
          grid: { display: false, drawBorder: false }
        }
      }
    }
  });
}

function renderThreatDonut(merged) {
  if (!el.threatDonutCanvas || typeof Chart === 'undefined') return;
  destroyChart('donut');
  if (el.threatDonutLegend) el.threatDonutLegend.innerHTML = '';

  if (merged.length === 0) {
    el.threatDonutCanvas.style.display = 'none';
    if (el.threatDonutLegend) {
      el.threatDonutLegend.innerHTML = '<li><span class="dot" style="background:var(--sev-safe)"></span><span>No category signals</span><span class="pct">—</span></li>';
    }
    return;
  }
  el.threatDonutCanvas.style.display = 'block';

  const buckets = new Map();
  merged.forEach((flag) => {
    const label = typeof flag === 'string' ? flag : flag.label;
    const cat = categorizeFlag(label);
    const prev = buckets.get(cat.name) || { name: cat.name, tone: cat.tone, count: 0 };
    prev.count += 1;
    buckets.set(cat.name, prev);
  });

  const items = [...buckets.values()].sort((a, b) => b.count - a.count);
  const total = items.reduce((sum, i) => sum + i.count, 0) || 1;
  const colors = items.map((i) => severityHexForTone(i.tone));
  const isLight = document.body.classList.contains('theme-light');

  charts.donut = new Chart(el.threatDonutCanvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: items.map((i) => i.name),
      datasets: [{
        data: items.map((i) => i.count),
        backgroundColor: colors,
        borderColor: isLight ? '#ffffff' : '#0d1117',
        borderWidth: 2,
        spacing: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      animation: { duration: 600, easing: 'easeOutCubic' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = Math.round((ctx.parsed / total) * 100);
              return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  if (el.threatDonutLegend) {
    el.threatDonutLegend.innerHTML = items
      .map((item, idx) => {
        const pct = Math.round((item.count / total) * 100);
        return `<li>
          <span class="dot" style="background:${colors[idx]}"></span>
          <span>${escapeHtml(item.name)}</span>
          <span class="pct">${pct}%</span>
        </li>`;
      })
      .join('');
  }
}

function renderEvidenceTimeline(merged) {
  if (!el.evidenceTimeline) return;
  if (merged.length === 0) {
    el.evidenceTimeline.innerHTML = '<li class="timeline-empty">No detected signals to show.</li>';
    if (el.timelineSub) el.timelineSub.textContent = 'No detected signals';
    return;
  }
  const top = merged.slice(0, 5);
  if (el.timelineSub) el.timelineSub.textContent = `${top.length} top detected signal${top.length === 1 ? '' : 's'}`;

  const ICONS = { safe: '✓', low: 'i', moderate: '!', high: '!', critical: '✕' };
  const BADGES = { safe: 'SAFE', low: 'LOW', moderate: 'MED', high: 'HIGH', critical: 'CRIT' };

  el.evidenceTimeline.innerHTML = top
    .map((flag) => {
      const label = typeof flag === 'string' ? flag : flag.label;
      const evidence = (typeof flag === 'object' && flag.evidence) ? flag.evidence : '';
      const weight = severityWeightForFlag(label);
      const tone = severityToneFromWeight(weight);
      const cat = categorizeFlag(label);
      return `<li class="timeline-item sev-${tone}">
        <div class="timeline-icon" aria-hidden="true">${ICONS[tone] || '!'}</div>
        <div class="timeline-body">
          <strong>${escapeHtml(label)}</strong>
          <small>${escapeHtml(evidence || `${cat.name} signal — severity weight ${weight}%`)}</small>
        </div>
        <span class="timeline-badge">${BADGES[tone] || 'MED'}</span>
      </li>`;
    })
    .join('');
}

function renderAuthChips(authResults) {
  if (!el.authChips) return;
  const auth = authResults || {};
  const KEYS = ['spf', 'dkim', 'dmarc'];
  const ICONS = { pass: '✓', fail: '✕', unknown: '?' };
  const STATUS = { pass: 'PASS', fail: 'FAIL', unknown: 'UNKNOWN' };

  let failCount = 0;
  let passCount = 0;
  el.authChips.innerHTML = KEYS.map((k) => {
    const value = (auth[k] || 'unknown').toLowerCase();
    const state = value === 'pass' ? 'pass' : value === 'fail' ? 'fail' : 'unknown';
    if (state === 'fail') failCount += 1;
    if (state === 'pass') passCount += 1;
    return `<div class="auth-chip ${state}" title="${k.toUpperCase()} ${STATUS[state]}">
      <span class="chip-icon">${ICONS[state]}</span>
      <span class="chip-label">${k.toUpperCase()}</span>
      <span class="chip-status">${STATUS[state]}</span>
    </div>`;
  }).join('');

  if (el.authVerdict) {
    if (failCount === 3) el.authVerdict.textContent = 'All 3 authentication checks failed';
    else if (failCount > 0) el.authVerdict.textContent = `${failCount} of 3 authentication check${failCount === 1 ? '' : 's'} failed`;
    else if (passCount === 3) el.authVerdict.textContent = 'All 3 authentication checks passed';
    else if (passCount > 0) el.authVerdict.textContent = `${passCount} of 3 authentication check${passCount === 1 ? '' : 's'} passed, ${3 - passCount} unknown`;
    else el.authVerdict.textContent = 'No authentication results available';
  }
}

const TRUSTED_TLDS = new Set(['com', 'org', 'net', 'edu', 'gov', 'io', 'co']);
const SUSPICIOUS_TLDS = new Set(['top', 'xyz', 'click', 'work', 'tk', 'ml', 'ga', 'cf', 'gq', 'monster', 'rest', 'fit']);
const FREE_MAIL_DOMAINS = new Set(['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'aol.com']);

function computeSenderTrust(signals) {
  const header = signals.headerResult || {};
  const sender = signals.senderResult || {};
  const auth = header.authResults || {};
  const fromEmail = String(sender.actualEmail || header.extracted?.from || '').toLowerCase();
  const domainMatch = fromEmail.match(/@([^>\s]+)/);
  const domain = domainMatch ? domainMatch[1].trim() : '';
  const tld = domain.includes('.') ? domain.split('.').pop() : '';

  // Domain age proxy (we don't have real WHOIS — use TLD heuristics + known providers)
  let domainAge = 60;
  if (TRUSTED_TLDS.has(tld)) domainAge = 80;
  if (FREE_MAIL_DOMAINS.has(domain)) domainAge = 90;
  if (SUSPICIOUS_TLDS.has(tld)) domainAge = 18;
  if (domain.split('.').length >= 4) domainAge = Math.min(domainAge, 35); // deeply nested

  // Sender match (display vs actual + return-path consistency)
  let senderMatch = 90;
  if (sender.mismatch) senderMatch = 25;
  if (sender.freeEmailImpersonation) senderMatch = 15;
  const mismatches = Array.isArray(header.mismatches) ? header.mismatches : [];
  if (mismatches.length) senderMatch = Math.max(10, senderMatch - 25 * mismatches.length);

  // Domain reputation: from auth + suspicious TLD + known phish hints
  let reputation = 75;
  if (auth.spf === 'fail') reputation -= 18;
  if (auth.dkim === 'fail') reputation -= 18;
  if (auth.dmarc === 'fail') reputation -= 14;
  if (auth.spf === 'pass' && auth.dkim === 'pass' && auth.dmarc === 'pass') reputation = Math.max(reputation, 92);
  if (SUSPICIOUS_TLDS.has(tld)) reputation -= 30;
  if (FREE_MAIL_DOMAINS.has(domain) && sender.freeEmailImpersonation) reputation -= 35;
  reputation = Math.max(0, Math.min(100, reputation));

  const overall = Math.round((domainAge + senderMatch + reputation) / 3);
  return {
    overall,
    components: [
      { label: 'Domain Age',        value: domainAge },
      { label: 'Sender Match',      value: senderMatch },
      { label: 'Domain Reputation', value: reputation }
    ]
  };
}

function trustToneFromValue(v) {
  if (v >= 75) return 'safe';
  if (v >= 55) return 'low';
  if (v >= 35) return 'moderate';
  if (v >= 20) return 'high';
  return 'critical';
}

function renderSenderTrust(signals) {
  if (!el.trustMeterFill || !el.trustBars) return;
  const trust = computeSenderTrust(signals);
  const tone = trustToneFromValue(trust.overall);
  const color = severityHexForTone(tone);

  setTimeout(() => {
    el.trustMeterFill.style.width = `${trust.overall}%`;
    el.trustMeterFill.style.background = color;
  }, 50);
  if (el.trustScoreValue) el.trustScoreValue.textContent = `${trust.overall} / 100`;

  el.trustBars.innerHTML = trust.components
    .map((c) => {
      const t = trustToneFromValue(c.value);
      const fillColor = severityHexForTone(t);
      return `<li class="trust-bar">
        <span class="label">${escapeHtml(c.label)}</span>
        <div class="track"><div class="fill" style="width:${c.value}%; background:${fillColor};"></div></div>
        <span class="pct">${c.value}</span>
      </li>`;
    })
    .join('');
}

function classifyLink(entry) {
  const flags = (entry.flags || []).map((f) => String(f).toLowerCase());
  const isHomograph = !!entry.homograph?.isHomograph;
  const hops = entry.hops?.length || 0;
  const dangerous = flags.some((f) => /credential|brand|ip|homograph|punycode|impersonat|suspicious|malicious/.test(f));
  const tracking  = flags.some((f) => /tracking|utm|analytic/.test(f));
  const redirect  = hops > 1 || flags.some((f) => /redirect|shortener|bit\.ly|tinyurl/.test(f));

  let tone = 'safe';
  if (isHomograph || dangerous) tone = 'critical';
  else if (redirect) tone = 'moderate';
  else if (tracking) tone = 'low';

  const chips = [];
  if (isHomograph) chips.push({ label: 'HOMOGRAPH', cls: 'homograph' });
  if (dangerous)   chips.push({ label: 'SUSPICIOUS', cls: 'danger' });
  if (redirect)    chips.push({ label: 'REDIRECT',   cls: 'redirect' });
  if (tracking)    chips.push({ label: 'TRACKING',   cls: 'tracking' });
  if (chips.length === 0) chips.push({ label: 'CLEAN', cls: 'safe' });

  return { tone, chips, hops, isHomograph };
}

function renderLinkCards(urls) {
  if (!el.linkCardsList) return;
  if (!urls || urls.length === 0) {
    el.linkCardsList.innerHTML = '<p class="muted small">No links found in this email.</p>';
    return;
  }

  el.linkCardsList.innerHTML = urls
    .map((entry) => {
      let host = 'unknown-host';
      let destHost = '';
      try { host = new URL(entry.original).hostname; } catch (_) { /* keep default */ }
      try { destHost = new URL(entry.finalDestination || entry.original).hostname; } catch (_) { /* noop */ }

      const meta = classifyLink(entry);
      const looksLike = entry.homograph?.normalized;
      const original = entry.original || '';
      const dest = entry.finalDestination || original;

      return `<article class="link-card sev-${meta.tone}">
        <div class="link-row">
          <div>
            <div class="link-host">${escapeHtml(host)}</div>
            <div class="link-original">${escapeHtml(shortLabel(original, 80))}</div>
          </div>
          <span class="hops-badge">${meta.hops} hop${meta.hops === 1 ? '' : 's'}</span>
        </div>
        <div class="link-row">
          <div class="destination">
            <span class="arrow">→</span> ${escapeHtml(destHost || dest)}
          </div>
        </div>
        <div class="link-flags">
          ${meta.chips.map((c) => `<span class="link-flag ${c.cls}">${c.label}</span>`).join('')}
          ${meta.isHomograph && looksLike ? `<span class="link-flag homograph">LOOKS LIKE: ${escapeHtml(looksLike)}</span>` : ''}
        </div>
      </article>`;
    })
    .join('');
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
  const ai = data.ai || {};
  const risk = data.risk || { score: 0, topReasons: [] };

  const ruleScore = Number(risk.score) || 0;
  const aiScore = Number.isFinite(Number(ai.risk_score)) ? Number(ai.risk_score) : 0;
  const score = Math.max(0, Math.min(100, Math.max(ruleScore, aiScore)));

  console.log('[renderReport] ruleScore=%d aiScore=%d finalScore=%d', ruleScore, aiScore, score);

  el.skeletonState.classList.add('hidden');
  el.emptyState.classList.add('hidden');
  el.reportRoot.classList.remove('hidden');

  const tone = severityToneFromScore(score);
  const verdictCard = document.querySelector('.verdict-card');
  if (verdictCard) {
    verdictCard.classList.remove('verdict--safe', 'verdict--low', 'verdict--moderate', 'verdict--high', 'verdict--critical');
    verdictCard.classList.add(`verdict--${tone}`);
  }

  el.severityLabel.textContent = severityText(score);

  // Mode-aware verdict eyebrow (e.g. "Email Analysis Complete")
  if (el.verdictEyebrow) {
    const modeId = data.mode || appState.mode || 'email';
    const fallback = MODE_INFO[modeId]?.verdictTitle || 'Analysis Complete';
    el.verdictEyebrow.textContent = data.modeLabel || fallback;
  }

  const displaySummary =
    data.ai?.summary && data.ai.summary.trim().length > 0
      ? data.ai.summary
      : 'Analysis complete. No specific threats detected.';
  el.aiSummary.textContent = displaySummary;
  animateGauge(score);

  if (el.confidenceMeta) {
    const conf = Number(ai.confidenceScore);
    el.confidenceMeta.textContent = `Confidence: ${Number.isFinite(conf) && conf > 0 ? `${conf}%` : '—'}`;
  }
  if (el.detectionSourceMeta) {
    const ruleS = Number(risk.ruleScore) || 0;
    const aiS = Number(ai.risk_score) || 0;
    let source = 'Rule + AI';
    if (aiS && !ruleS) source = 'AI';
    else if (ruleS && !aiS) source = 'Rule';
    else if (!aiS && !ruleS) source = '—';
    el.detectionSourceMeta.textContent = `Source: ${source}`;
  }
  if (el.providerMeta) {
    el.providerMeta.textContent = `Provider: ${ai.provider || '—'}${ai.model ? ` · ${ai.model}` : ''}`;
  }

  if (el.recommendCard) {
    const action = recommendedActionFor(score);
    el.recommendCard.classList.remove('tone-safe', 'tone-low', 'tone-moderate', 'tone-high', 'tone-critical');
    el.recommendCard.classList.add(`tone-${action.tone}`);
    if (el.recommendTitle) el.recommendTitle.textContent = action.title;
    if (el.recommendDetail) el.recommendDetail.textContent = action.detail;
    if (el.recommendIcon) el.recommendIcon.textContent = action.icon;
    if (el.recommendActionBtn) {
      el.recommendActionBtn.textContent = action.button;
      el.recommendActionBtn.dataset.tone = action.tone;
    }
  }

  const aiFlags = Array.isArray(ai.red_flags) ? ai.red_flags : [];
  const ruleReasons = (risk.topReasons || []).map((reason) => ({ label: reason, evidence: '' }));

  const merged = [];
  const seen = new Set();
  [...aiFlags, ...ruleReasons].forEach((flag) => {
    const key = String(flag?.label || '').trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(flag);
  });

  // Legacy structured list (hidden; preserved for any downstream consumers)
  if (el.redFlagsList) {
    el.redFlagsList.innerHTML = '';
    merged.slice(0, 5).forEach((flag, idx) => {
      const card = createFlagCard(flag, idx);
      card.classList.add(`sev-${tone}`);
      el.redFlagsList.appendChild(card);
    });
  }
  if (el.redFlagsEmpty) el.redFlagsEmpty.classList.toggle('hidden', merged.length !== 0);
  if (el.evidenceSub) {
    el.evidenceSub.textContent = merged.length === 0
      ? 'No red flags detected'
      : `${Math.min(merged.length, 5)} of 5 strongest red flag${merged.length === 1 ? '' : 's'}`;
  }

  renderGaugeSubtitle(merged, score);
  renderThreatBars(merged);
  renderThreatDonut(merged);
  renderEvidenceTimeline(merged);

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
  renderLinkCards(enrichedUrls);

  const header = signals.headerResult || {};
  const sender = signals.senderResult || {};

  if (el.senderKv) {
    el.senderKv.innerHTML = '';
    const senderRows = [
      ['From', header.extracted?.from || sender.displayName || 'n/a'],
      ['Actual email', sender.actualEmail || 'n/a'],
      ['Reply-To', header.extracted?.replyTo || 'n/a', header.mismatches?.some?.((m) => m.type === 'reply_to_vs_from') ? 'warn' : ''],
      ['Return-Path', header.extracted?.returnPath || 'n/a', header.mismatches?.some?.((m) => m.type === 'from_vs_return_path_domain') ? 'danger' : ''],
      ['Originating IP', header.originIP || 'n/a'],
      ['Hop count', String(header.hopCount || 0)],
      ['Display vs domain', sender.mismatch ? 'MISMATCH — possible spoof' : 'consistent', sender.mismatch ? 'danger' : 'ok'],
      ['Free-mail impersonation', sender.freeEmailImpersonation ? 'YES' : 'No', sender.freeEmailImpersonation ? 'danger' : 'ok']
    ];
    senderRows.forEach(([label, value, tone]) => {
      const labelEl = document.createElement('div');
      labelEl.className = 'kv-label';
      labelEl.textContent = label;
      const valueEl = document.createElement('div');
      valueEl.className = `kv-value${tone ? ` ${tone}` : ''}`;
      valueEl.textContent = value;
      el.senderKv.appendChild(labelEl);
      el.senderKv.appendChild(valueEl);
    });
  }

  if (el.senderPanel) {
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
  }

  renderAuthPills(header.authResults || {});
  renderAuthChips(header.authResults || {});
  renderSenderTrust(signals);

  const contentResult = signals.contentResult || {};

  if (el.contentTags) {
    el.contentTags.innerHTML = '';
    const contentSignals = [
      { label: 'Urgency', active: (contentResult.urgencyScore || 0) > 0, tone: 'warn' },
      { label: 'Threat language', active: (contentResult.threatScore || 0) > 0, tone: 'danger' },
      { label: 'Greed/reward', active: (contentResult.greedScore || 0) > 0, tone: 'warn' },
      { label: 'Credential request', active: !!contentResult.credentialRequest, tone: 'danger' },
      { label: 'Generic greeting', active: !!contentResult.genericGreeting, tone: 'warn' },
      { label: 'Money request', active: /wire|transfer|payment|invoice|usd|\$\d/i.test(appState.currentEmail), tone: 'warn' }
    ];
    contentSignals.forEach((s) => {
      if (!s.active) return;
      const badge = document.createElement('span');
      badge.className = `badge ${s.tone}`;
      badge.textContent = s.label;
      el.contentTags.appendChild(badge);
    });
    if (!el.contentTags.children.length) {
      const ok = document.createElement('span');
      ok.className = 'badge ok';
      ok.textContent = 'No content red flags';
      el.contentTags.appendChild(ok);
    }
  }

  el.highlightedEmail.innerHTML = highlightContent(appState.currentEmail, contentResult.redFlags || []);
  renderWordCloud(contentResult.redFlags || []);

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

  if (el.overviewBullets) {
    const urlCount = (signals.urlResult?.urls || []).length;
    const auth = header.authResults || {};
    const bullets = [];
    bullets.push({
      tone: tone === 'safe' ? 'ok' : tone === 'critical' || tone === 'high' ? 'danger' : 'warn',
      text: `${severityText(score)} verdict (score ${score} / 100)`
    });
    bullets.push({ tone: '', text: `${urlCount} link${urlCount === 1 ? '' : 's'} extracted from email body` });
    bullets.push({
      tone: sender.mismatch || sender.freeEmailImpersonation ? 'danger' : 'ok',
      text: sender.mismatch || sender.freeEmailImpersonation ? 'Sender identity inconsistent with claimed brand' : 'Sender identity looks internally consistent'
    });
    bullets.push({
      tone: auth.spf === 'fail' || auth.dkim === 'fail' || auth.dmarc === 'fail' ? 'danger' : auth.spf === 'pass' ? 'ok' : 'warn',
      text: `Authentication: SPF ${auth.spf || 'unknown'}, DKIM ${auth.dkim || 'unknown'}, DMARC ${auth.dmarc || 'unknown'}`
    });
    if (ai.attackType && ai.attackType !== 'other') {
      bullets.push({ tone: '', text: `AI attack profile: ${ai.attackType} (${ai.sophistication || 'unknown'} sophistication)` });
    }
    el.overviewBullets.innerHTML = '';
    bullets.forEach((b) => {
      const li = document.createElement('li');
      if (b.tone) li.className = b.tone;
      li.textContent = b.text;
      el.overviewBullets.appendChild(li);
    });
  }

  if (el.riskFactorsList) {
    el.riskFactorsList.innerHTML = '';
    const factors = merged.slice(0, 8);
    if (factors.length === 0) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'No specific risk factors identified.';
      el.riskFactorsList.appendChild(li);
    } else {
      factors.forEach((flag) => {
        const li = document.createElement('li');
        li.className = tone === 'safe' ? '' : tone === 'critical' || tone === 'high' ? 'danger' : 'warn';
        const label = typeof flag === 'string' ? flag : flag.label;
        const evidence = typeof flag === 'object' && flag.evidence ? ` — ${flag.evidence}` : '';
        li.textContent = `${label}${evidence}`;
        el.riskFactorsList.appendChild(li);
      });
    }
  }

  if (el.rawJson) {
    try {
      el.rawJson.textContent = JSON.stringify(data, null, 2);
    } catch (_) {
      el.rawJson.textContent = '{ "error": "Could not serialize report" }';
    }
  }

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
  const content = getCurrentInput();
  const info = MODE_INFO[appState.mode] || MODE_INFO.email;
  if (!content) {
    alert(`Provide ${info.label.toLowerCase()} input first.`);
    return;
  }

  appState.currentInput = content;
  appState.currentEmail = content; // legacy alias used by PDF/IOC code paths
  appState.analysis = { signals: {} };
  appState.isAnalyzing = true;

  setUiState('loading');
  startStepTicker();
  el.progressTrack.textContent = '> Starting forensic pipeline…';

  let completePayload = null;

  try {
    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: appState.mode, content })
    });

    if (!response.ok || !response.body) {
      throw new Error(`Analyze request failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamError = null;

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
          // Silently fold into state — keep loading UI visible until 'complete'
          mergePartial(parsed.section, parsed.data);
        } else if (eventName === 'complete') {
          appState.analysis = parsed;
          completePayload = parsed;
        } else if (eventName === 'error') {
          streamError = new Error(parsed.error || 'Unknown stream error');
        }
      });

      if (streamError) throw streamError;
    }

    // Stream finished — reveal results in one pass
    markAllStepsComplete();
    await new Promise((resolve) => setTimeout(resolve, 400));

    const finalReport = completePayload || appState.analysis;
    renderReport(finalReport);
    setUiState('result');
    el.progressTrack.textContent = '> Analysis complete';
  } catch (error) {
    el.progressTrack.textContent = `> Error: ${error.message}`;
    setUiState('idle');
    alert(`Analysis failed: ${error.message}`);
  } finally {
    appState.isAnalyzing = false;
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

function copySummary() {
  if (!appState.analysis) {
    alert('Run analysis first.');
    return;
  }
  const score = Math.max(0, Math.min(100, appState.analysis.risk?.score || 0));
  const verdict = severityText(score);
  const summary = appState.analysis.ai?.summary || 'No summary available.';
  const text = `PhishLens Verdict: ${verdict} (${score}/100)\n\n${summary}`;
  navigator.clipboard.writeText(text);
  alert('Summary copied to clipboard.');
}

function exportJson() {
  if (!appState.analysis) {
    alert('Run analysis first.');
    return;
  }
  const blob = new Blob([JSON.stringify(appState.analysis, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PhishLens_Report_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function copyJson() {
  if (!appState.analysis) {
    alert('Run analysis first.');
    return;
  }
  navigator.clipboard.writeText(JSON.stringify(appState.analysis, null, 2));
  alert('Report JSON copied to clipboard.');
}

function reportPhish() {
  if (!appState.analysis) {
    alert('Run analysis first.');
    return;
  }
  const score = Math.max(0, Math.min(100, appState.analysis.risk?.score || 0));
  alert(`Reported as phishing (verdict: ${severityText(score)} ${score}/100). In a production deployment this would forward the IOCs to your SOC pipeline.`);
}

el.tabs.forEach((tab) => tab.addEventListener('click', () => setTab(tab.dataset.tab)));
el.subtabs.forEach((tab) => tab.addEventListener('click', () => setSubtab(tab.dataset.subtab)));
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

/* === MODE SWITCHER + per-mode sample pickers ============== */
el.modeTabs.forEach((tab) =>
  tab.addEventListener('click', () => setMode(tab.dataset.mode))
);

if (el.urlSamplePicker && el.urlInput) {
  const applyUrl = () => { el.urlInput.value = urlSamples[el.urlSamplePicker.value] || ''; };
  if (el.urlLoadSampleBtn) el.urlLoadSampleBtn.addEventListener('click', applyUrl);
  el.urlSamplePicker.addEventListener('change', applyUrl);
}

if (el.smsSamplePicker && el.smsInput) {
  const applySms = () => { el.smsInput.value = smsSamples[el.smsSamplePicker.value] || ''; };
  if (el.smsLoadSampleBtn) el.smsLoadSampleBtn.addEventListener('click', applySms);
  el.smsSamplePicker.addEventListener('change', applySms);
}

if (el.jobSamplePicker && el.jobInput) {
  const applyJob = () => { el.jobInput.value = jobSamples[el.jobSamplePicker.value] || ''; };
  if (el.jobLoadSampleBtn) el.jobLoadSampleBtn.addEventListener('click', applyJob);
  el.jobSamplePicker.addEventListener('change', applyJob);
}

el.analyzeBtn.addEventListener('click', analyze);
if (el.showReasoningBtn) el.showReasoningBtn.addEventListener('click', streamReasoning);
if (el.downloadPdfBtn) el.downloadPdfBtn.addEventListener('click', downloadPdf);
if (el.copyIocsBtn) el.copyIocsBtn.addEventListener('click', copyIocs);
if (el.shareAnalysisBtn) el.shareAnalysisBtn.addEventListener('click', shareAnalysis);
if (el.copySummaryBtn) el.copySummaryBtn.addEventListener('click', copySummary);
if (el.exportJsonBtn) el.exportJsonBtn.addEventListener('click', exportJson);
if (el.copyJsonBtn) el.copyJsonBtn.addEventListener('click', copyJson);
if (el.reportPhishBtn) el.reportPhishBtn.addEventListener('click', reportPhish);

if (el.recommendActionBtn) {
  el.recommendActionBtn.addEventListener('click', () => {
    if (!appState.analysis) {
      alert('Run analysis first.');
      return;
    }
    const tone = el.recommendActionBtn.dataset.tone;
    if (tone === 'safe') {
      alert('Marked as safe. Standard caution still applies.');
    } else if (tone === 'low' || tone === 'moderate') {
      const sender = appState.analysis.signals?.headerResult?.extracted?.from || 'sender';
      alert(`Verify ${sender} through a separate, trusted channel before responding.`);
    } else {
      reportPhish();
    }
  });
}

const params = new URLSearchParams(window.location.search);
const prefill = params.get('prefill');
if (prefill) {
  el.rawEmail.value = decodeURIComponent(prefill);
} else {
  el.rawEmail.value = samples.paypal;
}

// Seed the per-mode inputs with their default samples so each tab is preloaded.
if (el.urlInput) el.urlInput.value = urlSamples.typo;
if (el.smsInput) el.smsInput.value = smsSamples.bank;
if (el.jobInput) el.jobInput.value = jobSamples.bigtech;

// Honor ?mode=url|sms|job query param, otherwise default to email.
const initialMode = params.get('mode');
setMode(MODE_INFO[initialMode] ? initialMode : 'email');
