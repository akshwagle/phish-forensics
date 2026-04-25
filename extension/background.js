const API_ANALYZE_URL = 'http://localhost:3001/api/analyze';

async function parseSSEAnalysisResponse(response) {
  const text = await response.text();
  const chunks = text.split('\n\n');
  let finalReport = null;

  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    let event = 'message';
    let data = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      }
      if (line.startsWith('data:')) {
        data += line.slice(5).trim();
      }
    }

    if (!data || data === '[DONE]') {
      continue;
    }

    try {
      const payload = JSON.parse(data);
      if (event === 'complete') {
        finalReport = payload;
      }
    } catch (_) {
      // ignore malformed chunk
    }
  }

  if (!finalReport) {
    throw new Error('No complete report found in SSE stream');
  }

  return finalReport;
}

async function analyzeRawEmail(rawEmail) {
  const response = await fetch(API_ANALYZE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawEmail })
  });

  if (!response.ok) {
    throw new Error(`Analyze failed (${response.status})`);
  }

  return parseSSEAnalysisResponse(response);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_EMAIL') {
    analyzeRawEmail(message.payload?.rawEmail || '')
      .then(async (report) => {
        await chrome.storage.local.set({
          phishlensLastReport: report,
          phishlensLastEmail: message.payload || null,
          phishlensLastUpdatedAt: Date.now()
        });

        if (chrome.action?.openPopup) {
          chrome.action.openPopup().catch(() => {});
        }

        sendResponse({ ok: true, report });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message.type === 'SCAN_INBOX_ITEMS') {
    const items = Array.isArray(message.payload) ? message.payload : [];

    Promise.all(
      items.map(async (item) => {
        try {
          return await analyzeRawEmail(item.rawEmail || '');
        } catch (error) {
          return { risk: { score: 0, severity: 'safe' }, error: error.message };
        }
      })
    )
      .then((results) => sendResponse({ ok: true, results }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message.type === 'GET_LAST_REPORT') {
    chrome.storage.local
      .get(['phishlensLastReport', 'phishlensLastEmail', 'phishlensLastUpdatedAt'])
      .then((data) => sendResponse({ ok: true, ...data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});
