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

const generateText = async (prompt, options = {}) => generateAIText(prompt, options);

const generateAssistantReply = async (payload) => generateAIText(buildAssistantPrompt(payload), {
  includeProvider: true,
  temperature: 0.45,
  maxOutputTokens: 1800,
});

const isAIConfigurationError = (error) => error?.code === 'AI_NOT_CONFIGURED';

const buildAIUnavailableMessage = () => 'AI chưa được cấu hình. Kiểm tra GEMINI_API_KEY trong backend/.env.';

const buildDescriptionFallback = ({ title, numericPrice, area, address, city, amenityList }) => {
  const details = [
    `${title} tại ${address}${city ? `, ${city}` : ''}`,
    `giá thuê ${numericPrice.toLocaleString('vi-VN')} VNĐ/tháng`,
    area ? `diện tích ${area} m²` : null,
    amenityList.length ? `có ${amenityList.slice(0, 4).join(', ')}` : null,
  ].filter(Boolean);
  return `${details.join(', ')}. Thông tin được tổng hợp từ dữ liệu tin đăng, phù hợp để người thuê liên hệ xem phòng và xác nhận thực tế trước khi quyết định.`;
};

const isUsableDescription = (text) => {
  const normalized = String(text || '').trim();
  return normalized.length >= 120 && /[.!?。]$/.test(normalized);
};

const normalizeListingAnalysis = (analysis, fallbackSummary) => ({
  score: Math.max(0, Math.min(100, Number(analysis?.score) || 70)),
  status: ['ready', 'needs_work'].includes(analysis?.status) ? analysis.status : 'needs_work',
  summary: String(analysis?.summary || fallbackSummary || 'Tin đăng cần được kiểm tra thêm trước khi gửi duyệt.'),
  strengths: Array.isArray(analysis?.strengths) ? analysis.strengths : [],
  issues: Array.isArray(analysis?.issues) ? analysis.issues : [],
  suggestions: Array.isArray(analysis?.suggestions) ? analysis.suggestions : [],
  missing_fields: Array.isArray(analysis?.missing_fields) ? analysis.missing_fields : [],
  risk_level: ['low', 'medium', 'high'].includes(analysis?.risk_level) ? analysis.risk_level : 'medium',
});

const buildListingAnalysisFallback = ({ title, numericPrice, numericArea, description, amenityList, numericImages }) => {
  const issues = [];
  const suggestions = [];
  const missingFields = [];

  if (!description || description.trim().length < 80) {
    issues.push('Mô tả còn ngắn, người thuê khó đánh giá phòng trước khi liên hệ.');
    suggestions.push('Bổ sung mô tả về vị trí, nội thất, chi phí phát sinh và nội quy.');
    missingFields.push('description');
  }
  if (!numericArea) {
    issues.push('Chưa có diện tích phòng rõ ràng.');
    suggestions.push('Thêm diện tích m² để người thuê so sánh dễ hơn.');
    missingFields.push('area');
  }
  if (!amenityList.length) {
    issues.push('Chưa có tiện ích nổi bật.');
    suggestions.push('Chọn các tiện ích thật sự có như WiFi, chỗ để xe, máy lạnh, bếp.');
    missingFields.push('amenities');
  }
  if (!numericImages || numericImages < 3) {
    issues.push('Số lượng ảnh còn ít.');
    suggestions.push('Nên có ít nhất 3 ảnh thật: toàn cảnh, khu vệ sinh/bếp và lối vào.');
    missingFields.push('images');
  }

  const score = Math.max(45, 90 - issues.length * 10);
  return normalizeListingAnalysis({
    score,
    status: issues.length <= 1 ? 'ready' : 'needs_work',
    summary: `${title} có giá ${numericPrice.toLocaleString('vi-VN')} VNĐ/tháng${numericArea ? `, diện tích ${numericArea} m²` : ''}. ${issues.length ? 'Tin còn vài điểm nên bổ sung trước khi duyệt.' : 'Tin đăng đã khá rõ ràng.'}`,
    strengths: ['Có tiêu đề, địa chỉ và giá thuê cơ bản.'],
    issues,
    suggestions,
    missing_fields: missingFields,
    risk_level: issues.length >= 3 ? 'high' : issues.length >= 1 ? 'medium' : 'low',
  });
};

const normalizeReviewSummary = (summary, fallbackText) => ({
  overall_tone: ['positive', 'mixed', 'negative'].includes(summary?.overall_tone) ? summary.overall_tone : 'mixed',
  summary: String(summary?.summary || fallbackText || 'Chưa đủ dữ liệu để kết luận chắc chắn.'),
  pros: Array.isArray(summary?.pros) ? summary.pros : [],
  cons: Array.isArray(summary?.cons) ? summary.cons : [],
  risks: Array.isArray(summary?.risks) ? summary.risks : [],
  recommendation: String(summary?.recommendation || 'Nên đọc kỹ từng review và xác nhận thêm khi liên hệ.'),
  confidence: ['low', 'medium', 'high'].includes(summary?.confidence) ? summary.confidence : 'low',
});

const buildReviewSummaryFallback = (reviewList) => {
  const ratings = reviewList.map(review => safeNumber(review.rating)).filter(Number.isFinite);
  const average = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null;
  const pros = reviewList.filter(review => safeNumber(review.rating) >= 4 && review.comment).slice(0, 3).map(review => review.comment.trim());
  const cons = reviewList.filter(review => safeNumber(review.rating) <= 3 && review.comment).slice(0, 3).map(review => review.comment.trim());

  return normalizeReviewSummary({
    overall_tone: average === null ? 'mixed' : average >= 4 ? 'positive' : average <= 2.5 ? 'negative' : 'mixed',
    summary: average === null
      ? `Có ${reviewList.length} review nhưng thiếu điểm số rõ ràng.`
      : `Điểm trung bình khoảng ${Math.round(average * 10) / 10}/5 từ ${reviewList.length} review.`,
    pros,
    cons,
    risks: cons,
    recommendation: reviewList.length < 3
      ? 'Review còn ít, nên hỏi thêm chủ nhà và kiểm tra phòng trực tiếp.'
      : 'Có thể dùng review làm tín hiệu tham khảo, nhưng vẫn nên xác nhận tình trạng thực tế.',
    confidence: reviewList.length >= 5 ? 'medium' : 'low',
  });
};

/**
 * @desc AI: Sinh mô tả phòng trọ từ thông tin cơ bản
 * @route POST /api/ai/generate-description
 * @access Private (Landlord)
 */
const generateDescription = async (req, res) => {
  try {
    const { title, price, area, address, city, amenities = [] } = req.body;
    const {
      deposit_amount,
      electricity_price,
      water_price,
      internet_fee,
      parking_fee,
      service_fee,
      payment_cycle,
      is_owner_occupied,
      has_private_hours,
      allow_cooking,
      allow_pets,
      allow_visitors,
      has_parking,
      max_occupants,
      house_rules,
    } = req.body;
    const numericPrice = safeNumber(price);

    if (!title || !numericPrice || !address) {
      return res.status(400).json({ error: 'Cần cung cấp: title, price, address.' });
    }

    const amenityList = normalizeList(amenities);
    const prompt = buildDescriptionPrompt({
      title,
      numericPrice,
      area,
      address,
      city,
      amenityList,
      costs: {
        deposit_amount,
        electricity_price,
        water_price,
        internet_fee,
        parking_fee,
        service_fee,
        payment_cycle,
      },
      rules: {
        is_owner_occupied,
        has_private_hours,
        allow_cooking,
        allow_pets,
        allow_visitors,
        has_parking,
        max_occupants,
        house_rules,
      },
    });

    const description = await generateText(prompt, { temperature: 0.65, maxOutputTokens: 700 });
    if (!isUsableDescription(description)) {
      return res.status(200).json({
        description: buildDescriptionFallback({ title, numericPrice, area, address, city, amenityList }),
        provider: 'fallback',
      });
    }
    return res.status(200).json({ description, provider: 'gemini' });
  } catch (err) {
    console.error('AI Error:', err.message);
    if (isAIConfigurationError(err)) {
      return res.status(503).json({ error: buildAIUnavailableMessage() });
    }
    const numericPrice = safeNumber(req.body?.price);
    if (req.body?.title && numericPrice && req.body?.address) {
      return res.status(200).json({
        description: buildDescriptionFallback({
          title: req.body.title,
          numericPrice,
          area: req.body.area,
          address: req.body.address,
          city: req.body.city,
          amenityList: normalizeList(req.body.amenities),
        }),
        provider: 'fallback',
      });
    }
    return res.status(err.status || 502).json({ error: 'AI tạm thời không phản hồi. Vui lòng thử lại sau.' });
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
      deposit_amount,
      electricity_price,
      water_price,
      internet_fee,
      parking_fee,
      service_fee,
      payment_cycle,
      is_owner_occupied,
      has_private_hours,
      allow_cooking,
      allow_pets,
      allow_visitors,
      has_parking,
      max_occupants,
      house_rules,
    } = req.body;

    const numericPrice = safeNumber(price);
    if (!title || !numericPrice || !address) {
      return res.status(400).json({ error: 'Cần cung cấp: title, price, address.' });
    }

    const amenityList = normalizeList(amenities);
    const numericArea = safeNumber(area);
    const numericSlots = safeNumber(available_slots);
    const numericImages = safeNumber(image_count);
    const prompt = buildListingAnalysisPrompt({
      title,
      numericPrice,
      numericArea,
      address,
      city,
      description,
      amenityList,
      numericSlots,
      numericImages,
      costs: {
        deposit_amount,
        electricity_price,
        water_price,
        internet_fee,
        parking_fee,
        service_fee,
        payment_cycle,
      },
      rules: {
        is_owner_occupied,
        has_private_hours,
        allow_cooking,
        allow_pets,
        allow_visitors,
        has_parking,
        max_occupants,
        house_rules,
      },
    });

    const raw = await generateText(prompt, { responseMimeType: 'application/json', temperature: 0.25, maxOutputTokens: 900 });
    let analysis;
    let provider = 'gemini';
    try {
      analysis = normalizeListingAnalysis(extractJson(raw));
    } catch {
      analysis = buildListingAnalysisFallback({ title, numericPrice, numericArea, description, amenityList, numericImages });
      provider = 'fallback';
    }

    return res.status(200).json({ analysis, provider });
  } catch (err) {
    console.error('AI Error:', err.message);
    if (isAIConfigurationError(err)) {
      return res.status(503).json({ error: buildAIUnavailableMessage() });
    }
    const numericPrice = safeNumber(req.body?.price);
    if (req.body?.title && numericPrice && req.body?.address) {
      return res.status(200).json({
        analysis: buildListingAnalysisFallback({
          title: req.body.title,
          numericPrice,
          numericArea: safeNumber(req.body.area),
          description: req.body.description || '',
          amenityList: normalizeList(req.body.amenities),
          numericImages: safeNumber(req.body.image_count),
        }),
        provider: 'fallback',
      });
    }
    return res.status(err.status || 502).json({ error: 'AI tạm thời không phản hồi. Vui lòng thử lại sau.' });
  }
};

/**
 * @desc AI: Tóm tắt review và rủi ro của phòng
 * @route POST /api/ai/review-summary
 * @access Public
 */
const summarizeReviews = async (req, res) => {
  let reviewList = [];
  try {
    const {
      room_title,
      address,
      city,
      price,
      average_rating,
      reviews = [],
    } = req.body;

    reviewList = Array.isArray(reviews) ? reviews : [];
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
    }), { responseMimeType: 'application/json', temperature: 0.25, maxOutputTokens: 900 });

    let summary;
    let provider = 'gemini';
    try {
      summary = normalizeReviewSummary(extractJson(raw));
    } catch {
      summary = buildReviewSummaryFallback(reviewList);
      provider = 'fallback';
    }

    return res.status(200).json({ summary, provider });
  } catch (err) {
    console.error('AI Error:', err.message);
    if (isAIConfigurationError(err)) {
      return res.status(503).json({ error: buildAIUnavailableMessage() });
    }
    return res.status(200).json({ summary: buildReviewSummaryFallback(reviewList), provider: 'fallback' });
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
