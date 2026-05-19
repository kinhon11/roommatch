const DEFAULT_WINDOW_MS = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 60_000);
const DEFAULT_MAX_REQUESTS = Number(process.env.AI_RATE_LIMIT_MAX_REQUESTS || 20);

const buckets = new Map();

const getClientKey = (req, scope) => {
  const userKey = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip || req.connection?.remoteAddress || 'unknown'}`;
  return `${scope}:${userKey}`;
};

const createAIRateLimiter = ({
  windowMs = DEFAULT_WINDOW_MS,
  maxRequests = DEFAULT_MAX_REQUESTS,
  scope = 'ai',
  now = () => Date.now(),
} = {}) => (req, res, next) => {
  const key = getClientKey(req, scope);
  const currentTime = now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= currentTime) {
    buckets.set(key, { count: 1, resetAt: currentTime + windowMs });
    res.set?.('X-RateLimit-Limit', String(maxRequests));
    res.set?.('X-RateLimit-Remaining', String(Math.max(maxRequests - 1, 0)));
    res.set?.('X-RateLimit-Reset', String(Math.ceil((currentTime + windowMs) / 1000)));
    return next();
  }

  if (bucket.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000));
    res.set?.('Retry-After', String(retryAfterSeconds));
    res.set?.('X-RateLimit-Limit', String(maxRequests));
    res.set?.('X-RateLimit-Remaining', '0');
    res.set?.('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
    return res.status(429).json({
      error: 'Bạn đang gửi yêu cầu AI quá nhanh. Vui lòng thử lại sau.',
      retry_after_seconds: retryAfterSeconds,
    });
  }

  bucket.count += 1;
  res.set?.('X-RateLimit-Limit', String(maxRequests));
  res.set?.('X-RateLimit-Remaining', String(Math.max(maxRequests - bucket.count, 0)));
  res.set?.('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
  return next();
};

const aiRateLimit = createAIRateLimiter();

const resetAIRateLimitStore = () => buckets.clear();

module.exports = {
  aiRateLimit,
  createAIRateLimiter,
  resetAIRateLimitStore,
};
