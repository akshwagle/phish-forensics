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

  // ── Deep Scan ─────────────────────────────────────────────────────────────

  async function fetchRawSource(url) {
    try {
      const res = await fetch(url, { method: 'GET', credentials: 'omit', cache: 'no-store' });
      return await res.text();
    } catch {
      return document.documentElement.outerHTML;
    }
  }

  function deepExtract(rawHTML, pageURL) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHTML, 'text/html');

    const allURLs = {
      links: [...doc.querySelectorAll('a[href]')]
        .map(a => a.getAttribute('href'))
        .filter(h => h && h.startsWith('http')),

      scripts: [...doc.querySelectorAll('script')].map(s => ({
        src: s.getAttribute('src') || null,
        inline: !s.getAttribute('src') ? s.textContent.slice(0, 500) : null,
        hasObfuscation: /eval\(|atob\(|String\.fromCharCode|unescape\(|\\\x/.test(s.textContent)
      })),

      forms: [...doc.querySelectorAll('form')].map(f => ({
        action: f.getAttribute('action'),
        method: f.getAttribute('method'),
        inputs: [...f.querySelectorAll('input')].map(i => ({
          type: i.type, name: i.name, placeholder: i.placeholder
        }))
      })),

      iframes: [...doc.querySelectorAll('iframe')].map(i => ({
        src: i.getAttribute('src'),
        width: i.getAttribute('width'),
        height: i.getAttribute('height'),
        hidden: i.getAttribute('width') === '0' || i.getAttribute('height') === '0' || i.style.display === 'none'
      })),

      images: [...doc.querySelectorAll('img')].map(i => ({
        src: i.getAttribute('src'), alt: i.getAttribute('alt')
      })).filter(i => i.src && !i.src.startsWith('data:')).slice(0, 20),

      metaRefresh: doc.querySelector('meta[http-equiv="refresh"]')?.content || null
    };

    const inlineScripts = [...doc.querySelectorAll('script:not([src])')].map(s => s.textContent);
    const scriptFlags = {
      hasEval:          inlineScripts.some(s => /\beval\s*\(/.test(s)),
      hasAtob:          inlineScripts.some(s => /\batob\s*\(/.test(s)),
      hasObfuscation:   inlineScripts.some(s => /String\.fromCharCode|\\x[0-9a-f]{2}|\\u[0-9a-f]{4}/i.test(s)),
      hasDocumentWrite: inlineScripts.some(s => /document\.write\s*\(/.test(s)),
      hasWindowLocation:inlineScripts.some(s => /window\.location\s*=|location\.href\s*=|location\.replace\s*\(/.test(s)),
      hasFetchPost:     inlineScripts.some(s => /fetch\s*\(|XMLHttpRequest|\.post\s*\(/.test(s)),
      hasLocalStorage:  inlineScripts.some(s => /localStorage|sessionStorage/.test(s)),
      hasCookieSteal:   inlineScripts.some(s => /document\.cookie/.test(s) && /fetch|XMLHttpRequest/.test(s)),
      totalInlineScripts: inlineScripts.length,
      suspiciousSample: inlineScripts.find(s => /eval|atob|fromCharCode/.test(s))?.slice(0, 300) || null
    };

    const metadata = {
      title:           doc.title,
      lang:            doc.documentElement.lang,
      charset:         doc.charset,
      metaDescription: doc.querySelector('meta[name="description"]')?.content,
      ogSiteName:      doc.querySelector('meta[property="og:site_name"]')?.content,
      ogTitle:         doc.querySelector('meta[property="og:title"]')?.content,
      canonical:       doc.querySelector('link[rel="canonical"]')?.href,
      generator:       doc.querySelector('meta[name="generator"]')?.content,
      isWordPress:     /wp-content|wp-includes/.test(rawHTML),
      isDrupal:        /drupal/.test(rawHTML.toLowerCase()),
      isShopify:       /shopify/.test(rawHTML.toLowerCase()),
      hasGoogleAnalytics:  /google-analytics|gtag|GA4/.test(rawHTML),
      hasGoogleTagManager: /googletagmanager/.test(rawHTML)
    };

    let parsed;
    try { parsed = new URL(pageURL); } catch { parsed = null; }
    const host = parsed ? parsed.hostname.replace('www.', '') : pageURL;
    const parts = host.split('.');
    const domainCore = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    const tld = parts[parts.length - 1] || '';
    const vowels = (domainCore.match(/[aeiou]/gi) || []).length;
    const vowelRatio = vowels / (domainCore.length || 1);

    const domainSignals = {
      hostname: host, domainCore, tld,
      domainLength: domainCore.length,
      vowelRatio: vowelRatio.toFixed(2),
      looksRandom: vowelRatio < 0.2 && domainCore.length <= 8,
      hasNumbers: /\d/.test(domainCore),
      hasDashes: /-/.test(domainCore),
      suspiciousTLD: ['xyz','top','click','online','site','fun','pw','cc','info',
        'tk','ml','ga','cf','gq','buzz','icu','vip','download','zip','mov'].includes(tld),
      isHTTPS: pageURL.startsWith('https'),
      subdomainCount: Math.max(0, parts.length - 2)
    };

    const visibleText = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
    return { pageURL, domainSignals, metadata, allURLs, scriptFlags, visibleText,
      rawHTMLSize: rawHTML.length, isTinyPage: rawHTML.length < 2000 };
  }

  async function getSecurityHeaders(url) {
    try {
      const res = await fetch(url, { method: 'HEAD', credentials: 'omit' });
      return {
        hasHSTS:        res.headers.has('strict-transport-security'),
        hasCSP:         res.headers.has('content-security-policy'),
        hasXFrame:      res.headers.has('x-frame-options'),
        hasXContentType:res.headers.has('x-content-type-options'),
        server:         res.headers.get('server') || 'unknown',
        finalURL:       res.url,
        wasRedirected:  res.url !== url,
        redirectedTo:   res.url !== url ? res.url : null,
        statusCode:     res.status
      };
    } catch { return { error: 'Could not fetch headers' }; }
  }

  async function checkDNS(domain) {
    try {
      const [mx, txt, a] = await Promise.all([
        fetch(`https://dns.google/resolve?name=${domain}&type=MX`).then(r => r.json()),
        fetch(`https://dns.google/resolve?name=${domain}&type=TXT`).then(r => r.json()),
        fetch(`https://dns.google/resolve?name=${domain}&type=A`).then(r => r.json())
      ]);
      const hasMX = (mx.Answer?.length || 0) > 0;
      const txtRecords = (txt.Answer || []).map(r => r.data).join(' ');
      const hasSPF   = /v=spf1/.test(txtRecords);
      const hasDMARC = txtRecords.includes('v=DMARC1');
      const aRecord  = a.Answer?.[0]?.data || null;
      return {
        hasMXRecords: hasMX, hasSPFRecord: hasSPF, hasDMARCRecord: hasDMARC,
        serverIP: aRecord,
        legitimacySignal: hasMX && hasSPF ? 'has_email_infrastructure' : 'no_email_infrastructure'
      };
    } catch { return { error: 'DNS lookup failed' }; }
  }

  async function checkCertAge(domain) {
    try {
      const res = await fetch(`https://crt.sh/?q=${domain}&output=json`,
        { signal: AbortSignal.timeout(8000) });
      const certs = await res.json();
      if (!certs.length) return { noCerts: true };
      const sorted = certs.sort((a, b) => new Date(a.not_before) - new Date(b.not_before));
      const firstCert = sorted[0];
      const daysSinceFirstCert = Math.floor((Date.now() - new Date(firstCert.not_before)) / 86400000);
      return {
        firstSeenDate: firstCert.not_before, daysSinceFirstCert,
        isVeryNew: daysSinceFirstCert < 7, isNew: daysSinceFirstCert < 30,
        issuer: firstCert.issuer_name,
        isFreeCert: /Let's Encrypt|ZeroSSL/.test(firstCert.issuer_name),
        totalCertsEver: certs.length
      };
    } catch { return { error: 'Could not check certificate' }; }
  }

  const HACKCLUB_AI = 'https://ai.hackclub.com/chat/completions';

  async function multiModelAnalysis(pageData) {
    const systemPrompt = [
      'You are a cybersecurity expert analyzing a web page for phishing and fraud.',
      'You receive comprehensive technical data extracted from the page source.',
      'Return ONLY raw JSON:',
      '{',
      '  "risk_score": 0-100,',
      '  "verdict": "SAFE|SUSPICIOUS|DANGEROUS",',
      '  "confidence": "low|medium|high",',
      '  "summary": "2 sentences",',
      '  "key_evidence": ["top 3 reasons for your verdict"],',
      '  "is_phishing": true|false',
      '}',
      'CRITICAL RULE: A login page on a domain with low vowel ratio, no MX records,',
      'cert < 30 days old, and missing security headers = Score 85+ regardless of content.'
    ].join('\n');

    const userMessage = JSON.stringify(pageData, null, 2).slice(0, 6000);

    const models = [
      'meta-llama/llama-3.1-8b-instruct',
      'qwen/qwen3-32b',
      'mistralai/mistral-7b-instruct'
    ];

    return Promise.all(models.map(model =>
      fetch(HACKCLUB_AI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userMessage }
          ],
          max_tokens: 300
        })
      })
      .then(r => r.json())
      .then(r => {
        const raw = (r.choices?.[0]?.message?.content || '{}')
          .replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        return { model, result: JSON.parse(raw) };
      })
      .catch(e => ({ model, result: null, error: e.message }))
    ));
  }

  function buildConsensus(modelResults) {
    const valid = modelResults.filter(r => r.result !== null);
    if (!valid.length) return null;

    const scores = valid.map(r => r.result.risk_score);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const verdicts = valid.map(r => r.result.verdict);
    const dangerCount    = verdicts.filter(v => v === 'DANGEROUS').length;
    const suspiciousCount = verdicts.filter(v => v === 'SUSPICIOUS').length;

    let finalVerdict, finalScore;
    if (dangerCount >= 2) {
      finalVerdict = 'DANGEROUS'; finalScore = Math.max(avgScore, 75);
    } else if (dangerCount >= 1) {
      finalVerdict = 'SUSPICIOUS'; finalScore = Math.max(avgScore, 50);
    } else if (suspiciousCount >= 2) {
      finalVerdict = 'SUSPICIOUS'; finalScore = Math.max(avgScore, 45);
    } else {
      finalVerdict = 'SAFE'; finalScore = avgScore;
    }

    const allAgree  = new Set(verdicts).size === 1;
    const confidence = allAgree ? 'high' : valid.length === 3 ? 'medium' : 'low';
    const allEvidence = valid.flatMap(r => r.result.key_evidence || []).filter(Boolean);

    return {
      finalScore, finalVerdict, confidence, modelsUsed: valid.length,
      modelScores: valid.map(r => ({
        model:   r.model.split('/')[1] || r.model,
        score:   r.result.risk_score,
        verdict: r.result.verdict
      })),
      allEvidence: [...new Set(allEvidence)].slice(0, 5),
      summary: valid[0]?.result?.summary || ''
    };
  }

  // ── Deep Scan Progress UI ──────────────────────────────────────────────────

  function updateDeepProgress(steps) {
    let el = document.getElementById('pls-deep-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pls-deep-overlay';
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <div class="pls-deep-progress-box">
        <div class="pls-deep-logo">🧬</div>
        <div class="pls-deep-title">Deep Scan in Progress</div>
        <div class="pls-deep-subtitle">Multi-model AI consensus · 3–5 min</div>
        <div class="pls-deep-steps">
          ${steps.map(s => `
            <div class="pls-deep-step ${s.status}">
              <span class="pls-deep-step-icon">
                ${s.status === 'done' ? '✓' : s.status === 'active' ? '<span class="pls-spin"></span>' : '○'}
              </span>
              <span class="pls-deep-step-label">${esc(s.label)}</span>
              ${s.detail ? `<span class="pls-deep-step-detail">${esc(s.detail)}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  function removeDeepOverlay() {
    document.getElementById('pls-deep-overlay')?.remove();
  }

  // ── Deep Scan Results UI ───────────────────────────────────────────────────

  function showDeepScanResults(consensus, details) {
    document.getElementById('pls-deep-panel')?.remove();
    const { certAge, dns, secHeaders } = details;
    const c = consensus;
    const vClass = c.finalVerdict.toLowerCase();
    const vIcon  = { SAFE: '✅', SUSPICIOUS: '⚠️', DANGEROUS: '🛑' }[c.finalVerdict] || '?';
    const confColor = { high: '#22c55e', medium: '#f59e0b', low: '#ef4444' }[c.confidence] || '#64748b';

    const dnsHTML = dns && !dns.error ? [
      ['MX records',   dns.hasMXRecords,  dns.hasMXRecords  ? 'Present' : 'Missing'],
      ['SPF record',   dns.hasSPFRecord,  dns.hasSPFRecord  ? 'Present' : 'Missing'],
      ['DMARC record', dns.hasDMARCRecord,dns.hasDMARCRecord ? 'Present' : 'Missing']
    ].map(([label, ok, val]) => `
      <div class="pls-deep-signal-row ${ok ? 'pass' : 'fail'}">
        <span class="pls-dsr-icon">${ok ? '✓' : '✗'}</span>
        <span>${label}</span>
        <span class="pls-dsr-val">${val}</span>
      </div>`).join('') : '';

    const certHTML = certAge && !certAge.error && !certAge.noCerts ? `
      <div class="pls-deep-signal-row ${certAge.isNew ? 'fail' : 'pass'}">
        <span class="pls-dsr-icon">${certAge.isNew ? '⚠' : '✓'}</span>
        <span>Cert age</span>
        <span class="pls-dsr-val">${certAge.daysSinceFirstCert}d${certAge.isNew ? ' — new!' : ''}</span>
      </div>
      <div class="pls-deep-signal-row ${certAge.isFreeCert ? 'warn' : 'pass'}">
        <span class="pls-dsr-icon">${certAge.isFreeCert ? '~' : '✓'}</span>
        <span>Issuer</span>
        <span class="pls-dsr-val">${certAge.isFreeCert ? "Let's Encrypt/ZeroSSL" : 'Paid CA'}</span>
      </div>` : '';

    const hdrHTML = secHeaders && !secHeaders.error ? [
      ['HSTS',          secHeaders.hasHSTS],
      ['CSP',           secHeaders.hasCSP],
      ['X-Frame-Options',secHeaders.hasXFrame],
      ['X-Content-Type', secHeaders.hasXContentType]
    ].map(([name, has]) => `
      <div class="pls-deep-signal-row ${has ? 'pass' : 'fail'}">
        <span class="pls-dsr-icon">${has ? '✓' : '✗'}</span>
        <span>${name}</span>
        <span class="pls-dsr-val">${has ? 'Present' : 'Missing'}</span>
      </div>`).join('') + (secHeaders.wasRedirected ? `
      <div class="pls-deep-signal-row fail">
        <span class="pls-dsr-icon">↪</span>
        <span>Redirect detected</span>
        <span class="pls-dsr-val" title="${esc(secHeaders.redirectedTo||'')}">
          ${esc((secHeaders.redirectedTo||'').slice(0,28))}…
        </span>
      </div>` : '') : '';

    const modelCardsHTML = (c.modelScores || []).map(m => {
      const mc = m.verdict.toLowerCase();
      return `
        <div class="pls-model-card">
          <div class="pls-mc-name">${esc(m.model)}</div>
          <div class="pls-mc-score ${mc}">${m.score}</div>
          <div class="pls-mc-verdict ${mc}">${m.verdict}</div>
        </div>`;
    }).join('');

    const evidenceHTML = (c.allEvidence || []).length
      ? (c.allEvidence).map(e => `<div class="pls-deep-evidence-item">• ${esc(e)}</div>`).join('')
      : '<div class="pls-deep-evidence-item muted">No specific evidence flagged.</div>';

    const panel = document.createElement('div');
    panel.id = 'pls-deep-panel';
    panel.innerHTML = `
      <div class="pls-panel-hdr">
        <span>🧬 Deep Scan Results</span>
        <button class="pls-close-btn" id="pls-deep-close">✕</button>
      </div>

      <div class="pls-deep-consensus">
        <div class="pls-deep-ring ${vClass}">${c.finalScore}</div>
        <div class="pls-deep-verdict-block">
          <div class="pls-deep-verdict-label ${vClass}">${vIcon} ${c.finalVerdict}</div>
          <div class="pls-deep-conf" style="color:${confColor}">
            ${c.confidence.toUpperCase()} CONFIDENCE · ${c.modelsUsed}/3 models
          </div>
          <div class="pls-deep-summary">${esc(c.summary)}</div>
        </div>
      </div>

      <div class="pls-deep-section-label">Model Breakdown</div>
      <div class="pls-model-row">${modelCardsHTML}</div>

      <div class="pls-deep-section-label">Evidence</div>
      <div class="pls-deep-evidence">${evidenceHTML}</div>

      ${dnsHTML || certHTML ? `
        <div class="pls-deep-section-label">DNS &amp; Certificate</div>
        <div class="pls-deep-signals">${dnsHTML}${certHTML}</div>` : ''}

      ${hdrHTML ? `
        <div class="pls-deep-section-label">Security Headers</div>
        <div class="pls-deep-signals">${hdrHTML}</div>` : ''}

      <div class="pls-panel-footer">
        <button class="pls-footer-btn pls-btn-export" id="pls-deep-copy">Copy JSON</button>
        <button class="pls-footer-btn pls-btn-full"   id="pls-deep-full">Open Full Report</button>
      </div>`;

    document.body.appendChild(panel);
    panel.querySelector('#pls-deep-close').onclick = () => panel.remove();
    panel.querySelector('#pls-deep-full').onclick = () =>
      window.open('https://phishlens.vercel.app/?url=' + encodeURIComponent(location.href), '_blank');
    panel.querySelector('#pls-deep-copy').onclick = () =>
      navigator.clipboard.writeText(
        JSON.stringify({ consensus: c, details }, null, 2)
      ).catch(() => {});
  }

  // ── Deep Scan Orchestrator ─────────────────────────────────────────────────

  async function runDeepScan() {
    document.getElementById('pls-deep-panel')?.remove();
    const pageURL = location.href;
    let domain;
    try { domain = new URL(pageURL).hostname; } catch { return; }

    const startTime = Date.now();

    // Storage step keys match popup's STEP_MAP
    const STORAGE_KEYS = ['source', 'dns', 'cert', 'headers', 'ai', 'consensus'];

    // In-overlay steps (7 entries — we merge fetch+extract into "source")
    const STEPS = [
      { label: 'Fetching raw page source',          status: 'pending', detail: '' },
      { label: 'Extracting signals from HTML',       status: 'pending', detail: '' },
      { label: 'Checking DNS records',               status: 'pending', detail: '' },
      { label: 'Checking certificate age (crt.sh)',  status: 'pending', detail: '' },
      { label: 'Checking security headers',          status: 'pending', detail: '' },
      { label: 'Running 3 AI models in parallel',    status: 'pending', detail: '' },
      { label: 'Building consensus verdict',         status: 'pending', detail: '' }
    ];

    // Map overlay step index → storage key index (steps 0+1 both map to "source")
    const OVERLAY_TO_STORAGE = [0, 0, 1, 2, 3, 4, 5];

    async function syncStorage(storageKeyIdx, status, detail = '') {
      const current = {};
      STORAGE_KEYS.forEach((key, i) => {
        if (i < storageKeyIdx) current[key] = { status: 'done',   detail: '' };
        else if (i === storageKeyIdx) current[key] = { status, detail };
        else current[key] = { status: 'pending', detail: '' };
      });
      try {
        await chrome.storage.local.set({ deepScanSteps: current, deepScanRunning: true });
      } catch {}
    }

    const setStep = async (i, status, detail = '') => {
      STEPS[i].status = status; STEPS[i].detail = detail;
      updateDeepProgress(STEPS);
      await syncStorage(OVERLAY_TO_STORAGE[i], status, detail);
    };

    // Initialise storage
    try { await chrome.storage.local.set({ deepScanRunning: true, deepScanResult: null }); } catch {}
    updateDeepProgress(STEPS);

    // Step 0 — fetch raw source
    await setStep(0, 'active');
    const rawHTML = await fetchRawSource(pageURL);
    await setStep(0, 'done', `${(rawHTML.length / 1024).toFixed(1)} KB`);

    // Step 1 — extract (maps to same "source" storage key, just overwrites detail)
    await setStep(1, 'active');
    const extracted = deepExtract(rawHTML, pageURL);
    await setStep(1, 'done',
      `${extracted.allURLs.links.length} links · ${extracted.allURLs.forms.length} forms · ` +
      `${extracted.scriptFlags.totalInlineScripts} scripts`);

    // Steps 2-4 — DNS, cert, headers in parallel
    await setStep(2, 'active'); await setStep(3, 'active'); await setStep(4, 'active');
    const [dns, certAge, secHeaders] = await Promise.all([
      checkDNS(domain),
      checkCertAge(domain),
      getSecurityHeaders(pageURL)
    ]);
    await setStep(2, 'done', dns.error     ? 'Failed' : `MX:${dns.hasMXRecords ? '✓' : '✗'} SPF:${dns.hasSPFRecord ? '✓' : '✗'}`);
    await setStep(3, 'done', certAge.error ? 'Failed' : certAge.noCerts ? 'No certs found' : `${certAge.daysSinceFirstCert} days old`);
    await setStep(4, 'done', secHeaders.error ? 'Failed' : `HSTS:${secHeaders.hasHSTS ? '✓' : '✗'} CSP:${secHeaders.hasCSP ? '✓' : '✗'}`);

    // Step 5 — 3 AI models
    await setStep(5, 'active', 'llama-3.1 · qwen3-32b · mistral-7b');
    const pageData = {
      pageURL, domain,
      domainSignals: extracted.domainSignals,
      metadata:      extracted.metadata,
      scriptFlags:   extracted.scriptFlags,
      formCount:     extracted.allURLs.forms.length,
      linkCount:     extracted.allURLs.links.length,
      iframeCount:   extracted.allURLs.iframes.length,
      hiddenIframes: extracted.allURLs.iframes.filter(i => i.hidden).length,
      isTinyPage:    extracted.isTinyPage,
      visibleText:   extracted.visibleText.slice(0, 1500),
      dns, certAge, secHeaders
    };
    const modelResults = await multiModelAnalysis(pageData);
    const successCount = modelResults.filter(r => r.result !== null).length;
    await setStep(5, 'done', `${successCount}/3 models responded`);

    // Step 6 — consensus
    await setStep(6, 'active');
    const consensus = buildConsensus(modelResults);

    if (!consensus) {
      await setStep(6, 'done', 'All models failed — no consensus');
      try { await chrome.storage.local.set({ deepScanRunning: false }); } catch {}
      await new Promise(r => setTimeout(r, 1500));
      removeDeepOverlay();
      return;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    await setStep(6, 'done', `Score: ${consensus.finalScore} · ${consensus.finalVerdict} · ${elapsed}s`);

    const details = { dns, certAge, secHeaders, extracted };

    // Write final result to storage → popup reads this and renders result card
    try {
      await chrome.storage.local.set({
        deepScanRunning: false,
        deepScanResult:  { consensus, details, elapsed }
      });
    } catch {}

    await new Promise(r => setTimeout(r, 800));
    removeDeepOverlay();
    // Also show the in-page panel for users who have the page focused
    showDeepScanResults(consensus, details);
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
    if (msg.type === "DEEP_SCAN") {
      runDeepScan();
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
