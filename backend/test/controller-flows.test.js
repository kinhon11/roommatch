const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const path = require('node:path');

const supabasePath = path.resolve(__dirname, '../config/supabaseClient.js');
const brokerLeadSyncPath = path.resolve(__dirname, '../utils/brokerLeadSync.js');

class QueryBuilder {
  constructor(table, handler) {
    this.table = table;
    this.handler = handler;
    this.operation = 'select';
    this.filters = [];
    this.payload = undefined;
  }

  select(columns, options) {
    if (!['insert', 'update', 'upsert', 'delete'].includes(this.operation)) {
      this.operation = 'select';
    }
    this.columns = columns;
    this.options = options;
    return this;
  }

  insert(payload) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  upsert(payload, options) {
    this.operation = 'upsert';
    this.payload = payload;
    this.options = options;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column, value) {
    this.filters.push({ method: 'eq', column, value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ method: 'neq', column, value });
    return this;
  }

  ilike(column, value) {
    this.filters.push({ method: 'ilike', column, value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ method: 'gte', column, value });
    return this;
  }

  lte(column, value) {
    this.filters.push({ method: 'lte', column, value });
    return this;
  }

  gt(column, value) {
    this.filters.push({ method: 'gt', column, value });
    return this;
  }

  in(column, value) {
    this.filters.push({ method: 'in', column, value });
    return this;
  }

  or(value) {
    this.filters.push({ method: 'or', value });
    return this;
  }

  not(column, operator, value) {
    this.filters.push({ method: 'not', column, operator, value });
    return this;
  }

  order(column, options) {
    this.filters.push({ method: 'order', column, options });
    return this;
  }

  limit(value) {
    this.filters.push({ method: 'limit', value });
    return this;
  }

  range(from, to) {
    this.filters.push({ method: 'range', from, to });
    return this;
  }

  single() {
    this.resultMode = 'single';
    return this;
  }

  maybeSingle() {
    this.resultMode = 'maybeSingle';
    return this;
  }

  then(resolve, reject) {
    return Promise.resolve(this.handler(this)).then(resolve, reject);
  }
}

const mockSupabase = (handler) => ({
  from: (table) => new QueryBuilder(table, handler),
});

const loadController = (relativePath, handler) => {
  const controllerPath = path.resolve(__dirname, '..', relativePath);
  delete require.cache[controllerPath];
  delete require.cache[brokerLeadSyncPath];
  require.cache[supabasePath] = {
    id: supabasePath,
    filename: supabasePath,
    loaded: true,
    exports: mockSupabase(handler),
  };
  return require(controllerPath);
};

const createRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const callController = async (controller, req = {}) => {
  const res = createRes();
  await controller({
    body: {},
    params: {},
    query: {},
    user: { id: 'user-1', role: 'tenant', full_name: 'Tenant' },
    ...req,
  }, res);
  return res;
};

afterEach(() => {
  delete require.cache[supabasePath];
});

test('room CRUD creates pending room with normalized payload and amenities', async () => {
  const writes = [];
  const { createRoom } = loadController('controllers/roomController.js', (query) => {
    writes.push({ table: query.table, operation: query.operation, payload: query.payload });
    if (query.table === 'rooms' && query.operation === 'insert') {
      assert.equal(query.payload.host_id, 'landlord-1');
      assert.equal(query.payload.title, 'Phòng đẹp');
      assert.equal(query.payload.status, 'pending');
      assert.equal(query.payload.available_slots, 2);
      assert.equal(query.payload.is_available, true);
      assert.equal(query.payload.deposit_amount, 2500000);
      assert.equal(query.payload.roommate_gender_preference, 'female');
      assert.equal(query.payload.roommate_occupation_preference, 'student');
      assert.equal(query.payload.roommate_schedule_preference, 'student');
      assert.equal(query.payload.roommate_cleanliness_preference, 'tidy');
      assert.equal(query.payload.roommate_allow_smoker, false);
      assert.equal(query.payload.roommate_allow_pets, true);
      assert.equal(query.payload.current_roommate_summary, 'Hien co 2 nu sinh vien, uu tien nguoi yen tinh.');
      return { data: { id: 'room-1', ...query.payload }, error: null };
    }
    if (query.table === 'room_amenities' && query.operation === 'insert') {
      assert.deepEqual(query.payload, [
        { room_id: 'room-1', amenity_id: 'wifi' },
        { room_id: 'room-1', amenity_id: 'parking' },
      ]);
      return { data: query.payload, error: null };
    }
    return { data: null, error: null };
  });

  const res = await callController(createRoom, {
    user: { id: 'landlord-1', role: 'landlord' },
    body: {
      title: '  Phòng đẹp  ',
      price: '2500000',
      address: '  Cầu Giấy  ',
      city: 'Hà Nội',
      area: '22',
      available_slots: '2',
      roommate_gender_preference: 'female',
      roommate_occupation_preference: 'student',
      roommate_schedule_preference: 'student',
      roommate_cleanliness_preference: 'tidy',
      roommate_allow_smoker: false,
      roommate_allow_pets: true,
      current_roommate_summary: 'Hien co 2 nu sinh vien, uu tien nguoi yen tinh.',
      amenity_ids: ['wifi', 'parking'],
    },
  });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.room.id, 'room-1');
  assert.equal(writes.filter(w => w.operation === 'insert').length, 2);
});

test('room CRUD protects owner-only updates and validates reopen slots', async () => {
  const { updateRoom, toggleRoomAvailable } = loadController('controllers/roomController.js', (query) => {
    if (query.table === 'rooms' && query.operation === 'select' && query.resultMode === 'single') {
      const idFilter = query.filters.find(f => f.column === 'id')?.value;
      if (idFilter === 'other-room') return { data: { host_id: 'other-landlord', available_slots: 1 }, error: null };
      return { data: { host_id: 'landlord-1', is_available: false, available_slots: 0, last_available_slots: 0 }, error: null };
    }
    return { data: null, error: null };
  });

  const forbidden = await callController(updateRoom, {
    user: { id: 'landlord-1', role: 'landlord' },
    params: { id: 'other-room' },
    body: { title: 'X', price: 1, address: 'A', city: 'C' },
  });
  assert.equal(forbidden.statusCode, 403);

  const invalidSlots = await callController(toggleRoomAvailable, {
    user: { id: 'landlord-1', role: 'landlord' },
    params: { id: 'own-room' },
    body: { available_slots: 0 },
  });
  assert.equal(invalidSlots.statusCode, 400);
  assert.match(invalidSlots.body.error, /slot/i);
});

test('room CRUD lets admin delete existing rooms', async () => {
  const deletes = [];
  const { deleteRoom } = loadController('controllers/roomController.js', (query) => {
    if (query.table === 'rooms' && query.operation === 'select') {
      return { data: { host_id: 'landlord-1' }, error: null };
    }
    if (query.table === 'rooms' && query.operation === 'delete') {
      deletes.push(query.filters);
      return { data: null, error: null };
    }
    return { data: null, error: null };
  });

  const res = await callController(deleteRoom, {
    user: { id: 'admin-1', role: 'admin' },
    params: { id: 'room-1' },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(deletes.length, 1);
});

test('room detail allows tenants with an existing room relationship to view hidden rooms', async () => {
  const { getRoomById } = loadController('controllers/roomController.js', (query) => {
    if (query.table === 'rooms' && query.operation === 'select' && query.resultMode === 'single') {
      return {
        data: {
          id: 'room-1',
          host_id: 'landlord-1',
          broker_id: null,
          status: 'approved',
          is_hidden: true,
          reviews: [],
        },
        error: null,
      };
    }
    if (query.table === 'roommate_requests') {
      return { data: { id: 'request-1' }, error: null };
    }
    return { data: null, error: null };
  });

  const res = await callController(getRoomById, {
    params: { id: 'room-1' },
    user: { id: 'tenant-1', role: 'tenant' },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.id, 'room-1');
});

test('chat validates room ownership before creating conversation', async () => {
  const { getOrCreateConversation } = loadController('controllers/chatController.js', (query) => {
    if (query.table === 'rooms') {
      return { data: { id: 'room-1', host_id: 'real-landlord', status: 'approved', is_hidden: false }, error: null };
    }
    return { data: null, error: null };
  });

  const res = await callController(getOrCreateConversation, {
    user: { id: 'tenant-1', role: 'tenant' },
    body: { room_id: 'room-1', landlord_id: 'fake-landlord' },
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Landlord does not match/i);
});

test('chat lets landlords open accepted tenant conversations by room', async () => {
  const inserts = [];
  const { getOrCreateConversation } = loadController('controllers/chatController.js', (query) => {
    if (query.table === 'rooms') {
      return { data: { id: 'room-1', host_id: 'landlord-1', status: 'approved', is_hidden: false }, error: null };
    }
    if (query.table === 'users') {
      return { data: { id: 'tenant-1', role: 'tenant', is_locked: false }, error: null };
    }
    if (query.table === 'conversations' && query.operation === 'select') {
      return { data: null, error: null };
    }
    if (query.table === 'conversations' && query.operation === 'insert') {
      inserts.push(query.payload);
      return { data: { id: 'conv-1', ...query.payload }, error: null };
    }
    return { data: null, error: null };
  });

  const res = await callController(getOrCreateConversation, {
    user: { id: 'landlord-1', role: 'landlord' },
    body: { room_id: 'room-1', tenant_id: 'tenant-1' },
  });

  assert.equal(res.statusCode, 201);
  assert.deepEqual(inserts[0], { tenant_id: 'tenant-1', landlord_id: 'landlord-1', room_id: 'room-1' });
});

test('chat creates broker lead when tenant starts conversation for assigned room', async () => {
  const leadWrites = [];
  const { getOrCreateConversation } = loadController('controllers/chatController.js', (query) => {
    if (query.table === 'rooms') {
      return {
        data: {
          id: 'room-1',
          host_id: 'landlord-1',
          broker_id: 'broker-1',
          title: 'Phong broker',
          city: 'Ha Noi',
          area: 25,
          price: 4000000,
          status: 'approved',
          is_hidden: false,
        },
        error: null,
      };
    }
    if (query.table === 'users') {
      return {
        data: { id: 'tenant-1', role: 'tenant', is_locked: false, full_name: 'Tenant A', email: 'tenant@test.com', phone: '0900000000' },
        error: null,
      };
    }
    if (query.table === 'conversations' && query.operation === 'select') {
      return { data: null, error: null };
    }
    if (query.table === 'conversations' && query.operation === 'insert') {
      return { data: { id: 'conv-1', ...query.payload }, error: null };
    }
    if (query.table === 'broker_leads' && query.operation === 'select') {
      return { data: null, error: null };
    }
    if (query.table === 'broker_leads' && query.operation === 'insert') {
      leadWrites.push(query.payload);
      return { data: { id: 'lead-1', status: query.payload.status }, error: null };
    }
    if (query.table === 'broker_lead_rooms' && query.operation === 'upsert') {
      return { data: { id: 'lead-room-1', ...query.payload }, error: null };
    }
    return { data: query.payload || null, error: null };
  });

  const res = await callController(getOrCreateConversation, {
    user: { id: 'tenant-1', role: 'tenant', full_name: 'Tenant A' },
    body: { room_id: 'room-1', landlord_id: 'broker-1' },
  });

  assert.equal(res.statusCode, 201);
  assert.equal(leadWrites[0].broker_id, 'broker-1');
  assert.equal(leadWrites[0].tenant_id, 'tenant-1');
  assert.equal(leadWrites[0].assigned_room_id, 'room-1');
  assert.equal(leadWrites[0].status, 'consulted');
});

test('chat rejects landlord conversation creation for invalid tenants', async () => {
  const { getOrCreateConversation } = loadController('controllers/chatController.js', (query) => {
    if (query.table === 'rooms') {
      return { data: { id: 'room-1', host_id: 'landlord-1', status: 'approved', is_hidden: false }, error: null };
    }
    if (query.table === 'users') {
      return { data: { id: 'landlord-2', role: 'landlord', is_locked: false }, error: null };
    }
    return { data: null, error: null };
  });

  const res = await callController(getOrCreateConversation, {
    user: { id: 'landlord-1', role: 'landlord' },
    body: { room_id: 'room-1', tenant_id: 'landlord-2' },
  });

  assert.equal(res.statusCode, 404);
  assert.match(res.body.error, /tenant/i);
});

test('chat sends trimmed messages only for conversation participants', async () => {
  const inserts = [];
  const { sendMessage } = loadController('controllers/chatController.js', (query) => {
    if (query.table === 'conversations' && query.operation === 'select') {
      return { data: { id: 'conv-1', tenant_id: 'tenant-1', landlord_id: 'landlord-1' }, error: null };
    }
    if (query.table === 'messages' && query.operation === 'insert') {
      inserts.push(query.payload);
      return { data: { id: 'msg-1', ...query.payload }, error: null };
    }
    return { data: query.payload || null, error: null };
  });

  const res = await callController(sendMessage, {
    user: { id: 'tenant-1', role: 'tenant', full_name: 'Tenant A' },
    params: { id: 'conv-1' },
    body: { content: '  Chào chủ nhà  ' },
  });

  assert.equal(res.statusCode, 201);
  assert.equal(inserts[0].content, 'Chào chủ nhà');
  assert.equal(res.body.message.sender_id, 'tenant-1');
});

test('favorite only adds public approved rooms and filters stale favorites', async () => {
  const { addFavorite, getFavorites } = loadController('controllers/favoriteController.js', (query) => {
    if (query.table === 'rooms') {
      return { data: { id: 'hidden-room', status: 'approved', is_hidden: true }, error: null };
    }
    if (query.table === 'favorites' && query.operation === 'select') {
      return {
        data: [
          { id: 'fav-1', rooms: { id: 'room-1', status: 'approved', is_hidden: false, title: 'OK' } },
          { id: 'fav-2', rooms: { id: 'room-2', status: 'pending', is_hidden: false, title: 'Pending' } },
          { id: 'fav-3', rooms: { id: 'room-3', status: 'approved', is_hidden: true, title: 'Hidden' } },
        ],
        error: null,
      };
    }
    return { data: { id: 'fav-new' }, error: null };
  });

  const add = await callController(addFavorite, {
    user: { id: 'tenant-1', role: 'tenant' },
    params: { roomId: 'hidden-room' },
  });
  assert.equal(add.statusCode, 404);

  const list = await callController(getFavorites, {
    user: { id: 'tenant-1', role: 'tenant' },
  });
  assert.equal(list.statusCode, 200);
  assert.deepEqual(list.body.favorites.map(room => room.id), ['room-1']);
});

test('deposit rejects invalid lifecycle changes and hides room after payment', async () => {
  const updates = [];
  let depositStatus = 'pending_payment';
  const { updateDepositStatus } = loadController('controllers/depositController.js', (query) => {
    if (query.table === 'room_deposits' && query.operation === 'select') {
      return {
        data: {
          id: 'dep-1',
          room_id: 'room-1',
          tenant_id: 'tenant-1',
          landlord_id: 'landlord-1',
          status: depositStatus,
          amount: 500000,
          room: { id: 'room-1', title: 'Phòng A', available_slots: 1 },
        },
        error: null,
      };
    }
    if (query.operation === 'update') {
      updates.push({ table: query.table, payload: query.payload });
      if (query.table === 'room_deposits') depositStatus = query.payload.status;
      return { data: { id: 'dep-1', ...query.payload }, error: null };
    }
    return { data: query.payload || null, error: null };
  });

  const missingReason = await callController(updateDepositStatus, {
    user: { id: 'tenant-1', role: 'tenant' },
    params: { id: 'dep-1' },
    body: { status: 'cancelled' },
  });
  assert.equal(missingReason.statusCode, 400);

  const adminConfirmed = await callController(updateDepositStatus, {
    user: { id: 'admin-1', role: 'admin' },
    params: { id: 'dep-1' },
    body: { status: 'admin_confirmed', note: 'Đã nhận tiền' },
  });
  assert.equal(adminConfirmed.statusCode, 200);
  assert.equal(updates.find(u => u.table === 'room_deposits').payload.status, 'admin_confirmed');

  const paid = await callController(updateDepositStatus, {
    user: { id: 'landlord-1', role: 'landlord' },
    params: { id: 'dep-1' },
    body: { status: 'landlord_accepted', note: 'Đồng ý nhận cọc' },
  });
  assert.equal(paid.statusCode, 200);
  assert.equal(updates.filter(u => u.table === 'room_deposits').at(-1).payload.status, 'landlord_accepted');
  assert.equal(updates.find(u => u.table === 'rooms').payload.is_hidden, true);
  assert.equal(updates.find(u => u.table === 'rooms').payload.is_available, false);
});

test('deposit payment for accepted roommate request keeps shared room visible while slots remain', async () => {
  const updates = [];
  const { updateDepositStatus } = loadController('controllers/depositController.js', (query) => {
    if (query.table === 'room_deposits' && query.operation === 'select') {
      return {
        data: {
          id: 'dep-slot-1',
          room_id: 'room-1',
          tenant_id: 'tenant-1',
          landlord_id: 'landlord-1',
          roommate_request_id: 'req-1',
          status: 'admin_confirmed',
          amount: 500000,
          deposit_scope: 'slot',
          deposit_slots: 1,
          room: {
            id: 'room-1',
            title: 'Phong ghep A',
            available_slots: 1,
            last_available_slots: 1,
            is_hidden: false,
            is_available: true,
          },
        },
        error: null,
      };
    }
    if (query.operation === 'update') {
      updates.push({ table: query.table, payload: query.payload });
      return { data: { id: 'dep-slot-1', ...query.payload }, error: null };
    }
    return { data: query.payload || null, error: null };
  });

  const paid = await callController(updateDepositStatus, {
    user: { id: 'landlord-1', role: 'landlord' },
    params: { id: 'dep-slot-1' },
    body: { status: 'landlord_accepted', note: 'Dong y nhan coc slot' },
  });

  const roomUpdate = updates.find(update => update.table === 'rooms');
  assert.equal(paid.statusCode, 200);
  assert.equal(roomUpdate.payload.is_hidden, false);
  assert.equal(roomUpdate.payload.is_available, true);
  assert.equal(roomUpdate.payload.available_slots, 1);
});

test('appointment validates future time and role-based status changes', async () => {
  const { createAppointment, updateAppointmentStatus } = loadController('controllers/appointmentController.js', (query) => {
    if (query.table === 'appointments' && query.operation === 'select') {
      return { data: { landlord_id: 'landlord-1', tenant_id: 'tenant-1', room_id: 'room-1', status: 'pending' }, count: 0, error: null };
    }
    return { data: query.payload || null, count: 0, error: null };
  });

  const past = await callController(createAppointment, {
    user: { id: 'tenant-1', role: 'tenant' },
    body: { room_id: 'room-1', scheduled_at: '2020-01-01T10:00:00.000Z' },
  });
  assert.equal(past.statusCode, 400);

  const tenantConfirm = await callController(updateAppointmentStatus, {
    user: { id: 'tenant-1', role: 'tenant' },
    params: { id: 'appt-1' },
    body: { status: 'confirmed' },
  });
  assert.equal(tenantConfirm.statusCode, 403);
});

test('appointment reschedule by tenant resets appointment to pending', async () => {
  const updates = [];
  const { rescheduleAppointment } = loadController('controllers/appointmentController.js', (query) => {
    if (query.table === 'appointments' && query.operation === 'select') {
      if (query.options?.head) return { count: 0, error: null };
      return {
        data: { id: 'appt-1', landlord_id: 'landlord-1', tenant_id: 'tenant-1', room_id: 'room-1', status: 'confirmed' },
        error: null,
      };
    }
    if (query.table === 'appointments' && query.operation === 'update') {
      updates.push(query.payload);
      return { data: { id: 'appt-1', ...query.payload }, error: null };
    }
    return { data: query.payload || null, count: 0, error: null };
  });

  const scheduledAt = new Date(Date.now() + 2 * 3600_000).toISOString();
  const res = await callController(rescheduleAppointment, {
    user: { id: 'tenant-1', role: 'tenant' },
    params: { id: 'appt-1' },
    body: { scheduled_at: scheduledAt },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(updates[0].scheduled_at, scheduledAt);
  assert.equal(updates[0].status, 'pending');
});

test('roommate request stores practical roommate criteria', async () => {
  const writes = [];
  const { createRoommateRequest } = loadController('controllers/roommateRequestController.js', (query) => {
    if (query.table === 'rooms' && query.operation === 'select') {
      return {
        data: {
          host_id: 'landlord-1',
          broker_id: null,
          title: 'Phong o ghep',
          available_slots: 2,
          status: 'approved',
          is_hidden: false,
          is_available: true,
        },
        error: null,
      };
    }
    if (query.table === 'roommate_requests' && query.operation === 'select') {
      return { data: null, error: null };
    }
    if (query.operation === 'insert') {
      writes.push({ table: query.table, payload: query.payload });
      return { data: { id: 'request-1', ...query.payload }, error: null };
    }
    return { data: query.payload || null, error: null };
  });

  const res = await callController(createRoommateRequest, {
    user: { id: 'tenant-1', role: 'tenant', full_name: 'Tenant A' },
    body: {
      room_id: 'room-1',
      message: 'Muon o ghep voi nguoi yen tinh',
      move_in_date: '2026-06-01',
      occupants: 1,
      has_pet: true,
      requester_gender: 'female',
      preferred_roommate_gender: 'female',
      occupation: 'Sinh vien',
      schedule_type: 'student',
      cleanliness_level: 'tidy',
      is_smoker: false,
      okay_with_smoker: false,
      okay_with_pets: true,
      roommate_note: 'Uu tien nguoi khong nhau nhet',
    },
  });

  assert.equal(res.statusCode, 201);
  const requestWrite = writes.find(write => write.table === 'roommate_requests');
  assert.equal(requestWrite.payload.requester_gender, 'female');
  assert.equal(requestWrite.payload.preferred_roommate_gender, 'female');
  assert.equal(requestWrite.payload.occupation, 'Sinh vien');
  assert.equal(requestWrite.payload.schedule_type, 'student');
  assert.equal(requestWrite.payload.cleanliness_level, 'tidy');
  assert.equal(requestWrite.payload.has_pet, true);
  assert.equal(requestWrite.payload.is_smoker, false);
  assert.equal(requestWrite.payload.okay_with_smoker, false);
  assert.equal(requestWrite.payload.okay_with_pets, true);
  assert.equal(requestWrite.payload.roommate_note, 'Uu tien nguoi khong nhau nhet');
});

test('roommate requests let brokers view but not decide final status', async () => {
  const writes = [];
  const { updateRoommateRequestStatus } = loadController('controllers/roommateRequestController.js', (query) => {
    if (query.table === 'roommate_requests' && query.operation === 'select') {
      return {
        data: { room_id: 'room-1', tenant_id: 'tenant-1', status: 'pending', occupants: 1 },
        error: null,
      };
    }
    if (query.table === 'rooms' && query.operation === 'select') {
      return {
        data: {
          host_id: 'landlord-1',
          broker_id: 'broker-1',
          title: 'Phong demo',
          available_slots: 2,
          is_available: true,
        },
        error: null,
      };
    }
    if (query.operation === 'update' || query.operation === 'insert') {
      writes.push({ table: query.table, operation: query.operation, payload: query.payload });
    }
    return { data: query.payload || null, error: null };
  });

  const res = await callController(updateRoommateRequestStatus, {
    user: { id: 'broker-1', role: 'broker' },
    params: { id: 'request-1' },
    body: { status: 'accepted' },
  });

  assert.equal(res.statusCode, 403);
  assert.deepEqual(writes, []);
});

test('broker leads validate assigned rooms and write lead records', async () => {
  const writes = [];
  const { createLead, recommendRoom } = loadController('controllers/brokerController.js', (query) => {
    if (query.table === 'rooms' && query.operation === 'select') {
      const roomId = query.filters.find(f => f.column === 'id')?.value;
      return {
        data: { id: roomId, broker_id: roomId === 'room-1' ? 'broker-1' : 'other-broker' },
        error: null,
      };
    }
    if (query.table === 'broker_leads' && query.operation === 'select') {
      return { data: { id: 'lead-1' }, error: null };
    }
    if (query.table === 'broker_leads' && query.operation === 'insert') {
      writes.push({ table: query.table, payload: query.payload });
      return { data: { id: 'lead-1', ...query.payload }, error: null };
    }
    if (query.table === 'broker_lead_rooms' && query.operation === 'upsert') {
      writes.push({ table: query.table, payload: query.payload });
      return { data: { id: 'rec-1', ...query.payload }, error: null };
    }
    if (query.table === 'activity_logs' && query.operation === 'insert') {
      return { data: query.payload, error: null };
    }
    return { data: query.payload || null, error: null };
  });

  const lead = await callController(createLead, {
    user: { id: 'broker-1', role: 'broker' },
    body: {
      full_name: 'Nguyen Van A',
      phone: '0900000000',
      budget_min: 2500000,
      budget_max: 4000000,
      assigned_room_id: 'room-1',
      status: 'consulted',
    },
  });

  assert.equal(lead.statusCode, 201);
  assert.equal(writes[0].payload.broker_id, 'broker-1');
  assert.equal(writes[0].payload.status, 'consulted');

  const forbiddenRoom = await callController(recommendRoom, {
    user: { id: 'broker-1', role: 'broker' },
    params: { id: 'lead-1' },
    body: { room_id: 'room-2' },
  });
  assert.equal(forbiddenRoom.statusCode, 400);

  const recommendation = await callController(recommendRoom, {
    user: { id: 'broker-1', role: 'broker' },
    params: { id: 'lead-1' },
    body: { room_id: 'room-1', match_reason: 'Dung ngan sach', status: 'interested' },
  });
  assert.equal(recommendation.statusCode, 200);
});


test('broker closing a lead creates pending commission for assigned room', async () => {
  const writes = [];
  const { updateLeadStatus } = loadController('controllers/brokerController.js', (query) => {
    if (query.table === 'broker_leads' && query.operation === 'select') {
      const isExistingLookup = query.columns === 'id, status';
      return {
        data: {
          id: 'lead-1',
          status: isExistingLookup ? 'deposit_ready' : 'closed',
          broker_id: 'broker-1',
          tenant_id: 'tenant-1',
          assigned_room_id: 'room-1',
          assigned_room: { id: 'room-1', price: 4000000 },
          recommended_rooms: [],
          ...(isExistingLookup ? {} : { commission: null }),
        },
        error: null,
      };
    }
    if (query.table === 'broker_leads' && query.operation === 'update') {
      return { data: { id: 'lead-1', ...query.payload }, error: null };
    }
    if (query.table === 'broker_commissions' && query.operation === 'upsert') {
      writes.push(query.payload);
      return { data: { id: 'commission-1', ...query.payload }, error: null };
    }
    if (query.table === 'activity_logs' && query.operation === 'insert') {
      return { data: query.payload, error: null };
    }
    return { data: query.payload || null, error: null };
  });

  const res = await callController(updateLeadStatus, {
    user: { id: 'broker-1', role: 'broker' },
    params: { id: 'lead-1' },
    body: { status: 'closed', commission_amount: 1500000, commission_note: 'Thu khi landlord xac nhan coc' },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(writes[0].broker_id, 'broker-1');
  assert.equal(writes[0].room_id, 'room-1');
  assert.equal(writes[0].amount, 1500000);
  assert.equal(writes[0].status, 'pending_collection');
});

test('admin updates broker commission payment status', async () => {
  const updates = [];
  const { updateBrokerCommissionStatus } = loadController('controllers/adminController.js', (query) => {
    if (query.table === 'broker_commissions' && query.operation === 'select') {
      return { data: { id: 'commission-1', status: 'pending_collection' }, error: null };
    }
    if (query.table === 'broker_commissions' && query.operation === 'update') {
      updates.push(query.payload);
      return { data: { id: 'commission-1', ...query.payload }, error: null };
    }
    if (query.table === 'activity_logs' && query.operation === 'insert') {
      return { data: query.payload, error: null };
    }
    return { data: query.payload || null, count: 0, error: null };
  });

  const res = await callController(updateBrokerCommissionStatus, {
    user: { id: 'admin-1', role: 'admin' },
    params: { id: 'commission-1' },
    body: { status: 'paid_to_broker', note: 'Da chuyen khoan' },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(updates[0].status, 'paid_to_broker');
  assert.ok(updates[0].collected_at);
  assert.ok(updates[0].paid_at);
});


test('assistant tool router runs search, compare, and review summary tools', async () => {
  const { routeAssistantTools } = loadController('services/ai/assistantToolRouter.js', (query) => {
    if (query.table === 'amenities') return { data: [], error: null };
    if (query.table === 'rooms') {
      return {
        data: [
          {
            id: 'room-2',
            title: 'Phòng gần trung tâm',
            price: 2500000,
            address: 'Cầu Giấy',
            city: 'Hà Nội',
            area: 24,
            available_slots: 1,
            created_at: new Date().toISOString(),
            is_available: true,
            room_images: [{ image_url: 'room.jpg', is_primary: true }],
            room_amenities: [{ amenities: { name: 'wifi' } }],
          },
        ],
        error: null,
      };
    }
    return { data: [], error: null };
  });

  const result = await routeAssistantTools({
    message: 'So sánh phòng này và tóm tắt review giúp tôi',
    intent: 'compare',
    user: { id: 'tenant-1', role: 'tenant' },
    profile: { has_profile: false },
    context: {
      current_room: {
        id: 'room-1',
        title: 'Phòng đang xem',
        price: 3000000,
        city: 'Hà Nội',
        area: 20,
        room_amenities: [{ amenities: { name: 'wifi' } }],
        reviews: [
          { rating: 5, comment: 'Sạch sẽ, chủ nhà dễ thương.' },
          { rating: 3, comment: 'Hơi ồn vào buổi tối.' },
        ],
      },
    },
  });

  assert.deepEqual(result.selectedTools, ['searchRooms', 'compareRooms', 'summarizeReviews']);
  assert.equal(result.rooms.length, 1);
  assert.equal(result.toolResults.find(tool => tool.name === 'summarizeReviews').average_rating, 4);
  assert.equal(result.toolResults.find(tool => tool.name === 'compareRooms').comparisons[0].price_delta, -500000);
});
