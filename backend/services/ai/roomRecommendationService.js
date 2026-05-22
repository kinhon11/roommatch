const supabase = require("../../config/supabaseClient");
const { safeNumber } = require("./assistantUtils");

const cityCatalog = [
  "Hà Nội",
  "Hồ Chí Minh",
  "Đà Nẵng",
  "Hải Phòng",
  "Cần Thơ",
  "Huế",
  "Nha Trang",
  "Biên Hòa",
  "Vũng Tàu",
  "Bình Dương",
  "Đồng Nai",
  "Long An",
  "Bắc Ninh",
  "Hưng Yên",
];

const amenitySynonyms = [
  { key: "wifi", patterns: ["wifi", "internet"] },
  { key: "máy lạnh", patterns: ["máy lạnh", "điều hòa", "điều hoà"] },
  { key: "nóng lạnh", patterns: ["nóng lạnh", "bình nóng", "water heater"] },
  { key: "bếp", patterns: ["bếp", "nấu ăn"] },
  { key: "ban công", patterns: ["ban công", "balcony"] },
  { key: "thang máy", patterns: ["thang máy", "elevator"] },
  { key: "máy giặt", patterns: ["máy giặt", "giặt"] },
  { key: "chỗ để xe", patterns: ["để xe", "giữ xe", "parking", "chỗ để xe"] },
  { key: "an ninh", patterns: ["an ninh", "camera", "bảo vệ"] },
  { key: "ở ghép", patterns: ["ở ghép", "share", "share room", "ghép"] },
];

const extractPriceBounds = (message) => {
  const text = message.toLowerCase().replace(/\s+/g, " ");
  const maxMatch =
    text.match(
      /(?:dưới|tối đa|max|không quá|<=|<)\s*(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|m|k)?/i,
    ) ||
    text.match(
      /(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|m)\s*(?:trở xuống|đổ xuống|đến|hoặc thấp hơn)/i,
    );
  const minMatch = text.match(
    /(?:trên|từ|tối thiểu|>=|>)\s*(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|m|k)?/i,
  );

  const toNumber = (value) => Number(String(value).replace(",", "."));
  const max = maxMatch ? toNumber(maxMatch[1]) * 1_000_000 : null;
  const min = minMatch ? toNumber(minMatch[1]) * 1_000_000 : null;
  return { min, max };
};

const extractAreaBounds = (message) => {
  const text = message.toLowerCase();
  const maxMatch = text.match(
    /(?:dưới|tối đa|không quá|<=|<)\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m²|m)/i,
  );
  const minMatch = text.match(
    /(?:trên|từ|tối thiểu|>=|>)\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m²|m)/i,
  );
  const toNumber = (value) => Number(String(value).replace(",", "."));
  return {
    min: minMatch ? toNumber(minMatch[1]) : null,
    max: maxMatch ? toNumber(maxMatch[1]) : null,
  };
};

const detectCity = (message) => {
  const lower = message.toLowerCase();
  const match =
    cityCatalog.find((city) => lower.includes(city.toLowerCase())) ||
    (lower.includes("hcm") ? "Hồ Chí Minh" : null) ||
    (lower.includes("sài gòn") ? "Hồ Chí Minh" : null);
  return match || null;
};

const detectAmenities = async (message) => {
  const lower = message.toLowerCase();
  try {
    const { data } = await supabase.from("amenities").select("id, name, icon");
    const allAmenities = Array.isArray(data) ? data : [];

    return allAmenities.filter((amenity) => {
      const name = (amenity.name || "").toLowerCase();
      return amenitySynonyms.some(({ key, patterns }) => {
        const matchedPattern = patterns.some((pattern) =>
          lower.includes(pattern),
        );
        return matchedPattern && (name.includes(key) || lower.includes(name));
      });
    });
  } catch {
    return [];
  }
};

const buildSearchCriteria = async (
  message,
  context = {},
  profile = null,
  intent = "general",
) => {
  const rawMessage = String(message || "").trim();
  const { min: priceMin, max: priceMax } = extractPriceBounds(rawMessage);
  const { min: areaMin, max: areaMax } = extractAreaBounds(rawMessage);
  const detectedCity = context.city || detectCity(rawMessage);
  const detectedAmenities = await detectAmenities(rawMessage);
  const hasSlots = /ở ghép|share|ghép|roommate/i.test(rawMessage);
  const currentRoom = context?.current_room || null;
  const wantsCurrentRoom =
    intent === "room_detail" ||
    intent === "compare" ||
    /phòng này|tương tự|xung quanh|cùng khu vực/i.test(rawMessage);

  const looseSearchTerms = rawMessage
    .replace(
      /(?:dưới|tối đa|max|không quá|trên|từ|tối thiểu)\s*\d+(?:[.,]\d+)?\s*(?:triệu|tr|m|m2|m²|k)?/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  const hasStructuredCriteria = Boolean(
    priceMin ||
    priceMax ||
    areaMin ||
    areaMax ||
    detectedCity ||
    detectedAmenities.length ||
    hasSlots,
  );
  const searchTerms =
    hasStructuredCriteria || looseSearchTerms.length > 48
      ? ""
      : looseSearchTerms;

  const city =
    detectedCity ||
    (wantsCurrentRoom ? currentRoom?.city : null) ||
    (intent === "search" ? profile?.top_cities?.[0]?.key || null : null);

  const roomPrice = safeNumber(currentRoom?.price);
  const roomArea = safeNumber(currentRoom?.area);

  return {
    city,
    priceMin:
      priceMin ||
      (wantsCurrentRoom && roomPrice !== null
        ? Math.max(0, Math.floor(roomPrice * 0.75))
        : null),
    priceMax:
      priceMax ||
      (wantsCurrentRoom && roomPrice !== null
        ? Math.ceil(roomPrice * 1.25)
        : null),
    areaMin:
      areaMin ||
      (wantsCurrentRoom && roomArea !== null
        ? Math.max(0, Math.floor(roomArea * 0.75))
        : null),
    areaMax:
      areaMax ||
      (wantsCurrentRoom && roomArea !== null
        ? Math.ceil(roomArea * 1.25)
        : null),
    amenities: detectedAmenities,
    hasSlots,
    searchTerms,
    currentRoomId: currentRoom?.id || null,
    intent,
  };
};

const scoreRoomMatch = (room, criteria, profile, context) => {
  const currentRoom = context?.current_room || null;
  const roomPrice = safeNumber(room.price);
  const roomArea = safeNumber(room.area);
  const roomSlots = safeNumber(room.available_slots);
  const roomAmenities = (room.amenities || [])
    .map((value) =>
      String(value || "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
  const reasons = [];
  let score = 0;

  if (
    criteria.city &&
    String(room.city || "")
      .toLowerCase()
      .includes(String(criteria.city).toLowerCase())
  ) {
    score += 30;
    reasons.push("cùng khu vực " + room.city);
  }

  if (
    criteria.priceMax &&
    roomPrice !== null &&
    roomPrice <= criteria.priceMax
  ) {
    score += 20;
    reasons.push(
      "giá trong ngưỡng " + criteria.priceMax.toLocaleString("vi-VN") + " VNĐ",
    );
  }
  if (
    criteria.priceMin &&
    roomPrice !== null &&
    roomPrice >= criteria.priceMin
  ) {
    score += 8;
  }

  if (criteria.areaMin && roomArea !== null && roomArea >= criteria.areaMin)
    score += 5;
  if (criteria.areaMax && roomArea !== null && roomArea <= criteria.areaMax)
    score += 5;

  if (criteria.hasSlots && roomSlots > 0) {
    score += 16;
    reasons.push("còn chỗ ở ghép");
  }

  if (criteria.amenities?.length) {
    const wanted = criteria.amenities.map((item) =>
      String(item.name || "")
        .trim()
        .toLowerCase(),
    );
    const matched = wanted.filter((name) => roomAmenities.includes(name));
    if (matched.length) {
      score += matched.length * 10;
      reasons.push("có " + matched.slice(0, 2).join(", "));
    }
  }

  if (profile?.has_profile) {
    const preferredCity = profile.top_cities?.[0]?.key;
    if (
      preferredCity &&
      String(room.city || "")
        .toLowerCase()
        .includes(String(preferredCity).toLowerCase())
    ) {
      score += 12;
    }

    if (profile.price_stats && roomPrice !== null) {
      const center =
        profile.price_stats.median || profile.price_stats.average || roomPrice;
      const gap = Math.abs(roomPrice - center);
      const tolerance = Math.max(250000, center * 0.35);
      if (gap <= tolerance) {
        score += 12;
        reasons.push("mức giá gần thói quen của bạn");
      }
    }

    const preferredAmenities =
      profile.top_amenities
        ?.map((item) =>
          String(item.key || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean) || [];
    const matchedPreferredAmenities = preferredAmenities.filter((name) =>
      roomAmenities.includes(name),
    );
    if (matchedPreferredAmenities.length)
      score += matchedPreferredAmenities.length * 4;

    if (profile.prefers_roommate && roomSlots > 0) score += 6;
  }

  if (currentRoom?.id && room.id === currentRoom.id) {
    score += 100;
    reasons.push("đúng phòng bạn đang xem");
  }

  if (criteria.searchTerms) {
    const roomText = `${room.title || ""} ${room.address || ""}`.toLowerCase();
    if (roomText.includes(criteria.searchTerms.toLowerCase())) {
      score += 20;
      reasons.push("khớp từ khóa bạn nhập");
    }
  }

  if (room.is_available === false) score -= 20;

  return { score, reasons };
};

const searchRoomsByCriteria = async (
  criteria,
  limit = 6,
  profile = null,
  context = null,
) => {
  const runQuery = async (nextCriteria, queryLimit = limit * 4) => {
    let query = supabase
      .from("rooms")
      .select(
        "id, title, price, address, city, area, available_slots, created_at, is_available, room_images (id, image_url, is_primary), room_amenities (amenities (id, name, icon))",
      )
      .eq("status", "approved")
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(queryLimit);

    if (nextCriteria.city)
      query = query.ilike("city", `%${nextCriteria.city}%`);
    if (nextCriteria.priceMin)
      query = query.gte("price", nextCriteria.priceMin);
    if (nextCriteria.priceMax)
      query = query.lte("price", nextCriteria.priceMax);
    if (nextCriteria.areaMin) query = query.gte("area", nextCriteria.areaMin);
    if (nextCriteria.areaMax) query = query.lte("area", nextCriteria.areaMax);
    if (nextCriteria.hasSlots) query = query.gt("available_slots", 0);
    if (nextCriteria.searchTerms)
      query = query.or(
        `title.ilike.%${nextCriteria.searchTerms}%,address.ilike.%${nextCriteria.searchTerms}%`,
      );

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  let rooms = await runQuery(criteria);
  if (criteria.amenities.length > 0 && rooms.length > 0) {
    const wanted = criteria.amenities.map((item) => item.name.toLowerCase());
    const strictAmenityMatches = rooms.filter((room) => {
      const roomAmenities = (room.room_amenities || [])
        .map((ra) => ra.amenities?.name?.toLowerCase())
        .filter(Boolean);
      return wanted.every((name) => roomAmenities.includes(name));
    });
    if (strictAmenityMatches.length > 0) rooms = strictAmenityMatches;
  }

  if (
    rooms.length === 0 &&
    (criteria.priceMax ||
      criteria.areaMax ||
      criteria.hasSlots ||
      criteria.searchTerms)
  ) {
    rooms = await runQuery(
      {
        ...criteria,
        priceMax: criteria.priceMax ? Math.ceil(criteria.priceMax * 1.2) : null,
        areaMax: null,
        hasSlots: false,
        searchTerms: "",
      },
      limit * 6,
    );
  }

  if (rooms.length === 0 && criteria.city) {
    rooms = await runQuery(
      {
        ...criteria,
        priceMin: null,
        priceMax: null,
        areaMin: null,
        areaMax: null,
        hasSlots: false,
        searchTerms: "",
      },
      limit * 6,
    );
  }

  return rooms
    .map((room) => {
      const amenities = (room.room_amenities || [])
        .map((ra) => ra.amenities?.name)
        .filter(Boolean);
      const scoreResult = scoreRoomMatch(
        { ...room, amenities },
        criteria,
        profile,
        context,
      );

      return {
        id: room.id,
        title: room.title,
        price: room.price,
        address: room.address,
        city: room.city,
        area: room.area,
        available_slots: room.available_slots,
        created_at: room.created_at,
        image_url:
          room.room_images?.find((img) => img.is_primary)?.image_url ||
          room.room_images?.[0]?.image_url ||
          null,
        amenities,
        match_score: scoreResult.score,
        match_reason: scoreResult.reasons.slice(0, 3).join(" • "),
      };
    })
    .sort(
      (left, right) =>
        right.match_score - left.match_score ||
        new Date(right.created_at || 0) - new Date(left.created_at || 0),
    )
    .slice(0, limit);
};

module.exports = {
  buildSearchCriteria,
  searchRoomsByCriteria,
};
