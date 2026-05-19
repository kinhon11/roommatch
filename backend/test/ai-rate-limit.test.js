const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const { createAIRateLimiter, resetAIRateLimitStore } = require('../middleware/aiRateLimit');

const createRes = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  set(name, value) {
    this.headers[name] = value;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

const runLimiter = (limiter, req) => {
  const res = createRes();
  let passed = false;
  limiter(req, res, () => { passed = true; });
  return { res, passed };
};

afterEach(() => {
  resetAIRateLimitStore();
});

test('AI rate limit blocks repeated requests in the same window', () => {
  let time = 1_000;
  const limiter = createAIRateLimiter({
    scope: 'test-ai',
    maxRequests: 2,
    windowMs: 10_000,
    now: () => time,
  });
  const req = { user: { id: 'user-1' }, ip: '127.0.0.1' };

  assert.equal(runLimiter(limiter, req).passed, true);
  const second = runLimiter(limiter, req);
  assert.equal(second.passed, true);
  assert.equal(second.res.headers['X-RateLimit-Remaining'], '0');

  const third = runLimiter(limiter, req);
  assert.equal(third.passed, false);
  assert.equal(third.res.statusCode, 429);
  assert.match(third.res.body.error, /AI quá nhanh/i);
  assert.equal(third.res.headers['Retry-After'], '10');

  time += 10_001;
  assert.equal(runLimiter(limiter, req).passed, true);
});

test('AI rate limit buckets authenticated users separately from anonymous IPs', () => {
  const limiter = createAIRateLimiter({
    scope: 'test-ai-isolation',
    maxRequests: 1,
    windowMs: 10_000,
    now: () => 1_000,
  });

  assert.equal(runLimiter(limiter, { user: { id: 'user-1' }, ip: 'same-ip' }).passed, true);
  assert.equal(runLimiter(limiter, { user: { id: 'user-2' }, ip: 'same-ip' }).passed, true);
  assert.equal(runLimiter(limiter, { ip: '1.1.1.1' }).passed, true);

  const repeatedAnonymous = runLimiter(limiter, { ip: '1.1.1.1' });
  assert.equal(repeatedAnonymous.passed, false);
  assert.equal(repeatedAnonymous.res.statusCode, 429);
});
