// -*- coding: utf-8 -*-
/**
 * 【2026-07-09 阶段 B】TextNormalizer 单元测试
 *
 * 覆盖:
 *   1) URL 剥离 (https://, http://, email)
 *   2) emoji / 特殊符号剥离
 *   3) 全角 → 半角
 *   4) 简繁转换 (常用 ~10 字)
 *   5) 空白归一 (多空白→单空格, trim)
 *   6) 保留中文标点 (，。！？)
 *   7) 空字符串 / null 边界
 */
import { TextNormalizer } from '../text-normalizer';

describe('TextNormalizer (阶段 B)', () => {
  let n: TextNormalizer;

  beforeEach(() => {
    n = new TextNormalizer();
  });

  describe('5 步清洗顺序', () => {
    it('URL 剥离', () => {
      // URL 剥离后留 1 空格, 再经空白归一 → 单空格
      expect(n.normalize('看这里 https://example.com 找到狗')).toBe('看这里 找到狗');
      expect(n.normalize('邮箱 abc@def.com 联系我')).toBe('邮箱 联系我');
    });

    it('emoji 剥离', () => {
      // 表情 U+1F600 (😀) 应被剥离
      const input = '看到小狗 \u{1F600} 太棒了';
      const out = n.normalize(input);
      expect(out).not.toContain('\u{1F600}');
      expect(out.trim()).toBe('看到小狗 太棒了');
    });

    it('全角 → 半角', () => {
      // 全角逗号 = U+FF0C, 全角空格 = U+3000
      expect(n.normalize('你好\uFF0C\u3000世界')).toBe('你好, 世界');
    });

    it('简繁转换 (个字)', () => {
      // 個 → 个, 來 → 来, 時 → 时 (注意: 這 不在 ~50 字 T2S_MAP 中, 保持繁体)
      expect(n.normalize('昨天看到一個狗')).toBe('昨天看到一个狗');
      expect(n.normalize('這個時候來找我')).toBe('這个时候来找我');
    });

    it('空白归一', () => {
      expect(n.normalize('  看到  \n\n  狗  ')).toBe('看到 狗');
    });

    it('保留中文标点 (，。！？)', () => {
      const out = n.normalize('你好,世界!看到狗?');
      expect(out).toBe('你好,世界!看到狗?');
    });
  });

  describe('组合 case (顺序敏感)', () => {
    it('URL + 空白归一', () => {
      // URL 留 1 空格 + 多空白 → 单空格
      expect(n.normalize('  看 https://x.com  这里  ')).toBe('看 这里');
    });

    it('emoji + 中文标点保留', () => {
      // 😀 在前面, 句号保留
      const input = '\u{1F600} 看到狗,';
      const out = n.normalize(input);
      expect(out).toBe('看到狗,');
    });

    it('简繁 + 全角', () => {
      // 個 (繁) + 全角逗号
      expect(n.normalize('一個\uFF0C狗')).toBe('一个,狗');
    });
  });

  describe('边界', () => {
    it('空字符串 → 返回空字符串', () => {
      expect(n.normalize('')).toBe('');
    });

    it('null / undefined → 返回空字符串', () => {
      expect(n.normalize(null as any)).toBe('');
      expect(n.normalize(undefined as any)).toBe('');
    });

    it('纯空白 → 返回空字符串', () => {
      expect(n.normalize('   \t\n  ')).toBe('');
    });

    it('纯 URL → 返回空字符串 (全剥离后无内容)', () => {
      expect(n.normalize('https://x.com')).toBe('');
    });
  });

  describe('不变性: 不破坏中文 (中文文本保持原样)', () => {
    it('普通中文评论 unchanged (仅 trim/空白归一)', () => {
      expect(n.normalize('  昨天在朝阳公园看到金毛  ')).toBe('昨天在朝阳公园看到金毛');
    });
  });
});
