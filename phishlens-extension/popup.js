// PhishLens Guard — popup.js (Clean Rewrite)

const APP = "https://phishlens.vercel.app";

const domainEl = document.getElementById("domain");
const scoreEl  = document.getElementById("score");
const badgeEl  = document.getElementById("badge");
const barEl    = document.getElementById("bar");
const reasonEl = document.getElementById("reason");
const sourceEl = document.getElementById("source");
const sigsEl   = document.getElementById("signals");
const dotEl    = document.getElementById("dot");
const liveTxt  = document.getElementById("live-txt");
const toggleEl = document.getElementById("toggle");
const btnScan  = document.getElementById("btn-scan");
const btnOpen  = document.getElementById("btn-open");

let tab = null;

// ── Render ─────────────────────────────────────────────────────────────────

function verdictClass(v) {
  return ({SAFE:"safe",SUSPICIOUS:"suspicious",DANGEROUS:"dangerous"})[v]||"pending";
}

function render(domain, r) {
  const c = verdictClass(r.verdict);
  const icons = {SAFE:"✅",SUSPICIOUS:"⚠️",DANGEROUS:"🛑"};

  domainEl.textContent = domain || "—";
  scoreEl.textContent  = r.risk_score ?? "—";
  scoreEl.className    = "score " + c;
  badgeEl.textContent  = `${icons[r.verdict]||"⏳"} ${r.verdict||"UNKNOWN"}`;
  badgeEl.className    = "badge " + c;
  barEl.className      = "bar " + c;
  barEl.style.width    = (r.risk_score ?? 0) + "%";
  reasonEl.textContent = r.reason || "—";

  const srcMap = { gemini:"🤖 Gemini AI", heuristics:"📐 Heuristics", trusted:"✓ Trusted", heuristics:"📐 Heuristics only" };
  sourceEl.textContent = srcMap[r.source] || r.source || "";

  sigsEl.innerHTML = (r.signals||[]).slice(0,4).map(s =>
    `<div class="sig">${s}</div>`
  ).join("");
}

function renderPending(domain) {
  domainEl.textContent = domain || "—";
  scoreEl.textContent  = "—";
  scoreEl.className    = "score pending";
  badgeEl.textContent  = "⏳ Not Scanned";
  badgeEl.className    = "badge pending";
  barEl.style.width    = "0%";
  reasonEl.textContent = "Click Scan Now to analyze";
  sourceEl.textContent = "";
  sigsEl.innerHTML     = "";
}

// ── Toggle ──────────────────────────────────────────────────────────────────

async function loadToggle() {
  const { phishlens_enabled } = await chrome.storage.local.get("phishlens_enabled").catch(()=>({}));
  const on = phishlens_enabled !== false;
  toggleEl.checked = on;
  dotEl.className  = on ? "dot" : "dot off";
  liveTxt.textContent = on ? "Active" : "Paused";
}

toggleEl.addEventListener("change", async () => {
  const on = toggleEl.checked;
  await chrome.storage.local.set({ phishlens_enabled: on });
  dotEl.className     = on ? "dot" : "dot off";
  liveTxt.textContent = on ? "Active" : "Paused";
});

// ── Scan Now ────────────────────────────────────────────────────────────────

btnScan.addEventListener("click", async () => {
  if (!tab) return;
  btnScan.disabled = true;
  btnScan.innerHTML = '<span class="spin"></span>Scanning…';

  let domain;
  try { domain = new URL(tab.url).hostname; } catch { resetBtn(); return; }

  // 1. Clear cache
  await chrome.runtime.sendMessage({ type: "CLEAR_CACHE", domain }).catch(()=>{});

  // 2. Try to ask content script to rescan
  let contentOk = false;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "PHISHLENS_RESCAN" });
    contentOk = true;
  } catch {
    // Content script not injected — inject it
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await new Promise(r => setTimeout(r, 700));
      await chrome.tabs.sendMessage(tab.id, { type: "PHISHLENS_RESCAN" });
      contentOk = true;
    } catch (e) {
      console.warn("[PhishLens Popup] Inject failed:", e.message);
    }
  }

  // 3. If content script still unreachable, ask background to do URL-only scan
  if (!contentOk) {
    try {
      const result = await chrome.runtime.sendMessage({
        type: "FORCE_SCAN", tabId: tab.id, url: tab.url, domain, title: tab.title || ""
      });
      if (result) { render(domain, result); resetBtn(); return; }
    } catch {}
  }

  // 4. Poll background cache for result (content script path)
  let tries = 0;
  const poll = setInterval(async () => {
    tries++;
    try {
      const r = await chrome.runtime.sendMessage({ type: "GET_RESULT", domain });
      if (r) { clearInterval(poll); render(domain, r); resetBtn(); return; }
    } catch {}
    if (tries > 20) {
      clearInterval(poll);
      reasonEl.textContent = "Timed out — reload page and try again";
      resetBtn();
    }
  }, 800);
});

function resetBtn() {
  btnScan.disabled = false;
  btnScan.innerHTML = "🔬 Scan Now";
}

// ── Full Page Scan ──────────────────────────────────────────────────────────

const btnFullScan = document.getElementById("btn-full-scan");
const btnClear    = document.getElementById("btn-clear");

btnFullScan.addEventListener("click", () => {
  if (!tab) return;
  btnFullScan.innerHTML = '<span class="spin"></span>Scanning...';
  chrome.tabs.sendMessage(tab.id, { type: "FULL_PAGE_SCAN" }).catch(async () => {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["alert.css"] });
      await new Promise(r => setTimeout(r, 700));
      await chrome.tabs.sendMessage(tab.id, { type: "FULL_PAGE_SCAN" });
    } catch(e) {
      console.warn("[PhishLens Popup] Inject failed:", e.message);
      alert("Cannot scan this type of page. Please try on a regular website.");
    }
  });
  setTimeout(() => window.close(), 1000);
});

btnClear.addEventListener("click", () => {
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: "CLEAR_SCAN" }).catch(()=>{});
  btnClear.style.display = "none";
});

// ── Deep Scan — popup-side ────────────────────────────────────────────────────

const deepBtn        = document.getElementById("deep-scan-btn");
const deepStatus     = document.getElementById("deep-scan-status");
const deepResultEl   = document.getElementById("deep-scan-result");
const dsStatusLabel  = document.getElementById("ds-status-label");

const STEP_MAP = {
  source:    { el: document.getElementById("step-source"),    label: "Fetching page source" },
  dns:       { el: document.getElementById("step-dns"),       label: "Checking DNS records" },
  cert:      { el: document.getElementById("step-cert"),      label: "Checking certificate age" },
  headers:   { el: document.getElementById("step-headers"),   label: "Reading security headers" },
  ai:        { el: document.getElementById("step-ai"),        label: "Running 3 AI models" },
  consensus: { el: document.getElementById("step-consensus"), label: "Building consensus" }
};

function applyStepUpdate(key, step) {
  const m = STEP_MAP[key];
  if (!m || !m.el) return;
  if (step.status === "done") {
    m.el.textContent = `✅ ${m.label}${step.detail ? " — " + step.detail : ""}`;
    m.el.className = "ds-step done";
  } else if (step.status === "active") {
    m.el.textContent = `⏳ ${m.label}…`;
    m.el.className = "ds-step active";
  } else {
    m.el.textContent = `⏳ ${m.label}…`;
    m.el.className = "ds-step pending";
  }
}

function vc(v) { return (v || "").toLowerCase(); }
function scoreBar(score) { return Math.max(0, Math.min(100, score || 0)); }

function buildSignals(details) {
  if (!details) return "";
  const rows = [];
  const { dns, certAge, secHeaders, extracted } = details;

  if (dns && !dns.error) {
    rows.push(dns.hasMXRecords
      ? { cls: "pass", txt: "✓ MX records present" }
      : { cls: "fail", txt: "✗ No MX records — no email infrastructure" });
    rows.push(dns.hasSPFRecord
      ? { cls: "pass", txt: "✓ SPF record present" }
      : { cls: "fail", txt: "✗ SPF record missing" });
    rows.push(dns.hasDMARCRecord
      ? { cls: "pass", txt: "✓ DMARC record present" }
      : { cls: "fail", txt: "✗ DMARC record missing" });
  }

  if (certAge && !certAge.error && !certAge.noCerts) {
    const age = `${certAge.daysSinceFirstCert}d`;
    rows.push(certAge.isVeryNew
      ? { cls: "fail", txt: `✗ Domain registered < 7 days ago (${age} — crt.sh)` }
      : certAge.isNew
        ? { cls: "fail", txt: `✗ Certificate issued < 30 days ago (${age})` }
        : { cls: "pass", txt: `✓ Certificate age: ${age}` });
    if (certAge.isFreeCert)
      rows.push({ cls: "warn", txt: "~ Let's Encrypt / ZeroSSL (free cert)" });
  }

  if (secHeaders && !secHeaders.error) {
    const missing = [];
    if (!secHeaders.hasHSTS) missing.push("HSTS");
    if (!secHeaders.hasCSP)  missing.push("CSP");
    if (!secHeaders.hasXFrame) missing.push("X-Frame");
    if (missing.length)
      rows.push({ cls: "fail", txt: "✗ Security headers missing: " + missing.join(", ") });
    else
      rows.push({ cls: "pass", txt: "✓ Security headers present" });

    rows.push(secHeaders.finalURL?.startsWith("https")
      ? { cls: "pass", txt: "✓ HTTPS enabled" }
      : { cls: "fail", txt: "✗ No HTTPS" });

    if (secHeaders.wasRedirected)
      rows.push({ cls: "warn", txt: `~ Redirect detected → ${(secHeaders.redirectedTo || "").slice(0, 35)}` });
  }

  if (extracted?.domainSignals) {
    const ds = extracted.domainSignals;
    if (ds.looksRandom)
      rows.push({ cls: "fail", txt: `✗ Random domain name (vowel ratio: ${ds.vowelRatio})` });
    if (ds.suspiciousTLD)
      rows.push({ cls: "fail", txt: `✗ Suspicious TLD: .${ds.tld}` });
    if (extracted?.scriptFlags?.hasEval || extracted?.scriptFlags?.hasAtob)
      rows.push({ cls: "fail", txt: "✗ Obfuscated JavaScript detected (eval/atob)" });
    if (extracted?.allURLs?.iframes?.some(i => i.hidden))
      rows.push({ cls: "fail", txt: "✗ Hidden iframes found" });
  }

  return rows.map(r =>
    `<div class="ds-sig ${r.cls}">${r.txt}</div>`
  ).join("");
}

function renderDeepResult(consensus, details, elapsed) {
  if (!consensus) return;
  const vClass   = vc(consensus.finalVerdict);
  const vIcon    = { safe:"✅", suspicious:"⚠️", dangerous:"🛑" }[vClass] || "?";
  const agreePct = consensus.modelsUsed === 3 && new Set(consensus.modelScores.map(m => m.verdict)).size === 1
    ? `${consensus.modelsUsed}/3 models agree` : `${consensus.modelsUsed}/3 models · ${consensus.confidence} confidence`;

  const modelBarsHTML = (consensus.modelScores || []).map(m => {
    const mc  = vc(m.verdict);
    const pct = scoreBar(m.score);
    return `
      <div class="ds-model-row">
        <span class="ds-model-name" title="${m.model}">${m.model}</span>
        <div class="ds-bar-bg"><div class="ds-bar ${mc}" style="width:${pct}%"></div></div>
        <span class="ds-model-score ${mc}">${m.score}</span>
      </div>`;
  }).join("");

  const signalsHTML  = buildSignals(details);
  const evidenceHTML = (consensus.allEvidence || []).map(e =>
    `<div class="ds-ev-item">• ${e}</div>`
  ).join("") || `<div class="ds-ev-item" style="color:#475569;font-style:italic">No specific evidence.</div>`;

  const elapsedStr = elapsed ? ` · <span class="ds-elapsed">${elapsed}s</span>` : "";

  deepResultEl.innerHTML = `
    <div class="ds-result">
      <div class="ds-result-hdr">DEEP SCAN COMPLETE${elapsedStr}</div>

      <div class="ds-verdict-block ${vClass}">
        <div class="ds-verdict-score">${consensus.finalScore}</div>
        <div class="ds-verdict-right">
          <div class="ds-verdict-label">${vIcon} ${consensus.finalVerdict}</div>
          <div class="ds-consensus">${agreePct}</div>
        </div>
      </div>

      <div class="ds-section-lbl">MODEL VERDICTS</div>
      <div class="ds-models">${modelBarsHTML}</div>

      ${signalsHTML ? `<div class="ds-section-lbl">TECHNICAL SIGNALS</div>
      <div class="ds-signals">${signalsHTML}</div>` : ""}

      ${evidenceHTML ? `<div class="ds-section-lbl">EVIDENCE</div>
      <div class="ds-evidence">${evidenceHTML}</div>` : ""}

      <div class="ds-rescan-row">
        <button class="ds-btn-rescan" id="ds-rescan">🔄 Run Again</button>
      </div>
    </div>`;

  deepResultEl.style.display = "block";
  deepResultEl.querySelector("#ds-rescan").onclick = () => deepBtn.click();
}

function showDeepStatus(running) {
  deepBtn.style.display    = running ? "none" : "flex";
  deepStatus.style.display = running ? "block" : "none";
}

// Listen for storage changes while popup is open (live step updates)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes.deepScanSteps) {
    const steps = changes.deepScanSteps.newValue || {};
    Object.entries(steps).forEach(([key, step]) => applyStepUpdate(key, step));
  }

  if (changes.deepScanRunning) {
    const running = changes.deepScanRunning.newValue;
    showDeepStatus(running);
    if (running) dsStatusLabel.textContent = "Running multi-model analysis…";
    else         dsStatusLabel.textContent = "Analysis complete";
  }

  if (changes.deepScanResult && changes.deepScanResult.newValue) {
    const { consensus, details, elapsed } = changes.deepScanResult.newValue;
    renderDeepResult(consensus, details, elapsed);
    deepStatus.style.display = "none";
    deepBtn.style.display    = "none";
  }
});

deepBtn.addEventListener("click", async () => {
  if (!tab) return;

  // Clear any previous result from storage and reset step UI
  await chrome.storage.local.remove(["deepScanResult", "deepScanSteps", "deepScanRunning"]).catch(()=>{});
  Object.values(STEP_MAP).forEach(({ el, label }) => {
    el.textContent = `⏳ ${label}…`;
    el.className = "ds-step pending";
  });
  deepResultEl.style.display = "none";
  deepResultEl.innerHTML = "";
  showDeepStatus(true);

  async function triggerDeepScan() {
    await chrome.tabs.sendMessage(tab.id, { type: "DEEP_SCAN" });
  }

  try {
    await triggerDeepScan();
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["alert.css"] });
      await new Promise(r => setTimeout(r, 700));
      await triggerDeepScan();
    } catch (e) {
      console.warn("[PhishLens] Deep scan inject failed:", e.message);
      alert("Cannot run Deep Scan on this page. Try on a regular website.");
      showDeepStatus(false);
    }
  }
});

// On popup open: restore any in-progress or completed scan
(async () => {
  const stored = await chrome.storage.local.get(["deepScanSteps","deepScanRunning","deepScanResult"]).catch(()=>({}));

  if (stored.deepScanRunning) {
    showDeepStatus(true);
    if (stored.deepScanSteps)
      Object.entries(stored.deepScanSteps).forEach(([key, step]) => applyStepUpdate(key, step));
  }

  if (stored.deepScanResult) {
    const { consensus, details, elapsed } = stored.deepScanResult;
    deepBtn.style.display = "none";
    deepStatus.style.display = "none";
    renderDeepResult(consensus, details, elapsed);
    if (stored.deepScanSteps)
      Object.entries(stored.deepScanSteps).forEach(([key, step]) => applyStepUpdate(key, step));
    deepStatus.style.display = stored.deepScanRunning ? "block" : "none";
  }
})();

// ── Open App ────────────────────────────────────────────────────────────────

btnOpen.addEventListener("click", () => {
  const info = { url: tab?.url||"", title: tab?.title||"" };
  chrome.tabs.create({ url: APP + "?scan=" + btoa(encodeURIComponent(JSON.stringify(info))).slice(0,2000) });
});

// ── Init ─────────────────────────────────────────────────────────────────────

(async () => {
  await loadToggle();

  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) { renderPending("—"); return; }

    let domain;
    try { domain = new URL(tab.url).hostname; }
    catch { renderPending("—"); return; }

    // Check cached result
    const r = await chrome.runtime.sendMessage({ type: "GET_RESULT", domain }).catch(()=>null);
    if (r) render(domain, r);
    else    renderPending(domain);

  } catch (e) {
    console.warn("[PhishLens Popup]", e);
    renderPending("Error");
  }
})();
