require('dotenv').config();
const express = require('express');
const cors = require('cors');

const headerAnalyzer = require('./analyzers/headerAnalyzer');
const urlAnalyzer = require('./analyzers/urlAnalyzer');
const senderAnalyzer = require('./analyzers/senderAnalyzer');
const contentAnalyzer = require('./analyzers/contentAnalyzer');
const attachmentAnalyzer = require('./analyzers/attachmentAnalyzer');
const aiAnalyzer = require('./analyzers/aiAnalyzer');
const domainReputation = require('./utils/domainReputation');
const riskScorer = require('./utils/riskScorer');
const { detectHomograph } = require('./utils/homographDetector');

const API_PORT = Number(process.env.PORT || 3001);
const WEB_PORT = 3000;

const apiApp = express();
const webApp = express();

apiApp.use(cors());
apiApp.use(express.json({ limit: '2mb' }));

apiApp.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${elapsed}ms`);
  });
  next();
});

webApp.use(express.static('public'));
webApp.use('/public', express.static('public'));
webApp.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

apiApp.use('/public', express.static('public'));

apiApp.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    name: 'PhishLens',
    apiPort: API_PORT,
    webPort: WEB_PORT,
    timestamp: new Date().toISOString()
  });
});

apiApp.post('/api/unshorten', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }
    const result = await urlAnalyzer.unshortenURL(url);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

apiApp.post('/api/analyze', async (req, res) => {
  const sendEvent = (event, payload) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const payload = req.body || {};
    const rawEmail = String(payload.rawEmail || '');
    const sections = rawEmail.split(/\r?\n\r?\n/);
    const rawHeaders = sections[0] || '';
    const emailBody = sections.slice(1).join('\n\n');

    const combined = {
      headerResult: null,
      senderResult: null,
      urlResult: { urls: [] },
      contentResult: null,
      attachmentResult: null,
      homographResult: { domains: [] },
      reputationResult: { domains: [] }
    };

    sendEvent('progress', { step: 'headerAnalyzer', message: '✓ Headers parsed' });
    combined.headerResult = headerAnalyzer.analyzeHeaders(rawHeaders || rawEmail);
    sendEvent('partial', { section: 'headerResult', data: combined.headerResult });

    sendEvent('progress', { step: 'senderAnalyzer', message: '✓ Sender verified' });
    combined.senderResult = senderAnalyzer.analyzeSender(rawHeaders || rawEmail);
    sendEvent('partial', { section: 'senderResult', data: combined.senderResult });

    const discoveredUrls = Array.isArray(payload.urls) && payload.urls.length ? payload.urls : urlAnalyzer.extractURLs(rawEmail);
    const analyzedUrls = await Promise.all(discoveredUrls.map((url) => urlAnalyzer.analyzeURL(url, rawEmail)));
    combined.urlResult = { urls: analyzedUrls };
    sendEvent('progress', {
      step: 'urlAnalyzer',
      message: `✓ ${combined.urlResult.urls.length} URLs unshortened`
    });
    sendEvent('partial', { section: 'urlResult', data: combined.urlResult });

    sendEvent('progress', { step: 'contentAnalyzer', message: '✓ Content scanned' });
    combined.contentResult = contentAnalyzer.analyzeContent(emailBody);
    sendEvent('partial', { section: 'contentResult', data: combined.contentResult });

    sendEvent('progress', { step: 'attachmentAnalyzer', message: '✓ Attachments checked' });
    combined.attachmentResult = attachmentAnalyzer.analyzeAttachments(rawEmail);
    sendEvent('partial', { section: 'attachmentResult', data: combined.attachmentResult });

    const domains = combined.urlResult.urls
      .map((item) => {
        try {
          return new URL(item.finalDestination || item.original).hostname;
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);

    combined.homographResult = {
      domains: domains.map((domain) => ({
        domain,
        result: detectHomograph(domain)
      }))
    };
    sendEvent('progress', { step: 'homographDetector', message: '✓ Lookalike check' });
    sendEvent('partial', { section: 'homographResult', data: combined.homographResult });

    combined.reputationResult = domainReputation.checkDomains(domains);

    sendEvent('progress', { step: 'aiAnalyzer', message: '✓ AI deep analysis' });
    const ai = await aiAnalyzer.aiDeepAnalysis(rawEmail || emailBody, combined);
    sendEvent('partial', { section: 'ai', data: ai });

    const ruleRisk = riskScorer.scoreEmail(combined);
    const aiScore = Number.isFinite(ai?.risk_score) ? ai.risk_score : 0;
    const aiFlagLabels = Array.isArray(ai?.red_flags)
      ? ai.red_flags.map((f) => f.label).filter(Boolean)
      : [];

    const finalScore = Math.max(0, Math.min(100, Math.max(ruleRisk.score || 0, aiScore)));
    const severityFromScore = (s) => {
      if (s <= 20) return 'safe';
      if (s <= 40) return 'low';
      if (s <= 60) return 'moderate';
      if (s <= 80) return 'high';
      return 'critical';
    };

    const mergedReasons = [];
    const seen = new Set();
    [...aiFlagLabels, ...(ruleRisk.topReasons || [])].forEach((reason) => {
      const key = String(reason || '').trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      mergedReasons.push(reason);
    });

    const risk = {
      ...ruleRisk,
      score: finalScore,
      severity: severityFromScore(finalScore),
      ruleScore: ruleRisk.score || 0,
      aiScore,
      topReasons: mergedReasons.slice(0, 8)
    };

    sendEvent('progress', { step: 'riskScorer', message: '✓ Risk score computed' });

    sendEvent('complete', {
      app: 'PhishLens',
      risk,
      signals: combined,
      ai
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    sendEvent('error', { error: error.message });
    res.end();
  }
});

apiApp.post('/api/explain', async (req, res) => {
  try {
    const { context } = req.body || {};

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const chunks = await aiAnalyzer.deepExplainStream(context || {});
    for (const chunk of chunks) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

apiApp.listen(API_PORT, () => {
  console.log(`PhishLens API running on http://localhost:${API_PORT}`);
});

webApp.listen(WEB_PORT, () => {
  console.log(`PhishLens UI running on http://localhost:${WEB_PORT}`);
});
