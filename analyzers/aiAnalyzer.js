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
            content:
              'You are a senior security analyst specializing in phishing forensics. Given an email and technical findings, produce a deep analysis. Focus on social engineering tactics, attribution clues, and what the attacker is trying to achieve. Return JSON only. You MUST always include a "summary" key in your JSON. It must be a non-empty string of 2-4 sentences explaining the threat level and key reasons, even if the email is legitimate.'
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
    const summaryCandidate = parsed.summary || parsed.description || parsed.explanation || parsed.analysis;

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
      summary:
        typeof summaryCandidate === 'string' && summaryCandidate.trim().length > 0
          ? summaryCandidate
          : 'Analysis complete. No specific threats detected.',
      provider: config.provider,
      model: config.deepModel
    };
  } catch (error) {
    return {
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
