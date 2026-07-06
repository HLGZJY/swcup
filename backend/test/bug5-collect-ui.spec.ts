/**
 * Bug5 修复测试：collect/index.vue UI/UX 改进
 *
 * 背景:
 *   用户反馈 collect/index 页 3 个 UI 问题:
 *   1. 顶部绿色 header 显示 "鼻纹采集" 与微信原生导航栏重复
 *   2. 进度条 5 个 step 文字 20rpx 过小、#999 过浅、横向挤
 *   3. 拍摄取景框 #1A1A1A 黑底 + 30% 透明 placeholder + 多段文字堆叠
 *
 * 修复目标:
 *   1. 顶部 header 去掉 "鼻纹采集" title-main, 只保留副标题
 *   2. 步骤指示改为 progress bar + 步骤名（不在模板硬编码 5 步）
 *   3. 拍摄取景框改为浅色 bg + 单一 CTA + 相机图标
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const COLLECT_VUE = path.join(ROOT, 'miniapp-user', 'src', 'pages', 'collect', 'index.vue');
const collectContent = fs.readFileSync(COLLECT_VUE, 'utf-8');
const collectStyleMatch = collectContent.match(/<style[\s\S]*?<\/style>/);
const collectStyle = collectStyleMatch ? collectStyleMatch[0] : '';
const collectTemplateMatch = collectContent.match(/<template>([\s\S]*?)<\/template>/);
const collectTemplate = collectTemplateMatch ? collectTemplateMatch[1] : '';

test.describe('Bug5 修复：collect/index.vue UI/UX 改进', () => {

  test('1. 顶部 header 不再硬编码「鼻纹采集」title-main', () => {
    // 修复前: <text class="title-main">鼻纹采集</text>
    // 修复后: title-main 标签不应再包含 "鼻纹采集" 文本
    const hasOldTitle = /<text\s+class="title-main"[^>]*>\s*鼻纹采集\s*<\/text>/.test(collectTemplate);
    expect(hasOldTitle, '不应再有 <text class="title-main">鼻纹采集</text>').toBeFalsy();

    // 整个模板中不应该再出现 "鼻纹采集" 文字（避免再次重复）
    // 注: 仅在 template 范围内查, scripts 里可能有导航栏标题配置
    expect(collectTemplate.includes('鼻纹采集'), '模板中不应包含 "鼻纹采集" 文本').toBeFalsy();
  });

  test('2. 步骤指示改为 progress bar 形式（不再有 5 个并排 step-item）', () => {
    // 修复前: 5 个 .step-item 横向排列
    // 修复后: 进度条 + 步骤名
    const hasStepItem = /\.step-item\s*\{/.test(collectStyle);
    expect(hasStepItem, '样式中不应再有 .step-item 块').toBeFalsy();

    const hasStepLine = /\.step-line/.test(collectStyle);
    expect(hasStepLine, '样式中不应再有 .step-line').toBeFalsy();

    // 应有 progress bar 样式
    const hasProgressBar = /\.steps-progress/.test(collectStyle) || /\.progress-bar/.test(collectStyle);
    expect(hasProgressBar, '应有 progress bar 样式').toBeTruthy();

    // 步骤名应动态绑定，不应硬编码 5 步
    // 检查模板中应有"步骤 X / Y"的展示方式
    const hasStepCounter = /步骤\s*\{\{/.test(collectTemplate) || /currentStep\s*\+\s*1/.test(collectTemplate);
    expect(hasStepCounter, '应有动态步骤计数器').toBeTruthy();
  });

  test('3. 拍摄取景框不再使用 #1A1A1A 黑底', () => {
    // 修复前: background: #1A1A1A;
    // 修复后: 浅色 bg
    const hasBlackCamera = /\.camera-area\s*\{[^}]*background:\s*#1A1A1A/.test(collectStyle);
    expect(hasBlackCamera, 'camera-area 不应再用 #1A1A1A 黑底').toBeFalsy();

    // camera-placeholder 30% opacity 也不应保留
    const hasFadedPlaceholder = /\.camera-placeholder\s*\{[^}]*opacity:\s*0\.3/.test(collectStyle);
    expect(hasFadedPlaceholder, 'camera-placeholder 不应再用 0.3 opacity').toBeFalsy();
  });

  test('4. 拍摄取景框有清晰的单一 CTA 和相机图标', () => {
    // 模板里应有相机图标引用
    const hasCameraIcon = /icon-camera\.svg/.test(collectTemplate);
    expect(hasCameraIcon, '应有 icon-camera.svg 引用').toBeTruthy();

    // 样式里应有 camera-icon-wrap 圆形背景容器
    const hasIconWrap = /\.camera-icon-wrap/.test(collectStyle);
    expect(hasIconWrap, '应有 .camera-icon-wrap 样式').toBeTruthy();

    // 单一 CTA 文字（不应有 camera-text 同时叠加 camera-hint 在 overlay 中）
    // 修复前: <text class="camera-text">点击拍摄</text> + <text class="camera-hint">...</text>
    // 修复后: 一个 camera-text，camera-hint 移出 overlay（如果保留）
    const hasOldOverlay = /camera-overlay[\s\S]*?camera-text[\s\S]*?camera-hint[\s\S]*?<\/view>/.test(collectTemplate);
    expect(hasOldOverlay, 'camera-overlay 内不应同时堆叠 camera-text 和 camera-hint').toBeFalsy();
  });
});
