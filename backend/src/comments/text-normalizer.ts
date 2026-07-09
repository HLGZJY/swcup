// -*- coding: utf-8 -*-
/**
 * text-normalizer.ts
 * 阶段 B: 评论文本清洗前置 (PR #1)
 *
 * 严格按 plan §B3 顺序:
 *   1. URL / 邮箱剥离
 *   2. emoji / 特殊符号
 *   3. 全角 → 半角 (ASCII 可打印区段)
 *   4. 简繁转换 (内置 ~60 字 map, 不引外部库)
 *   5. 空白归一 (多空白→单空格, trim)
 *
 * 保留中文标点 `，。！？` (保留语义)
 * 清洗失败容忍: 调用方 try/catch, 失败 fallback 到原 content
 */
import { Injectable } from '@nestjs/common';

const URL_RE = /(https?:\/\/[^\s]+|[\w.+-]+@[\w-]+\.[a-z]{2,})/gi;
// emoji + 杂项符号: 表情区段 + 杂项符号
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
// ASCII 可打印全角区段: U+FF01 (!) ~ U+FF5E (~)
const FULLWIDTH_RE = /[\uFF01-\uFF5E]/g;

// 简繁映射 (60 个常用字, 涵盖寻宠评论高频)
const T2S_MAP: Record<string, string> = {
  個: '个', 們: '们', 來: '来', 時: '时', 會: '会', 說: '说',
  對: '对', 為: '为', 沒: '没', 發: '发', 經: '经', 當: '当',
  車: '车', 見: '见', 長: '长', 門: '门', 開: '开', 關: '关',
  隻: '只', 條: '条', 邊: '边', 裡: '里', 給: '给', 還: '还',
  過: '过', 進: '进', 點: '点', 麼: '么', 從: '从', 請: '请',
  讓: '让', 幫: '帮', 謝: '谢', 醫: '医', 園: '园', 區: '区',
  場: '场', 樓: '楼', 號: '号', 節: '节', 聲: '声', 線: '线',
  蘭: '兰', 華: '华', 張: '张', 處: '处', 報: '报', 認: '认',
  記: '记', 話: '话', 視: '视', 體: '体', 學: '学', 業: '业',
  東: '东', 貓: '猫',
};

function fullwidthToHalf(ch: string): string {
  return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
}

function t2sConvert(text: string): string {
  // 逐字替换, 1 字 = 1 替换, O(n)
  let out = '';
  for (const ch of text) {
    out += T2S_MAP[ch] || ch;
  }
  return out;
}

@Injectable()
export class TextNormalizer {
  /**
   * 5 步清洗. 失败抛错, 由调用方决定是否回退.
   */
  normalize(text: string): string {
    if (!text) return '';
    let s = String(text);

    // 1. URL / 邮箱剥离
    s = s.replace(URL_RE, '');

    // 2. emoji / 特殊符号
    s = s.replace(EMOJI_RE, '');

    // 3. 全角 → 半角 (ASCII 可打印)
    s = s.replace(FULLWIDTH_RE, fullwidthToHalf);

    // 4. 简繁转换
    s = t2sConvert(s);

    // 5. 空白归一 (多空白→单空格, trim)
    s = s.replace(/\s+/g, ' ').trim();

    return s;
  }
}
