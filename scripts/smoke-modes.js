// Quick smoke test for all 4 detection modes against a live local server.
// Usage: node scripts/smoke-modes.js
const http = require('http');

const TESTS = [
  {
    name: 'EMAIL',
    mode: 'email',
    content: [
      'From: "Mark Stevens, Sr. Director" <mark.stevens.adobe@gmail.com>',
      'Reply-To: mark.stevens.adobe@gmail.com',
      'Subject: Adobe Career Opportunity - Senior Software Engineer',
      '',
      'Hi,',
      'I am Mark Stevens, Sr. Director of Talent at Adobe. We have a Senior Software Engineer role.',
      'Please send your resume, work history, references, certifications, and salary expectations.',
      'Schedule via https://adobe.com/careers',
      ''
    ].join('\n')
  },
  {
    name: 'URL',
    mode: 'url',
    content: 'https://paypa1-secure-login.com/account/verify'
  },
  {
    name: 'SMS',
    mode: 'sms',
    content:
      'HDFC ALERT: Your account has been locked due to suspicious activity. Reactivate within 2 hours: http://hdfc-secure.click/verify'
  },
  {
    name: 'JOB',
    mode: 'job',
    content: [
      'From: hr.recruiter@gmail.com',
      'Subject: Senior Software Engineer at Google - Immediate Joining',
      '',
      'We have shortlisted your profile for the Senior Software Engineer position with a CTC of $250,000/year.',
      'Please share your passport, PAN card, and bank account details to process the offer letter today.',
      'Position closes in 24 hours. Limited slots.'
    ].join('\n')
  }
];

function runOne(t) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ mode: t.mode, content: t.content });
    const req = http.request(
      {
        host: 'localhost',
        port: 3001,
        path: '/api/analyze',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        let buf = '';
        let last = null;
        let progressCount = 0;
        let partialCount = 0;
        let startedAt = Date.now();
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          buf += chunk;
          const events = buf.split('\n\n');
          buf = events.pop() || '';
          for (const ev of events) {
            const lines = ev.split('\n');
            let name = 'message';
            let data = '';
            for (const l of lines) {
              if (l.startsWith('event:')) name = l.slice(6).trim();
              else if (l.startsWith('data:')) data += l.slice(5).trim();
            }
            if (!data || data === '[DONE]') continue;
            if (name === 'progress') progressCount += 1;
            else if (name === 'partial') partialCount += 1;
            else if (name === 'complete') {
              try { last = JSON.parse(data); } catch (_) { last = { _raw: data }; }
            } else if (name === 'error') {
              last = { _error: data };
            }
          }
        });
        res.on('end', () => {
          const elapsed = Date.now() - startedAt;
          const r = last || {};
          const ai = r.ai || {};
          console.log(
            `[${t.name}] ` +
              `mode=${r.mode} modeLabel="${r.modeLabel}" ` +
              `risk=${r.risk?.score ?? '?'} severity=${r.risk?.severity ?? '?'} ` +
              `aiScore=${ai.risk_score ?? '?'} flags=${(ai.red_flags || []).length} ` +
              `progress=${progressCount} partial=${partialCount} ` +
              `elapsed=${elapsed}ms`
          );
          if (ai.summary) {
            console.log(`  summary: ${String(ai.summary).slice(0, 200)}…`);
          }
          if (Array.isArray(ai.red_flags) && ai.red_flags.length) {
            console.log(
              `  top flags: ${ai.red_flags.slice(0, 3).map((f) => f.label).join(' | ')}`
            );
          }
          if (ai.recommended_action) {
            console.log(`  recommend: ${ai.recommended_action.slice(0, 160)}`);
          }
          if (ai.threat_categories && Object.keys(ai.threat_categories).length) {
            console.log(
              `  categories: ${Object.entries(ai.threat_categories)
                .slice(0, 4)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ')}`
            );
          }
          if (r._error || ai.summary?.startsWith?.('AI deep analysis failed')) {
            console.log('  !! AI ERROR detected');
          }
          resolve();
        });
      }
    );
    req.on('error', (e) => {
      console.log(`[${t.name}] request failed: ${e.message}`);
      resolve();
    });
    req.write(body);
    req.end();
  });
}

(async () => {
  for (const t of TESTS) {
    await runOne(t);
  }
})();
