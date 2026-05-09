const supabase = require('../config/supabaseClient');

const loadUserFromToken = async (token) => {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { error: 'Unauthorized: Invalid or expired token.' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: 'Unauthorized: User profile not found.' };
  }

  if (profile.is_locked) {
    return { error: 'Forbidden: Account is locked.', status: 403 };
  }

  return { user: { ...user, ...profile } };
};

/**
 * Middleware: Verify JWT token from Supabase and attach user to req
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    const result = await loadUserFromToken(token);
    if (result.error) {
      return res.status(result.status || 401).json({ error: result.error });
    }

    req.user = result.user;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const result = await loadUserFromToken(token);
    if (result.error) {
      return next();
    }

    req.user = result.user;
    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

/**
 * Middleware: Restrict access to specific roles
 * Usage: restrictTo('admin'), restrictTo('landlord', 'admin')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: This action requires one of the following roles: ${roles.join(', ')}.`,
      });
    }
    next();
  };
};

module.exports = { protect, optionalAuth, restrictTo };
