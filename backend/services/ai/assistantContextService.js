const supabase = require('../../config/supabaseClient');
const { safeNumber } = require('./assistantUtils');

const usageKeywords = [
  'cách dùng', 'hướng dẫn', 'sử dụng', 'làm sao', 'đặt lịch', 'nhắn tin',
  'yêu thích', 'ở ghép', 'cọc', 'báo cáo', 'đánh giá', 'đăng tin', 'sửa phòng',
];

const searchKeywords = [
  'phòng', 'tìm', 'giá', 'quận', 'huyện', 'khu vực', 'có', 'cần', 'muốn', 'lọc',
  'gần', 'rẻ', 'tiện ích', 'trọ', 'thuê',
];

const computeStats = (values = []) => {
  const numbers = values.map(safeNumber).filter(Number.isFinite);
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  const sum = numbers.reduce((total, value) => total + value, 0);

  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
    average: Math.round(sum / numbers.length),
    median: Math.round(median),
  };
};

const topEntries = (counts, limit = 3) =>
  Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));

const isUsageQuestion = (message) => usageKeywords.some(keyword => message.toLowerCase().includes(keyword));
const isSearchQuestion = (message) => searchKeywords.some(keyword => message.toLowerCase().includes(keyword));
const isComparisonQuestion = (message) => /so sánh|compare|khác nhau|nên chọn|phòng nào tốt hơn|đối chiếu/i.test(message);
const isCurrentRoomQuestion = (message, context = {}) => {
  if (!context?.current_room) return false;
  return /phòng này|phòng hiện tại|đang xem|ở đây|chi tiết|đánh giá|review|tương tự/i.test(message);
};

const detectAssistantIntent = (message, context = {}) => {
  if (isUsageQuestion(message)) return 'usage';
  if (isComparisonQuestion(message)) return 'compare';
  if (isCurrentRoomQuestion(message, context)) return 'room_detail';
  if (isSearchQuestion(message)) return 'search';
  return 'general';
};

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
    const intro = searchCriteria.city || searchCriteria.priceMax || searchCriteria.priceMin || searchCriteria.amenities.length
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

const buildPreferenceProfile = ({ favorites = [], requests = [] } = {}) => {
  const favoriteRooms = favorites.map(item => item?.rooms || item).filter(Boolean);
  const requestRooms = requests.map(item => item?.room || item).filter(Boolean);
  const allRooms = [...favoriteRooms, ...requestRooms];

  if (!allRooms.length) {
    return {
      has_profile: false,
      favorite_count: favoriteRooms.length,
      request_count: requestRooms.length,
      top_cities: [],
      top_amenities: [],
      price_stats: null,
      area_stats: null,
      prefers_roommate: requestRooms.length > 0,
    };
  }

  const cityCounts = {};
  const amenityCounts = {};
  const priceValues = [];
  const areaValues = [];
  const slotValues = [];

  for (const room of allRooms) {
    const city = String(room?.city || '').trim();
    if (city) cityCounts[city] = (cityCounts[city] || 0) + 1;

    const price = safeNumber(room?.price);
    if (price !== null) priceValues.push(price);

    const area = safeNumber(room?.area);
    if (area !== null) areaValues.push(area);

    const slots = safeNumber(room?.available_slots);
    if (slots !== null) slotValues.push(slots);

    const amenities = Array.isArray(room?.amenities)
      ? room.amenities
      : Array.isArray(room?.room_amenities)
        ? room.room_amenities.map(item => item?.amenities?.name || item?.name).filter(Boolean)
        : [];

    for (const amenity of amenities) {
      const key = String(amenity || '').trim();
      if (!key) continue;
      amenityCounts[key] = (amenityCounts[key] || 0) + 1;
    }
  }

  const slotStats = computeStats(slotValues);
  return {
    has_profile: true,
    favorite_count: favoriteRooms.length,
    request_count: requestRooms.length,
    top_cities: topEntries(cityCounts, 3),
    top_amenities: topEntries(amenityCounts, 5),
    price_stats: computeStats(priceValues),
    area_stats: computeStats(areaValues),
    slot_stats: slotStats,
    prefers_roommate: requestRooms.length > 0 || (slotStats?.average ?? 0) > 0,
  };
};

const buildPreferenceSummary = (profile) => {
  if (!profile?.has_profile) return null;

  const parts = [];
  if (profile.top_cities?.[0]) parts.push(`khu vực hay quan tâm: ${profile.top_cities[0].key}`);
  if (profile.price_stats) {
    const { min, max } = profile.price_stats;
    parts.push(`mức giá hay xem: ${min.toLocaleString('vi-VN')}-${max.toLocaleString('vi-VN')} VNĐ`);
  }
  if (profile.top_amenities?.length) {
    parts.push(`tiện ích hay chọn: ${profile.top_amenities.slice(0, 3).map(item => item.key).join(', ')}`);
  }
  if (profile.prefers_roommate) parts.push('có xu hướng quan tâm phòng còn chỗ ở ghép');

  return parts.length ? parts.join(' • ') : null;
};

const buildFollowUpPrompts = ({ intent, profile, currentRoom }) => {
  if (intent === 'usage') {
    return [
      'Cách tìm phòng nhanh nhất là gì?',
      'Tôi nên lọc phòng theo tiêu chí nào?',
      'Hướng dẫn tôi đăng phòng cho thuê',
    ];
  }

  if (currentRoom) {
    return [
      'Tóm tắt ưu nhược điểm phòng này',
      'So sánh với phòng tương tự',
      'Gợi ý phòng khác cùng khu vực',
    ];
  }

  if (profile?.has_profile) {
    return [
      'Cho tôi phòng giống sở thích của tôi',
      'Lọc chặt hơn theo giá và tiện ích',
      'Xem thêm phòng ở khu vực tôi hay tìm',
    ];
  }

  return [
    'Tìm phòng dưới 4 triệu',
    'Gợi ý phòng có wifi và máy lạnh',
    'Hướng dẫn tôi dùng app',
  ];
};

const loadAssistantSignals = async (userId) => {
  if (!userId) {
    return { favorites: [], requests: [] };
  }

  const [favoritesResult, requestsResult] = await Promise.all([
    supabase
      .from('favorites')
      .select(`
        id, created_at,
        rooms (
          id, title, price, city, address, area, available_slots, is_available,
          room_images (image_url, is_primary),
          room_amenities (amenities (name))
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('roommate_requests')
      .select(`
        id, status, created_at,
        room:rooms!room_id (
          id, title, price, city, address, area, available_slots, is_available,
          room_images (image_url, is_primary),
          room_amenities (amenities (name))
        )
      `)
      .eq('tenant_id', userId)
      .order('created_at', { ascending: false })
      .limit(12),
  ]);

  if (favoritesResult.error) {
    console.warn('AI assistant favorites load failed:', favoritesResult.error.message);
  }
  if (requestsResult.error) {
    console.warn('AI assistant requests load failed:', requestsResult.error.message);
  }

  return {
    favorites: Array.isArray(favoritesResult.data) ? favoritesResult.data : [],
    requests: Array.isArray(requestsResult.data) ? requestsResult.data : [],
  };
};

module.exports = {
  buildFallbackReply,
  buildFollowUpPrompts,
  buildPreferenceProfile,
  buildPreferenceSummary,
  buildUsageGuide,
  detectAssistantIntent,
  loadAssistantSignals,
};
