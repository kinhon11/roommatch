const supabase = require('../backend/config/supabaseClient');
const {
  syncBrokerLeadFromTenantAction,
  createBrokerCommissionFromDeposit,
} = require('../backend/utils/brokerLeadSync');

const run = async () => {
  const { data: deposits, error } = await supabase
    .from('room_deposits')
    .select(`
      id, room_id, tenant_id, amount, status, deposit_scope, deposit_slots,
      room:rooms (id, title, broker_id)
    `)
    .in('status', ['pending_payment', 'paid'])
    .not('room.broker_id', 'is', null);

  if (error) throw error;

  let scanned = 0;
  let createdOrUpdated = 0;
  let skipped = 0;

  for (const deposit of deposits || []) {
    const brokerId = deposit.room?.broker_id;
    if (!brokerId) {
      skipped += 1;
      continue;
    }
    scanned += 1;

    const syncedLead = await syncBrokerLeadFromTenantAction({
      brokerId,
      tenantId: deposit.tenant_id,
      roomId: deposit.room_id,
      status: deposit.status === 'paid' ? 'closed' : 'deposit_ready',
      note: `Backfill hoa hong tu yeu cau coc phong "${deposit.room?.title || deposit.room_id}".`,
    });

    if (!syncedLead.lead?.id) {
      skipped += 1;
      continue;
    }

    const commission = await createBrokerCommissionFromDeposit({
      brokerId,
      tenantId: deposit.tenant_id,
      roomId: deposit.room_id,
      leadId: syncedLead.lead.id,
      amount: deposit.amount,
      note: `Backfill hoa hong tu yeu cau coc ${deposit.id}.`,
    });

    if (commission.error) throw commission.error;
    if (!commission.skipped) createdOrUpdated += 1;
  }

  console.log(JSON.stringify({ scanned, createdOrUpdated, skipped }, null, 2));
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
