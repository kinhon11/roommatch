const { generateAIText } = require('../config/aiClient');
const {
  buildAssistantPrompt,
  buildDescriptionPrompt,
  buildListingAnalysisPrompt,
  buildReviewSummaryPrompt,
} = require('../services/ai/aiPromptBuilder');
const {
  buildFallbackReply,
  buildFollowUpPrompts,
  buildPreferenceProfile,
  buildPreferenceSummary,
  buildUsageGuide,
  detectAssistantIntent,
  loadAssistantSignals,
} = require('../services/ai/assistantContextService');
const { routeAssistantTools } = require('../services/ai/assistantToolRouter');
const {
  extractJson,
  normalizeList,
  safeNumber,
} = require('../services/ai/assistantUtils');

const generateText = async (prompt, modelName) => generateAIText(prompt, { modelName });

const generateAssistantReply = async (payload) => generateAIText(buildAssistantPrompt(payload), { includeProvider: true });

/**
 * @desc AI: Sinh mô tả phòng trọ từ thông tin cơ bản
 * @route POST /api/ai/generate-description
 * @access Private (Landlord)
 */
const generateDescription = async (req, res) => {
  try {
    const { title, price, area, address, city, amenities = [] } = req.body;
    const numericPrice = safeNumber(price);

    if (!title || !numericPrice || !address) {
      return res.status(400).json({ error: 'Cần cung cấp: title, price, address.' });
    }

    const prompt = buildDescriptionPrompt({
      title,
      numericPrice,
      area,
      address,
      city,
      amenityList: normalizeList(amenities),
    });

    const description = await generateText(prompt);
    return res.status(200).json({ description });
  } catch (err) {
    console.error('AI Error:', err.message);
    if (err.message?.includes('not configured')) {
      return res.status(503).json({ error: 'AI chưa được cấu hình. Kiểm tra GEMINI_API_KEY hoặc MINIMAX_API_KEY trong backend/.env.' });
    }
    return res.status(500).json({ error: 'AI gặp lỗi: ' + err.message });
  }
};

/**
 * @desc AI: Phân tích chất lượng tin đăng
 * @route POST /api/ai/analyze-listing
 * @access Private (Landlord/Admin)
 */
const analyzeListing = async (req, res) => {
  try {
    const {
      title,
      price,
      area,
      address,
      city,
      description = '',
      amenities = [],
      available_slots,
      image_count,
    } = req.body;

    const numericPrice = safeNumber(price);
    if (!title || !numericPrice || !address) {
      return res.status(400).json({ error: 'Cần cung cấp: title, price, address.' });
    }

    const prompt = buildListingAnalysisPrompt({
      title,
      numericPrice,
      numericArea: safeNumber(area),
      address,
      city,
      description,
      amenityList: normalizeList(amenities),
      numericSlots: safeNumber(available_slots),
      numericImages: safeNumber(image_count),
    });

    const raw = await generateText(prompt);
    let analysis;
    try {
      analysis = extractJson(raw);
    } catch {
      analysis = {
        score: 70,
        status: 'needs_work',
        summary: raw,
        strengths: [],
        issues: ['Không thể phân tích JSON từ AI, trả về nội dung thô.'],
        suggestions: [],
        missing_fields: [],
        risk_level: 'medium',
      };
    }

    return res.status(200).json({ analysis });
  } catch (err) {
    console.error('AI Error:', err.message);
    if (err.message?.includes('not configured')) {
      return res.status(503).json({ error: 'AI chưa được cấu hình. Kiểm tra GEMINI_API_KEY hoặc MINIMAX_API_KEY trong backend/.env.' });
    }
    return res.status(500).json({ error: 'AI gặp lỗi: ' + err.message });
  }
};

/**
 * @desc AI: Tóm tắt review và rủi ro của phòng
 * @route POST /api/ai/review-summary
 * @access Public
 */
const summarizeReviews = async (req, res) => {
  try {
    const {
      room_title,
      address,
      city,
      price,
      average_rating,
      reviews = [],
    } = req.body;

    const reviewList = Array.isArray(reviews) ? reviews : [];
    if (reviewList.length === 0) {
      return res.status(400).json({ error: 'Cần ít nhất một review để tóm tắt.' });
    }

    const raw = await generateText(buildReviewSummaryPrompt({
      room_title,
      address,
      city,
      price,
      average_rating,
      reviewList,
    }));

    let summary;
    try {
      summary = extractJson(raw);
    } catch {
      summary = {
        overall_tone: 'mixed',
        summary: raw,
        pros: [],
        cons: [],
        risks: [],
        recommendation: 'Không thể phân tích JSON từ AI, hãy xem nội dung thô ở phần tóm tắt.',
        confidence: 'low',
      };
    }

    return res.status(200).json({ summary });
  } catch (err) {
    console.error('AI Error:', err.message);
    if (err.message?.includes('not configured')) {
      return res.status(503).json({ error: 'AI chưa được cấu hình. Kiểm tra GEMINI_API_KEY hoặc MINIMAX_API_KEY trong backend/.env.' });
    }
    return res.status(500).json({ error: 'AI gặp lỗi: ' + err.message });
  }
};

/**
 * @desc AI: Trợ lý tìm phòng và hướng dẫn sử dụng app
 * @route POST /api/ai/assistant
 * @access Private
 */
const assistantChat = async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    const conversation = Array.isArray(req.body?.conversation) ? req.body.conversation : [];
    const context = req.body?.context || {};

    if (!message) {
      return res.status(400).json({ error: 'Vui lòng nhập nội dung để hỏi trợ lý.' });
    }

    const intent = detectAssistantIntent(message, context);
    const assistantSignals = await loadAssistantSignals(req.user?.id);
    const profile = buildPreferenceProfile(assistantSignals);
    const {
      criteria: searchCriteria,
      rooms,
      toolResults,
      selectedTools,
    } = await routeAssistantTools({ message, context, profile, intent, user: req.user });
    const followUpPrompts = buildFollowUpPrompts({
      intent,
      profile,
      currentRoom: context?.current_room || null,
    });
    const preferenceSummary = buildPreferenceSummary(profile);

    let reply = '';
    let provider = 'fallback';
    try {
      const assistantResult = await generateAssistantReply({
        message,
        user: req.user,
        criteria: searchCriteria,
        rooms,
        conversation,
        context,
        profile,
        intent,
        toolResults,
      });
      reply = assistantResult.text;
      provider = assistantResult.provider;
    } catch (error) {
      console.warn('AI assistant fallback:', error.message);
      reply = buildFallbackReply({
        message,
        role: req.user?.role,
        searchCriteria,
        rooms,
      });
    }

    return res.status(200).json({
      reply,
      rooms,
      criteria: searchCriteria,
      provider,
      intent,
      tools: selectedTools,
      tool_results: toolResults,
      profile_summary: preferenceSummary,
      follow_up_prompts: followUpPrompts,
      usage_tip: buildUsageGuide(req.user?.role),
    });
  } catch (err) {
    console.error('AI Error:', err.message);
    return res.status(500).json({ error: 'AI gặp lỗi: ' + err.message });
  }
};

module.exports = {
  generateDescription,
  analyzeListing,
  summarizeReviews,
  assistantChat,
};
