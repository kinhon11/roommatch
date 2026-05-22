const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const path = require('node:path');

const supabasePath = path.resolve(__dirname, '../config/supabaseClient.js');

class QueryBuilder {
  constructor(table, handler) {
    this.table = table;
    this.handler = handler;
    this.operation = 'select';
    this.filters = [];
    this.payload = undefined;
  }

  select(columns, options) {
    if (!['insert', 'update', 'delete'].includes(this.operation)) {
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
  const { updateDepositStatus } = loadController('controllers/depositController.js', (query) => {
    if (query.table === 'room_deposits' && query.operation === 'select') {
      return {
        data: {
          id: 'dep-1',
          room_id: 'room-1',
          tenant_id: 'tenant-1',
          landlord_id: 'landlord-1',
          status: 'pending_payment',
          amount: 500000,
          room: { id: 'room-1', title: 'Phòng A' },
        },
        error: null,
      };
    }
    if (query.operation === 'update') {
      updates.push({ table: query.table, payload: query.payload });
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

  const paid = await callController(updateDepositStatus, {
    user: { id: 'landlord-1', role: 'landlord' },
    params: { id: 'dep-1' },
    body: { status: 'paid', note: 'Đã nhận tiền' },
  });
  assert.equal(paid.statusCode, 200);
  assert.equal(updates.find(u => u.table === 'room_deposits').payload.status, 'paid');
  assert.equal(updates.find(u => u.table === 'rooms').payload.is_hidden, true);
  assert.equal(updates.find(u => u.table === 'rooms').payload.is_available, false);
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
