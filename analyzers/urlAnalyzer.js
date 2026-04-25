const { URL } = require('url');
const fetch = require('node-fetch');
const { detectHomograph } = require('../utils/homographDetector');

const SHORTENER_HOSTS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'rb.gy', 'ow.ly']);

async function unshortenUrl(url) {
  try {
    const parsed = new URL(url);
    const isShortener = SHORTENER_HOSTS.has(parsed.hostname.toLowerCase());

    if (!isShortener) {
      return { original: url, expanded: url, redirected: false };
    }

    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return {
      original: url,
      expanded: response.url || url,
      redirected: (response.url || url) !== url
    };
  } catch (error) {
    return { original: url, expanded: url, redirected: false, error: error.message };
  }
}

async function analyze(urls) {
  const results = [];

  for (const input of urls || []) {
    const unshortened = await unshortenUrl(input);
    let domain = null;

    try {
      domain = new URL(unshortened.expanded).hostname;
    } catch (_) {
      domain = null;
    }

    results.push({
      original: input,
      expanded: unshortened.expanded,
      redirected: unshortened.redirected,
      domain,
      homograph: detectHomograph(domain || '')
    });
  }

  return { urls: results };
}

module.exports = { analyze, unshortenUrl };
