const assert = require('node:assert/strict');
const http = require('node:http');
const { test } = require('node:test');

const app = require('../server');

const request = (method, path) => new Promise((resolve, reject) => {
  const server = http.createServer(app);

  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    const req = http.request(
      { method, port, host: '127.0.0.1', path },
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
