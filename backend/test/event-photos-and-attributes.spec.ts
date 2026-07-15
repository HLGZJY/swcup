import { test, expect } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:3000'
const API = '/v1'

async function login(ctx: any) {
  const r = await ctx.post(`${API}/auth/login`, {
    data: { phone: '13900000088', password: 'admin123' },
  })
  expect(r.ok()).toBeTruthy()
  return (await r.json()).data.token as string
}

test('report → admin create_new → animal.photos + 三属性', async ({ request }) => {
  const token = await login(request)

  // 1. 上传图片拿到 URL
  const uploadRes = await request.post(`${API}/upload`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: { name: 'test.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake-jpg') },
    },
  })
  expect(uploadRes.ok()).toBeTruthy()
  const photoUrl = (await uploadRes.json()).data?.url
  expect(typeof photoUrl).toBe('string')

  // 2. report 提交 (含三属性)
  const reportRes = await request.post(`${API}/events`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      event_type: 'report',
      intent: 'stray_sighting',
      species: 'dog',
      breed: '金毛',
      color: '金色',
      gender: 'male',
      age_estimate: 'junior',
      health_status: 'healthy',
      sterilized: true,
      location_lat: 30.5,
      location_lng: 114.3,
      address: 'test',
      description: '亲人',
      photos: [photoUrl],
    },
  })
  expect(reportRes.ok()).toBeTruthy()
  const eventId = (await reportRes.json()).data?.event_id
  expect(eventId).toBeTruthy()

  // 3. admin 同意新建
  const actionRes = await request.put(`${API}/admin/events/${eventId}/action`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { action: 'create_new' },
  })
  expect(actionRes.ok()).toBeTruthy()
  const animalId = (await actionRes.json()).data?.animal_id
  expect(animalId).toBeTruthy()

  // 4. 查 animal 详情
  const detailRes = await request.get(`${API}/animals/${animalId}`)
  expect(detailRes.ok()).toBeTruthy()
  const body = (await detailRes.json()).data
  expect(body.photos).toContain(photoUrl)
  expect(body.age_estimate).toBe('junior')
  expect(body.health_status).toBe('healthy')
  expect(body.sterilized).toBe(true)
})
