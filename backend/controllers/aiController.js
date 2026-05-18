const { generateAIText } = require('../config/aiClient');

const DEFAULT_MODEL = process.env.AI_PROVIDER === 'minimax' || process.env.MINIMAX_API_KEY
  ? 'MiniMax-M2.7'
  : 'gemini-1.5-flash';

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeList = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
    .filter(Boolean);
};

const extractJson = (text) => {
  const cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI returned non-JSON content.');
  }

  return JSON.parse(cleaned.slice(start, end + 1));
};

const generateText = async (prompt, modelName = DEFAULT_MODEL) => generateAIText(prompt, { modelName });

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

    const amenityList = normalizeList(amenities);
    const prompt = `
Bạn là chuyên gia viết mô tả bất động sản cho thuê tại Việt Nam.
Hãy viết một đoạn mô tả phòng trọ hấp dẫn, chân thật bằng tiếng Việt dựa trên thông tin sau:

- Tiêu đề: ${title}
- Địa chỉ: ${address}, ${city || 'Hà Nội'}
- Giá thuê: ${numericPrice.toLocaleString('vi-VN')} VNĐ/tháng
- Diện tích: ${area ? `${area} m²` : 'chưa cung cấp'}
- Tiện ích: ${amenityList.length > 0 ? amenityList.join(', ') : 'không có tiện ích đặc biệt'}

Yêu cầu:
1. Viết 3-5 câu, tự nhiên, hấp dẫn người thuê
2. Nhấn mạnh vị trí, giá trị, và tiện ích nổi bật
3. KHÔNG bịa thêm thông tin không có trong dữ liệu
4. Kết thúc bằng lời kêu gọi hành động ngắn gọn
5. Chỉ trả về đoạn mô tả, không có tiêu đề hay giải thích thêm
`.trim();

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

    const amenityList = normalizeList(amenities);
    const numericArea = safeNumber(area);
    const numericSlots = safeNumber(available_slots);
    const numericImages = safeNumber(image_count);

    const prompt = `
Bạn là chuyên gia thẩm định tin đăng phòng trọ tại Việt Nam.
Hãy đánh giá tin đăng bên dưới và trả về DUY NHẤT một JSON hợp lệ theo schema:
{
  "score": number,
  "status": "ready" | "needs_work",
  "summary": string,
  "strengths": string[],
  "issues": string[],
  "suggestions": string[],
  "missing_fields": string[],
  "risk_level": "low" | "medium" | "high"
}

Quy tắc:
- Chỉ dùng dữ liệu đầu vào, không tự bịa
- Nếu tin còn thiếu ảnh, mô tả, diện tích hoặc tiện ích thì hãy nêu rõ trong issues/suggestions
- score từ 0 đến 100
- status = "ready" nếu tin đã đủ rõ ràng để đăng, ngược lại "needs_work"

Dữ liệu:
- Tiêu đề: ${title}
- Địa chỉ: ${address}, ${city || 'Hà Nội'}
- Giá thuê: ${numericPrice.toLocaleString('vi-VN')} VNĐ/tháng
- Diện tích: ${numericArea ? `${numericArea} m²` : 'chưa cung cấp'}
- Mô tả: ${description ? description : 'chưa có mô tả'}
- Tiện ích: ${amenityList.length > 0 ? amenityList.join(', ') : 'chưa có tiện ích'}
- Số chỗ ở ghép: ${numericSlots !== null ? numericSlots : 'chưa rõ'}
- Số ảnh: ${numericImages !== null ? numericImages : 'chưa rõ'}

Hãy viết ngắn gọn, thực tế, ưu tiên những góp ý có thể hành động ngay.
`.trim();

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

    const prompt = `
Bạn là trợ lý phân tích review phòng trọ tại Việt Nam.
Hãy đọc các review bên dưới và trả về DUY NHẤT một JSON hợp lệ theo schema:
{
  "overall_tone": "positive" | "mixed" | "negative",
  "summary": string,
  "pros": string[],
  "cons": string[],
  "risks": string[],
  "recommendation": string,
  "confidence": "low" | "medium" | "high"
}

Quy tắc:
- Chỉ dựa trên review đã cho, không thêm thông tin ngoài dữ liệu
- Nếu review ít hoặc ngắn thì confidence phải là "low" hoặc "medium"
- risks là các cảnh báo thực dụng như ồn, giá cao, phản hồi chậm, hoặc nội dung lặp lại nhiều
- recommendation phải ngắn, rõ, giúp người xem quyết định nhanh

Thông tin phòng:
- Tên phòng: ${room_title || 'Chưa có tên'}
- Địa chỉ: ${address || 'Chưa có địa chỉ'}, ${city || 'Chưa rõ'}
- Giá thuê: ${price ? `${Number(price).toLocaleString('vi-VN')} VNĐ/tháng` : 'Chưa rõ'}
- Điểm trung bình: ${average_rating || 'Chưa có'}

Review:
${reviewList.slice(0, 20).map((review, index) => {
  const rating = review?.rating ?? 'N/A';
  const comment = (review?.comment || '').trim() || 'Không có bình luận';
  return `${index + 1}. ${rating}/5 - ${comment}`;
}).join('\n')}

Chỉ trả về JSON, không markdown, không giải thích thêm.
`.trim();

    const raw = await generateText(prompt);
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

module.exports = {
  generateDescription,
  analyzeListing,
  summarizeReviews,
};
