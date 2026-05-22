const { summarizeRooms } = require('./assistantUtils');

const buildCostSummary = (costs = {}) => {
  const items = [
    ['Tiền cọc', costs.deposit_amount ? `${Number(costs.deposit_amount).toLocaleString('vi-VN')} VNĐ` : null],
    ['Điện', costs.electricity_price ? `${Number(costs.electricity_price).toLocaleString('vi-VN')} VNĐ/kWh` : null],
    ['Nước', costs.water_price ? `${Number(costs.water_price).toLocaleString('vi-VN')} VNĐ` : null],
    ['Wifi', costs.internet_fee ? `${Number(costs.internet_fee).toLocaleString('vi-VN')} VNĐ/tháng` : null],
    ['Gửi xe', costs.parking_fee ? `${Number(costs.parking_fee).toLocaleString('vi-VN')} VNĐ/tháng` : null],
    ['Dịch vụ', costs.service_fee ? `${Number(costs.service_fee).toLocaleString('vi-VN')} VNĐ/tháng` : null],
    ['Chu kỳ thanh toán', costs.payment_cycle || null],
  ].filter(([, value]) => value);
  return items.length ? items.map(([label, value]) => `${label}: ${value}`).join('; ') : 'chưa cung cấp';
};

const buildRuleSummary = (rules = {}) => {
  const items = [
    rules.is_owner_occupied === true ? 'chung chủ' : 'không chung chủ',
    rules.has_private_hours === true ? 'giờ giấc tự do' : 'có quy định giờ giấc',
    rules.allow_cooking === true ? 'cho nấu ăn' : 'không cho nấu ăn',
    rules.allow_pets === true ? 'cho nuôi thú cưng' : 'không cho nuôi thú cưng',
    rules.allow_visitors === true ? 'cho tiếp khách' : 'hạn chế tiếp khách',
    rules.has_parking === true ? 'có chỗ để xe' : 'chưa rõ chỗ để xe',
    rules.max_occupants ? `tối đa ${rules.max_occupants} người` : null,
    rules.house_rules ? `nội quy thêm: ${rules.house_rules}` : null,
  ].filter(Boolean);
  return items.length ? items.join('; ') : 'chưa cung cấp';
};

const buildDescriptionPrompt = ({ title, numericPrice, area, address, city, amenityList, costs, rules }) => `
Bạn là chuyên gia viết mô tả bất động sản cho thuê tại Việt Nam.
Hãy viết một đoạn mô tả phòng trọ hấp dẫn, chân thật bằng tiếng Việt dựa trên thông tin sau:

- Tiêu đề: ${title}
- Địa chỉ: ${address}, ${city || 'Hà Nội'}
- Giá thuê: ${numericPrice.toLocaleString('vi-VN')} VNĐ/tháng
- Diện tích: ${area ? `${area} m²` : 'chưa cung cấp'}
- Tiện ích: ${amenityList.length > 0 ? amenityList.join(', ') : 'không có tiện ích đặc biệt'}
- Chi phí khác: ${buildCostSummary(costs)}
- Nội quy: ${buildRuleSummary(rules)}

Yêu cầu:
1. Viết 3-5 câu, tự nhiên, hấp dẫn người thuê
2. Nhấn mạnh vị trí, giá trị, và tiện ích nổi bật
3. KHÔNG bịa thêm thông tin không có trong dữ liệu
4. Kết thúc bằng lời kêu gọi hành động ngắn gọn
5. Chỉ trả về đoạn mô tả, không có tiêu đề hay giải thích thêm
`.trim();

const buildListingAnalysisPrompt = ({
  title,
  numericPrice,
  numericArea,
  address,
  city,
  description,
  amenityList,
  numericSlots,
  numericImages,
  costs,
  rules,
}) => `
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
- Chi phí khác: ${buildCostSummary(costs)}
- Nội quy: ${buildRuleSummary(rules)}

Hãy viết ngắn gọn, thực tế, ưu tiên những góp ý có thể hành động ngay.
`.trim();

const buildReviewSummaryPrompt = ({ room_title, address, city, price, average_rating, reviewList }) => `
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

const buildAssistantPrompt = ({ message, user, criteria, rooms, conversation, context, profile, intent, toolResults = [] }) => `
Bạn là trợ lý AI riêng của RoommieMatch.
Mục tiêu của bạn là: hiểu đúng nhu cầu, dùng dữ liệu thật trong hệ thống, và trả lời ngắn gọn nhưng hữu ích.

Quy tắc:
1. Ưu tiên trả lời theo ý định của người dùng: hướng dẫn sử dụng, tìm phòng, so sánh, hoặc phân tích phòng đang xem.
2. Nếu có dữ liệu phòng thật, hãy gợi ý theo thứ tự phù hợp nhất và giải thích vì sao phù hợp.
3. Nếu người dùng đang ở trang chi tiết một phòng, hãy bám sát phòng đó trước khi gợi ý phòng khác.
4. Không bịa thông tin không có trong dữ liệu.
5. Nếu điều kiện còn quá rộng hoặc kết quả chưa đủ tốt, hãy nói rõ cách nới bộ lọc.
6. Giọng văn thân thiện, rõ ràng, thực tế. Chia 2-5 ý ngắn là đủ.

Thông tin người dùng:
- Vai trò: ${user?.role || 'guest'}
- Tên: ${user?.full_name || 'Chưa rõ'}

Ý định được đoán:
${intent}

Ngữ cảnh hiện tại:
${JSON.stringify(context || {}, null, 2)}

Hồ sơ sở thích:
${JSON.stringify(profile || {}, null, 2)}

Tiêu chí đã đoán:
${JSON.stringify(criteria, null, 2)}

Phòng đang gợi ý:
${JSON.stringify(summarizeRooms(rooms), null, 2)}

Kết quả tool router:
${JSON.stringify(toolResults, null, 2)}

Ngữ cảnh hội thoại gần đây:
${JSON.stringify(conversation.slice(-8), null, 2)}

Câu hỏi người dùng:
${message}

Hãy ưu tiên:
- nếu intent là usage thì trả lời hướng dẫn ngắn gọn;
- nếu intent là room_detail hoặc compare thì nhận xét trực tiếp trên phòng đang xem;
- nếu tool router có summarizeReviews thì nêu rõ review có điểm mù hoặc rủi ro nào;
- nếu tool router có compareRooms thì chỉ so sánh theo dữ liệu có thật: giá, diện tích, khu vực, tiện ích;
- nếu có rooms phù hợp thì mở đầu bằng kết luận ngắn, sau đó liệt kê 2-4 phòng tốt nhất và nêu lý do phù hợp;
- nếu không có phòng đủ tốt, nói rõ cần nới điều kiện nào.
Không dùng markdown nặng; chỉ dùng xuống dòng hoặc gạch đầu dòng nhẹ.
`.trim();

module.exports = {
  buildAssistantPrompt,
  buildDescriptionPrompt,
  buildListingAnalysisPrompt,
  buildReviewSummaryPrompt,
};
