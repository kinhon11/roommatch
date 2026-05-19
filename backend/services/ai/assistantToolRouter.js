const { buildUsageGuide } = require('./assistantContextService');
const {
  buildSearchCriteria,
  searchRoomsByCriteria,
} = require('./roomRecommendationService');
const { safeNumber, summarizeRooms } = require('./assistantUtils');

const hasReviewQuestion = (message = '') => /review|đánh giá|nhận xét|uy tín|phàn nàn|khen|chê/i.test(message);

const summarizeReviewsTool = (currentRoom) => {
  const reviews = Array.isArray(currentRoom?.reviews) ? currentRoom.reviews : [];
  if (!currentRoom || reviews.length === 0) {
    return {
      room_id: currentRoom?.id || null,
      review_count: 0,
      summary: 'Chưa có đủ đánh giá để tóm tắt.',
      highlights: [],
      concerns: [],
    };
  }

  const ratings = reviews.map(review => safeNumber(review.rating)).filter(Number.isFinite);
  const average = ratings.length
    ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10
    : null;
  const highlights = reviews
    .filter(review => safeNumber(review.rating) >= 4 && review.comment)
    .slice(0, 3)
    .map(review => review.comment.trim());
  const concerns = reviews
    .filter(review => safeNumber(review.rating) <= 3 && review.comment)
    .slice(0, 3)
    .map(review => review.comment.trim());

  return {
    room_id: currentRoom.id,
    review_count: reviews.length,
    average_rating: average,
    summary: average === null
      ? 'Có đánh giá nhưng thiếu điểm số rõ ràng.'
      : `Điểm trung bình khoảng ${average}/5 từ ${reviews.length} đánh giá.`,
    highlights,
    concerns,
  };
};

const compareRoomsTool = (currentRoom, rooms = []) => {
  if (!currentRoom) {
    return {
      base_room: null,
      comparisons: summarizeRooms(rooms).slice(0, 4),
      recommendation: rooms.length ? 'Có thể so sánh các phòng gợi ý theo giá, diện tích và tiện ích.' : 'Chưa có phòng để so sánh.',
    };
  }

  const basePrice = safeNumber(currentRoom.price);
  const baseArea = safeNumber(currentRoom.area);
  const baseAmenities = new Set(
    (currentRoom.amenities || currentRoom.room_amenities || [])
      .map(item => item?.amenities?.name || item?.name || item)
      .filter(Boolean)
      .map(item => String(item).toLowerCase())
  );

  const comparisons = rooms
    .filter(room => room.id !== currentRoom.id)
    .slice(0, 4)
    .map((room) => {
      const price = safeNumber(room.price);
      const area = safeNumber(room.area);
      const amenities = new Set((room.amenities || []).map(item => String(item).toLowerCase()));
      const sharedAmenities = [...amenities].filter(name => baseAmenities.has(name));
      return {
        id: room.id,
        title: room.title,
        price: room.price,
        city: room.city,
        area: room.area,
        image_url: room.image_url,
        price_delta: price !== null && basePrice !== null ? price - basePrice : null,
        area_delta: area !== null && baseArea !== null ? area - baseArea : null,
        shared_amenities: sharedAmenities,
        match_reason: room.match_reason,
      };
    });

  const cheaper = comparisons.filter(room => room.price_delta !== null && room.price_delta < 0).length;
  const bigger = comparisons.filter(room => room.area_delta !== null && room.area_delta > 0).length;

  return {
    base_room: {
      id: currentRoom.id,
      title: currentRoom.title,
      price: currentRoom.price,
      city: currentRoom.city,
      area: currentRoom.area,
    },
    comparisons,
    recommendation: cheaper > 0
      ? `Có ${cheaper} phòng rẻ hơn phòng đang xem; nên kiểm tra vị trí và tiện ích trước khi chọn.`
      : bigger > 0
        ? `Có ${bigger} phòng rộng hơn; nên so thêm giá và khoảng cách di chuyển.`
        : 'Các phòng khá tương đồng; nên ưu tiên ảnh thật, review và phản hồi của chủ nhà.',
  };
};

const guideUserTool = (role, intent) => ({
  role: role || 'guest',
  intent,
  guide: buildUsageGuide(role),
  next_actions: [
    'Nói rõ ngân sách, khu vực và tiện ích cần có để AI lọc phòng sát hơn.',
    'Mở chi tiết một phòng rồi hỏi “phòng này có ổn không?” để AI phân tích theo ngữ cảnh.',
    'Khi đã thích phòng, hãy lưu yêu thích, nhắn tin chủ nhà hoặc đặt lịch xem phòng.',
  ],
});

const routeAssistantTools = async ({ message, context = {}, profile = null, intent = 'general', user = null }) => {
  const currentRoom = context?.current_room || null;
  const criteria = await buildSearchCriteria(message, context, profile, intent);
  const toolResults = [];
  let rooms = [];

  try {
    rooms = await searchRoomsByCriteria(criteria, 5, profile, context);
    toolResults.push({
      name: 'searchRooms',
      status: 'ok',
      criteria,
      result_count: rooms.length,
      rooms: summarizeRooms(rooms),
    });
  } catch (error) {
    toolResults.push({
      name: 'searchRooms',
      status: 'error',
      error: error.message,
      criteria,
      result_count: 0,
      rooms: [],
    });
  }

  if (intent === 'compare' || currentRoom) {
    toolResults.push({
      name: 'compareRooms',
      status: 'ok',
      ...compareRoomsTool(currentRoom, rooms),
    });
  }

  if (intent === 'room_detail' || hasReviewQuestion(message)) {
    toolResults.push({
      name: 'summarizeReviews',
      status: 'ok',
      ...summarizeReviewsTool(currentRoom),
    });
  }

  if (intent === 'usage' || intent === 'general') {
    toolResults.push({
      name: 'guideUser',
      status: 'ok',
      ...guideUserTool(user?.role, intent),
    });
  }

  return {
    criteria,
    rooms,
    toolResults,
    selectedTools: toolResults.map(tool => tool.name),
  };
};

module.exports = {
  compareRoomsTool,
  guideUserTool,
  routeAssistantTools,
  summarizeReviewsTool,
};
