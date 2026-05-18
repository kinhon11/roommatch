const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  SUPABASE_URL hoặc SUPABASE_SERVICE_KEY chưa được cấu hình.');
  console.warn('   Hãy tạo file backend/.env từ backend/.env.example và điền giá trị thật.');
}

// Service role client - bypasses RLS, dùng cho server-side operations
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

module.exports = supabase;
