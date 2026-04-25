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

async function aiDeepAnalysis(emailContent, technicalFindings) {
  const config = getAIConfig();
  try {
    const response = await axios.post(
      config.url,
      {
        model: config.deepModel,
        messages: [
          {
            role: 'system',
            content: [
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
              '',
              'Output JSON shape (always include all keys, risk_score MUST be a NUMBER 0-100, never a string):',
              '{',
              '  "risk_score": number,                 // integer 0-100, sum of triggered scoring rules, capped at 100',
              '  "summary": string,                    // 2-4 sentence narrative explaining the verdict',
              '  "red_flags": [                        // 0-8 items, ordered by severity',
              '    { "label": string, "evidence": string }',
              '  ],',
              '  "attackType": string,',
              '  "sophistication": string,',
              '  "likelyTarget": string,',
              '  "socialEngineeringTactics": string[],',
              '  "attributionClues": string[],',
              '  "confidenceScore": number',
              '}'
            ].join('\n')
          },
          {
            role: 'user',
            content: `RAW_EMAIL:\n${String(emailContent || '')}\n\nTECHNICAL_FINDINGS_JSON:\n${JSON.stringify(
              technicalFindings || {},
              null,
              2
            )}`
          }
        ],
        response_format: { type: 'json_object' }
      },
      {
        headers: config.headers,
        timeout: TIMEOUT_MS
      }
    );

    const raw = response.data.choices?.[0]?.message?.content || '{}';
    console.log('[aiDeepAnalysis] raw response body:', raw);
    const clean = String(raw)
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    const parsed = typeof raw === 'string' ? JSON.parse(clean) : raw;
    console.log('[aiDeepAnalysis] parsed JSON keys:', Object.keys(parsed));

    const summaryCandidate = parsed.summary || parsed.description || parsed.explanation || parsed.analysis;

    const rawScore =
      parsed.risk_score ??
      parsed.riskScore ??
      parsed.score ??
      parsed.threat_score ??
      parsed.threatScore ??
      parsed.risk_level ??
      0;
    let aiRiskScore = parseInt(rawScore, 10);
    if (Number.isNaN(aiRiskScore)) {
      aiRiskScore = 0;
    }
    aiRiskScore = Math.max(0, Math.min(100, aiRiskScore));

    const rawFlags = parsed.red_flags || parsed.redFlags || parsed.flags || [];
    const redFlags = Array.isArray(rawFlags)
      ? rawFlags
          .map((item) => {
            if (typeof item === 'string') {
              return { label: item, evidence: '' };
            }
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

    return {
      risk_score: aiRiskScore,
      red_flags: redFlags,
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
      model: config.deepModel
    };
  } catch (error) {
    return {
      risk_score: 0,
      red_flags: [],
      attackType: 'other',
      sophistication: 'low',
      likelyTarget: 'unknown',
      socialEngineeringTactics: [],
      attributionClues: [],
      confidenceScore: 0,
      summary: `AI deep analysis failed: ${error.response?.data?.error?.message || error.message}`,
      provider: config.provider,
      model: config.deepModel
    };
  }
}

async function deepExplainStream(context) {
  const analysis = await aiDeepAnalysis(context?.rawEmail || JSON.stringify(context || {}), context);
  const text = JSON.stringify(analysis, null, 2);
  return text.match(/.{1,350}/g) || [text];
}

module.exports = { quickAnalyze, aiDeepAnalysis, deepExplainStream };
