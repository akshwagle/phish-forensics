// PhishLens Guard — content.js (Clean Rewrite)
(function () {
  "use strict";

  const TRUSTED_DOMAINS = [
    // Search & productivity
    "google.com","googleapis.com","gstatic.com","googletagmanager.com",
    "googleadservices.com","doubleclick.net","google-analytics.com",
    "youtube.com","youtu.be","gmail.com","drive.google.com",

    // Microsoft
    "microsoft.com","microsoftonline.com","live.com","outlook.com",
    "office.com","azure.com","bing.com","msn.com","sharepoint.com",

    // Meta / Social
    "facebook.com","instagram.com","twitter.com","x.com","linkedin.com",
    "threads.net","whatsapp.com","messenger.com",

    // Developer / Tech
    "github.com","githubusercontent.com","gitlab.com","stackoverflow.com",
    "npmjs.com","nodejs.org","python.org","developer.mozilla.org",
    "w3schools.com","geeksforgeeks.org","medium.com","dev.to",
    "hashnode.com","codepen.io","jsfiddle.net","replit.com",
    "vercel.com","netlify.com","heroku.com","railway.app",
    "cloudflare.com","cloudfront.net","fastly.net","akamai.net",
    "jsdelivr.net","cdnjs.cloudflare.com","unpkg.com",

    // News & Info
    "wikipedia.org","wikimedia.org","reddit.com","quora.com",
    "bbc.com","cnn.com","nytimes.com","theguardian.com",
    "techcrunch.com","wired.com","hackernews.com","ycombinator.com",

    // E-commerce & Finance (legitimate)
    "amazon.com","flipkart.com","ebay.com","stripe.com","paypal.com",
    "razorpay.com","shopify.com",

    // CDN & Analytics (never flag these)
    "cloudflare.com","jquery.com","bootstrapcdn.com","fontawesome.com",
    "fonts.googleapis.com","fonts.gstatic.com","analytics.google.com",
    "segment.com","mixpanel.com","hotjar.com","intercom.io",
    "crisp.chat","freshdesk.com","zendesk.com",

    // Ad networks (annoying but not phishing)
    "googlesyndication.com","adservice.google.com","amazon-adsystem.com",
    "outbrain.com","taboola.com","criteo.com","scorecardresearch.com",

    // Apple
    "apple.com","icloud.com","itunes.com",

    // Indian sites
    "unstop.com","internshala.com","naukri.com","hackerrank.com",
    "hackerearth.com","codechef.com","codeforces.com","leetcode.com",
    "swiggy.com","zomato.com","phonepe.com","paytm.com","upi.npci.org"
  ];

  const hostname = window.location.hostname;

  function getApexDomain(url) {
    try {
      const host = new URL(url).hostname;
      const parts = host.split('.');
      if (parts.length > 2 && (parts[parts.length-2] === 'co' || parts[parts.length-2] === 'com') && parts[parts.length-1].length === 2) {
        return parts.slice(-3).join('.');
      }
      return parts.slice(-2).join('.');
    } catch { return null; }
  }

  function isTrusted(url) {
    const apex = getApexDomain(url);
    if (!apex) return false;
    return TRUSTED_DOMAINS.some(d => apex === d || apex.endsWith('.' + d));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function extractLinks() {
    return Array.from(document.querySelectorAll("a[href]"))
      .map(a => a.href).filter(h => h.startsWith("http")).slice(0, 80);
  }

  // ── Alert UI ───────────────────────────────────────────────────────────────

  function removeAlert() {
    document.getElementById("pl-alert")?.remove();
  }

  function showAlert({ risk_score, verdict, reason, signals = [] }) {
    if (risk_score < 40) return; // below threshold — no popup
    removeAlert();

    const danger = verdict === "DANGEROUS";
    const color  = danger ? "#ef4444" : "#f59e0b";
    const icon   = danger ? "🛑" : "⚠️";
    const title  = danger ? "Phishing Threat Detected" : "Suspicious Page";

    const el = document.createElement("div");
    el.id = "pl-alert";
    el.style.cssText = `
      position:fixed;bottom:20px;right:20px;width:300px;
      background:#111827;color:#f1f5f9;
      border-left:4px solid ${color};border-radius:8px;
      padding:14px 16px;z-index:2147483647;
      font-family:system-ui,-apple-system,sans-serif;font-size:13px;
      box-shadow:0 8px 24px rgba(0,0,0,.6);
      animation:plIn .3s ease;
    `;

    const signalHTML = signals.slice(0,3).map(s =>
      `<div style="color:#94a3b8;font-size:11px;margin-top:3px">• ${esc(s)}</div>`
    ).join("");

    el.innerHTML = `
      <style>@keyframes plIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}</style>
      <button id="pl-close" style="position:absolute;top:8px;right:10px;background:none;border:none;color:#64748b;font-size:18px;cursor:pointer;line-height:1">×</button>
      <div style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:14px;margin-bottom:6px">
        <span>${icon}</span><span>${title}</span>
      </div>
      <div style="color:#94a3b8;font-size:12px;margin-bottom:4px">${esc(reason)}</div>
      <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:6px">Risk: ${risk_score}/100</div>
      ${signalHTML}
      <div style="display:flex;gap:8px;margin-top:12px">
        ${danger
          ? `<button id="pl-leave" style="flex:1;background:#ef4444;color:#fff;border:none;border-radius:5px;padding:6px;font-size:12px;cursor:pointer;font-weight:600">← Leave Page</button>`
          : `<button id="pl-dismiss" style="flex:1;background:#1e293b;color:#94a3b8;border:none;border-radius:5px;padding:6px;font-size:12px;cursor:pointer">Dismiss</button>`
        }
        <button id="pl-detail" style="flex:1;background:#1d4ed8;color:#fff;border:none;border-radius:5px;padding:6px;font-size:12px;cursor:pointer;font-weight:600">Details →</button>
      </div>
    `;

    document.body.appendChild(el);

    el.querySelector("#pl-close").onclick = removeAlert;
    el.querySelector("#pl-dismiss")?.addEventListener("click", removeAlert);
    el.querySelector("#pl-leave")?.addEventListener("click", () => window.history.back());
    el.querySelector("#pl-detail").onclick = () => {
      const data = encodeURIComponent(JSON.stringify({ url: location.href, verdict, risk_score, reason, signals }));
      window.open("https://phishlens.vercel.app?scan=" + btoa(data).slice(0, 2000), "_blank");
    };

    // Auto-dismiss suspicious after 12s
    if (!danger) setTimeout(removeAlert, 12000);
  }

  // ── Suspicious link annotation ─────────────────────────────────────────────

  const SHORTENERS = new Set(["bit.ly","tinyurl.com","t.co","goo.gl","ow.ly","buff.ly","is.gd","cutt.ly","rb.gy"]);

  function annotateSuspiciousLinks() {
    document.querySelectorAll("a[href]:not([data-pl])").forEach(a => {
      a.dataset.pl = "1";
      let h;
      try { h = new URL(a.href).hostname; } catch { return; }
      if (!SHORTENERS.has(h) && !/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return;
      a.style.outline = "1px dashed #f59e0b";
      a.title = `[PhishLens] ⚠ Suspicious link → ${a.href}`;
    });
  }

  // ── Main scan ──────────────────────────────────────────────────────────────

  async function runScan() {
    if (isTrusted(hostname)) return;

    try {
      const { phishlens_enabled } = await chrome.storage.local.get("phishlens_enabled");
      if (phishlens_enabled === false) return;
    } catch {}

    const bodyText = (document.body?.innerText || "").slice(0, 3000);

    const payload = {
      type: "ANALYZE_PAGE",
      url: location.href,
      domain: hostname,
      title: document.title,
      bodyText,
      links: extractLinks(),
      isEmail: false,
      emailData: null,
    };

    console.log("[PhishLens] Scanning:", hostname);
    try {
      await chrome.runtime.sendMessage(payload);
    } catch (e) {
      console.warn("[PhishLens] Send failed:", e.message);
    }

    annotateSuspiciousLinks();
  }

  // ── Full Page Scan ──────────────────────────────────────────────────────────

  function clearScan() {
    document.getElementById("pls-scan-overlay")?.remove();
    document.getElementById("pls-summary-panel")?.remove();
    document.getElementById("pls-tooltip")?.remove();
    document.querySelectorAll(".pls-highlight, .pls-badge").forEach(e => e.remove());
  }

  function showTooltip(reason, rect, severity) {
    let tooltip = document.getElementById("pls-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "pls-tooltip";
      document.body.appendChild(tooltip);
    }
    const colors = { critical:"#ef4444", high:"#f97316", medium:"#f59e0b", low:"#3b82f6" };
    tooltip.style.cssText = `
      position: fixed; background: #1a1d27; color: #e2e8f0; padding: 10px 14px;
      border-radius: 8px; font-size: 12px; max-width: 280px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5); z-index: 2147483647; pointer-events: none;
      border-left: 3px solid ${colors[severity] || "#fff"};
      font-family: -apple-system, sans-serif; line-height: 1.4;
    `;
    tooltip.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px;color:${colors[severity]}">${severity.toUpperCase()} THREAT</div>
      <div style="color:#94a3b8">${esc(reason)}</div>
    `;
    
    // Position near the element
    let top = rect.top - tooltip.offsetHeight - 8;
    if (top < 0) top = rect.bottom + 8;
    let left = rect.left;
    if (left + tooltip.offsetWidth > window.innerWidth) left = window.innerWidth - tooltip.offsetWidth - 8;
    
    tooltip.style.top = top + "px";
    tooltip.style.left = left + "px";
    tooltip.style.display = "block";
  }

  function hideTooltip() {
    const tooltip = document.getElementById("pls-tooltip");
    if (tooltip) tooltip.style.display = "none";
  }

  function highlightElement(el, severity, reason) {
    const rect = el.getBoundingClientRect();
    const highlight = document.createElement("div");
    highlight.className = `pls-highlight pls-highlight-${severity}`;
    highlight.style.top = (rect.top + window.scrollY) + "px";
    highlight.style.left = (rect.left + window.scrollX) + "px";
    highlight.style.width = rect.width + "px";
    highlight.style.height = rect.height + "px";

    const badge = document.createElement("div");
    badge.className = `pls-badge pls-badge-${severity}`;
    badge.textContent = severity.toUpperCase();
    badge.style.top = (rect.top + window.scrollY - 8) + "px";
    badge.style.left = (rect.right + window.scrollX - badge.offsetWidth) + "px";

    highlight.addEventListener("mouseenter", () => showTooltip(reason, rect, severity));
    highlight.addEventListener("mouseleave", hideTooltip);
    
    // For scrolling to it later
    highlight.dataset.ref = Math.random().toString(36).substr(2, 9);
    el.dataset.plsRef = highlight.dataset.ref;

    document.body.appendChild(highlight);
    document.body.appendChild(badge);
    return highlight.dataset.ref;
  }

  async function runFullPageScan() {
    clearScan();

    // 1. Show overlay
    const overlay = document.createElement("div");
    overlay.id = "pls-scan-overlay";
    overlay.innerHTML = `
      <div class="pls-scan-header">
        <div class="pls-scan-logo">🔍</div>
        <div class="pls-scan-text">PhishLens scanning page...</div>
        <div class="pls-scan-counter" id="pls-counter">Found 0 elements</div>
      </div>
      <div class="pls-scan-bar"><div class="pls-scan-progress" id="pls-progress"></div></div>
    `;
    document.body.appendChild(overlay);

    // Animate progress bar
    setTimeout(() => { document.getElementById("pls-progress").style.width = "100%"; }, 50);

    // 2. Extract elements
    const links   = [...document.querySelectorAll("a[href]")];
    const forms   = [...document.querySelectorAll("form")];
    const inputs  = [...document.querySelectorAll("input, textarea")];
    const iframes = [...document.querySelectorAll("iframe")];
    const images  = [...document.querySelectorAll("img[src]")];
    
    document.getElementById("pls-counter").textContent = `Scanning ${links.length + forms.length + inputs.length} elements...`;

    // 3. Local Analysis (Critical explicit threats only)
    const localFlags = [];

    links.forEach(a => {
      const href = a.href || '';
      
      if (/^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(href)) {
        localFlags.push({ el: a, type: "link", hint: a.href, threat: "Link points to raw IP address", severity: "critical" });
      } else if (/^(data|javascript):/i.test(href)) {
        localFlags.push({ el: a, type: "link", hint: a.href, threat: "Data/JS URI link — potential script injection", severity: "critical" });
      } else {
        try {
          if (/[^\u0000-\u007F]/.test(new URL(href).hostname)) {
            localFlags.push({ el: a, type: "link", hint: a.href, threat: "Domain contains non-ASCII characters (homograph attack)", severity: "critical" });
          }
        } catch {}
      }
    });

    // 4. Build deep page data for AI
    function buildDeepPageData() {
      // 1. DOMAIN ANALYSIS
      const hostname = window.location.hostname;
      const domainParts = hostname.replace('www.','').split('.');
      const domainName = domainParts.length > 1 ? domainParts[domainParts.length - 2] : domainParts[0];

      // Check if domain looks random/generated
      const vowels = (domainName.match(/[aeiou]/gi) || []).length;
      const consonants = domainName.replace(/[aeiou]/gi,'').replace(/[^a-z]/gi,'').length;
      const vowelRatio = vowels / (domainName.length || 1);
      const looksRandom = vowelRatio < 0.2 && domainName.length <= 8;

      // Check TLD
      const tld = domainParts.slice(-1)[0];
      const suspiciousTLDs = ['xyz','top','click','online','site','fun','pw','cc','info','biz','tk','ml','ga','cf','gq','buzz','icu','vip'];
      const hasSuspiciousTLD = suspiciousTLDs.includes(tld);

      // 2. PAGE IDENTITY SIGNALS
      const pageTitle = document.title || '';
      const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
      const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.content || '';
      const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
      const canonicalURL = document.querySelector('link[rel="canonical"]')?.href || '';
      const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')?.href || '';

      // 3. BRANDING DETECTION
      const allText = document.body.innerText || '';
      const allHTML = document.body.innerHTML || '';

      const hasLogo = !!document.querySelector(
        'img[class*="logo"], img[id*="logo"], img[alt*="logo"], '
        + '.logo, #logo, [class*="brand"], header img'
      );
      const hasCompanyName = !!(ogSiteName || ogTitle);
      const hasFooter = !!document.querySelector('footer');
      const hasAboutLink = /about|contact|privacy|terms/i.test(allText);
      const hasCopyright = /©|copyright|all rights reserved/i.test(allText);

      // 4. LOGIN / CREDENTIAL FORM DETECTION
      const inputs = [...document.querySelectorAll('input')];
      const passwordFields = inputs.filter(i => i.type === 'password');
      const usernameFields = inputs.filter(i =>
        i.type === 'text' || i.type === 'email' ||
        /user|email|phone|account|login|id/i.test(i.name + i.placeholder + i.id)
      );
      const hasCaptcha = !!document.querySelector(
        '.captcha, [class*="captcha"], [id*="captcha"], canvas, '
        + 'img[src*="captcha"], input[name*="captcha"], input[name*="code"]'
      );

      const isLoginPage = passwordFields.length > 0 ||
        /login|sign in|signin|log in|password/i.test(allText.slice(0,500));

      // 5. FORM ACTION ANALYSIS
      const formActions = forms.map(f => f.action).filter(Boolean);
      const formMethods = forms.map(f => f.method);

      // 6. SCRIPT AND EXTERNAL RESOURCE ANALYSIS
      const scripts = [...document.querySelectorAll('script[src]')]
        .map(s => s.src)
        .filter(s => !s.includes(hostname)); // external scripts only

      const externalScriptDomains = [...new Set(
        scripts.map(s => { try { return new URL(s).hostname; } catch { return null; }})
               .filter(Boolean)
      )];

      // 7. SOCIAL PROOF SIGNALS
      const hasSocialLinks = /facebook|twitter|instagram|linkedin|youtube/i.test(allHTML);
      const hasContactInfo = /contact|support|help|@|phone|\+[0-9]/i.test(allText);
      const hasAddress = /street|avenue|road|city|state|zip|postal/i.test(allText);

      // 8. HTTPS CHECK
      const isHTTPS = window.location.protocol === 'https:';

      // 9. URL PATH ANALYSIS
      const path = window.location.pathname + window.location.hash;
      const hasLoginInPath = /login|signin|account|auth|verify/i.test(path);

      // 10. VISIBLE PAGE TEXT
      const visibleText = document.body.innerText
        .replace(/\s+/g,' ')
        .trim()
        .slice(0, 1000);

      return JSON.stringify({
        domain: hostname,
        domainName: domainName,
        tld: tld,
        looksRandomDomain: looksRandom,
        vowelRatio: vowelRatio.toFixed(2),
        hasSuspiciousTLD: hasSuspiciousTLD,
        isHTTPS: isHTTPS,
        pageTitle: pageTitle,
        metaDescription: metaDesc,
        ogSiteName: ogSiteName,
        canonicalURL: canonicalURL,
        hasFavicon: !!favicon,
        hasLogoElement: hasLogo,
        hasCompanyNameMeta: hasCompanyName,
        hasFooter: hasFooter,
        hasAboutOrContactLink: hasAboutLink,
        hasCopyrightText: hasCopyright,
        hasSocialMediaLinks: hasSocialLinks,
        hasContactInfo: hasContactInfo,
        hasPhysicalAddress: hasAddress,
        isLoginPage: isLoginPage,
        passwordFieldCount: passwordFields.length,
        usernameFieldCount: usernameFields.length,
        hasCaptcha: hasCaptcha,
        formCount: forms.length,
        formActions: formActions,
        formMethods: formMethods,
        externalScriptDomains: externalScriptDomains.slice(0,10),
        totalExternalScripts: scripts.length,
        pathHasLoginKeyword: hasLoginInPath,
        fullURL: window.location.href,
        pageTextPreview: visibleText
      }, null, 2);
    }

    const summary = buildDeepPageData();

    let aiResult;
    try {
      const res = await chrome.runtime.sendMessage({ type: "ANALYZE_FULL_PAGE", summary });
      if (res && res.ok) aiResult = res.result;
    } catch (e) { console.warn("[PhishLens] AI full scan failed:", e); }

    // Use AI result if available, otherwise fallback to local flags
    let finalFlags = [];
    if (aiResult && aiResult.real_threats && aiResult.real_threats.length > 0) {
      // Try to match AI flagged elements back to DOM elements
      aiResult.real_threats.forEach(aiFlag => {
        let el = null;
        if (aiFlag.type === "link") el = links.find(a => a.href === aiFlag.evidence || (a.innerText||'').includes(aiFlag.evidence));
        else if (aiFlag.type === "form") el = forms.find(f => f.action === aiFlag.evidence || !!f.querySelector('input[type=password]'));
        else if (aiFlag.type === "iframe") el = iframes.find(i => i.src === aiFlag.evidence);
        
        if (el) finalFlags.push({ el, type: aiFlag.type, hint: aiFlag.evidence, severity: aiFlag.severity, threat: aiFlag.threat });
      });
      // Add local critical flags just in case AI missed them
      localFlags.forEach(lf => {
        if (!finalFlags.some(ff => ff.el === lf.el)) finalFlags.push(lf);
      });
    } else {
      finalFlags = localFlags;
      aiResult = {
        page_risk: localFlags.length > 0 ? 90 : 10,
        page_verdict: localFlags.length > 0 ? "DANGEROUS" : "SAFE",
        page_summary: finalFlags.length > 0 ? `Found ${finalFlags.length} critical elements based on local heuristics.` : "Page appears safe."
      };
    }

    // Wait for progress bar animation
    await new Promise(r => setTimeout(r, 600));
    overlay.remove();

    // 5. Highlight elements based on confidence rules
    const elementRefs = [];
    finalFlags.forEach(flag => {
      // Confidence threshold:
      // critical/high -> always highlight
      // medium -> highlight if AI confirmed (or if AI failed and we fallback to local)
      // low -> never highlight
      let shouldHighlight = false;
      if (flag.severity === "critical" || flag.severity === "high") shouldHighlight = true;
      else if (flag.severity === "medium") {
         // If AI ran and didn't include this flag, don't highlight. If AI failed, we highlight.
         const aiRanAndConfirmed = aiResult.real_threats && aiResult.real_threats.some(t => t.type === flag.type && t.threat === flag.threat);
         if (aiRanAndConfirmed || (!aiResult.real_threats)) shouldHighlight = true;
      }

      let ref = null;
      if (shouldHighlight) {
        ref = highlightElement(flag.el, flag.severity, flag.threat);
      }
      elementRefs.push({ ...flag, ref, shouldHighlight });
    });

    // 6. Show Summary Panel
    const panel = document.createElement("div");
    panel.id = "pls-summary-panel";
    
    const counts = { critical:0, high:0, medium:0, low:0 };
    elementRefs.forEach(f => counts[f.severity]++);

    const vClass = aiResult.page_verdict.toLowerCase();

    // Group findings
    const highlightedFindings = elementRefs.filter(f => f.shouldHighlight);
    const lowFindings = elementRefs.filter(f => !f.shouldHighlight);

    panel.innerHTML = `
      <div class="pls-panel-hdr">
        <span>🔍 PhishLens Scan Results</span>
        <button class="pls-close-btn" id="pls-clear-scan">✕</button>
      </div>
      <div class="pls-score-box">
        <div class="pls-ring ${vClass}">${aiResult.page_risk}</div>
        <div>
          <div class="pls-verdict ${vClass}">${aiResult.page_verdict}</div>
          <div class="pls-summary-txt">${esc(aiResult.page_summary)}</div>
        </div>
      </div>
      <div class="pls-chips">
        ${counts.critical ? `<div class="pls-chip pls-chip-critical">${counts.critical} Critical</div>` : ''}
        ${counts.high ? `<div class="pls-chip pls-chip-high">${counts.high} High</div>` : ''}
        ${counts.medium ? `<div class="pls-chip pls-chip-medium">${counts.medium} Suspicious</div>` : ''}
        ${counts.low ? `<div class="pls-chip pls-chip-low">${counts.low} Informational</div>` : ''}
      </div>
      <div class="pls-findings">
        ${highlightedFindings.map(f => `
          <div class="pls-finding" data-ref="${f.ref || ''}">
            <span class="pls-finding-badge ${f.severity}">${f.severity.toUpperCase()}</span>
            <div class="pls-finding-info">
              <div class="pls-finding-type">${f.type.toUpperCase()} — ${esc(f.threat)}</div>
              <div class="pls-finding-hint">${esc(f.hint)}</div>
            </div>
            <button class="pls-scroll-to">↗</button>
          </div>
        `).join("")}
        ${finalFlags.length === 0 ? `<div style="padding:16px;color:#94a3b8;font-size:12px;text-align:center">No suspicious elements found on this page.</div>` : ''}
      </div>
      <div class="pls-panel-footer">
        <button class="pls-footer-btn pls-btn-full" id="pls-open-full">Open Full Analysis</button>
      </div>
    `;

    document.body.appendChild(panel);

    panel.querySelector("#pls-clear-scan").onclick = clearScan;
    panel.querySelector("#pls-open-full").onclick = () => {
      window.open("https://phishlens.vercel.app/?url=" + encodeURIComponent(location.href), "_blank");
    };

    panel.querySelectorAll(".pls-finding").forEach(row => {
      row.onclick = () => {
        const ref = row.dataset.ref;
        const hl = document.querySelector(`.pls-highlight[data-ref="${ref}"]`);
        if (hl) {
          hl.scrollIntoView({ behavior: "smooth", block: "center" });
          hl.style.animation = "none";
          setTimeout(() => hl.style.animation = "", 50); // reset animation
        }
      };
    });
  }

  // ── Message listener ───────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "SHOW_ALERT") {
      showAlert(msg);
    }
    if (msg.type === "PHISHLENS_RESCAN") {
      removeAlert();
      runScan();
      sendResponse({ ok: true });
    }
    if (msg.type === "FULL_PAGE_SCAN") {
      runFullPageScan();
      sendResponse({ ok: true });
    }
    if (msg.type === "CLEAR_SCAN") {
      clearScan();
      sendResponse({ ok: true });
    }
    return true;
  });

  // ── Gmail support ──────────────────────────────────────────────────────────

  if (hostname === "mail.google.com") {
    let lastMsgId = null;

    function scanEmail() {
      const msgEl  = document.querySelector("div[data-message-id]");
      const mid    = msgEl?.getAttribute("data-message-id");
      if (!mid || mid === lastMsgId) return;
      lastMsgId = mid;

      setTimeout(() => {
        const from    = document.querySelector(".gD")?.getAttribute("email") || "unknown";
        const subject = document.querySelector(".hP")?.innerText?.trim() || "";
        const body    = document.querySelector(".a3s.aiL")?.innerText?.trim().slice(0, 2000) || "";
        const links   = Array.from(document.querySelectorAll(".a3s a[href]")).map(a => a.href).slice(0, 40);

        chrome.runtime.sendMessage({
          type: "ANALYZE_PAGE",
          url: location.href,
          domain: hostname,
          title: `Email: ${subject}`,
          bodyText: `From: ${from}\nSubject: ${subject}\n${body}`,
          links,
          isEmail: true,
          emailData: { from, subject, body },
        }).catch(() => {});

        annotateSuspiciousLinks();
      }, 1500);
    }

    new MutationObserver(scanEmail)
      .observe(document.querySelector(".nH") || document.body, { childList: true, subtree: true });
  }

  console.log("[PhishLens] Content ready:", hostname);
})();
