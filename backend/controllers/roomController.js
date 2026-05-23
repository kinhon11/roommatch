const supabase = require('../config/supabaseClient');
const { logActivity } = require('../utils/activityLogger');

const APPROVAL_HISTORY_SELECT = `
  id, from_status, to_status, reason, created_at,
  admin:users!room_approval_history_admin_id_fkey (id, full_name, email)
`;

const normalizeSlots = (value, fallback = 1) => {
  const slots = Number(value);
  if (!Number.isInteger(slots) || slots < 0) return fallback;
  return slots;
};

const parseNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return Boolean(value);
};

const canManageRoom = (user, room) => (
  user?.role === 'admin' || room?.host_id === user?.id || room?.broker_id === user?.id
);

const buildRoomPayload = (body, fallbackSlots = 1) => {
  const slots = normalizeSlots(body.available_slots, fallbackSlots);
  return {
    title: body.title?.trim(),
    description: body.description?.trim() || null,
    price: parseNumber(body.price),
    deposit_amount: parseNumber(body.deposit_amount),
    electricity_price: parseNumber(body.electricity_price),
    water_price: parseNumber(body.water_price),
    internet_fee: parseNumber(body.internet_fee),
    parking_fee: parseNumber(body.parking_fee),
    service_fee: parseNumber(body.service_fee),
    payment_cycle: body.payment_cycle || 'monthly',
    address: body.address?.trim(),
    city: body.city?.trim(),
    area: parseNumber(body.area),
    available_slots: slots,
    is_available: slots > 0,
    is_owner_occupied: parseBoolean(body.is_owner_occupied),
    has_private_hours: parseBoolean(body.has_private_hours, true),
    allow_cooking: parseBoolean(body.allow_cooking, true),
    allow_pets: parseBoolean(body.allow_pets),
    allow_visitors: parseBoolean(body.allow_visitors, true),
    has_parking: parseBoolean(body.has_parking),
    max_occupants: parseNumber(body.max_occupants),
    house_rules: body.house_rules?.trim() || null,
  };
};

const validateRoomPayload = (payload) => {
  if (!payload.title) return 'Tiêu đề phòng là bắt buộc.';
  if (!payload.address) return 'Địa chỉ phòng là bắt buộc.';
  if (!payload.city) return 'Tỉnh / thành phố là bắt buộc.';
  if (!payload.price || payload.price <= 0) return 'Giá thuê phải lớn hơn 0.';
  if (payload.area !== null && payload.area < 0) return 'Diện tích không hợp lệ.';
  const costFields = [
    payload.deposit_amount,
    payload.electricity_price,
    payload.water_price,
    payload.internet_fee,
    payload.parking_fee,
    payload.service_fee,
  ];
  if (costFields.some(value => value !== null && value < 0)) return 'Các khoản phí không được âm.';
  if (!['monthly', 'quarterly', 'negotiable'].includes(payload.payment_cycle)) return 'Chu kỳ thanh toán không hợp lệ.';
  if (payload.max_occupants !== null && (!Number.isInteger(payload.max_occupants) || payload.max_occupants <= 0)) {
    return 'Số người ở tối đa phải là số nguyên lớn hơn 0.';
  }
  return null;
};

/**
 * @desc  Get all approved rooms (public) — with advanced filters
 * @route GET /api/rooms
 */
const getApprovedRooms = async (req, res) => {
  try {
    const {
      price_min, price_max, city, search,
      area_min, area_max,
      amenities: amenityFilter,  // comma-separated amenity names
      sort = 'newest',
      has_slots,  // "true" = chỉ phòng còn chỗ ở ghép
      no_owner, private_hours, allow_pets, has_parking,
      page = 1, limit = 12,
    } = req.query;

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 12;
    const from = (pageNumber - 1) * limitNumber;
    const to   = pageNumber * limitNumber - 1;

    let allowedRoomIds = null;
    if (amenityFilter) {
      const wantedAmenities = amenityFilter
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);

      if (!wantedAmenities.length) {
        return res.status(200).json({
          rooms: [],
          total: 0,
          page: pageNumber,
          limit: limitNumber,
        });
      }

      const { data: amenityRows, error: amenityErr } = await supabase
        .from('room_amenities')
        .select('room_id, amenities(name)')
        .in('amenities.name', wantedAmenities);

      if (amenityErr) return res.status(500).json({ error: amenityErr.message });

      const roomToAmenities = new Map();
      (amenityRows || []).forEach((row) => {
        const roomId = row.room_id;
        const name = row.amenities?.name?.toLowerCase();
        if (!roomId || !name) return;
        if (!roomToAmenities.has(roomId)) roomToAmenities.set(roomId, new Set());
        roomToAmenities.get(roomId).add(name);
      });

      allowedRoomIds = Array.from(roomToAmenities.entries())
        .filter(([, names]) => wantedAmenities.every(amenity => names.has(amenity)))
        .map(([roomId]) => roomId);

      if (!allowedRoomIds.length) {
        return res.status(200).json({
          rooms: [],
          total: 0,
          page: pageNumber,
          limit: limitNumber,
        });
      }
    }

    let query = supabase
      .from('rooms')
      .select(`
        *,
        users:users!rooms_host_id_fkey (id, full_name, avatar_url, phone, contact_email, zalo, facebook_url, contact_hours),
        broker:users!rooms_broker_id_fkey (id, full_name, avatar_url, phone, contact_email, zalo, facebook_url, contact_hours),
        room_images (image_url, is_primary),
        room_amenities (amenities (id, name, icon))
      `, { count: 'exact' })
      .eq('status', 'approved')
      .eq('is_hidden', false)
      .eq('is_available', true)
      .gt('available_slots', 0);

    if (sort === 'price_asc') {
      query = query.order('price', { ascending: true });
    } else if (sort === 'price_desc') {
      query = query.order('price', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    if (price_min) query = query.gte('price', Number(price_min));
    if (price_max) query = query.lte('price', Number(price_max));
    if (area_min)  query = query.gte('area', Number(area_min));
    if (area_max)  query = query.lte('area', Number(area_max));
    if (city)      query = query.ilike('city', `%${city}%`);
    if (search)    query = query.or(`title.ilike.%${search}%,address.ilike.%${search}%`);
    if (has_slots === 'true') query = query.gt('available_slots', 0);
    if (no_owner === 'true') query = query.eq('is_owner_occupied', false);
    if (private_hours === 'true') query = query.eq('has_private_hours', true);
    if (allow_pets === 'true') query = query.eq('allow_pets', true);
    if (has_parking === 'true') query = query.eq('has_parking', true);
    if (allowedRoomIds) query = query.in('id', allowedRoomIds);

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      rooms: data || [],
      total: count ?? (data || []).length,
      page: pageNumber,
      limit: limitNumber,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Get single room by ID (public)
 * @route GET /api/rooms/:id
 */
const getRoomById = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select(`
        *,
        users:users!rooms_host_id_fkey (id, full_name, avatar_url, phone, contact_email, zalo, facebook_url, contact_hours, is_verified, created_at),
        broker:users!rooms_broker_id_fkey (id, full_name, avatar_url, phone, contact_email, zalo, facebook_url, contact_hours, is_verified, created_at),
        room_images (id, image_url, is_primary),
        room_amenities (amenities (id, name, icon)),
        reviews (id, user_id, rating, comment, is_hidden, landlord_response, landlord_responded_at, created_at, updated_at, users!reviews_user_id_fkey (full_name, avatar_url))
      `)
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Không tìm thấy phòng.' });
    const isPublic = data.status === 'approved' && data.is_hidden !== true;
    const canViewPrivate = req.user && canManageRoom(req.user, data);
    if (!isPublic && !canViewPrivate) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    data.reviews = (data.reviews || []).filter(review => review.is_hidden !== true);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Get similar rooms (rule-based)
 * @route GET /api/rooms/:id/similar
 */
const getSimilarRooms = async (req, res) => {
  try {
    // Get current room info
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('id, city, price, room_amenities (amenities (id, name))')
      .eq('id', req.params.id)
      .single();

    if (roomErr || !room) return res.status(404).json({ error: 'Phòng không tồn tại.' });

    const priceRange = 0.3; // ±30% price
    const minPrice = Math.floor(room.price * (1 - priceRange));
    const maxPrice = Math.ceil(room.price * (1 + priceRange));

    const { data: similar, error } = await supabase
      .from('rooms')
      .select(`
        id, title, price, deposit_amount, address, city, area, available_slots,
        is_owner_occupied, has_private_hours, allow_pets, has_parking,
        room_images (image_url, is_primary),
        room_amenities (amenities (id, name, icon))
      `)
      .eq('status', 'approved')
      .eq('is_hidden', false)
      .eq('is_available', true)
      .gt('available_slots', 0)
      .neq('id', room.id)
      .eq('city', room.city)
      .gte('price', minPrice)
      .lte('price', maxPrice)
      .limit(6)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(similar || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Create a new room (Landlord only - status: pending)
 * @route POST /api/rooms
 */
const createRoom = async (req, res) => {
  try {
    const { amenity_ids } = req.body;
    const roomPayload = buildRoomPayload(req.body, 1);
    const validationError = validateRoomPayload(roomPayload);
    if (validationError) return res.status(400).json({ error: validationError });

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        host_id: req.user.id,
        ...roomPayload,
        status: 'pending', // Default: cần Admin duyệt
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Insert amenities if provided
    if (amenity_ids && amenity_ids.length > 0) {
      const amenityLinks = amenity_ids.map((amenityId) => ({
        room_id: room.id,
        amenity_id: amenityId,
      }));
      await supabase.from('room_amenities').insert(amenityLinks);
    }

    return res.status(201).json({ message: 'Đăng tin thành công! Đang chờ Admin duyệt.', room });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Update room (Landlord - own room only)
 * @route PUT /api/rooms/:id
 */
const updateRoom = async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from('rooms').select('host_id, available_slots').eq('id', req.params.id).single();

    if (!existing || existing.host_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa phòng này.' });
    }

    const { amenity_ids } = req.body;
    const roomFields = buildRoomPayload(req.body, existing.available_slots || 0);
    const validationError = validateRoomPayload(roomFields);
    if (validationError) return res.status(400).json({ error: validationError });

    const { data, error } = await supabase
      .from('rooms')
      .update({ ...roomFields, status: 'pending', updated_at: new Date() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Update amenities if provided
    if (amenity_ids && Array.isArray(amenity_ids)) {
      // Delete old amenities
      await supabase.from('room_amenities').delete().eq('room_id', req.params.id);
      // Insert new
      if (amenity_ids.length > 0) {
        const amenityLinks = amenity_ids.map((amenityId) => ({
          room_id: req.params.id,
          amenity_id: amenityId,
        }));
        await supabase.from('room_amenities').insert(amenityLinks);
      }
    }

    return res.status(200).json({ message: 'Cập nhật thành công. Đang chờ duyệt lại.', room: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Toggle room visibility (Landlord - own room)
 * @route PATCH /api/rooms/:id/toggle-hidden
 */
const toggleRoomHidden = async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from('rooms').select('host_id, broker_id, is_hidden').eq('id', req.params.id).single();

    if (!existing || !canManageRoom(req.user, existing)) {
      return res.status(403).json({ error: 'Bạn không có quyền thay đổi phòng này.' });
    }

    const newHidden = !existing.is_hidden;
    const { data, error } = await supabase
      .from('rooms')
      .update({ is_hidden: newHidden })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    await logActivity({
      actorId: req.user.id,
      action: newHidden ? 'room_hidden' : 'room_unhidden',
      targetType: 'room',
      targetId: req.params.id,
      oldValue: { is_hidden: existing.is_hidden },
      newValue: { is_hidden: newHidden },
    });
    return res.status(200).json({
      message: newHidden ? 'Đã ẩn phòng.' : 'Đã hiện phòng.',
      room: data,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Toggle room availability (Landlord - own room)
 * @route PATCH /api/rooms/:id/toggle-available
 */
const toggleRoomAvailable = async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from('rooms').select('host_id, broker_id, is_available, available_slots, last_available_slots').eq('id', req.params.id).single();

    if (!existing || !canManageRoom(req.user, existing)) {
      return res.status(403).json({ error: 'Bạn không có quyền thay đổi phòng này.' });
    }

    const { available_slots } = req.body;
    const newAvail = !existing.is_available;
    const updateFields = {};

    if (newAvail) {
      const slots = normalizeSlots(available_slots, existing.last_available_slots || existing.available_slots || 0);
      if (slots <= 0) {
        return res.status(400).json({ error: 'C?n nh?p s? slot m?i l?n h?n 0 khi m? l?i ph?ng.' });
      }
      updateFields.is_available = true;
      updateFields.available_slots = slots;
      updateFields.last_available_slots = slots;
    } else {
      updateFields.is_available = false;
      updateFields.last_available_slots = existing.available_slots > 0 ? existing.available_slots : existing.last_available_slots;
      updateFields.available_slots = 0;
    }

    const { data, error } = await supabase
      .from('rooms')
      .update(updateFields)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    await logActivity({
      actorId: req.user.id,
      action: newAvail ? 'room_marked_available' : 'room_marked_full',
      targetType: 'room',
      targetId: req.params.id,
      oldValue: { is_available: existing.is_available, available_slots: existing.available_slots },
      newValue: { is_available: data.is_available, available_slots: data.available_slots },
    });
    return res.status(200).json({
      message: newAvail ? 'Đã mở nhận khách.' : 'Đã đánh dấu hết phòng.',
      room: data,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Delete room
 * @route DELETE /api/rooms/:id
 */
const deleteRoom = async (req, res) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('rooms')
      .select('host_id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    if (req.user.role === 'broker' || (req.user.role !== 'admin' && existing.host_id !== req.user.id)) {
      return res.status(403).json({ error: 'You do not have permission to delete this room.' });
    }

    const { error } = await supabase.from('rooms').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'Xóa phòng thành công.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Get landlord's own rooms
 * @route GET /api/rooms/my/listings
 */
const getMyRooms = async (req, res) => {
  try {
    let query = supabase
      .from('rooms')
      .select(`*, users:users!rooms_host_id_fkey (full_name, email), broker:users!rooms_broker_id_fkey (id, full_name, email, phone), room_images (image_url, is_primary), room_approval_history (${APPROVAL_HISTORY_SELECT})`)
      .order('created_at', { ascending: false })
      .order('created_at', { foreignTable: 'room_approval_history', ascending: false });

    query = req.user.role === 'broker'
      ? query.eq('broker_id', req.user.id)
      : query.eq('host_id', req.user.id);

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Admin: Approve or Reject a room
 * @route PATCH /api/rooms/:id/status
 */
const updateRoomStatus = async (req, res) => {
  try {
    const { status, rejection_reason } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Status không hợp lệ.' });
    }

    const reason = rejection_reason?.trim();
    if (status === 'rejected' && !reason) {
      return res.status(400).json({ error: 'L? do t? ch?i l? b?t bu?c.' });
    }

    const { data: existing, error: existingError } = await supabase
      .from('rooms')
      .select('status')
      .eq('id', req.params.id)
      .single();

    if (existingError || !existing) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    const { data, error } = await supabase
      .from('rooms')
      .update({
        status,
        rejection_reason: status === 'rejected' ? reason : null,
        is_hidden: status === 'approved' ? false : true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    await supabase.from('room_approval_history').insert({
      room_id: req.params.id,
      admin_id: req.user.id,
      from_status: existing.status,
      to_status: status,
      reason: status === 'rejected' ? reason : null,
    });

    return res.status(200).json({ message: `Đã cập nhật trạng thái phòng thành: ${status}`, room: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Helper: Check if a tenant is eligible to review a room
 * (must have completed appointment OR accepted roommate request)
 */
const checkReviewEligibility = async (userId, roomId) => {
  // Check for completed appointment
  const { count: apptCount } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', userId)
    .eq('room_id', roomId)
    .eq('status', 'completed');

  if (apptCount && apptCount > 0) return true;

  // Check for accepted roommate request
  const { count: reqCount } = await supabase
    .from('roommate_requests')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', userId)
    .eq('room_id', roomId)
    .eq('status', 'accepted');

  if (reqCount && reqCount > 0) return true;

  return false;
};

/**
 * @desc  Check review eligibility for current user
 * @route GET /api/rooms/:id/reviews/eligibility
 */
const getReviewEligibility = async (req, res) => {
  try {
    const eligible = await checkReviewEligibility(req.user.id, req.params.id);

    // Also check if user already reviewed
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('room_id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    return res.status(200).json({
      eligible,
      already_reviewed: !!existing,
      review_id: existing?.id || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Create a review for a room (Tenant)
 * @route POST /api/rooms/:id/reviews
 */
const createReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating phải từ 1 đến 5.' });
    }

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, status, is_hidden')
      .eq('id', req.params.id)
      .single();

    if (roomError || !room) {
      return res.status(404).json({ error: 'Room not found.' });
    }
    if (room.status !== 'approved' || room.is_hidden === true) {
      return res.status(400).json({ error: 'Only visible approved rooms can be reviewed.' });
    }

    // Check eligibility: must have completed appointment OR accepted roommate request
    const eligible = await checkReviewEligibility(req.user.id, req.params.id);
    if (!eligible) {
      return res.status(403).json({
        error: 'Bạn cần có lịch hẹn hoàn thành hoặc yêu cầu ở ghép được chấp nhận để đánh giá phòng này.',
      });
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        room_id: req.params.id,
        user_id: req.user.id,
        rating: Number(rating),
        comment: comment?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Bạn đã đánh giá phòng này rồi.' });
      }
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ message: 'Đánh giá thành công!', review: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Update own review
 * @route PUT /api/rooms/:id/reviews/:reviewId
 */
const updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'Rating phải từ 1 đến 5.' });
    }

    // Verify the review exists and belongs to this user
    const { data: existing, error: fetchErr } = await supabase
      .from('reviews')
      .select('id, user_id')
      .eq('id', req.params.reviewId)
      .eq('room_id', req.params.id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Không tìm thấy đánh giá.' });
    }
    if (existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền sửa đánh giá này.' });
    }

    const updateFields = {};
    if (rating !== undefined) updateFields.rating = Number(rating);
    if (comment !== undefined) updateFields.comment = comment?.trim() || null;

    const { data, error } = await supabase
      .from('reviews')
      .update(updateFields)
      .eq('id', req.params.reviewId)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'Đã cập nhật đánh giá.', review: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Delete own review
 * @route DELETE /api/rooms/:id/reviews/:reviewId
 */
const deleteReview = async (req, res) => {
  try {
    // Verify the review exists and belongs to this user
    const { data: existing, error: fetchErr } = await supabase
      .from('reviews')
      .select('id, user_id')
      .eq('id', req.params.reviewId)
      .eq('room_id', req.params.id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Không tìm thấy đánh giá.' });
    }
    if (existing.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bạn không có quyền xóa đánh giá này.' });
    }
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', req.params.reviewId);

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'Đã xóa đánh giá.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Admin hides or shows a review
 * @route PATCH /api/rooms/:id/reviews/:reviewId/moderation
 */
const moderateReview = async (req, res) => {
  try {
    const { is_hidden, hidden_reason } = req.body;
    const hide = is_hidden === true;
    const reason = hidden_reason?.trim();

    if (hide && !reason) {
      return res.status(400).json({ error: 'L? do ?n review l? b?t bu?c.' });
    }

    const { data, error } = await supabase
      .from('reviews')
      .update({
        is_hidden: hide,
        hidden_reason: hide ? reason : null,
        hidden_at: hide ? new Date().toISOString() : null,
        hidden_by: hide ? req.user.id : null,
      })
      .eq('id', req.params.reviewId)
      .eq('room_id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: hide ? 'Da an review.' : 'Da hien review.', review: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Landlord responds to a review on own room
 * @route PATCH /api/rooms/:id/reviews/:reviewId/response
 */
const respondToReview = async (req, res) => {
  try {
    const response = req.body.response?.trim();
    if (!response) return res.status(400).json({ error: 'Noi dung phan hoi la bat buoc.' });

    const { data: room } = await supabase
      .from('rooms')
      .select('host_id, broker_id')
      .eq('id', req.params.id)
      .single();

    if (!room || room.host_id !== req.user.id) {
      return res.status(403).json({ error: 'B?n kh?ng c? quy?n ph?n h?i review n?y.' });
    }

    const { data, error } = await supabase
      .from('reviews')
      .update({
        landlord_response: response,
        landlord_responded_at: new Date().toISOString(),
      })
      .eq('id', req.params.reviewId)
      .eq('room_id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'Da phan hoi review.', review: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Get landlord public profile
 * @route GET /api/rooms/landlord/:id/profile
 */
const getLandlordProfile = async (req, res) => {
  try {
    const landlordId = req.params.id;

    // Get landlord info
    const { data: landlord, error: userErr } = await supabase
      .from('users')
      .select('id, full_name, avatar_url, phone, is_verified, created_at')
      .eq('id', landlordId)
      .eq('role', 'landlord')
      .single();

    if (userErr || !landlord) {
      return res.status(404).json({ error: 'Không tìm thấy chủ nhà.' });
    }

    // Get landlord's approved rooms
    const { data: rooms, error: roomErr } = await supabase
      .from('rooms')
      .select(`
        id, title, price, address, city, area, status, available_slots, is_available, created_at,
        room_images (image_url, is_primary),
        room_amenities (amenities (id, name, icon))
      `)
      .eq('host_id', landlordId)
      .eq('status', 'approved')
      .eq('is_hidden', false)
      .eq('is_available', true)
      .gt('available_slots', 0)
      .order('created_at', { ascending: false });

    if (roomErr) return res.status(500).json({ error: roomErr.message });

    // Count stats
    const { count: totalRooms } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('host_id', landlordId);

    const { count: approvedRooms } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('host_id', landlordId)
      .eq('status', 'approved');

    return res.status(200).json({
      landlord,
      rooms: rooms || [],
      stats: {
        totalRooms: totalRooms || 0,
        approvedRooms: approvedRooms || 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Upload room images (Landlord - own room)
 * @route POST /api/rooms/:id/images
 */
const uploadRoomImages = async (req, res) => {
  try {
    const roomId = req.params.id;
    const files = req.files || [];

    if (!files.length) return res.status(400).json({ error: 'Vui lòng chọn ít nhất một ảnh.' });

    const { data: room } = await supabase
      .from('rooms')
      .select('host_id')
      .eq('id', roomId)
      .single();

    if (!room || room.host_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền thêm ảnh cho phòng này.' });
    }

    const { count: existingCount } = await supabase
      .from('room_images')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);

    if ((existingCount || 0) + files.length > 6) {
      return res.status(400).json({ error: 'Mỗi phòng chỉ được tối đa 6 ảnh.' });
    }

    const uploaded = [];
    for (const [index, file] of files.entries()) {
      if (!file.mimetype?.startsWith('image/')) {
        if (uploaded.length) {
          await supabase.storage.from('room-images').remove(uploaded.map(item => item.path));
        }
        return res.status(400).json({ error: 'Chỉ hỗ trợ upload file ảnh.' });
      }

      const extension = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${roomId}/${Date.now()}-${index}-${Math.random().toString(36).slice(2)}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('room-images')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        if (uploaded.length) {
          await supabase.storage.from('room-images').remove(uploaded.map(item => item.path));
        }
        return res.status(400).json({ error: uploadError.message });
      }

      const { data: publicData } = supabase.storage.from('room-images').getPublicUrl(filePath);
      uploaded.push({
        path: filePath,
        room_id: roomId,
        image_url: publicData.publicUrl,
        is_primary: (existingCount || 0) === 0 && index === 0,
      });
    }

    const { data, error } = await supabase
      .from('room_images')
      .insert(uploaded.map(({ room_id, image_url, is_primary }) => ({ room_id, image_url, is_primary })))
      .select('id, image_url, is_primary');

    if (error) {
      await supabase.storage.from('room-images').remove(uploaded.map(item => item.path));
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ message: 'Đã upload ảnh phòng.', images: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Delete room image (Landlord - own room)
 * @route DELETE /api/rooms/:roomId/images/:imageId
 */
const deleteRoomImage = async (req, res) => {
  try {
    const { roomId, imageId } = req.params;

    // Verify ownership
    const { data: room } = await supabase
      .from('rooms').select('host_id').eq('id', roomId).single();

    if (!room || room.host_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa ảnh này.' });
    }

    const { data: image, error: imageError } = await supabase
      .from('room_images')
      .select('id, is_primary')
      .eq('id', imageId)
      .eq('room_id', roomId)
      .single();

    if (imageError || !image) {
      return res.status(404).json({ error: 'Không tìm thấy ảnh phòng.' });
    }

    const { error } = await supabase
      .from('room_images')
      .delete()
      .eq('id', imageId)
      .eq('room_id', roomId);

    if (error) return res.status(400).json({ error: error.message });
    if (image.is_primary) {
      const { data: nextImage } = await supabase
        .from('room_images')
        .select('id')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextImage?.id) {
        await supabase.from('room_images').update({ is_primary: true }).eq('id', nextImage.id);
      }
    }
    return res.status(200).json({ message: 'Đã xóa ảnh.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Set primary image (Landlord - own room)
 * @route PATCH /api/rooms/:roomId/images/:imageId/primary
 */
const setPrimaryImage = async (req, res) => {
  try {
    const { roomId, imageId } = req.params;

    // Verify ownership
    const { data: room } = await supabase
      .from('rooms').select('host_id').eq('id', roomId).single();

    if (!room || room.host_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền thay đổi ảnh này.' });
    }

    const { data: image, error: imageError } = await supabase
      .from('room_images')
      .select('id')
      .eq('id', imageId)
      .eq('room_id', roomId)
      .single();

    if (imageError || !image) {
      return res.status(404).json({ error: 'Không tìm thấy ảnh phòng.' });
    }

    // Unset all primary
    await supabase.from('room_images').update({ is_primary: false }).eq('room_id', roomId);
    // Set new primary
    const { error } = await supabase
      .from('room_images')
      .update({ is_primary: true })
      .eq('id', imageId)
      .eq('room_id', roomId);

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'Đã đặt ảnh đại diện.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getApprovedRooms, getRoomById, getSimilarRooms,
  createRoom, updateRoom, deleteRoom,
  getMyRooms, updateRoomStatus,
  createReview, updateReview, deleteReview, getReviewEligibility, moderateReview, respondToReview,
  toggleRoomHidden, toggleRoomAvailable,
  getLandlordProfile,
  uploadRoomImages, deleteRoomImage, setPrimaryImage,
};
