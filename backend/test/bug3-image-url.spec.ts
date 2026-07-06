/**
 * Bug3 修复测试：前端图片 URL 解析
 *
 * 背景:
 *   miniapp-user 在显示 animal.photos 时直接用相对路径作为 <image :src>:
 *     :src="animal.photos?.[0]"
 *   但微信小程序不接受相对 URL - 必须是 http(s) 完整 URL 或本地包内路径.
 *   后端返回 "/static/uploads/xxx.jpg" 是正确设计, 前端需要拼上 BASE_URL.
 *
 *   miniapp-admin 已有 resolveImageUrl 工具正确处理, miniapp-user 缺失.
 *
 * 修复目标:
 *   1. miniapp-user/src/services/api.js 导出 resolveImageUrl(path)
 *   2. 6 处 .vue 文件改用 resolveImageUrl
 *   3. 解析结果应为完整 http URL, 浏览器可直接加载
 */
import { test, expect } from '@playwright/test';

// 这里重新声明 resolveImageUrl 逻辑 (前端 ESM, Playwright 用 CommonJS 跑)
// 必须与前端 api.js 中的实现完全一致, 否则测试无意义
//
// 关键设计点: 静态资源 URL 不在 API versioning 范围, 不应含 /v1
// - user 端:  BASE_URL = 'http://host:3000' (无 /v1),  resolveImageUrl 直接拼
// - admin 端: BASE_URL = 'http://host:3000/v1' (有 /v1), resolveImageUrl 应改用 STATIC_BASE_URL (无 /v1)
function resolveImageUrl(path: string, BASE_URL: string = 'http://192.168.32.1:3000'): string {
  if (!path) return '';
  if (path === 'undefined' || path === 'null') return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/static/mock/')) return path;
  return BASE_URL + path;
}

test.describe('Bug3 修复：前端图片 URL 解析', () => {

  test('1. user 端: 后端返回相对路径 /static/uploads/xxx.jpg 时, 应拼成完整 URL (无 /v1)', () => {
    // user 端 BASE_URL = 'http://192.168.32.1:3000' (无 /v1)
    const userBase = 'http://192.168.32.1:3000';
    const photoFromBackend = '/static/uploads/1781068107705_8nah0o1n.jpg';
    const resolved = resolveImageUrl(photoFromBackend, userBase);
    expect(resolved).toBe('http://192.168.32.1:3000/static/uploads/1781068107705_8nah0o1n.jpg');
  });

  test('1b. admin 端: 静态资源 URL 不能含 /v1 (否则 ServeStaticModule 404)', () => {
    // admin 端 BASE_URL = 'http://192.168.32.1:3000/v1' (有 /v1)
    // 错误做法: 直接用 BASE_URL 拼 → '/v1/static/uploads/...' → 404
    // 正确做法: admin 端 resolveImageUrl 必须用 STATIC_BASE_URL (无 /v1)
    const adminApiBase = 'http://192.168.32.1:3000/v1';
    const photoFromBackend = '/static/uploads/1781068472139_0c4fcmrp.jpg';

    // 真实 admin 端报错场景
    const wrongResolved = resolveImageUrl(photoFromBackend, adminApiBase);
    expect(wrongResolved, '直接用含 /v1 的 BASE_URL 拼静态资源会 404').toBe('http://192.168.32.1:3000/v1/static/uploads/1781068472139_0c4fcmrp.jpg');

    // admin 端实际应: resolveImageUrl 用 STATIC_BASE_URL (无 /v1)
    const adminStaticBase = 'http://192.168.32.1:3000';
    const correctResolved = resolveImageUrl(photoFromBackend, adminStaticBase);
    expect(correctResolved).toBe('http://192.168.32.1:3000/static/uploads/1781068472139_0c4fcmrp.jpg');
    expect(correctResolved, 'admin 端修复后 URL 不应含 /v1').not.toMatch(/\/v1\/static/);
  });

  test('2. 已经是 http 完整 URL 时, 不应重复拼接', () => {
    const url = 'https://cdn.example.com/dog.jpg';
    expect(resolveImageUrl(url)).toBe(url);
  });

  test('3. 本地包内 mock 资源 /static/mock/xxx 应原样返回 (不被拼 baseURL)', () => {
    const mock = '/static/mock/dog-placeholder.png';
    expect(resolveImageUrl(mock)).toBe(mock);
  });

  test('4. 空值/无效值应返回空字符串 (避免渲染 "undefined"/"null")', () => {
    expect(resolveImageUrl('')).toBe('');
    expect(resolveImageUrl(undefined as any)).toBe('');
    expect(resolveImageUrl(null as any)).toBe('');
    // 防御脏数据: 字符串 "undefined"/"null"
    expect(resolveImageUrl('undefined')).toBe('');
    expect(resolveImageUrl('null')).toBe('');
  });

  test('5. 集成验证: 后端实际返回的 photos 数组, 全部能解析成可访问 URL', async ({ request }) => {
    // 实际拉一个走"采集新建"渠道的动物
    const r = await request.get('/v1/animals/287d9338-f2aa-4951-855f-50d0dd2ca49a');
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    const photos: string[] = body.data?.photos || [];

    expect(photos.length).toBeGreaterThan(0);
    const photoUrl = photos[0];
    expect(photoUrl).toMatch(/^\/static\/uploads\//);  // 后端返回相对路径

    // 解析后, 完整 URL 应能在 HTTP 层访问
    const resolved = resolveImageUrl(photoUrl, 'http://127.0.0.1:3000');
    const fetchRes = await request.get(resolved.replace('http://127.0.0.1:3000', ''));
    expect(fetchRes.ok()).toBeTruthy();
    expect(fetchRes.headers()['content-type']).toMatch(/image/);
  });

  test('6. user 端 api.js: resolveImageUrl 用 BASE_URL (无 /v1)', async () => {
    const fs = require('fs');
    const path = require('path');
    const apiJsPath = path.resolve(__dirname, '..', '..', 'miniapp-user', 'src', 'services', 'api.js');
    const content = fs.readFileSync(apiJsPath, 'utf-8');

    expect(content).toMatch(/export\s+function\s+resolveImageUrl/);
    expect(content).toMatch(/BASE_URL\s*\+\s*path/);
    expect(content).toMatch(/startsWith\(['"]\/static\/mock\//);

    // user 端 BASE_URL 必须不含 /v1 (user 端 fullPath 主动加 /v1)
    const baseUrlMatch = content.match(/const\s+BASE_URL\s*=\s*['"]([^'"]+)['"]/);
    expect(baseUrlMatch, 'user 端 BASE_URL 必须定义').toBeTruthy();
    expect(baseUrlMatch![1], 'user 端 BASE_URL 不应含 /v1').not.toMatch(/\/v1$/);
  });

  test('7. 6 个 .vue 文件必须 import 并使用 resolveImageUrl', async () => {
    const fs = require('fs');
    const path = require('path');
    const userSrc = path.resolve(__dirname, '..', '..', 'miniapp-user', 'src');

    const filesToCheck = [
      'pages/animal-detail/index.vue',
      'pages/index/index.vue',
      'pages/claim/index.vue',
      'pages/collect/result.vue',
      'components/animal-card/index.vue',
      'components/match-result-card/index.vue',
    ];

    for (const f of filesToCheck) {
      const full = path.join(userSrc, f);
      const content = fs.readFileSync(full, 'utf-8');
      // 必须 import resolveImageUrl
      expect(content, `${f} 缺 import { resolveImageUrl }`).toMatch(/import\s*\{[^}]*resolveImageUrl[^}]*\}\s*from\s*['"][^'"]*services\/api['"]/);
      // 必须至少一处使用 resolveImageUrl(...)
      expect(content, `${f} 未调用 resolveImageUrl(...)`).toMatch(/resolveImageUrl\s*\(/);
    }
  });

  test('8. admin 端 5 个 .vue 文件所有动态 image src 必须全部用 resolveImageUrl 包装', async () => {
    // Phase 1 调查发现的 admin 端所有动态图片引用
    // 凡是 ":src=..." 后面不是以 /static/ 开头(本地资源) 或不是字符串字面量, 都需要走 resolveImageUrl
    const fs = require('fs');
    const path = require('path');
    const adminSrc = path.resolve(__dirname, '..', '..', 'miniapp-admin', 'src');

    // 已知应该用 resolveImageUrl 的所有 .vue 文件
    const filesToCheck = [
      'pages/animals/index.vue',
      'pages/animals/detail/index.vue',
      'pages/admin/audit/index.vue',
      'pages/admin/audit-detail/index.vue',
      'pages/users/detail/index.vue',  // ← 之前遗漏, 包含 animal-thumb 和 avatar
    ];

    for (const f of filesToCheck) {
      const full = path.join(adminSrc, f);
      const content = fs.readFileSync(full, 'utf-8');
      // 必须 import resolveImageUrl
      expect(content, `${f} 缺 import { resolveImageUrl }`).toMatch(/import\s*\{[^}]*resolveImageUrl[^}]*\}\s*from\s*['"][^'"]*services\/api['"]/);
      // 必须至少一处使用 resolveImageUrl(...)
      expect(content, `${f} 未调用 resolveImageUrl(...)`).toMatch(/resolveImageUrl\s*\(/);

      // 抓出所有 ":src=..." 表达式 (排除 /static/ 字符串字面量)
      const srcMatches = content.match(/:src="[^"]+"/g) || [];
      for (const m of srcMatches) {
        // 字符串字面量 (如 "/static/mock/xxx.png") 跳过
        if (/:src="\/static\//.test(m)) continue;
        // 应当包含 resolveImageUrl(...)
        expect(m, `${f} 动态 src 没走 resolveImageUrl: ${m}`).toMatch(/resolveImageUrl\s*\(/);
      }
    }
  });

  test('9. admin 端 api.js: resolveImageUrl 必须用 STATIC_BASE_URL (无 /v1)', async () => {
    // 真实场景: 静态资源路由不走 URI versioning, 不能含 /v1
    // admin 端 BASE_URL 含 /v1, 所以 resolveImageUrl 必须用单独的 STATIC_BASE_URL
    const fs = require('fs');
    const path = require('path');
    const apiJsPath = path.resolve(__dirname, '..', '..', 'miniapp-admin', 'src', 'services', 'api.js');
    const content = fs.readFileSync(apiJsPath, 'utf-8');

    expect(content).toMatch(/export\s+function\s+resolveImageUrl/);

    // 必须有 STATIC_BASE_URL (无 /v1) 用于拼静态资源
    const staticBaseMatch = content.match(/(?:const|let|var)\s+STATIC_BASE_URL\s*=\s*['"]([^'"]+)['"]/);
    expect(staticBaseMatch, 'admin 端必须定义 STATIC_BASE_URL').toBeTruthy();
    expect(staticBaseMatch![1], 'STATIC_BASE_URL 不应含 /v1').not.toMatch(/\/v1/);

    // resolveImageUrl 函数体里必须用 STATIC_BASE_URL (不是 BASE_URL)
    const resolveFnMatch = content.match(/export\s+function\s+resolveImageUrl[\s\S]+?\n\}/);
    expect(resolveFnMatch, 'resolveImageUrl 函数体').toBeTruthy();
    expect(resolveFnMatch![0], 'resolveImageUrl 内部应使用 STATIC_BASE_URL 拼路径').toMatch(/STATIC_BASE_URL\s*\+\s*path/);
  });

  test('10. 端到端: 用 admin 端真实拼 URL 方式必须能 200 访问', async ({ request }) => {
    // 模拟 admin 端修复后的逻辑: STATIC_BASE_URL = 'http://host:3000' (无 /v1)
    const STATIC_BASE = 'http://127.0.0.1:3000';  // 测试用 127.0.0.1
    const photoPath = '/static/uploads/1781068107705_8nah0o1n.jpg';
    const resolved = STATIC_BASE + photoPath;

    const r = await request.get(resolved);
    expect(r.ok(), `admin 端 resolveImageUrl 拼出的 URL 应可访问`).toBeTruthy();
    expect(r.headers()['content-type']).toMatch(/image/);

    // 反例: 含 /v1 的 URL 必须 404
    const wrongUrl = 'http://127.0.0.1:3000/v1' + photoPath;
    const wrongRes = await request.get(wrongUrl);
    expect(wrongRes.ok(), `含 /v1 的 URL 应 404`).toBeFalsy();
    expect(wrongRes.status()).toBe(404);
  });
});
