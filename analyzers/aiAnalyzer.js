const axios = require('axios');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FAST_MODEL = 'google/gemini-2.5-flash';
const DEEP_MODEL = 'deepseek/deepseek-r1-0528';
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

async function deepExplainStream(context) {
  try {
    const response = await axios.post(
      OPENROUTER_URL,
      {
        model: DEEP_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a deep phishing forensics explainer. Provide clear reasoning, threat chain, and prioritized remediation.'
          },
          {
            role: 'user',
            content: JSON.stringify(context)
          }
        ],
        stream: false
      },
      {
        headers: getHeaders(),
        timeout: TIMEOUT_MS
      }
    );

    const text = response.data.choices?.[0]?.message?.content || '';
    if (!text) {
      return ['No deep explanation generated.'];
    }

    const chunks = text.match(/.{1,350}/g) || [text];
    return chunks;
  } catch (error) {
    return [`Deep explanation failed: ${error.response?.data?.error?.message || error.message}`];
  }
}

module.exports = { quickAnalyze, deepExplainStream };
