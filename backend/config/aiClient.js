const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const geminiApiKey = process.env.GEMINI_API_KEY;
const minimaxApiKey = process.env.MINIMAX_API_KEY;
const aiProvider = (process.env.AI_PROVIDER || '').toLowerCase();

if (!geminiApiKey && !minimaxApiKey) {
  console.warn('⚠️  GEMINI_API_KEY hoặc MINIMAX_API_KEY chưa được cấu hình.');
}

const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

const stripThinkBlocks = (text) => String(text || '')
  .replace(/<think>[\s\S]*?<\/think>\s*/gi, '')
  .trim();

const isMinimaxEnabled = aiProvider === 'minimax' || (!geminiApiKey && !!minimaxApiKey) || (!!minimaxApiKey && aiProvider !== 'gemini');

const generateWithGemini = async (prompt, modelName = 'gemini-1.5-flash') => {
  if (!genAI) {
    throw new Error('Gemini AI is not configured.');
  }
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
};

const generateWithMinimax = async (prompt, modelName = 'MiniMax-M2.7') => {
  if (!minimaxApiKey) {
    throw new Error('MiniMax AI is not configured.');
  }

  const response = await fetch('https://api.minimaxi.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${minimaxApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('MiniMax response did not include content.');
  }
  return stripThinkBlocks(content);
};

const generateAIText = async (prompt, options = {}) => {
  const modelName = options.modelName;
  if (isMinimaxEnabled) {
    return generateWithMinimax(prompt, modelName || 'MiniMax-M2.7');
  }
  return generateWithGemini(prompt, modelName || 'gemini-1.5-flash');
};

module.exports = {
  generateAIText,
  generateWithGemini,
  generateWithMinimax,
  isMinimaxEnabled,
};
