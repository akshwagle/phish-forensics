const { URL } = require('url');
const fetch = require('node-fetch');
const { detectHomograph } = require('../utils/homographDetector');

const SHORTENER_HOSTS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd']);
const SUSPICIOUS_TLDS = new Set(['zip', 'mov', 'top', 'xyz', 'click', 'work']);
const BRAND_WORDS = ['paypal', 'microsoft', 'apple', 'google', 'amazon', 'bank', 'netflix'];

function extractURLs(text) {
  const body = String(text || '');
  const matched = body.match(/\bhttps?:\/\/[^\s<>"']+/gi) || [];
  return Array.from(new Set(matched.map((value) => value.trim())));
}

function isIpHost(hostname) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

function getTld(hostname) {
  const parts = String(hostname || '').toLowerCase().split('.').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function isShortener(hostname) {
  const host = String(hostname || '').toLowerCase();
  return SHORTENER_HOSTS.has(host);
}

function hasBrandInPathOffDomain(pathname, hostname) {
  const lowerPath = String(pathname || '').toLowerCase();
  const lowerHost = String(hostname || '').toLowerCase();
  return BRAND_WORDS.some((brand) => lowerPath.includes(brand) && !lowerHost.includes(brand));
}

function detectDisplayTextHrefMismatch(emailTextOrHtml, href) {
  const source = String(emailTextOrHtml || '');
  if (!source || !source.includes('<a') || !href) {
    return false;
  }

  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<a[^>]+href=["']${escapedHref}["'][^>]*>(.*?)<\\/a>`, 'i');
  const match = source.match(pattern);
  if (!match) {
    return false;
  }

  const displayText = (match[1] || '').replace(/<[^>]+>/g, '').trim();
  return /^https?:\/\//i.test(displayText) && displayText !== href;
}

async function unshortenURL(inputUrl) {
  const hops = [];
  let currentUrl = inputUrl;
  let finalDestination = inputUrl;

  try {
    for (let i = 0; i < 5; i += 1) {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        timeout: 5000
      });

      const location = response.headers.get('location');
      hops.push({ status: response.status, from: currentUrl, to: location || currentUrl });

      if (!location || response.status < 300 || response.status >= 400) {
        finalDestination = currentUrl;
        break;
      }

      const nextUrl = new URL(location, currentUrl).toString();
      finalDestination = nextUrl;
      currentUrl = nextUrl;
    }
  } catch (error) {
    hops.push({ error: error.message, from: currentUrl });
  }

  return { original: inputUrl, finalDestination, hops };
}

async function analyzeURL(inputUrl, emailTextOrHtml) {
  const flags = [];
  let parsed;
  let unshortened = { original: inputUrl, finalDestination: inputUrl, hops: [] };

  try {
    parsed = new URL(inputUrl);
  } catch (_) {
    return {
      original: inputUrl,
      finalDestination: inputUrl,
      hops: [],
      flags: ['Invalid URL format'],
      riskScore: 70
    };
  }

  unshortened = await unshortenURL(inputUrl);
  const finalParsed = (() => {
    try {
      return new URL(unshortened.finalDestination);
    } catch (_) {
      return parsed;
    }
  })();

  const hostname = finalParsed.hostname.toLowerCase();
  const tld = getTld(hostname);
  const subdomainParts = hostname.split('.').filter(Boolean);
  const homograph = detectHomograph(hostname);

  if (isIpHost(hostname)) {
    flags.push('Uses IP address instead of domain');
  }
  if (SUSPICIOUS_TLDS.has(tld)) {
    flags.push(`Suspicious TLD .${tld}`);
  }
  if (isShortener(parsed.hostname.toLowerCase())) {
    flags.push('URL shortener detected');
  }
  if (subdomainParts.length > 4) {
    flags.push('Excessive subdomains');
  }
  if (finalParsed.username || inputUrl.includes('@')) {
    flags.push('@ symbol or embedded credentials in URL');
  }
  if (homograph.suspicious) {
    flags.push(`Punycode/IDN homograph signal (${homograph.reason})`);
  }
  if (hasBrandInPathOffDomain(finalParsed.pathname, hostname)) {
    flags.push('Brand name in path on unrelated domain');
  }
  if (detectDisplayTextHrefMismatch(emailTextOrHtml, inputUrl)) {
    flags.push('Display text and href mismatch in HTML anchor');
  }

  const riskScore = Math.min(100, flags.length * 15);

  return {
    original: inputUrl,
    finalDestination: unshortened.finalDestination,
    hops: unshortened.hops,
    flags,
    riskScore
  };
}

async function analyze(urls, emailTextOrHtml) {
  const list = Array.isArray(urls) ? urls : extractURLs(urls);
  const results = [];
  for (const url of list) {
    results.push(await analyzeURL(url, emailTextOrHtml));
  }
  return { urls: results };
}

async function unshortenUrl(url) {
  return unshortenURL(url);
}

module.exports = { extractURLs, unshortenURL, analyzeURL, analyze, unshortenUrl };
