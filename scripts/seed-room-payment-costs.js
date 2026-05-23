const supabase = require('../backend/config/supabaseClient');

const costTemplates = [
  { electricity_price: 4000, water_price: 100000, internet_fee: 100000, parking_fee: 100000, service_fee: 50000 },
  { electricity_price: 4500, water_price: 120000, internet_fee: 120000, parking_fee: 150000, service_fee: 80000 },
  { electricity_price: 3800, water_price: 80000, internet_fee: 0, parking_fee: 0, service_fee: 50000 },
  { electricity_price: 4200, water_price: 100000, internet_fee: 100000, parking_fee: 0, service_fee: 100000 },
  { electricity_price: 3500, water_price: 70000, internet_fee: 80000, parking_fee: 100000, service_fee: 50000 },
  { electricity_price: 4000, water_price: 100000, internet_fee: 0, parking_fee: 120000, service_fee: 100000 },
];

const hasPositiveNumber = (value) => Number(value) > 0;
const hasNumber = (value) => value !== null && value !== undefined && value !== '';

async function main() {
  const { data: rooms, error: roomError } = await supabase
    .from('rooms')
    .select(`
      id, title, price, deposit_amount, electricity_price, water_price,
      internet_fee, parking_fee, service_fee, payment_cycle, created_at
    `)
    .order('created_at', { ascending: true });

  if (roomError) throw roomError;
  if (!rooms?.length) throw new Error('Không có phòng để cập nhật chi phí thanh toán.');

  let updated = 0;
  for (let i = 0; i < rooms.length; i += 1) {
    const room = rooms[i];
    const template = costTemplates[i % costTemplates.length];
    const payload = {
      deposit_amount: hasPositiveNumber(room.deposit_amount) ? Number(room.deposit_amount) : Number(room.price || 0),
      electricity_price: hasPositiveNumber(room.electricity_price) ? Number(room.electricity_price) : template.electricity_price,
      water_price: hasPositiveNumber(room.water_price) ? Number(room.water_price) : template.water_price,
      internet_fee: hasNumber(room.internet_fee) ? Number(room.internet_fee) : template.internet_fee,
      parking_fee: hasNumber(room.parking_fee) ? Number(room.parking_fee) : template.parking_fee,
      service_fee: hasNumber(room.service_fee) ? Number(room.service_fee) : template.service_fee,
      payment_cycle: room.payment_cycle || 'monthly',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('rooms')
      .update(payload)
      .eq('id', room.id);

    if (error) throw error;
    updated += 1;
  }

  const { data: checkRows, error: checkError } = await supabase
    .from('rooms')
    .select('id, title, price, deposit_amount, electricity_price, water_price, internet_fee, parking_fee, service_fee, payment_cycle');

  if (checkError) throw checkError;

  const missing = (checkRows || []).filter(room => (
    !hasPositiveNumber(room.deposit_amount)
    || !hasPositiveNumber(room.electricity_price)
    || !hasPositiveNumber(room.water_price)
    || !hasNumber(room.internet_fee)
    || !hasNumber(room.parking_fee)
    || !hasNumber(room.service_fee)
    || !room.payment_cycle
  ));

  console.log(JSON.stringify({
    roomsUpdated: updated,
    roomsMissingPaymentCosts: missing.length,
    sample: (checkRows || []).slice(0, 5).map(room => ({
      title: room.title,
      rent: Number(room.price || 0),
      deposit: Number(room.deposit_amount || 0),
      electricity: Number(room.electricity_price || 0),
      water: Number(room.water_price || 0),
      internet: Number(room.internet_fee || 0),
      parking: Number(room.parking_fee || 0),
      service: Number(room.service_fee || 0),
      cycle: room.payment_cycle,
    })),
  }, null, 2));

  if (missing.length) process.exit(1);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
