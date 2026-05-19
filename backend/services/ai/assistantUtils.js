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
  const cleaned = String(text || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI returned non-JSON content.');
  }

  return JSON.parse(cleaned.slice(start, end + 1));
};

const simplifyRoomForAI = (room) => ({
  id: room?.id || null,
  title: room?.title || null,
  price: safeNumber(room?.price),
  city: room?.city || null,
  address: room?.address || null,
  area: safeNumber(room?.area),
  available_slots: safeNumber(room?.available_slots),
  status: room?.status || null,
  is_available: room?.is_available ?? null,
  amenities: Array.isArray(room?.amenities) ? room.amenities.filter(Boolean) : [],
  match_score: safeNumber(room?.match_score),
  match_reason: room?.match_reason || null,
});

const summarizeRooms = (rooms = []) => rooms
  .filter(Boolean)
  .slice(0, 5)
  .map(room => simplifyRoomForAI(room));

module.exports = {
  safeNumber,
  normalizeList,
  extractJson,
  summarizeRooms,
};
