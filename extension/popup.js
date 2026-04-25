const gauge = document.getElementById('riskGauge');
const riskValue = document.getElementById('riskValue');
const verdictBadge = document.getElementById('verdictBadge');
const topFlags = document.getElementById('topFlags');
const scanMeta = document.getElementById('scanMeta');

const circumference = 226;

function verdictFromSeverity(severity) {
  if (severity === 'safe') return 'SAFE TO OPEN';
  if (severity === 'suspicious') return 'VERIFY BEFORE ACTING';
  return 'DO NOT INTERACT';
}

function colorFromSeverity(severity) {
  if (severity === 'safe') return '#00ff88';
  if (severity === 'suspicious') return '#ffaa00';
  return '#ff3b5c';
}

function renderReport(report, updatedAt) {
  const risk = report?.risk || { score: 0, severity: 'safe', topReasons: [] };
  const score = Math.max(0, Math.min(100, risk.score || 0));
  const severity = risk.severity || 'safe';
  const verdict = verdictFromSeverity(severity);

  riskValue.textContent = String(score);
  gauge.style.stroke = colorFromSeverity(severity);
  gauge.style.strokeDashoffset = String(circumference - (circumference * score) / 100);

  verdictBadge.className = `badge ${severity}`;
  verdictBadge.textContent = verdict;

  const reasons = (risk.topReasons || []).slice(0, 3);
  topFlags.innerHTML = reasons.length
    ? reasons.map((reason) => `<li>${reason}</li>`).join('')
    : '<li>No major red flags detected.</li>';

  scanMeta.textContent = updatedAt
    ? `Last scanned: ${new Date(updatedAt).toLocaleTimeString()}`
    : 'No scan metadata';
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function requestCurrentEmailFromContent() {
  const tab = await getActiveTab();
  return chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CURRENT_EMAIL' });
}

async function runCurrentEmailScan() {
  const emailData = await requestCurrentEmailFromContent();
  if (!emailData?.rawEmail) {
    alert('No opened email could be extracted from Gmail.');
    return;
  }

  const result = await chrome.runtime.sendMessage({ type: 'ANALYZE_EMAIL', payload: emailData });
  if (!result?.ok) {
    alert(`Scan failed: ${result?.error || 'Unknown error'}`);
    return;
  }

  const data = await chrome.storage.local.get(['phishlensLastReport', 'phishlensLastUpdatedAt']);
  renderReport(data.phishlensLastReport, data.phishlensLastUpdatedAt);
}

async function runScanPageMode() {
  const tab = await getActiveTab();
  const result = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PAGE_MODE' });
  if (!result?.ok) {
    alert(`Inbox scan failed: ${result?.error || 'Unknown error'}`);
    return;
  }
  alert('Inbox scan complete. Risk badges were added to visible rows.');
}

async function openFullReport() {
  const data = await chrome.storage.local.get(['phishlensLastEmail']);
  const rawEmail = data?.phishlensLastEmail?.rawEmail || '';
  const encoded = encodeURIComponent(rawEmail);
  await chrome.tabs.create({ url: `http://localhost:3000/?prefill=${encoded}` });
}

document.getElementById('scanCurrentBtn').addEventListener('click', runCurrentEmailScan);
document.getElementById('scanPageBtn').addEventListener('click', runScanPageMode);
document.getElementById('openFullReportBtn').addEventListener('click', openFullReport);

chrome.runtime.sendMessage({ type: 'GET_LAST_REPORT' }, (response) => {
  if (response?.ok && response.phishlensLastReport) {
    renderReport(response.phishlensLastReport, response.phishlensLastUpdatedAt);
  }
});
