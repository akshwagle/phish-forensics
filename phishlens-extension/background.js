// PhishLens Guard — background.js (Clean Rewrite)
// Uses Gemini AI + strong local heuristics. No hallucination — evidence-based only.

const GEMINI_KEY = "AIzaSyD1eCm_D6til7nI2JPgJRknbSUnG2S_1nM";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;
const CACHE_TTL = 20 * 60 * 1000; // 20 min

const TRUSTED = new Set([
  "google.com","youtube.com","github.com","stackoverflow.com","twitter.com",
  "x.com","linkedin.com","wikipedia.org","microsoft.com","apple.com",
  "amazon.com","reddit.com","instagram.com","facebook.com","whatsapp.com",
  "gmail.com","outlook.com","yahoo.com","bing.com","duckduckgo.com",
]);

function isTrusted(hostname) {
  if (TRUSTED.has(hostname)) return true;
  for (const t of TRUSTED) if (hostname.endsWith("." + t)) return true;
  return false;
}

// ── Heuristics (always runs, no API needed) ──────────────────────────────────

const SUSP_TLDS    = new Set([".xyz",".tk",".ml",".ga",".cf",".gq",".top",".click",".loan",".work",".win",".ru",".pw",".cc",".ws"]);
const SUSP_WORDS   = ["login","verify","secure","account","update","confirm","password","signin","suspended","credential","webscr","banking","alert","unlock"];
const FREE_HOSTING = ["vercel.app","netlify.app","github.io","pages.dev","glitch.me","ngrok.io","firebaseapp.com","web.app","000webhost.com","replit.app"];
const BRANDS       = ["paypal","amazon","apple","google","microsoft","netflix","ebay","wellsfargo","chase","citibank","bankofamerica","instagram","facebook","whatsapp"];
const URGENCY      = ["urgent","immediately","suspended","expires today","act now","unauthorized","verify your account","confirm identity","security alert","update payment"];
const PRIZE_WORDS  = ["you have won","você ganhou","parabéns","congratulations","claim your prize","resgate","ganhou","sorteio","premio","leilao","lote","oferta","gratis","cashback"];

function heuristics({ url = "", domain = "", bodyText = "", links = [] }) {
  let score = 0;
  const signals = [];

  let u;
  try { u = new URL(url); } catch { return { score: 0, signals: [] }; }

  const host  = u.hostname.toLowerCase();
  const proto = u.protocol;
  const furl  = url.toLowerCase();
  const parts = host.split(".");
  const tld   = "." + parts.at(-1);
  const body  = (bodyText || "").toLowerCase();

  // IP domain
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) { score += 50; signals.push("IP address as domain"); }

  // Suspicious TLD
  if (SUSP_TLDS.has(tld)) { score += 20; signals.push(`Suspicious TLD: ${tld}`); }

  // Free hosting platform
  if (FREE_HOSTING.some(p => host.endsWith(p))) { score += 20; signals.push("Free hosting platform (common for phishing)"); }

  // No HTTPS
  if (proto !== "https:") { score += 20; signals.push("No HTTPS"); }

  // Suspicious URL words
  const uHits = SUSP_WORDS.filter(w => furl.includes(w));
  if (uHits.length) { score += Math.min(uHits.length * 10, 30); signals.push(`Suspicious URL words: ${uHits.slice(0,2).join(", ")}`); }

  // Brand impersonation in subdomain
  const sub  = parts.slice(0,-2).join(".");
  const root = parts.at(-2) || "";
  for (const b of BRANDS) {
    if (sub.includes(b) && !root.includes(b)) { score += 45; signals.push(`Brand impersonation: "${b}" in subdomain`); break; }
    if (root.includes(b) && !isTrusted(host))  { score += 30; signals.push(`Brand name "${b}" in unverified domain`); break; }
  }

  // "oficial" / "official" in domain
  if (host.includes("oficial") || host.includes("official")) { score += 25; signals.push('"oficial/official" in domain'); }

  // All-numeric subdomain
  if (parts.slice(0,-2).some(p => /^\d+$/.test(p))) { score += 15; signals.push("Numeric subdomain"); }

  // Too many subdomains
  if (parts.length > 4) { score += 15; signals.push(`${parts.length - 2} subdomains`); }

  // Multiple hyphens
  if ((host.match(/-/g)||[]).length >= 2) { score += 10; signals.push("Multiple hyphens in domain"); }

  // Long URL
  if (url.length > 120) { score += 8; signals.push(`Long URL (${url.length} chars)`); }

  // Urgency language
  const uWords = URGENCY.filter(w => body.includes(w));
  if (uWords.length) { score += Math.min(uWords.length * 10, 25); signals.push(`Urgency language: "${uWords[0]}"`); }

  // Login form
  const hasPass  = body.includes("password") || body.includes("senha");
  const hasLogin = body.includes("username") || body.includes("sign in") || body.includes("login") || body.includes("log in");
  if (hasPass && hasLogin) {
    score += (proto !== "https:") ? 35 : 12;
    signals.push(proto !== "https:" ? "Login form with no HTTPS!" : "Login/password form detected");
  }

  // Prize / auction language
  const pHits = PRIZE_WORDS.filter(w => (furl + " " + body).includes(w));
  if (pHits.length) { score += Math.min(pHits.length * 12, 30); signals.push(`Prize/auction language: "${pHits[0]}"`); }

  // Suspicious embedded links
  const badLinks = (links||[]).filter(l => {
    try { const h = new URL(l).hostname; return FREE_HOSTING.some(p => h.endsWith(p)) || /^(\d{1,3}\.){3}\d{1,3}$/.test(h); }
    catch { return false; }
  });
  if (badLinks.length > 1) { score += 12; signals.push(`${badLinks.length} suspicious embedded links`); }

  // Unknown domain baseline — everything that's not trusted starts with some uncertainty
  if (score === 0) { score = 5; signals.push("Unverified domain"); }

  return { score: Math.min(score, 100), signals };
}

// ── Full Page Scan AI ─────────────────────────────────────────────────────────

async function analyzeFullPage(summary) {
  const prompt = `You are PhishLens Guard, a precise browser security analyzer.
You are given a deep JSON analysis of a web page. Your goal is to detect phishing, especially credential harvesting pages that try to look like login screens but lack legitimate branding, or use random/suspicious domains.

CRITICAL RULES:
1. LEGITIMATE SITES (score 0-15): Sites with actual content, known domains, consistent branding, social proof, contact info, proper footers. Even if they have ads, trackers, or external links, score them low.
2. SUSPICIOUS DOMAINS (score 40-70): Domains with random consonants (vowelRatio < 0.2), suspicious TLDs (.xyz, .top, .pw, etc), or typosquatted domains.
3. CREDENTIAL HARVESTING (score 80-100): If the page is a login page (isLoginPage: true, passwordFieldCount > 0) BUT it is on a suspicious or random domain AND lacks strong branding (no logo, no footer, no social links, no contact info), it is highly likely a credential harvesting page. Flag it as DANGEROUS.

Only flag REAL threats. Do not flag generic external links or scripts unless they are part of a phishing attack.

Here is the deep page data:
${summary}

Return ONLY raw JSON:
{
  "page_risk": 0-100,
  "page_verdict": "SAFE|SUSPICIOUS|DANGEROUS",
  "page_summary": "one clear sentence",
  "false_positive_check": "brief note on why legitimate sites on this domain should not be flagged",
  "real_threats": [
    {
      "type": "link|form|input|iframe|domain|branding",
      "threat": "specific label",
      "severity": "low|medium|high|critical",
      "evidence": "exact URL or element description"
    }
  ]
}

Scoring guide:
- 0-15:  Normal website, ads and external links are fine
- 16-39: Minor anomalies, worth noting but not dangerous
- 40-69: Real suspicious patterns found
- 70-100: Active phishing attempt or credential harvester on suspicious domain.

IMPORTANT: Legitimate sites = always return page_risk <= 10. Only score high if there is CLEAR evidence of phishing intent or a highly suspicious login page.`;

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 600, temperature: 0.1, responseMimeType: "application/json" }
    })
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const j = await res.json();
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const cleaned = text.trim().replace(/^```json\s*/i,"").replace(/\s*```$/i,"");
  const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
  return JSON.parse(cleaned.slice(s, e + 1));
}

async function callGemini(pageData, hScore, hSignals) {
  const { url, title, bodyText, links, isEmail, emailData } = pageData;

  const prompt = `You are a phishing detection system. Analyze this web page and return ONLY valid JSON.

URL: ${url}
Title: ${title || "(none)"}
Local heuristic score: ${hScore}/100
Local signals found: ${hSignals.join(", ") || "none"}
Page content (first 2000 chars): ${(bodyText||"").slice(0,2000)}
Number of links on page: ${(links||[]).length}
${isEmail && emailData ? `\nEMAIL DATA:\nFrom: ${emailData.from}\nSubject: ${emailData.subject}\nBody: ${(emailData.body||"").slice(0,1000)}` : ""}

Instructions:
- Base your score on ACTUAL EVIDENCE from the URL and content above
- Do NOT guess — only flag what you can see
- If unsure, lean toward the heuristic score
- Phishing sites often: impersonate brands, use urgency/fear, ask for credentials on suspicious domains, use free hosting, have prize/giveaway claims
- Legitimate sites on free hosting (vercel/netlify) used for real apps should score 10-25 unless other signals present

Return this exact JSON:
{"risk_score": <0-100>, "verdict": "SAFE|SUSPICIOUS|DANGEROUS", "reason": "<evidence-based, max 12 words>", "signals": ["<signal1>", "<signal2>"]}

Scoring: 0-39=SAFE, 40-74=SUSPICIOUS, 75-100=DANGEROUS`;

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 300, temperature: 0.1, responseMimeType: "application/json" }
    })
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text().then(t=>t.slice(0,100))}`);
  const j = await res.json();
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text || "";
  // Parse JSON from response
  const cleaned = text.trim().replace(/^```json\s*/i,"").replace(/\s*```$/i,"");
  const start = cleaned.indexOf("{"), end = cleaned.lastIndexOf("}");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function setBadge(tabId, verdict) {
  const M = { SAFE:["✓","#22c55e"], SUSPICIOUS:["!","#f59e0b"], DANGEROUS:["✗","#ef4444"] };
  const [text, color] = M[verdict] || ["?","#64748b"];
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ tabId, color });
}

// ── Main Analysis ─────────────────────────────────────────────────────────────

const cache = new Map(); // in-memory cache: domain → {result, ts}

async function analyze(pageData, tabId) {
  const { domain, url } = pageData;

  if (!domain || !url) return null;

  // Trusted → skip
  if (isTrusted(domain)) {
    setBadge(tabId, "SAFE");
    return { risk_score: 0, verdict: "SAFE", reason: "Trusted domain", signals: [], source: "trusted" };
  }

  // Cache
  const cached = cache.get(domain);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    console.log("[PhishLens] Cache hit:", domain);
    setBadge(tabId, cached.result.verdict);
    return cached.result;
  }

  // Step 1: heuristics
  const { score: hScore, signals: hSignals } = heuristics(pageData);
  console.log(`[PhishLens] Heuristics ${domain}: ${hScore}`, hSignals);

  // Step 2: Gemini AI
  let result;
  try {
    const ai = await callGemini(pageData, hScore, hSignals);
    const aiScore = Math.max(0, Math.min(100, parseInt(ai.risk_score)||0));

    // Final score: never let AI completely override strong heuristics
    let finalScore = aiScore;
    if (hScore >= 40 && aiScore < 40) {
      // Heuristics found real signals but AI disagrees — blend them
      finalScore = Math.round((hScore * 0.5) + (aiScore * 0.5));
    } else {
      finalScore = Math.max(hScore, aiScore);
    }

    const verdict = finalScore >= 75 ? "DANGEROUS" : finalScore >= 40 ? "SUSPICIOUS" : "SAFE";
    const allSignals = [...new Set([...(ai.signals||[]), ...hSignals])].slice(0,5);

    result = {
      risk_score: finalScore,
      verdict,
      reason: ai.reason || hSignals[0] || "Analysis complete",
      signals: allSignals,
      source: "gemini",
    };
    console.log("[PhishLens] Gemini result:", result);

  } catch (err) {
    console.warn("[PhishLens] Gemini failed:", err.message);
    const verdict = hScore >= 75 ? "DANGEROUS" : hScore >= 40 ? "SUSPICIOUS" : "SAFE";
    result = {
      risk_score: hScore,
      verdict,
      reason: hSignals[0] || "Heuristic scan only (AI unavailable)",
      signals: hSignals,
      source: "heuristics",
    };
  }

  cache.set(domain, { result, ts: Date.now() });
  setBadge(tabId, result.verdict);
  return result;
}

// ── Messages ──────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === "ANALYZE_FULL_PAGE") {
    analyzeFullPage(msg.summary)
      .then(result => sendResponse({ ok: true, result }))
      .catch(err => {
        console.error("[PhishLens] Full page scan error:", err);
        sendResponse({ ok: false });
      });
    return true;
  }

  if (msg.type === "ANALYZE_PAGE") {
    const tabId = sender.tab?.id;
    if (!tabId) return false;
    analyze(msg, tabId).then(result => {
      if (!result) return;
      // Send alert to content script
      chrome.tabs.sendMessage(tabId, { type: "SHOW_ALERT", ...result }).catch(() => {});
      sendResponse({ ok: true });
    }).catch(err => {
      console.error("[PhishLens]", err);
      sendResponse({ ok: false });
    });
    return true;
  }

  if (msg.type === "FORCE_SCAN") {
    // Called from popup when content script unreachable
    analyze({ url: msg.url, domain: msg.domain, title: msg.title, bodyText: "", links: [], isEmail: false, emailData: null }, msg.tabId)
      .then(result => sendResponse(result || null))
      .catch(() => sendResponse(null));
    return true;
  }

  if (msg.type === "GET_RESULT") {
    const cached = cache.get(msg.domain);
    sendResponse(cached ? cached.result : null);
    return false;
  }

  if (msg.type === "CLEAR_CACHE") {
    cache.delete(msg.domain);
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "PHISHLENS_RESCAN") {
    // Background-side rescan for a specific tab
    chrome.tabs.get(msg.tabId, tab => {
      if (!tab?.url) return;
      const domain = new URL(tab.url).hostname;
      cache.delete(domain);
    });
    sendResponse({ ok: true });
    return false;
  }
});

// ── Restore badge on tab switch ───────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) return;
    const domain = new URL(tab.url).hostname;
    if (isTrusted(domain)) { setBadge(tabId, "SAFE"); return; }
    const cached = cache.get(domain);
    if (cached) setBadge(tabId, cached.result.verdict);
    else chrome.action.setBadgeText({ tabId, text: "" });
  } catch {}
});

console.log("[PhishLens] Background ready. Gemini key loaded.");
