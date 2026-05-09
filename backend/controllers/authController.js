const { createClient } = require('@supabase/supabase-js');
const supabase = require('../config/supabaseClient');

// ─── Helper: tạo client với token của user (bypass RLS theo auth.uid())
const makeUserClient = (accessToken) =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth:   { autoRefreshToken: false, persistSession: false },
  });

/**
 * @desc  Register a new user
 * @route POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { email, password, full_name, role = 'tenant' } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, và họ tên là bắt buộc.' });
    }

    const validRoles = ['tenant', 'landlord'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Role không hợp lệ.' });
    }

    // ── Bước 1: Đăng ký tài khoản Auth (signUp thay vì admin.createUser)
    //    Yêu cầu: TẮT "Email Confirmation" trong Supabase → Auth → Providers → Email
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, role }, // Lưu vào auth metadata
      },
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    if (!authData?.user) {
      return res.status(500).json({ error: 'Không thể tạo tài khoản.' });
    }

    const userId  = authData.user.id;
    const session = authData.session; // null nếu email confirm chưa tắt

    // ── Bước 2: Insert vào bảng public.users
    let insertError = null;

    if (session?.access_token) {
      // Dùng user's own token → RLS cho phép (auth.uid() = id)
      const userClient = makeUserClient(session.access_token);
      const { error } = await userClient.from('users').insert({
        id: userId, email, full_name, role,
      });
      insertError = error;
    } else {
      // Fallback: dùng service client (nếu có service_role hoạt động)
      const { error } = await supabase.from('users').insert({
        id: userId, email, full_name, role,
      });
      insertError = error;
    }

    if (insertError) {
      console.error('❌ Insert users error:', JSON.stringify(insertError));
      // Xóa auth user nếu insert thất bại (rollback)
      await supabase.auth.admin.deleteUser(userId).catch(() => {});
      return res.status(500).json({
        error: 'Lưu thông tin người dùng thất bại.',
        detail: insertError.message,
        code: insertError.code,
        hint: '💡 Nếu lỗi 42501: Hãy chạy lại schema.sql trên Supabase và tắt Email Confirmation.',
      });
    }

    // ── Bước 3: Nếu chưa có session, đăng nhập ngay
    let finalSession = session;
    if (!finalSession) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email, password,
      });
      if (signInError) {
        return res.status(500).json({ error: 'Đăng ký thành công. Vui lòng đăng nhập lại.' });
      }
      finalSession = signInData.session;
    }

    return res.status(201).json({
      message : 'Đăng ký thành công!',
      user    : { id: userId, email, full_name, role },
      session : finalSession,
    });

  } catch (err) {
    console.error('❌ Register error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

/**
 * @desc  Login user
 * @route POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc.' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
    }

    // Fetch profile từ public.users
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin người dùng.' });
    }

    if (profile.is_locked) {
      return res.status(403).json({ error: 'Account is locked. Please contact an administrator.' });
    }

    return res.status(200).json({
      message : 'Đăng nhập thành công!',
      user    : profile,
      session : data.session,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

/**
 * @desc  Logout
 * @route POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      await supabase.auth.admin.signOut(token).catch(() => {});
    }
    return res.status(200).json({ message: 'Đăng xuất thành công.' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

module.exports = { register, login, logout };
