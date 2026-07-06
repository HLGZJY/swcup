/**
 * 多部位颜色取色器 E2E（占位骨架）
 *
 * 实际状态：
 * - 项目 e2e-tests 现有约定是基于 fetch 的 HTTP 测试（见 run-e2e.js / run-flow-e2e.js）
 * - UI 取色器在微信开发者工具里手动跑（canvas/getImageData 需要真实运行环境）
 * - 本文件只保留骨架结构，等真 E2E 基础设施落地后再补全
 *
 * 9 个用例 (TC-PICK-001 ~ 009)：
 * - 001 进入 picker
 * - 002 切部位 + 点照片
 * - 003 切第二部位 + 点照片
 * - 004 覆盖 modal
 * - 005 切照片 cursor 保留
 * - 006 5 部位完成激活
 * - 007 4 部位完成 disabled
 * - 008 step 4 展开 7 部位
 * - 009 提交带 body_colors
 *
 * 当前已覆盖（vitest）：
 * - PhotoCanvas matchNearestColor 10 用例
 * - SamplePreview 6 用例
 * - PartTabs 6 用例
 * - ColorPicker 容器 11 用例
 *
 * 待覆盖（手动 / 未来 Appium）：
 * - TC-PICK-001 ~ 009 UI 行为
 */

// 占位：等真实 UI 自动化框架落地后补全
const tests = [
  { id: 'TC-PICK-001', name: '进入 picker', status: 'manual' },
  { id: 'TC-PICK-002', name: '切部位 + 点照片', status: 'manual' },
  { id: 'TC-PICK-003', name: '切第二部位 + 点照片', status: 'manual' },
  { id: 'TC-PICK-004', name: '覆盖 modal', status: 'manual' },
  { id: 'TC-PICK-005', name: '切照片 cursor 保留', status: 'manual' },
  { id: 'TC-PICK-006', name: '5 部位完成激活', status: 'manual' },
  { id: 'TC-PICK-007', name: '4 部位完成 disabled', status: 'manual' },
  { id: 'TC-PICK-008', name: 'step 4 展开 7 部位', status: 'manual' },
  { id: 'TC-PICK-009', name: '提交带 body_colors', status: 'manual' },
]

module.exports = { tests }