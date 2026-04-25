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
    const result = await urlAnalyzer.unshortenUrl(url);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

apiApp.post('/api/analyze', async (req, res) => {
  try {
    const payload = req.body || {};

    const headerResult = headerAnalyzer.analyze(payload.headers || '');
    const urlResult = await urlAnalyzer.analyze(payload.urls || []);
    const senderResult = senderAnalyzer.analyze(payload.headers || '');
    const contentResult = contentAnalyzer.analyze(payload.content || '');
    const attachmentResult = attachmentAnalyzer.analyze(payload.attachments || []);

    const repDomains = urlResult.urls.map((item) => item.domain).filter(Boolean);
    const reputationResult = domainReputation.checkDomains(repDomains);

    const combined = {
      headerResult,
      urlResult,
      senderResult,
      contentResult,
      attachmentResult,
      reputationResult
    };

    const risk = riskScorer.score(combined);
    const ai = await aiAnalyzer.quickAnalyze(payload, combined);

    res.json({
      app: 'PhishLens',
      risk,
      signals: combined,
      ai
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
