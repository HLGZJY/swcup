import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';
const API = '/v1';

async function login(request: any) {
  const response = await request.post(`${BASE_URL}${API}/auth/login`, {
    data: { phone: '13900000001', password: 'admin123' },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body?.data?.token).toBeTruthy();
  return body.data.token as string;
}

test.describe('collect 必须使用 JWT', () => {
  test('无 token 调用 collect 返回 401，而不是业务 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}${API}/nose/collect`, {
      data: {
        nose_photo: '',
        species: 'dog',
        location_lat: 30.49984,
        location_lng: 114.34253,
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(String(body.message)).toContain('未登录');
  });

  test('有效 token 的无鼻纹 collect 首次请求即成功', async ({ request }) => {
    const token = await login(request);
    const response = await request.post(`${BASE_URL}${API}/nose/collect`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        nose_photo: '',
        body_photo_url: '/static/uploads/collect-auth-test.jpg',
        species: 'dog',
        breed: '金毛',
        color: '金色',
        gender: 'male',
        location_lat: 30.49984,
        location_lng: 114.34253,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect([
      'show_high_score_dialog',
      'show_low_score_dialog',
      'show_no_candidate_dialog',
    ]).toContain(body?.data?.next_action);
    expect(Array.isArray(body?.data?.candidates)).toBe(true);
  });
});
