const supabase = require('../config/supabaseClient');
const { generateAIText } = require('../config/aiClient');
const { getGeminiModel } = require('../config/geminiClient');

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

const cityCatalog = [
  'Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Huế', 'Nha Trang',
  'Biên Hòa', 'Vũng Tàu', 'Bình Dương', 'Đồng Nai', 'Long An', 'Bắc Ninh', 'Hưng Yên',
];

const amenitySynonyms = [
  { key: 'wifi', patterns: ['wifi', 'internet'] },
  { key: 'máy lạnh', patterns: ['máy lạnh', 'điều hòa', 'điều hoà'] },
  { key: 'nóng lạnh', patterns: ['nóng lạnh', 'bình nóng', 'water heater'] },
  { key: 'bếp', patterns: ['bếp', 'nấu ăn'] },
  { key: 'ban công', patterns: ['ban công', 'balcony'] },
  { key: 'thang máy', patterns: ['thang máy', 'elevator'] },
  { key: 'máy giặt', patterns: ['máy giặt', 'giặt'] },
  { key: 'chỗ để xe', patterns: ['để xe', 'giữ xe', 'parking', 'chỗ để xe'] },
  { key: 'an ninh', patterns: ['an ninh', 'camera', 'bảo vệ'] },
  { key: 'ở ghép', patterns: ['ở ghép', 'share', 'share room', 'ghép'] },
];

const usageKeywords = [
  'cách dùng', 'hướng dẫn', 'sử dụng', 'làm sao', 'đặt lịch', 'nhắn tin',
  'yêu thích', 'ở ghép', 'cọc', 'báo cáo', 'đánh giá', 'đăng tin', 'sửa phòng',
];

const searchKeywords = [
  'phòng', 'tìm', 'giá', 'quận', 'huyện', 'khu vực', 'có', 'cần', 'muốn', 'lọc',
  'gần', 'rẻ', 'tiện ích', 'trọ', 'thuê',
];

const extractJson = (text) => {
  const cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI returned non-JSON content.');
  }

  return JSON.parse(cleaned.slice(start, end + 1));
};

const extractPriceBounds = (message) => {
  const text = message.toLowerCase().replace(/\s+/g, ' ');
  const maxMatch = text.match(/(?:dưới|tối đa|max|không quá|<=|<)\s*(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|m|k)?/i)
    || text.match(/(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|m)\s*(?:trở xuống|đổ xuống|đến|hoặc thấp hơn)/i);
  const minMatch = text.match(/(?:trên|từ|tối thiểu|>=|>)\s*(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|m|k)?/i);

  const toNumber = (value) => Number(String(value).replace(',', '.'));
  const max = maxMatch ? toNumber(maxMatch[1]) * 1_000_000 : null;
  const min = minMatch ? toNumber(minMatch[1]) * 1_000_000 : null;
  return { min, max };
};

const extractAreaBounds = (message) => {
  const text = message.toLowerCase();
  const maxMatch = text.match(/(?:dưới|tối đa|không quá|<=|<)\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m²|m)/i);
  const minMatch = text.match(/(?:trên|từ|tối thiểu|>=|>)\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m²|m)/i);
  const toNumber = (value) => Number(String(value).replace(',', '.'));
  return {
    min: minMatch ? toNumber(minMatch[1]) : null,
    max: maxMatch ? toNumber(maxMatch[1]) : null,
  };
};

const detectCity = (message) => {
  const lower = message.toLowerCase();
  const match = cityCatalog.find(city => lower.includes(city.toLowerCase()))
    || (lower.includes('hcm') ? 'Hồ Chí Minh' : null)
    || (lower.includes('sài gòn') ? 'Hồ Chí Minh' : null);
  return match || null;
};

const detectAmenities = async (message) => {
  const lower = message.toLowerCase();
  try {
    const { data } = await supabase.from('amenities').select('id, name, icon');
    const allAmenities = Array.isArray(data) ? data : [];

    const detected = allAmenities.filter((amenity) => {
      const name = (amenity.name || '').toLowerCase();
      return amenitySynonyms.some(({ key, patterns }) => {
        const matchedPattern = patterns.some(pattern => lower.includes(pattern));
        return matchedPattern && (name.includes(key) || lower.includes(name));
      });
    });

    return detected;
  } catch {
    return [];
  }
};

const isUsageQuestion = (message) => usageKeywords.some(keyword => message.toLowerCase().includes(keyword));
const isSearchQuestion = (message) => searchKeywords.some(keyword => message.toLowerCase().includes(keyword));

const buildUsageGuide = (role = 'tenant') => {
  const common = [
    'Bạn có thể dùng mục Tìm phòng để lọc theo giá, thành phố, diện tích và tiện ích.',
    'Vào chi tiết phòng để xem ảnh, review, thông tin chủ nhà và nhắn tin nhanh.',
    'Bạn có thể bấm Yêu thích để lưu lại phòng, đặt lịch hẹn và gửi yêu cầu ở ghép nếu cần.',
  ];

  const landlord = [
    'Landlord có thể đăng tin ở mục Đăng tin, chỉnh sửa ảnh, cập nhật tình trạng phòng và theo dõi phòng của mình.',
    'Nên dùng AI kiểm tra tin đăng trước khi gửi duyệt để tăng khả năng được chấp nhận nhanh.',
  ];

  const admin = [
    'Admin có thể duyệt phòng, xử lý báo cáo và kiểm soát chất lượng tin đăng.',
  ];

  const roleMap = { landlord, admin };
  return [...common, ...(roleMap[role] || [])].join(' ');
};

const buildFallbackReply = ({ message, role, searchCriteria, rooms }) => {
  const parts = [];
  if (isUsageQuestion(message)) {
    parts.push(buildUsageGuide(role));
  }

  if (rooms.length > 0) {
    const intro = searchCriteria.city || searchCriteria.maxPrice || searchCriteria.minPrice || searchCriteria.amenities.length
      ? 'Mình đã lọc được một vài phòng phù hợp với yêu cầu của bạn:'
      : 'Mình gợi ý một số phòng nổi bật hiện có:';
    parts.push(intro);
    rooms.slice(0, 3).forEach((room, index) => {
      parts.push(`${index + 1}. ${room.title} - ${Number(room.price).toLocaleString('vi-VN')} VNĐ/tháng, ${room.address}, ${room.city}${room.area ? `, ${room.area} m²` : ''}.`);
    });
    parts.push('Nếu bạn muốn, mình có thể lọc sâu hơn theo giá, khu vực hoặc tiện ích.');
  } else if (isSearchQuestion(message)) {
    parts.push('Mình chưa tìm được phòng khớp hoàn toàn với yêu cầu này. Bạn thử nới giá hoặc đổi khu vực nhé.');
  }

  if (!parts.length) {
    parts.push('Mình có thể giúp bạn tìm phòng theo giá, khu vực, tiện ích, hướng dẫn dùng app, hoặc gợi ý phòng phù hợp từ dữ liệu hiện có. Hãy nói nhu cầu của bạn thật cụ thể nhé.');
  }

  return parts.join('\n\n');
};

const buildSearchCriteria = async (message, context = {}) => {
  const rawMessage = String(message || '').trim();
  const { min: priceMin, max: priceMax } = extractPriceBounds(rawMessage);
  const { min: areaMin, max: areaMax } = extractAreaBounds(rawMessage);
  const city = context.city || detectCity(rawMessage);
  const detectedAmenities = await detectAmenities(rawMessage);
  const hasSlots = /ở ghép|share|ghép|roommate/i.test(rawMessage);

  const searchTerms = rawMessage
    .replace(/(?:dưới|tối đa|không quá|trên|từ|tối thiểu)\s*\d+(?:[.,]\d+)?\s*(?:triệu|tr|m|m2|m²|k)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    city,
    priceMin,
    priceMax,
    areaMin,
    areaMax,
    amenities: detectedAmenities,
    hasSlots,
    searchTerms,
  };
};

const searchRoomsByCriteria = async (criteria, limit = 6) => {
  let query = supabase
    .from('rooms')
    .select(`
      id, title, price, address, city, area, available_slots, created_at,
      room_images (id, image_url, is_primary),
      room_amenities (amenities (id, name, icon))
    `)
    .eq('status', 'approved')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(limit * 3);

  if (criteria.city) query = query.ilike('city', `%${criteria.city}%`);
  if (criteria.priceMin) query = query.gte('price', criteria.priceMin);
  if (criteria.priceMax) query = query.lte('price', criteria.priceMax);
  if (criteria.areaMin) query = query.gte('area', criteria.areaMin);
  if (criteria.areaMax) query = query.lte('area', criteria.areaMax);
  if (criteria.hasSlots) query = query.gt('available_slots', 0);
  if (criteria.searchTerms) query = query.or(`title.ilike.%${criteria.searchTerms}%,address.ilike.%${criteria.searchTerms}%`);

  const { data, error } = await query;
  if (error) throw error;

  let rooms = data || [];
  if (criteria.amenities.length > 0) {
    const wanted = criteria.amenities.map(item => item.name.toLowerCase());
    rooms = rooms.filter((room) => {
      const roomAmenities = (room.room_amenities || [])
        .map(ra => ra.amenities?.name?.toLowerCase())
        .filter(Boolean);
      return wanted.every(name => roomAmenities.includes(name));
    });
  }

  return rooms.slice(0, limit).map(room => ({
    id: room.id,
    title: room.title,
    price: room.price,
    address: room.address,
    city: room.city,
    area: room.area,
    available_slots: room.available_slots,
    image_url: room.room_images?.find(img => img.is_primary)?.image_url || room.room_images?.[0]?.image_url || null,
    amenities: (room.room_amenities || []).map(ra => ra.amenities?.name).filter(Boolean),
  }));
};

const generateGeminiAssistantReply = async ({ message, user, criteria, rooms, conversation }) => {
  const model = getGeminiModel('gemini-1.5-flash');
  const prompt = `
Bạn là trợ lý RoommieMatch, một hướng dẫn viên tìm phòng bằng tiếng Việt, thân thiện, thực tế, ngắn gọn.

Nhiệm vụ:
1. Giải thích cách dùng app nếu người dùng hỏi cách sử dụng.
2. Nếu người dùng đang tìm phòng, ưu tiên gợi ý từ dữ liệu phòng thật bên dưới.
3. Không bịa thêm thông tin không có trong dữ liệu.
4. Nếu phòng phù hợp ít, nói rõ là cần nới điều kiện.
5. Trả lời dễ hiểu, theo kiểu hỗ trợ nhanh.

Thông tin người dùng:
- Vai trò: ${user?.role || 'guest'}
- Tên: ${user?.full_name || 'Chưa rõ'}

Tiêu chí đã đoán:
${JSON.stringify(criteria, null, 2)}

Phòng phù hợp từ Supabase:
${JSON.stringify(rooms, null, 2)}

Ngữ cảnh hội thoại gần đây:
${JSON.stringify(conversation.slice(-6), null, 2)}

Câu hỏi người dùng:
${message}

Hãy trả về một đoạn trả lời hoàn chỉnh bằng tiếng Việt, có thể dùng xuống dòng để dễ đọc, nhưng không dùng markdown quá nặng.
`.trim();

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
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

    const searchCriteria = await buildSearchCriteria(message, context);
    const rooms = await searchRoomsByCriteria(searchCriteria, 5);

    let reply = '';
    let provider = 'fallback';
    try {
      reply = await generateGeminiAssistantReply({
        message,
        user: req.user,
        criteria: searchCriteria,
        rooms,
        conversation,
      });
      provider = 'gemini';
    } catch (error) {
      console.warn('Gemini assistant fallback:', error.message);
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
