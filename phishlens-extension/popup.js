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
  setTimeout(() => window.close(), 1000); // Close popup so user can see overlay
});

btnClear.addEventListener("click", () => {
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: "CLEAR_SCAN" }).catch(()=>{});
  btnClear.style.display = "none";
});

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
