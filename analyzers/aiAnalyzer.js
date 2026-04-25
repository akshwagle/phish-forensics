const axios = require('axios');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FAST_MODEL = 'google/gemini-2.5-flash';
const TIMEOUT_MS = 30000;

function getHeaders() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json'
  };
}

async function quickAnalyze(payload, combinedSignals) {
  try {
    const response = await axios.post(
      OPENROUTER_URL,
      {
        model: FAST_MODEL,
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
        headers: getHeaders(),
        timeout: TIMEOUT_MS
      }
    );

    return {
      model: FAST_MODEL,
      response: response.data.choices?.[0]?.message?.content || 'No response'
    };
  } catch (error) {
    return {
      model: FAST_MODEL,
      error: error.response?.data || error.message
    };
  }
}

async function aiDeepAnalysis(emailContent, technicalFindings) {
  try {
    const response = await axios.post(
      OPENROUTER_URL,
      {
        model: FAST_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a senior security analyst specializing in phishing forensics. Given an email and technical findings, produce a deep analysis. Focus on social engineering tactics, attribution clues, and what the attacker is trying to achieve. Return JSON only.'
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
        headers: getHeaders(),
        timeout: TIMEOUT_MS
      }
    );

    const content = response.data.choices?.[0]?.message?.content || '{}';
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;

    return {
      attackType: parsed.attackType || 'other',
      sophistication: parsed.sophistication || 'low',
      likelyTarget: parsed.likelyTarget || 'unknown',
      socialEngineeringTactics: Array.isArray(parsed.socialEngineeringTactics)
        ? parsed.socialEngineeringTactics
        : [],
      attributionClues: Array.isArray(parsed.attributionClues) ? parsed.attributionClues : [],
      confidenceScore:
        typeof parsed.confidenceScore === 'number'
          ? Math.max(0, Math.min(100, parsed.confidenceScore))
          : 0,
      summary: parsed.summary || 'No summary generated.'
    };
  } catch (error) {
    return {
      attackType: 'other',
      sophistication: 'low',
      likelyTarget: 'unknown',
      socialEngineeringTactics: [],
      attributionClues: [],
      confidenceScore: 0,
      summary: `AI deep analysis failed: ${error.response?.data?.error?.message || error.message}`
    };
  }
}

async function deepExplainStream(context) {
  const analysis = await aiDeepAnalysis(context?.rawEmail || JSON.stringify(context || {}), context);
  const text = JSON.stringify(analysis, null, 2);
  return text.match(/.{1,350}/g) || [text];
}

module.exports = { quickAnalyze, aiDeepAnalysis, deepExplainStream };
