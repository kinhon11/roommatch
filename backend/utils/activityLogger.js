const supabase = require('../config/supabaseClient');

const logActivity = async ({ actorId, action, targetType, targetId, oldValue = null, newValue = null }) => {
  try {
    await supabase.from('activity_logs').insert({
      actor_id: actorId || null,
      action,
      target_type: targetType,
      target_id: targetId || null,
      old_value: oldValue,
      new_value: newValue,
    });
  } catch (err) {
    console.warn('Failed to write activity log:', err.message);
  }
};

module.exports = { logActivity };
