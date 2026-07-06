const { request } = require('@playwright/test');
(async () => {
  const ctx = await request.newContext({ baseURL: 'http://127.0.0.1:3000/v1' });
  const res = await ctx.post('/auth/login', { data: { phone: '13900000001', password: 'admin123' } });
  console.log('URL:', res.url(), 'status:', res.status());
  const text = await res.text();
  console.log('body:', text.slice(0, 200));
  await ctx.dispose();
})();
