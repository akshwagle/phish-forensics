const axios = require('axios');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const HACKCLUB_PROXY_URL = 'https://ai.hackclub.com/proxy/v1/chat/completions';
const DEFAULT_FAST_MODEL = 'google/gemini-2.5-flash';
const DEFAULT_DEEP_MODEL = 'deepseek/deepseek-r1-0528';
const TIMEOUT_MS = 30000;

function getAIConfig() {
  const provider = (process.env.LLM_PROVIDER || 'openrouter').toLowerCase();

  if (provider === 'hackclub') {
    if (!process.env.HACKCLUB_API_KEY) {
      throw new Error('HACKCLUB_API_KEY is not set');
    }
    return {
      provider,
      url: HACKCLUB_PROXY_URL,
      fastModel: process.env.HACKCLUB_FAST_MODEL || 'qwen/qwen3-32b',
      deepModel: process.env.HACKCLUB_DEEP_MODEL || 'qwen/qwen3-32b',
      headers: {
        Authorization: `Bearer ${process.env.HACKCLUB_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };
  }

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  return {
    provider: 'openrouter',
    url: OPENROUTER_URL,
    fastModel: process.env.OPENROUTER_FAST_MODEL || DEFAULT_FAST_MODEL,
    deepModel: process.env.OPENROUTER_DEEP_MODEL || DEFAULT_DEEP_MODEL,
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };
}

async function quickAnalyze(payload, combinedSignals) {
  const config = getAIConfig();
  try {
    const response = await axios.post(
      config.url,
      {
        model: config.fastModel,
        messages: [
          {
            role: 'system',
            content:
              'You are a phishing detection assistant. Return concise JSON with keys: verdict, confidence, key_findings (array).'
          },
          {
            role: 'user',
            content: JSON.stringify({ payload, combinedSignals })
          }
        ]
      },
      {
        headers: config.headers,
        timeout: TIMEOUT_MS
      }
    );

    return {
      model: config.fastModel,
      provider: config.provider,
      response: response.data.choices?.[0]?.message?.content || 'No response'
    };
  } catch (error) {
    return {
      model: config.fastModel,
      provider: config.provider,
      error: error.response?.data || error.message
    };
  }
}

/* ============================================================
   PER-MODE SYSTEM PROMPTS
   All modes return the SAME JSON shape so the frontend renderer
   can display any mode's result through the same components.
   ============================================================ */

const COMMON_OUTPUT_SCHEMA = [
  '',
  'Output JSON shape (always include all keys, risk_score MUST be a NUMBER 0-100, never a string):',
  '{',
  '  "risk_score": number,                 // integer 0-100, sum of triggered scoring rules, capped at 100',
  '  "summary": string,                    // 2-4 sentence narrative explaining the verdict',
  '  "red_flags": [                        // 0-8 items, ordered by severity',
  '    { "label": string, "evidence": string }',
  '  ],',
  '  "threat_categories": {                // 0-100 percentages by category, totaling 100 (omit unused)',
  '    "Identity Spoofing": number,',
  '    "Authentication Failure": number,',
  '    "Malicious Links": number,',
  '    "Data Harvesting": number,',
  '    "Social Engineering": number,',
  '    "Money / Wire Fraud": number,',
  '    "Malicious Payload": number,',
  '    "Other": number',
  '  },',
  '  "recommended_action": string,         // 1 sentence on what the user should do',
  '  "attackType": string,',
  '  "sophistication": string,',
  '  "likelyTarget": string,',
  '  "socialEngineeringTactics": string[],',
  '  "attributionClues": string[],',
  '  "confidenceScore": number             // 0-100',
  '}'
].join('\n');

const PROMPTS = {
  email: [
    'You are a senior security analyst specializing in phishing forensics. Given an email and technical findings, produce a deep analysis.',
    'Focus on social engineering tactics, attribution clues, and what the attacker is trying to achieve. Return JSON only.',
    '',
    'You MUST always include a "summary" key in your JSON. It must be a non-empty string of 2-4 sentences explaining the threat level and key reasons, even if the email is legitimate.',
    '',
    'CRITICAL DETECTION RULES — apply these in addition to all other phishing heuristics:',
    '',
    '1. Corporate Domain Impersonation (CRITICAL):',
    '   - Extract the sender email domain (e.g. gmail.com, yahoo.com, outlook.com, hotmail.com, protonmail.com, icloud.com, aol.com).',
    '   - Extract any company name the sender CLAIMS to represent (in From display name, body, or signature).',
    '   - If the sender claims to work for CompanyX (Adobe, Google, Microsoft, PayPal, Amazon, Apple, Meta, Netflix, Oracle, Salesforce, IBM, etc.) but emails from a free/personal domain, treat it as HIGH RISK.',
    '   - Real employees of those companies always email from @adobe.com, @google.com, @microsoft.com, @paypal.com, etc.',
    '   - Rule: if claimed_company != sender_domain_company, add the red flag "Corporate domain mismatch" and add +40 to risk score.',
    '',
    '2. Unsolicited Recruitment / Job Offer Scam:',
    '   - If the email is an unsolicited job offer asking for personal information (resume, career goals, work history, certifications, references), flag as data harvesting.',
    '   - Legitimate recruiters from real companies do not cold-email asking for that volume of personal data upfront.',
    '   - Rule: unsolicited job offer + personal data request, add +30 to risk score and the red flag "Unsolicited recruitment scam".',
    '',
    '3. Identity Impersonation of a Real Person:',
    '   - If the sender provides a personal name + company title but the email domain does not match the company, flag "Identity impersonation".',
    '   - Example: "Mark Stevens, Sr. Director at Adobe" sent from markstevenstalent@gmail.com.',
    '   - Rule: named person + company title + personal/free email domain, add the red flag "Possible identity impersonation" and add +25 to risk score.',
    '',
    '4. Fake LinkedIn / Official Link Deception:',
    '   - If the email contains links to official company sites (e.g. adobe.com/careers, microsoft.com/careers) but the sender is on a personal/free domain, treat it as a deceptive legitimacy tactic.',
    '   - Adding real company links to fake emails is a known trust-building trick.',
    '   - Rule: official brand URLs + personal sender domain, add the red flag "Deceptive legitimacy links" and add +15 to risk score.',
    '',
    '5. Mass Personal Data Harvesting:',
    '   - If the email asks for 5+ pieces of personal/professional information (resume, goals, work history, references, certifications, salary expectations, ID, etc.) in a single message, flag it.',
    '   - Rule: requests resume or 5+ personal details upfront, add the red flag "Mass personal data harvesting" and add +20 to risk score.',
    '',
    'Additional scoring rules to apply when computing the final risk score (0-100, capped at 100):',
    '   - Sender domain is free/personal (gmail/yahoo/hotmail/outlook/protonmail/icloud/aol) but claims corporate identity: +40',
    '   - Unsolicited job offer asking for personal data: +30',
    '   - Named individual + company title + personal email domain: +25',
    '   - Contains official brand URLs but sent from personal domain: +15',
    '   - Requests resume or 5+ personal details upfront: +20',
    '',
    'When any of the above rules trigger, the summary MUST explicitly mention the corporate impersonation pattern and call out the mismatched sender domain.',
    COMMON_OUTPUT_SCHEMA
  ].join('\n'),

  url: [
    'You are a URL phishing detection expert. Analyze the given URL for phishing indicators. Return JSON only.',
    '',
    'You MUST always include a "summary" key (2-4 sentences). The summary must explicitly mention which red-flag patterns triggered.',
    '',
    'Focus on these threat patterns:',
    '1. Typosquatting — common brand names with letter substitutions, swaps, insertions, or omissions (e.g. paypa1.com, microsft.com, amaz0n.net, faceboook.com, gooogle.com).',
    '2. Homograph / IDN attacks — Cyrillic, Greek, or other Unicode lookalikes (e.g. раypal.com with Cyrillic "р", аpple.com with Cyrillic "а"). Mention Punycode (xn--…) when applicable.',
    '3. Suspicious TLDs — .top, .xyz, .click, .work, .tk, .ml, .ga, .cf, .gq, .monster, .rest, .fit, .country, .stream, .download are common phishing TLDs.',
    '4. URL shorteners — bit.ly, tinyurl.com, goo.gl, ow.ly, t.co, is.gd, buff.ly, t.ly, rebrand.ly, cutt.ly hide the real destination.',
    '5. Redirect chains — multiple hops or tracking redirects often used to evade detection.',
    '6. Suspicious paths — keywords like /login/, /verify/, /secure/, /update/, /confirm/, /signin/, /account/, /webscr/, /wp-admin/ combined with a brand name in path or subdomain.',
    '7. Suspicious query parameters — token=, redirect=, return_url=, continue=, next=, dest=, url= often used for credential capture or open-redirect abuse.',
    '8. Brand impersonation in subdomain — e.g. amazon.com.security-update.top (real brand placed as subdomain of attacker domain).',
    '9. IP address as host — raw IPv4/IPv6 hostnames (e.g. http://185.220.100.44/login) instead of a domain.',
    '10. Newly registered / unusual domains — long random-looking domains, double-hyphen patterns, or excessive subdomains.',
    '',
    'Scoring guidance (sum, capped at 100):',
    '   - Homograph / IDN attack: +60',
    '   - Typosquat of major brand: +50',
    '   - Brand name as subdomain of attacker domain: +45',
    '   - Suspicious TLD + brand keyword in domain or path: +35',
    '   - IP address as host: +35',
    '   - URL shortener: +25',
    '   - Redirect chain >1 hop: +15',
    '   - Brand keyword in path with /login or /verify: +20',
    '   - Suspicious query parameters: +10',
    '   - HTTP (not HTTPS) for sensitive-looking paths: +10',
    COMMON_OUTPUT_SCHEMA
  ].join('\n'),

  sms: [
    'You are an SMS phishing (smishing) detection expert. Analyze the given SMS message text for phishing indicators. Return JSON only.',
    '',
    'You MUST always include a "summary" key (2-4 sentences) that explicitly names the smishing pattern when triggered.',
    '',
    'Focus on these threat patterns:',
    '1. Fake OTP / verification code delivery — "Your OTP is 729812. Reply YES to confirm $4500 transaction." (designed to manipulate the user into calling a fake support line or sharing the code).',
    '2. Bank impersonation — claims to be from HDFC, ICICI, SBI, Axis, Chase, Wells Fargo, Bank of America, Citi, etc. with "account locked / verify now" framing.',
    '3. Fake package delivery — FedEx, UPS, DHL, Amazon, India Post, Royal Mail, USPS. "Your package is held at customs, pay redelivery fee."',
    '4. Urgency language — "expires in 1 hour", "act now", "immediate action required", "within 24 hours", "final notice".',
    '5. Shortened URLs in SMS body — bit.ly, tinyurl, goo.gl, t.co, is.gd, t.ly hide the real destination. Treat shorteners in SMS as highly suspicious.',
    '6. Fake prizes / lottery / gifts — "You won an iPhone", "claim your $500 Amazon gift card", "exclusive airdrop".',
    '7. Personal info requests via SMS — PAN, Aadhaar, SSN, account number, password, CVV, OTP. Legit banks NEVER ask for these via SMS.',
    '8. Fake government / tax notices — IRS, Income Tax, social security threats with payment links.',
    '9. Wrong sender — random 10-digit phone numbers vs. official short codes used by real banks/services.',
    '10. "Family emergency" scams — "Hi Mom this is my new number, please send money urgently", "I lost my phone, send $200 via Venmo".',
    '11. Investment / crypto / job lures — "earn $500/day", "free trading group", "remote job paying $9000/month".',
    '',
    'Scoring guidance (sum, capped at 100):',
    '   - Bank impersonation + URL/shortener: +55',
    '   - Fake package delivery + payment request: +50',
    '   - Personal info request (PAN/SSN/password/CVV/OTP share): +60',
    '   - OTP-related social engineering ("share code"): +55',
    '   - Family/relative emergency money request: +55',
    '   - Prize/lottery scam: +45',
    '   - URL shortener present: +25',
    '   - Urgency language: +15',
    '   - Crypto/investment promise: +35',
    '   - Government/tax threat with link: +45',
    COMMON_OUTPUT_SCHEMA
  ].join('\n'),

  job: [
    'You are a job-scam / recruitment-fraud detection expert. Analyze the given recruiter message or job offer for fraud indicators. Return JSON only.',
    '',
    'You MUST always include a "summary" key (2-4 sentences) that names the specific scam pattern when triggered.',
    '',
    'Focus on these fraud patterns:',
    '1. Sender domain vs claimed company mismatch — recruiter claims to be from Google/Microsoft/Amazon/Adobe/Meta/Netflix/Apple/etc but emails from gmail.com, outlook.com, hotmail.com, yahoo.com, or random vanity domains. Real recruiters from real companies always use the company domain (e.g. @google.com, @microsoft.com).',
    '2. Salary far too high for role — "$250k/year for entry level", "$9000/month for data entry", "$500/hour easy work-from-home", "₹3 lakh/month for fresher". Legit companies pay market rate.',
    '3. Excessive personal data harvesting upfront — passport, driver license, bank account number, Aadhaar, SSN, PAN, full address, photos requested before any interview. Legit hiring asks for these only after offer acceptance and onboarding.',
    '4. Vague company details — no real address, no LinkedIn presence, no real website, generic "we are a fast-growing global firm" language with no specifics.',
    '5. Urgency to apply — "only 24 hours to accept", "limited slots", "respond in 30 minutes".',
    '6. Wire transfer or prepayment required — laptop deposit, training fees, equipment fees, certification fees, courier fees, "refundable" deposits. Any money flowing FROM candidate TO "employer" is a scam.',
    '7. Generic recruiter on personal email — "talent.acquisition@gmail.com", "hr.recruiter@outlook.com", "amazon.hiring@gmail.com".',
    '8. No interview / instant offer — legit roles always have at least a screening call.',
    '9. Cryptocurrency or unusual payment method — "send Bitcoin for processing", "USDT for laptop".',
    '10. Reshipping / mule schemes — "we will send packages to your address, you forward them to our customer".',
    '11. Telegram / WhatsApp-only contact — refusing email/video and pushing to chat apps with anonymous handles.',
    '',
    'Scoring guidance (sum, capped at 100):',
    '   - Wire transfer / prepayment requested: +70',
    '   - Personal financial info (bank/Aadhaar/SSN/passport) requested upfront: +55',
    '   - Sender domain != claimed company domain: +45',
    '   - Salary unrealistic for role: +35',
    '   - Generic personal-email recruiter claiming big-tech role: +35',
    '   - No company website / LinkedIn / vague details: +25',
    '   - Urgency to accept: +20',
    '   - Reshipping / package forwarding: +60',
    '   - Crypto-only payment: +40',
    '   - Telegram/WhatsApp-only contact: +25',
    COMMON_OUTPUT_SCHEMA
  ].join('\n')
};

const MODE_USER_LABELS = {
  email: 'RAW_EMAIL',
  url:   'URL_TO_ANALYZE',
  sms:   'SMS_TEXT',
  job:   'RECRUITER_MESSAGE'
};

function buildSystemPrompt(mode) {
  return PROMPTS[mode] || PROMPTS.email;
}

function buildUserPrompt(mode, content, technicalFindings) {
  const label = MODE_USER_LABELS[mode] || MODE_USER_LABELS.email;
  return `${label}:\n${String(content || '')}\n\nTECHNICAL_FINDINGS_JSON:\n${JSON.stringify(
    technicalFindings || {},
    null,
    2
  )}`;
}

async function callAiOnce(config, activeMode, content, technicalFindings, retryHint) {
  const userPrompt = buildUserPrompt(activeMode, content, technicalFindings);
  const messages = [
    { role: 'system', content: buildSystemPrompt(activeMode) },
    { role: 'user', content: retryHint ? `${userPrompt}\n\n${retryHint}` : userPrompt }
  ];
  const response = await axios.post(
    config.url,
    { model: config.deepModel, messages, response_format: { type: 'json_object' } },
    { headers: config.headers, timeout: TIMEOUT_MS }
  );
  return parseAiResponse(response, config, activeMode);
}

// A response is "garbage" if the model gave us no score, no flags, and no real
// summary — typically `{"error":"..."}`, `{"_type":"..."}`, or bracket noise.
function isGarbageAiResponse(parsed) {
  if (!parsed) return true;
  const hasScore = Number.isFinite(parsed.risk_score) && parsed.risk_score > 0;
  const hasFlags = Array.isArray(parsed.red_flags) && parsed.red_flags.length > 0;
  const summary = String(parsed.summary || '').trim();
  const isFallbackSummary =
    !summary ||
    summary === 'Analysis complete. No specific threats detected.' ||
    summary.startsWith('AI deep analysis failed');
  return !hasScore && !hasFlags && isFallbackSummary;
}

async function aiDeepAnalysis(content, technicalFindings, mode) {
  const config = getAIConfig();
  const activeMode = (mode || 'email').toLowerCase();
  try {
    let parsed = await callAiOnce(config, activeMode, content, technicalFindings);
    if (isGarbageAiResponse(parsed)) {
      console.warn('[aiDeepAnalysis] empty/garbage response, retrying once with stronger hint');
      const hint = [
        'IMPORTANT: Return ONLY a single JSON object that follows the schema in the system prompt.',
        'Do NOT return {"error": ...}, do NOT return {"_type": ...}, do NOT return brackets-only output.',
        'You MUST include risk_score (number 0-100), summary (2-4 sentences), and red_flags (array).'
      ].join(' ');
      const retried = await callAiOnce(config, activeMode, content, technicalFindings, hint);
      if (!isGarbageAiResponse(retried)) parsed = retried;
    }
    return parsed;
  } catch (error) {
    return {
      risk_score: 0,
      red_flags: [],
      threat_categories: {},
      recommended_action: '',
      attackType: 'other',
      sophistication: 'low',
      likelyTarget: 'unknown',
      socialEngineeringTactics: [],
      attributionClues: [],
      confidenceScore: 0,
      summary: `AI deep analysis failed: ${error.response?.data?.error?.message || error.message}`,
      provider: config.provider,
      model: config.deepModel,
      mode: activeMode
    };
  }
}

function parseAiResponse(response, config, mode) {
  const raw = response.data.choices?.[0]?.message?.content || '{}';
  console.log('[aiDeepAnalysis] mode=%s raw response body:', mode, raw);
  const clean = String(raw)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  let parsed = {};
  try {
    parsed = typeof raw === 'string' ? JSON.parse(clean) : raw;
  } catch (e) {
    console.warn('[aiDeepAnalysis] JSON parse failed:', e.message);
    parsed = {};
  }
  console.log('[aiDeepAnalysis] parsed JSON keys:', Object.keys(parsed));

  const summaryCandidate =
    parsed.summary || parsed.description || parsed.explanation || parsed.analysis;

  const rawScore =
    parsed.risk_score ??
    parsed.riskScore ??
    parsed.score ??
    parsed.threat_score ??
    parsed.threatScore ??
    parsed.risk_level ??
    0;
  let aiRiskScore = parseInt(rawScore, 10);
  if (Number.isNaN(aiRiskScore)) aiRiskScore = 0;
  aiRiskScore = Math.max(0, Math.min(100, aiRiskScore));

  const rawFlags = parsed.red_flags || parsed.redFlags || parsed.flags || [];
  const redFlags = Array.isArray(rawFlags)
    ? rawFlags
        .map((item) => {
          if (typeof item === 'string') return { label: item, evidence: '' };
          if (item && typeof item === 'object') {
            return {
              label: String(item.label || item.title || item.name || item.flag || '').trim(),
              evidence: String(item.evidence || item.detail || item.description || '').trim()
            };
          }
          return null;
        })
        .filter((entry) => entry && entry.label)
    : [];

  const rawCategories =
    parsed.threat_categories || parsed.threatCategories || parsed.categories || {};
  const threat_categories = {};
  if (rawCategories && typeof rawCategories === 'object') {
    Object.keys(rawCategories).forEach((k) => {
      const v = Number(rawCategories[k]);
      if (Number.isFinite(v) && v > 0) threat_categories[String(k)] = Math.max(0, Math.min(100, v));
    });
  }

  const recommended_action = String(
    parsed.recommended_action || parsed.recommendedAction || parsed.action || ''
  ).trim();

  return {
    risk_score: aiRiskScore,
    red_flags: redFlags,
    threat_categories,
    recommended_action,
    attackType: parsed.attackType || parsed.attack_type || 'other',
    sophistication: parsed.sophistication || 'low',
    likelyTarget: parsed.likelyTarget || parsed.likely_target || 'unknown',
    socialEngineeringTactics: Array.isArray(parsed.socialEngineeringTactics)
      ? parsed.socialEngineeringTactics
      : Array.isArray(parsed.social_engineering_tactics)
        ? parsed.social_engineering_tactics
        : [],
    attributionClues: Array.isArray(parsed.attributionClues)
      ? parsed.attributionClues
      : Array.isArray(parsed.attribution_clues)
        ? parsed.attribution_clues
        : [],
    confidenceScore:
      typeof parsed.confidenceScore === 'number'
        ? Math.max(0, Math.min(100, parsed.confidenceScore))
        : typeof parsed.confidence_score === 'number'
          ? Math.max(0, Math.min(100, parsed.confidence_score))
          : 0,
    summary:
      typeof summaryCandidate === 'string' && summaryCandidate.trim().length > 0
        ? summaryCandidate
        : 'Analysis complete. No specific threats detected.',
    provider: config.provider,
    model: config.deepModel,
    mode
  };
}


async function deepExplainStream(context) {
  const analysis = await aiDeepAnalysis(context?.rawEmail || JSON.stringify(context || {}), context);
  const text = JSON.stringify(analysis, null, 2);
  return text.match(/.{1,350}/g) || [text];
}

module.exports = { quickAnalyze, aiDeepAnalysis, deepExplainStream };
