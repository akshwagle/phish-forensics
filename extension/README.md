# PhishLens Chrome Extension (Gmail)

This extension adds one-click phishing forensics directly inside Gmail.

## Features

- Floating **"Scan with PhishLens"** button on opened emails
- Popup forensic summary with risk gauge and top red flags
- Verdict badge: **SAFE TO OPEN / VERIFY BEFORE ACTING / DO NOT INTERACT**
- **Scan this page** mode: scans visible inbox rows and overlays risk badges
- **Open full report** launches the full PhishLens web dashboard with prefilled email data

## Requirements

- Chrome / Chromium browser with Extension Developer Mode enabled
- PhishLens backend running at `http://localhost:3001`
- PhishLens frontend running at `http://localhost:3000`

## Install

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. Pin **PhishLens** extension from the toolbar

## Usage

1. Open Gmail (`https://mail.google.com`)
2. Open an email thread
3. Click **?? Scan with PhishLens** in the Gmail toolbar, or use popup **Scan current open email**
4. Check popup summary and verdict
5. Click **Open full report** for deep forensic details
6. Use **Scan this page (inbox mode)** to label visible inbox items with risk badges

## Troubleshooting

- If scanning fails, verify backend is running on port `3001`
- If full report is empty, ensure frontend is running on `3000`
- Reload the extension after code changes from `chrome://extensions/`
