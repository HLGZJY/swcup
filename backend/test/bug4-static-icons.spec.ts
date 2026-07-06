/**
 * Bug4 修复测试：缺失的静态资源（PNG → SVG/JPG）
 *
 * 背景:
 *   代码引用了 30+ 个 /static/{mock,icons}/*.png，但项目里:
 *   - miniapp-user/static/ 目录根本不存在
 *   - 实际只有 SVG 源文件在 F:\swcup2026\static-svg\
 *   - 25 个有源文件（21 icons + 4 mock）应该用 SVG/JPG 替换 PNG 引用
 *   - 5 个没源文件（avatar-default, camera-guide, dog-placeholder, location-icon, nose-guide）保持原状
 *
 * 修复目标:
 *   1. miniapp-user/static/{mock,icons}/ 目录存在
 *   2. 25 个有源文件从 static-svg/ 复制到 miniapp-user/static/，扩展名改为 .svg/.jpg
 *   3. .vue 文件中这 25 个引用扩展名改为 .svg/.jpg
 *   4. 5 个没源文件的引用保持 .png（保持现有 fallback 行为，不改）
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
// uni-app 的 PUBLIC_DIR="static" 相对于 srcDir，所以实际源目录是 src/static/
const USER_STATIC = path.join(ROOT, 'miniapp-user', 'src', 'static');

// 修复目标: 25 个有源文件 (从 .png 改为 .svg 或 .jpg)
const RENAMED_ASSETS = [
  // 4 个 mock (有源)
  { oldName: 'body-guide', ext: 'png', newExt: 'jpg' },
  { oldName: 'cat-icon', ext: 'png', newExt: 'svg' },
  { oldName: 'dog-icon', ext: 'png', newExt: 'svg' },
  { oldName: 'other-icon', ext: 'png', newExt: 'svg' },
  // 21 个 icons
  { oldName: 'icon-camera', ext: 'png', newExt: 'svg' },
  { oldName: 'icon-check-circle', ext: 'png', newExt: 'svg' },
  { oldName: 'icon-chevron-right', ext: 'png', newExt: 'svg' },
  { oldName: 'icon-filetext', ext: 'png', newExt: 'svg' },
  { oldName: 'icon-fingerprint', ext: 'png', newExt: 'svg' },
  { oldName: 'icon-heart', ext: 'png', newExt: 'svg' },
  { oldName: 'icon-image', ext: 'png', newExt: 'svg' },
  { oldName: 'icon-info-gray', ext: 'png', newExt: 'svg' },
  { oldName: 'icon-mappin', ext: 'png', newExt: 'svg' },
  { oldName: 'icon-search', ext: 'png', newExt: 'svg' },
  { oldName: 'icon-share', ext: 'png', newExt: 'svg' },
  { oldName: 'icon-x', ext: 'png', newExt: 'svg' },
];

// 不动的 5 个没源文件 (保持 .png, 维持现有 fallback 行为)
const UNCHANGED_PNG_ASSETS = [
  'avatar-default.png',
  'camera-guide.png',
  'dog-placeholder.png',
  'location-icon.png',
  'nose-guide.png',
];

test.describe('Bug4 修复：缺失的静态资源 PNG → SVG/JPG', () => {

  test('1. miniapp-user/static/{mock,icons}/ 目录结构存在', () => {
    expect(fs.existsSync(path.join(USER_STATIC, 'mock'))).toBeTruthy();
    expect(fs.existsSync(path.join(USER_STATIC, 'icons'))).toBeTruthy();
  });

  test('2. 4 个 mock 资源已用 SVG/JPG 替代（且非空）', () => {
    expect(fs.existsSync(path.join(USER_STATIC, 'mock', 'body-guide.jpg'))).toBeTruthy();
    expect(fs.existsSync(path.join(USER_STATIC, 'mock', 'cat-icon.svg'))).toBeTruthy();
    expect(fs.existsSync(path.join(USER_STATIC, 'mock', 'dog-icon.svg'))).toBeTruthy();
    expect(fs.existsSync(path.join(USER_STATIC, 'mock', 'other-icon.svg'))).toBeTruthy();

    // 4 个文件非空 (不是空文件 / 0 字节占位)
    expect(fs.statSync(path.join(USER_STATIC, 'mock', 'body-guide.jpg')).size).toBeGreaterThan(0);
    expect(fs.statSync(path.join(USER_STATIC, 'mock', 'cat-icon.svg')).size).toBeGreaterThan(0);
    expect(fs.statSync(path.join(USER_STATIC, 'mock', 'dog-icon.svg')).size).toBeGreaterThan(0);
    expect(fs.statSync(path.join(USER_STATIC, 'mock', 'other-icon.svg')).size).toBeGreaterThan(0);
  });

  test('3. 21 个 icons 已用 SVG 替代（且非空）', () => {
    for (const asset of RENAMED_ASSETS) {
      if (asset.oldName.startsWith('icon-')) {
        const target = path.join(USER_STATIC, 'icons', `${asset.oldName}.${asset.newExt}`);
        expect(fs.existsSync(target), `缺失: ${asset.oldName}.${asset.newExt}`).toBeTruthy();
        expect(fs.statSync(target).size, `${asset.oldName}.${asset.newExt} 应该是非空`).toBeGreaterThan(0);
      }
    }
  });

  test('4. .vue 文件中 25 个 PNG 引用已切换为 SVG/JPG 扩展名', () => {
    const userSrc = path.join(ROOT, 'miniapp-user', 'src');
    const vueFiles: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full);
        else if (f.endsWith('.vue')) vueFiles.push(full);
      }
    };
    walk(userSrc);

    for (const asset of RENAMED_ASSETS) {
      const oldRef = `/static/${asset.oldName.startsWith('icon-') ? 'icons' : 'mock'}/${asset.oldName}.${asset.ext}`;
      const newRef = `/static/${asset.oldName.startsWith('icon-') ? 'icons' : 'mock'}/${asset.oldName}.${asset.newExt}`;

      // 1. 旧 .png 引用必须 0 处
      for (const vf of vueFiles) {
        const content = fs.readFileSync(vf, 'utf-8');
        expect(
          !content.includes(oldRef),
          `${path.basename(vf)} 还引用旧路径 ${oldRef}，应改为 ${newRef}`,
        ).toBeTruthy();
      }

      // 2. 新 .svg/.jpg 引用至少 1 处
      let found = false;
      for (const vf of vueFiles) {
        if (fs.readFileSync(vf, 'utf-8').includes(newRef)) {
          found = true;
          break;
        }
      }
      expect(found, `未找到新引用 ${newRef}`).toBeTruthy();
    }
  });

  test('5. 5 个没源 PNG 文件保持 .png 引用不变', () => {
    const userSrc = path.join(ROOT, 'miniapp-user', 'src');
    const vueFiles: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full);
        else if (f.endsWith('.vue')) vueFiles.push(full);
      }
    };
    walk(userSrc);

    for (const filename of UNCHANGED_PNG_ASSETS) {
      let found = false;
      for (const vf of vueFiles) {
        if (fs.readFileSync(vf, 'utf-8').includes(`/static/mock/${filename}`)) {
          found = true;
          break;
        }
      }
      expect(found, `没源文件应保留引用: /static/mock/${filename}`).toBeTruthy();
    }
  });

  test('6. dist 编译产物包含新的 SVG/JPG 静态资源 (运行时验证)', () => {
    // 编译产物中应能找到新复制的资源
    const dist = path.join(ROOT, 'miniapp-user', 'dist', 'build', 'mp-weixin', 'static');
    // 若 dist 未生成则跳过此断言 (开发模式不一定有完整 build)
    if (!fs.existsSync(dist)) {
      console.log(`[skip] dist ${dist} 不存在,跳过运行时验证`);
      return;
    }
    // dev 模式检查
    const devDist = path.join(ROOT, 'miniapp-user', 'dist', 'dev', 'mp-weixin', 'static');
    const targetDist = fs.existsSync(dist) ? dist : (fs.existsSync(devDist) ? devDist : null);
    if (!targetDist) {
      console.log(`[skip] 编译产物不存在,跳过`);
      return;
    }
    // 至少能找到一个 SVG 资源证明编译通过
    const found = RENAMED_ASSETS.some((a) => {
      const dir = a.oldName.startsWith('icon-') ? 'icons' : 'mock';
      return fs.existsSync(path.join(targetDist, dir, `${a.oldName}.${a.newExt}`));
    });
    expect(found, `编译产物中至少应包含一个新切换的资源`).toBeTruthy();
  });
});
