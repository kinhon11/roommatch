const supabase = require('../config/supabaseClient');

const PROFILE_SELECT = 'id, email, full_name, role, phone, contact_email, zalo, facebook_url, contact_hours, address, avatar_url, bio, is_verified, created_at';

/**
 * @desc  GET current user profile
 * @route GET /api/auth/profile
 */
const getProfile = async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('users')
      .select(PROFILE_SELECT)
      .eq('id', req.user.id)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ người dùng.' });
    }

    return res.status(200).json({ user: profile });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

/**
 * @desc  UPDATE current user profile (name, phone, address, bio)
 * @route PUT /api/auth/profile
 */
const updateProfile = async (req, res) => {
  try {
    const { full_name, phone, contact_email, zalo, facebook_url, contact_hours, address, bio, avatar_url } = req.body;

    // Validation
    if (!full_name || full_name.trim().length < 2) {
      return res.status(400).json({ error: 'Họ tên phải có ít nhất 2 ký tự.' });
    }

    if (phone && !/^[0-9+\-\s]{7,15}$/.test(phone.trim())) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ.' });
    }

    if (contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email.trim())) {
      return res.status(400).json({ error: 'Email li?n h? kh?ng h?p l?.' });
    }
    if (facebook_url && !/^https?:\/\/(www\.)?facebook\.com\/.+/i.test(facebook_url.trim())) {
      return res.status(400).json({ error: 'Facebook URL phai la lien ket facebook hop le.' });
    }

    const updates = {
      full_name: full_name.trim(),
      phone: phone?.trim() || null,
      contact_email: contact_email?.trim() || null,
      zalo: zalo?.trim() || null,
      facebook_url: facebook_url?.trim() || null,
      contact_hours: contact_hours?.trim() || null,
      address: address?.trim() || null,
      bio: bio?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const { data: profile, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select(PROFILE_SELECT)
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: 'Cập nhật hồ sơ thành công!',
      user:    profile,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

/**
 * @desc  CHANGE password
 * @route PUT /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin.' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ error: 'Mật khẩu xác nhận không khớp.' });
    }

    // Verify current password by re-signin
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email:    req.user.email,
      password: current_password,
    });

    if (signInError) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng.' });
    }

    // Update password via admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(req.user.id, {
      password: new_password,
    });

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    return res.status(200).json({ message: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

module.exports = { getProfile, updateProfile, changePassword };
