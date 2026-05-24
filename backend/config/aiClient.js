const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const aiTimeoutMs = Number(process.env.AI_TIMEOUT_MS || 25_000);

class AIConfigurationError extends Error {
  constructor(message = 'Gemini AI is not configured.') {
    super(message);
    this.name = 'AIConfigurationError';
    this.code = 'AI_NOT_CONFIGURED';
    this.status = 503;
  }
}

class AIRuntimeError extends Error {
  constructor(message = 'Gemini AI request failed.', cause = null) {
    super(message);
    this.name = 'AIRuntimeError';
    this.code = 'AI_PROVIDER_FAILED';
    this.status = 502;
    this.cause = cause;
  }
}

if (!geminiApiKey) {
  console.warn('⚠️  GEMINI_API_KEY chưa được cấu hình. AI sẽ dùng fallback khi có thể.');
}

const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

const stripThinkBlocks = (text) => String(text || '')
  .replace(/<think>[\s\S]*?<\/think>\s*/gi, '')
  .trim();

const withTimeout = (promise, timeoutMs = aiTimeoutMs) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`AI request timed out after ${timeoutMs}ms.`)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

const generateWithGemini = async (prompt, options = {}) => {
  if (!genAI) {
    throw new AIConfigurationError();
  }

  const model = genAI.getGenerativeModel({
    model: options.modelName || geminiModel,
    generationConfig: {
      temperature: options.temperature ?? 0.55,
      topP: options.topP ?? 0.9,
      maxOutputTokens: options.maxOutputTokens || 1200,
      ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
    },
  });

  try {
    const result = await withTimeout(model.generateContent(prompt), options.timeoutMs || aiTimeoutMs);
    const text = stripThinkBlocks(result?.response?.text?.() || '');
    if (!text) {
      throw new Error('Gemini response did not include text.');
    }
    return text;
  } catch (error) {
    if (error instanceof AIConfigurationError) throw error;
    throw new AIRuntimeError('Gemini AI request failed.', error);
  }
};

const generateAIText = async (prompt, options = {}) => {
  const text = await generateWithGemini(prompt, options);
  return options.includeProvider ? { text, provider: 'gemini' } : text;
};

module.exports = {
  AIConfigurationError,
  AIRuntimeError,
  generateAIText,
  generateWithGemini,
};
