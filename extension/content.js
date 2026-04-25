const PHISHLENS_BUTTON_ID = 'phishlens-floating-scan-btn';
const PHISHLENS_BADGE_CLASS = 'phishlens-inbox-risk-badge';

function ensureStyles() {
  if (document.getElementById('phishlens-style')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'phishlens-style';
  style.textContent = `
    #${PHISHLENS_BUTTON_ID} {
      margin-left: 8px;
      border: 1px solid #00d9ff;
      border-radius: 8px;
      background: #0a0e1a;
      color: #00d9ff;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 10px;
      cursor: pointer;
    }
    #${PHISHLENS_BUTTON_ID}:hover {
      background: #11213a;
    }
    .${PHISHLENS_BADGE_CLASS} {
      margin-left: 8px;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 700;
      border: 1px solid transparent;
    }
    .phishlens-safe { background: rgba(0,255,136,0.12); color: #00ff88; border-color: rgba(0,255,136,0.35); }
    .phishlens-suspicious { background: rgba(255,170,0,0.14); color: #ffaa00; border-color: rgba(255,170,0,0.35); }
    .phishlens-dangerous, .phishlens-critical { background: rgba(255,59,92,0.14); color: #ff3b5c; border-color: rgba(255,59,92,0.35); }
  `;
  document.head.appendChild(style);
}

function extractVisibleEmail() {
  const main = document.querySelector('div[role="main"]');
  if (!main) {
    return null;
  }

  const subject =
    document.querySelector('h2[data-thread-perm-id]')?.innerText?.trim() ||
    document.querySelector('h2.hP')?.innerText?.trim() ||
    '(No subject)';

  const fromEmail =
    document.querySelector('span[email]')?.getAttribute('email') ||
    document.querySelector('span.gD')?.getAttribute('email') ||
    'unknown@unknown.local';

  const fromName =
    document.querySelector('span[email]')?.getAttribute('name') ||
    document.querySelector('span.gD')?.innerText?.trim() ||
    'Unknown Sender';

  const body =
    document.querySelector('div.a3s.aiL')?.innerText?.trim() ||
    document.querySelector('div[role="listitem"] div[dir="ltr"]')?.innerText?.trim() ||
    main.innerText.slice(0, 12000);

  const pseudoHeaders = [
    `From: ${fromName} <${fromEmail}>`,
    `Reply-To: ${fromEmail}`,
    `Return-Path: ${fromEmail}`,
    `Subject: ${subject}`,
    'X-Mailer: Gmail Web UI'
  ].join('\n');

  const rawEmail = `${pseudoHeaders}\n\n${body}`;
  const urls = body.match(/https?:\/\/[^\s<>"']+/g) || [];

  return { subject, fromName, fromEmail, body, rawEmail, urls, source: 'gmail-open-email' };
}

function findToolbarContainer() {
  return document.querySelector('div[gh="mtb"]') || document.querySelector('div[role="toolbar"]');
}

function injectFloatingScanButton() {
  ensureStyles();
  const toolbar = findToolbarContainer();
  if (!toolbar || toolbar.querySelector(`#${PHISHLENS_BUTTON_ID}`)) {
    return;
  }

  const button = document.createElement('button');
  button.id = PHISHLENS_BUTTON_ID;
  button.textContent = '?? Scan with PhishLens';
  button.addEventListener('click', async () => {
    const emailData = extractVisibleEmail();
    if (!emailData) {
      alert('PhishLens: Could not extract the opened email.');
      return;
    }

    button.textContent = 'Scanning...';
    try {
      const response = await chrome.runtime.sendMessage({ type: 'ANALYZE_EMAIL', payload: emailData });
      if (response?.ok) {
        button.textContent = `Risk ${response.report?.risk?.score ?? 0}`;
        setTimeout(() => {
          button.textContent = '?? Scan with PhishLens';
        }, 2000);
      } else {
        button.textContent = 'Scan failed';
      }
    } catch (_) {
      button.textContent = 'Scan failed';
    }
  });

  toolbar.appendChild(button);
}

function getVisibleInboxRows() {
  return [...document.querySelectorAll('tr.zA')].filter((row) => row.offsetParent !== null).slice(0, 15);
}

function buildInboxRowEmail(row) {
  const subject = row.querySelector('span.bog')?.innerText?.trim() || '(No subject)';
  const sender = row.querySelector('span.yP')?.getAttribute('email') || row.querySelector('span.yP')?.innerText?.trim() || 'unknown@unknown.local';
  const snippet = row.querySelector('span.y2')?.innerText?.trim() || '';

  const rawEmail = [
    `From: ${sender}`,
    `Reply-To: ${sender}`,
    `Return-Path: ${sender}`,
    `Subject: ${subject}`,
    'X-Mailer: Gmail Inbox Preview',
    '',
    snippet
  ].join('\n');

  return { rawEmail, subject, sender, snippet };
}

function renderInboxBadges(results) {
  getVisibleInboxRows().forEach((row) => {
    row.querySelectorAll(`.${PHISHLENS_BADGE_CLASS}`).forEach((badge) => badge.remove());
  });

  results.forEach((item, index) => {
    const row = getVisibleInboxRows()[index];
    if (!row) {
      return;
    }

    const severity = item?.risk?.severity || 'safe';
    const badge = document.createElement('span');
    badge.className = `${PHISHLENS_BADGE_CLASS} phishlens-${severity}`;
    badge.textContent = `PhishLens ${String(severity).toUpperCase()} ${item?.risk?.score ?? 0}`;

    const anchor = row.querySelector('td.xY.a4W') || row.querySelector('td.xY');
    if (anchor) {
      anchor.appendChild(badge);
    }
  });
}

async function scanInboxVisibleEmails() {
  const rows = getVisibleInboxRows();
  const payload = rows.map((row) => buildInboxRowEmail(row));
  if (!payload.length) {
    alert('PhishLens: No visible inbox rows to scan.');
    return;
  }

  const response = await chrome.runtime.sendMessage({ type: 'SCAN_INBOX_ITEMS', payload });
  if (response?.ok) {
    renderInboxBadges(response.results || []);
  }
}

function setupObserver() {
  const observer = new MutationObserver(() => {
    const main = document.querySelector('div[role="main"]');
    if (!main) {
      return;
    }
    injectFloatingScanButton();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_CURRENT_EMAIL') {
    sendResponse(extractVisibleEmail());
    return true;
  }

  if (message.type === 'SCAN_PAGE_MODE') {
    scanInboxVisibleEmails()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

ensureStyles();
injectFloatingScanButton();
setupObserver();
