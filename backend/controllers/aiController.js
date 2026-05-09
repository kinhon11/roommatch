const { getGeminiModel } = require('../config/geminiClient');

/**
 * @desc  AI: Sinh mô tả phòng trọ từ thông tin cơ bản
 * @route POST /api/ai/generate-description
 * @access Private (Landlord)
 */
const generateDescription = async (req, res) => {
  try {
    const { title, price, area, address, city, amenities = [] } = req.body;

    if (!title || !price || !address) {
      return res.status(400).json({ error: 'Cần cung cấp: title, price, address.' });
    }

    const model = getGeminiModel('gemini-1.5-flash');

    const amenityList = amenities.length > 0
      ? amenities.join(', ')
      : 'không có tiện ích đặc biệt';

    const prompt = `
Bạn là chuyên gia viết mô tả bất động sản cho thuê tại Việt Nam.
Hãy viết một đoạn mô tả phòng trọ hấp dẫn, chân thực bằng tiếng Việt dựa trên thông tin sau:

- Tiêu đề: ${title}
- Địa chỉ: ${address}, ${city || 'Hà Nội'}
- Giá thuê: ${parseInt(price).toLocaleString('vi-VN')} VNĐ/tháng
- Diện tích: ${area ? area + ' m²' : 'chưa cung cấp'}
- Tiện ích: ${amenityList}

Yêu cầu:
1. Viết 3-5 câu, tự nhiên, hấp dẫn người thuê
2. Nhấn mạnh vị trí, giá trị, và tiện ích nổi bật
3. KHÔNG bịa thêm thông tin không có trong dữ liệu
4. Kết thúc bằng lời kêu gọi hành động ngắn gọn
5. Chỉ trả về đoạn mô tả, không có tiêu đề hay giải thích thêm
`.trim();

    const result = await model.generateContent(prompt);
    const description = result.response.text().trim();

    return res.status(200).json({ description });
  } catch (err) {
    console.error('Gemini Error:', err.message);
    if (err.message?.includes('not configured')) {
      return res.status(503).json({ error: 'Gemini AI chưa được cấu hình. Kiểm tra GEMINI_API_KEY trong .env.' });
    }
    return res.status(500).json({ error: 'AI gặp lỗi: ' + err.message });
  }
};

module.exports = { generateDescription };
