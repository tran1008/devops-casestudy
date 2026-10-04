const request = require('supertest');
const app = require('../src/index');

describe('demo-app', () => {
  it('GET / trả về service name', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.service).toBe('demo-app');
  });
  it('GET /health trả 200', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
  });
});
