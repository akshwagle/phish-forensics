# PhishLens

A full-stack phishing forensics sandbox that combines rule-based signal extraction with AI-powered deep analysis. Paste a suspicious email, URL, SMS, or job offer and get a structured verdict, risk score, red flags, and evidence timeline — all in a few seconds.

---

## Features

- **Four detection modes** — Email, URL, SMS/Smishing, and Job Offer / Recruitment Fraud
- **Rule-based analyzers** — header authentication (SPF/DKIM/DMARC), sender identity, URL chain tracing, content pattern matching, attachment detection, homograph/IDN detection, and domain reputation
- **AI deep analysis** — LLM generates a risk score (0–100), red flags, threat category breakdown, attack profile, social engineering tactics, and attribution clues
- **Streaming results** — Server-Sent Events push partial results to the UI in real time as each analyzer completes
- **Rich forensic dashboard** — risk gauge, bar + donut threat charts, evidence timeline, sender identity panel, link card detail, content keyword highlighting, tactics matrix, and raw JSON export
- **Chrome extension (Gmail)** — one-click scan button injected into Gmail threads with a popup verdict and badge overlay for inbox rows
- **Chrome extension (PhishLens Guard)** — real-time phishing alert banner injected on any suspicious page you browse to
- **Built-in sample scenarios** — payloads for PayPal suspend, BEC wire transfer, Microsoft 365 login, crypto airdrop, bank SMS, fake package delivery, big-tech recruiter fraud, and more

---

## Architecture

```
┌─────────────────────────────────────────┐
│              Browser (port 3000)        │
│  public/index.html + app.js + styles    │
│  Mode tabs: Email | URL | SMS | Job     │
└───────────────┬─────────────────────────┘
                │ SSE  POST /api/analyze
┌───────────────▼─────────────────────────┐
│         Express API (port 3001)         │
│              server.js                  │
│                                         │
│  ┌──────────┐  ┌──────────┐             │
│  │ pipeline │  │ pipeline │  ...        │
│  │  Email   │  │   URL    │             │
│  └────┬─────┘  └────┬─────┘             │
│       │              │                  │
│  ┌────▼──────────────▼──────────────┐   │
│  │          Analyzers               │   │
│  │  headerAnalyzer  senderAnalyzer  │   │
│  │  urlAnalyzer     contentAnalyzer │   │
│  │  attachmentAnalyzer  aiAnalyzer  │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │            Utils                 │   │
│  │  homographDetector  riskScorer   │   │
│  │  domainReputation                │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
                │
        OpenRouter / HackClub AI
```

---

## Project Layout

```
phish-forensics/
├── server.js                   # Express API + web server entry point
├── package.json
├── .env.example                # Environment variable template
│
├── analyzers/
│   ├── headerAnalyzer.js       # SPF/DKIM/DMARC, From/Reply-To/Return-Path mismatches
│   ├── senderAnalyzer.js       # Sender domain trust scoring
│   ├── urlAnalyzer.js          # URL unshortening, flag detection, homograph check
│   ├── contentAnalyzer.js      # Urgency/credential keyword patterns
│   ├── attachmentAnalyzer.js   # Attachment extension and MIME analysis
│   └── aiAnalyzer.js           # LLM deep analysis via OpenRouter or HackClub
│
├── utils/
│   ├── homographDetector.js    # Punycode / IDN lookalike detection
│   ├── domainReputation.js     # Domain blocklist / reputation check
│   └── riskScorer.js           # Rule-based risk score aggregation
│
├── public/                     # Web UI (served on port 3000)
│   ├── index.html
│   ├── app.js
│   └── styles.css
│
├── extension/                  # Chrome extension for Gmail
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   ├── popup.js
│   └── README.md
│
└── phishlens-extension/        # Chrome extension — PhishLens Guard (any site)
    ├── manifest.json
    ├── background.js
    ├── content.js
    ├── popup.html
    ├── popup.js
    └── alert.css
```

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- An AI provider API key (see [AI Configuration](#ai-configuration))

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in your API key (see [AI Configuration](#ai-configuration) below).

### 3. Start the servers

```bash
npm start
```

This starts two servers:

| Server | URL | Purpose |
|--------|-----|---------|
| Web UI | http://localhost:3000 | Forensic dashboard |
| API | http://localhost:3001 | Analysis endpoints |

Open **http://localhost:3000** in your browser.

---

## AI Configuration

PhishLens supports two LLM providers. Set `LLM_PROVIDER` in `.env` to choose one.

### Option A — OpenRouter (default)

1. Sign up at [openrouter.ai](https://openrouter.ai) and create an API key.
2. Set in `.env`:

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_FAST_MODEL=google/gemini-2.5-flash
OPENROUTER_DEEP_MODEL=deepseek/deepseek-r1-0528
```

### Option B — Hack Club AI (free tier)

1. Get a key from [ai.hackclub.com](https://ai.hackclub.com).
2. Set in `.env`:

```env
LLM_PROVIDER=hackclub
HACKCLUB_API_KEY=your_key_here
HACKCLUB_FAST_MODEL=qwen/qwen3-32b
HACKCLUB_DEEP_MODEL=qwen/qwen3-32b
```

> **Note:** The fast model is used for quick passes; the deep model is used for the full forensic analysis. You can point both to the same model if your provider only has one option.

---

## API Reference

All endpoints are on port `3001`.

### `GET /api/health`

Returns server status.

```json
{ "ok": true, "name": "PhishLens", "apiPort": 3001, "webPort": 3000, "timestamp": "..." }
```

### `POST /api/analyze`

Streams analysis results via Server-Sent Events.

**Request body:**

```json
{
  "mode": "email",        // "email" | "url" | "sms" | "job"
  "content": "..."        // raw input text
}
```

**SSE event types:**

| Event | Payload | Description |
|-------|---------|-------------|
| `progress` | `{ step, message }` | Analyzer checkpoint |
| `partial` | `{ section, data }` | Incremental result for one analyzer |
| `complete` | Full report object | Final aggregated result |
| `error` | `{ error }` | Analysis failure |

**Complete event shape:**

```json
{
  "app": "PhishLens",
  "mode": "email",
  "modeLabel": "Email Analysis Complete",
  "risk": {
    "score": 85,
    "severity": "high",
    "ruleScore": 60,
    "aiScore": 85,
    "topReasons": ["SPF failed", "Domain mismatch", "..."]
  },
  "signals": { "headerResult": {}, "urlResult": {}, "..." },
  "ai": {
    "risk_score": 85,
    "summary": "...",
    "red_flags": [{ "label": "...", "evidence": "..." }],
    "threat_categories": { "Identity Spoofing": 60, "Malicious Links": 40 },
    "recommended_action": "...",
    "attackType": "...",
    "sophistication": "high",
    "likelyTarget": "...",
    "socialEngineeringTactics": [],
    "attributionClues": [],
    "confidenceScore": 88
  }
}
```

### `POST /api/unshorten`

Resolves a shortened or redirected URL and returns the full hop chain.

```json
// Request
{ "url": "https://bit.ly/example" }

// Response
{ "original": "https://bit.ly/example", "finalDestination": "https://...", "hops": [...] }
```

### `POST /api/explain`

Streams an AI deep-dive explanation for a given analysis context (used by the "Show AI Reasoning" button).

---

## Detection Modes

### Email

Full RFC 822 header + body analysis:

- SPF, DKIM, DMARC authentication results
- From / Reply-To / Return-Path domain mismatch detection
- Origin IP extraction from `Received:` chain
- URL extraction and multi-hop unshortening
- Content keyword scanning (urgency, credential harvest, threats)
- Attachment MIME/extension analysis
- AI checks for corporate domain impersonation, identity spoofing, and data harvesting

### URL

Single URL deep inspection:

- Shortener detection (bit.ly, tinyurl, t.co, goo.gl, ow.ly, is.gd, ...)
- Redirect chain tracing (up to 5 hops)
- IP-as-hostname, excessive subdomains, `@`-embedded credentials
- Suspicious TLDs: `.zip .mov .top .xyz .click .work`
- Brand keyword in path on unrelated domain
- Display-text vs href mismatch in HTML anchors
- Homograph / IDN / Punycode lookalike detection
- AI checks for typosquatting, brand-as-subdomain, open-redirect patterns

### SMS (Smishing)

- URL extraction and unshortening from SMS body
- Content pattern scanning for urgency and impersonation language
- AI checks for bank impersonation, fake package delivery, OTP social engineering, prize scams, government threats

### Job Offer / Recruitment Fraud

- Sender domain vs claimed company mismatch
- Content scanning for salary inflation, prepayment requests, personal data harvesting
- AI checks for big-tech impersonation on personal email, deposit/fee scams, reshipping schemes, crypto-only payment

---

## Risk Score

The final score (0–100) is `max(ruleScore, aiScore)`, ensuring AI severity never gets underridden by a low rule score when header/attachment signals are absent (e.g. URL-only or SMS modes).

| Score | Severity |
|-------|----------|
| 0–20 | Safe |
| 21–40 | Low |
| 41–60 | Moderate |
| 61–80 | High |
| 81–100 | Critical |

---

## Chrome Extensions

### Gmail Extension (`extension/`)

Adds phishing forensics directly inside Gmail.

- Floating **"Scan with PhishLens"** button on open email threads
- Popup summary with risk gauge and top red flags
- Verdict badge: **SAFE TO OPEN / VERIFY BEFORE ACTING / DO NOT INTERACT**
- Inbox scan mode: overlays risk badges on visible inbox rows
- **Open full report** button opens the web dashboard pre-filled with the email

**Install:**

1. Go to `chrome://extensions/` and enable **Developer mode**
2. Click **Load unpacked** → select the `extension/` folder
3. Open Gmail and open any email thread

> Requires the backend running on port `3001` and frontend on port `3000`.

### PhishLens Guard (`phishlens-extension/`)

Real-time phishing detection on any site you visit.

- Scans page URLs against the backend as you browse
- Injects a dismissible alert banner when a high-risk page is detected
- Popup lets you manually scan the current tab

**Install:**

1. Go to `chrome://extensions/` and enable **Developer mode**
2. Click **Load unpacked** → select the `phishlens-extension/` folder

---

## Development

```bash
# Start both servers
npm start

# Watch server logs
# API logs print: [timestamp] METHOD /path statusCode Xms
```

The frontend is plain HTML/CSS/JS with no build step — edit `public/app.js` or `public/styles.css` and refresh the browser.

Analyzer modules in `analyzers/` and `utils/` are plain Node.js CommonJS modules — no transpilation needed.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `LLM_PROVIDER` | `openrouter` | AI provider: `openrouter` or `hackclub` |
| `OPENROUTER_API_KEY` | — | Required when provider is `openrouter` |
| `OPENROUTER_FAST_MODEL` | `google/gemini-2.5-flash` | Model for quick analysis passes |
| `OPENROUTER_DEEP_MODEL` | `deepseek/deepseek-r1-0528` | Model for full forensic analysis |
| `HACKCLUB_API_KEY` | — | Required when provider is `hackclub` |
| `HACKCLUB_FAST_MODEL` | `qwen/qwen3-32b` | HackClub fast model |
| `HACKCLUB_DEEP_MODEL` | `qwen/qwen3-32b` | HackClub deep model |

---

## License

[MIT](LICENSE)
