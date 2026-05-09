const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  console.warn('⚠️  GEMINI_API_KEY is not set. AI features will be disabled.');
}

const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

const getGeminiModel = (modelName = 'gemini-1.5-flash') => {
  if (!genAI) throw new Error('Gemini AI is not configured.');
  return genAI.getGenerativeModel({ model: modelName });
};

module.exports = { genAI, getGeminiModel };
