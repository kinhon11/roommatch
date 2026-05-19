const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const geminiApiKey = process.env.GEMINI_API_KEY;
const minimaxApiKey = process.env.MINIMAX_API_KEY;
const aiProvider = (process.env.AI_PROVIDER || '').toLowerCase();
const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const minimaxModel = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';
const minimaxBaseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io';

if (!geminiApiKey && !minimaxApiKey) {
  console.warn('⚠️  GEMINI_API_KEY hoặc MINIMAX_API_KEY chưa được cấu hình.');
}

const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

const stripThinkBlocks = (text) => String(text || '')
  .replace(/<think>[\s\S]*?<\/think>\s*/gi, '')
  .trim();

const providerAvailable = {
  gemini: !!geminiApiKey,
  minimax: !!minimaxApiKey,
};

const chooseProviderOrder = () => {
  if (aiProvider === 'minimax') return ['minimax', 'gemini'];
  if (aiProvider === 'auto') return ['gemini', 'minimax'];
  if (!geminiApiKey && minimaxApiKey) return ['minimax'];
  return ['gemini', 'minimax'];
};

const isMinimaxEnabled = chooseProviderOrder()[0] === 'minimax';

const generateWithGemini = async (prompt, modelName = geminiModel) => {
  if (!genAI) {
    throw new Error('Gemini AI is not configured.');
  }
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
};

const generateWithMinimax = async (prompt, modelName = minimaxModel) => {
  if (!minimaxApiKey) {
    throw new Error('MiniMax AI is not configured.');
  }

  const response = await fetch(`${minimaxBaseUrl.replace(/\/$/, '')}/v1/text/chatcompletion_v2`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${minimaxApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', name: 'RoommieMatch', content: 'You are a helpful Vietnamese assistant for a room rental app.' },
        { role: 'user', name: 'user', content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (data?.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax API error (${data.base_resp.status_code}): ${data.base_resp.status_msg || 'unknown error'}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('MiniMax response did not include content.');
  }
  return stripThinkBlocks(content);
};

const generateAIText = async (prompt, options = {}) => {
  const modelName = options.modelName;
  const errors = [];

  for (const provider of chooseProviderOrder()) {
    if (!providerAvailable[provider]) continue;

    try {
      const text = provider === 'minimax'
        ? await generateWithMinimax(prompt, modelName || minimaxModel)
        : await generateWithGemini(prompt, modelName || geminiModel);

      return options.includeProvider
        ? { text, provider }
        : text;
    } catch (error) {
      errors.push(`${provider}: ${error.message}`);
      console.warn(`AI provider ${provider} failed:`, error.message);
    }
  }

  throw new Error(errors.length ? errors.join(' | ') : 'No AI provider is configured.');
};

module.exports = {
  generateAIText,
  generateWithGemini,
  generateWithMinimax,
  isMinimaxEnabled,
  chooseProviderOrder,
};
