const assert = require('node:assert/strict');
const http = require('node:http');
const { test } = require('node:test');

const app = require('../server');

const request = (method, path, body = null) => new Promise((resolve, reject) => {
  const server = http.createServer(app);

  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        method,
        port,
        host: '127.0.0.1',
        path,
        headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : undefined,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          server.close();
          resolve({ statusCode: res.statusCode, body: body ? JSON.parse(body) : null });
        });
      }
    );

    req.on('error', (error) => {
      server.close();
      reject(error);
    });
    if (payload) req.write(payload);
    req.end();
  });
});

test('GET /api/health returns API health payload', async () => {
  const res = await request('GET', '/api/health');

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'OK');
  assert.equal(res.body.project, 'RoommieMatch API');
  assert.match(res.body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test('unknown API route returns JSON 404', async () => {
  const res = await request('GET', '/api/does-not-exist');

  assert.equal(res.statusCode, 404);
  assert.match(res.body.error, /Route/i);
});

test('protected routes reject missing tokens before database access', async () => {
  const res = await request('GET', '/api/profile');

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Unauthorized: No token provided.');
});

test('public AI review summary validates required review data', async () => {
  const res = await request('POST', '/api/ai/review-summary', {});

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /review/i);
});

test('AI listing analysis stays protected for landlords', async () => {
  const res = await request('POST', '/api/ai/analyze-listing', {});

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Unauthorized: No token provided.');
});

test('AI assistant validates input even without auth', async () => {
  const res = await request('POST', '/api/ai/assistant', {});

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /vui lòng nhập/i);
});
