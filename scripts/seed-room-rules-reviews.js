const supabase = require('../backend/config/supabaseClient');

const ruleTemplates = [
  {
    is_owner_occupied: false,
    has_private_hours: true,
    allow_cooking: true,
    allow_pets: false,
    allow_visitors: true,
    has_parking: true,
    max_occupants: 2,
    house_rules: 'Giữ yên lặng sau 22h, không hút thuốc trong phòng, khách qua đêm cần báo trước.',
  },
  {
    is_owner_occupied: false,
    has_private_hours: true,
    allow_cooking: true,
    allow_pets: true,
    allow_visitors: true,
    has_parking: true,
    max_occupants: 3,
    house_rules: 'Được nấu ăn nhẹ, giữ vệ sinh khu bếp chung, thú cưng nhỏ cần trao đổi trước.',
  },
  {
    is_owner_occupied: true,
    has_private_hours: false,
    allow_cooking: true,
    allow_pets: false,
    allow_visitors: false,
    has_parking: true,
    max_occupants: 2,
    house_rules: 'Nhà chung chủ, hạn chế về sau 23h, không tổ chức tiệc hoặc gây ồn vào buổi tối.',
  },
  {
    is_owner_occupied: false,
    has_private_hours: true,
    allow_cooking: false,
    allow_pets: false,
    allow_visitors: true,
    has_parking: false,
    max_occupants: 1,
    house_rules: 'Không nấu ăn trong phòng, không hút thuốc, ưu tiên người đi làm hoặc sinh viên ở lâu dài.',
  },
  {
    is_owner_occupied: false,
    has_private_hours: true,
    allow_cooking: true,
    allow_pets: false,
    allow_visitors: true,
    has_parking: true,
    max_occupants: 4,
    house_rules: 'Giữ vệ sinh khu sinh hoạt chung, để xe đúng vị trí, không tự ý khoan tường hoặc thay khóa.',
  },
  {
    is_owner_occupied: false,
    has_private_hours: true,
    allow_cooking: true,
    allow_pets: true,
    allow_visitors: true,
    has_parking: true,
    max_occupants: 2,
    house_rules: 'Có thể nuôi thú cưng nhỏ, không để thú cưng gây ồn, dọn vệ sinh hành lang sau khi sử dụng.',
  },
  {
    is_owner_occupied: true,
    has_private_hours: false,
    allow_cooking: false,
    allow_pets: false,
    allow_visitors: false,
    has_parking: true,
    max_occupants: 1,
    house_rules: 'Phòng phù hợp người ở một mình, hạn chế tiếp khách, tắt điện nước khi ra khỏi phòng.',
  },
  {
    is_owner_occupied: false,
    has_private_hours: true,
    allow_cooking: true,
    allow_pets: false,
    allow_visitors: true,
    has_parking: true,
    max_occupants: 3,
    house_rules: 'Tự do giờ giấc, không mở nhạc lớn sau 22h30, báo trước nếu có người thân ở lại.',
  },
  {
    is_owner_occupied: false,
    has_private_hours: true,
    allow_cooking: true,
    allow_pets: false,
    allow_visitors: false,
    has_parking: true,
    max_occupants: 2,
    house_rules: 'Không hút thuốc, không gây ồn trong giờ nghỉ trưa, đóng phí dịch vụ đúng hạn.',
  },
  {
    is_owner_occupied: false,
    has_private_hours: true,
    allow_cooking: true,
    allow_pets: true,
    allow_visitors: true,
    has_parking: true,
    max_occupants: 4,
    house_rules: 'Phù hợp nhóm bạn ở ghép, giữ trật tự khu dân cư, thú cưng cần tiêm phòng đầy đủ.',
  },
];

const reviewTemplates = [
  {
    rating: 5,
    comment: 'Phòng sạch, đúng ảnh, chủ nhà phản hồi nhanh. Khu vực đi lại thuận tiện và an ninh ổn.',
  },
  {
    rating: 4,
    comment: 'Nội thất cơ bản đầy đủ, giá hợp lý. Buổi tối hơi đông xe nhưng không quá ảnh hưởng.',
  },
  {
    rating: 5,
    comment: 'Mình rất hài lòng vì phòng thoáng, có chỗ để xe và giờ giấc khá thoải mái.',
  },
  {
    rating: 3,
    comment: 'Phòng ổn so với giá, nhưng cách âm chưa tốt. Ai ngủ sớm nên hỏi kỹ trước khi thuê.',
  },
  {
    rating: 4,
    comment: 'Khu dân cư yên tĩnh, chủ nhà hỗ trợ nhiệt tình. Điểm cộng là gần chợ và quán ăn.',
  },
  {
    rating: 5,
    comment: 'Phòng mới, vệ sinh tốt, nước mạnh. Quy định rõ ràng nên ở khá dễ chịu.',
  },
  {
    rating: 4,
    comment: 'Không gian vừa đủ cho một người, chi phí minh bạch. Mình thích phần nội quy rõ ràng.',
  },
  {
    rating: 3,
    comment: 'Phòng dùng ổn, nhưng giờ cao điểm hơi kẹt xe. Nên xem phòng vào buổi chiều để đánh giá đúng.',
  },
  {
    rating: 5,
    comment: 'Rất đáng tiền, chủ nhà thân thiện, khu vực an toàn. Có thể ở lâu dài.',
  },
  {
    rating: 4,
    comment: 'Phòng phù hợp ở ghép, tiện ích xung quanh đầy đủ. Cần giữ vệ sinh chung tốt hơn một chút.',
  },
  {
    rating: 5,
    comment: 'Môi giới tư vấn kỹ, lịch xem phòng đúng giờ. Phòng giống mô tả và không phát sinh phí lạ.',
  },
  {
    rating: 4,
    comment: 'Tổng thể hài lòng. Nếu bổ sung thêm máy giặt riêng thì sẽ hoàn thiện hơn.',
  },
];

function responseForRating(rating) {
  if (rating >= 5) return 'Cảm ơn bạn đã đánh giá tốt. Chủ nhà sẽ tiếp tục giữ chất lượng phòng ổn định.';
  if (rating === 4) return 'Cảm ơn góp ý của bạn. Chủ nhà sẽ ghi nhận để cải thiện thêm trải nghiệm thuê.';
  return null;
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function main() {
  const { data: rooms, error: roomError } = await supabase
    .from('rooms')
    .select('id, title, host_id, created_at, status, is_hidden')
    .order('created_at', { ascending: true });

  if (roomError) throw roomError;
  if (!rooms?.length) throw new Error('Không có phòng để cập nhật nội quy.');

  let roomsUpdated = 0;
  for (let i = 0; i < rooms.length; i += 1) {
    const payload = { ...ruleTemplates[i % ruleTemplates.length], updated_at: new Date().toISOString() };
    const { error } = await supabase.from('rooms').update(payload).eq('id', rooms[i].id);
    if (error) throw error;
    roomsUpdated += 1;
  }

  const { data: tenants, error: tenantError } = await supabase
    .from('users')
    .select('id, full_name, created_at')
    .eq('role', 'tenant')
    .order('created_at', { ascending: true });

  if (tenantError) throw tenantError;
  if (!tenants?.length) throw new Error('Không có tenant để tạo review.');

  const approvedRooms = rooms.filter(room => room.status === 'approved' && room.is_hidden !== true);
  if (!approvedRooms.length) throw new Error('Không có phòng approved/visible để tạo review.');

  const reviewRows = [];
  for (let i = 0; i < reviewTemplates.length; i += 1) {
    const room = approvedRooms[i % approvedRooms.length];
    let tenant = tenants[i % tenants.length];
    if (tenant.id === room.host_id && tenants.length > 1) tenant = tenants[(i + 1) % tenants.length];
    if (tenant.id === room.host_id) continue;

    const template = reviewTemplates[i];
    const createdAt = daysAgo((i % 14) + 1);
    const landlordResponse = responseForRating(template.rating);

    reviewRows.push({
      room_id: room.id,
      user_id: tenant.id,
      rating: template.rating,
      comment: template.comment,
      is_hidden: false,
      hidden_reason: null,
      hidden_at: null,
      hidden_by: null,
      landlord_response: landlordResponse,
      landlord_responded_at: landlordResponse ? daysAgo(i % 14) : null,
      created_at: createdAt,
      updated_at: new Date().toISOString(),
    });
  }

  const { data: reviews, error: reviewError } = await supabase
    .from('reviews')
    .upsert(reviewRows, { onConflict: 'room_id,user_id' })
    .select('room_id, rating, comment, room:rooms(title), user:users!reviews_user_id_fkey(full_name)');

  if (reviewError) throw reviewError;

  const { data: allReviews, error: allReviewError } = await supabase
    .from('reviews')
    .select('id, rating, comment, landlord_response')
    .order('created_at', { ascending: false });
  if (allReviewError) throw allReviewError;

  const badReviews = (allReviews || []).filter(item => /\?/.test(`${item.comment || ''} ${item.landlord_response || ''}`));
  for (let i = 0; i < badReviews.length; i += 1) {
    const template = reviewTemplates[i % reviewTemplates.length];
    const landlordResponse = responseForRating(template.rating);
    const { error } = await supabase
      .from('reviews')
      .update({
        rating: template.rating,
        comment: template.comment,
        landlord_response: landlordResponse,
        landlord_responded_at: landlordResponse ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', badReviews[i].id);
    if (error) throw error;
  }

  console.log(JSON.stringify({
    roomsUpdated,
    reviewsInsertedOrUpdated: reviews.length,
    badReviewsRepaired: badReviews.length,
    sampleRules: rooms.slice(0, 3).map((room, index) => ({
      room: room.title,
      house_rules: ruleTemplates[index % ruleTemplates.length].house_rules,
    })),
    sampleReviews: reviews.slice(0, 5).map(item => ({
      room: item.room?.title,
      user: item.user?.full_name,
      rating: item.rating,
      comment: item.comment,
    })),
  }, null, 2));
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
