// -*- coding: utf-8 -*-
/**
 * 【2026-07-09 阶段 D】ClueStatsService — 线索统计落盘
 *
 * 每日 0 点扫描 data/clue_state/*.json, 输出 _stats/YYYY-MM-DD.json。
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { MatchRecord } from './file-state-store';

export interface KeywordCount {
  keyword: string;
  count: number;
}

export interface ClueDailyStats {
  date: string;
  generated_at: string;
  total: number;
  pending_count: number;
  confirmed_count: number;
  rejected_count: number;
  hit_rate: number;
  average_match_score: number;
  top_keywords: KeywordCount[];
  rejected_keywords: KeywordCount[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_LIMIT = 20;

@Injectable()
export class ClueStatsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClueStatsService.name);
  private readonly stateDir: string;
  private firstRunTimer: NodeJS.Timeout | null = null;
  private dailyTimer: NodeJS.Timeout | null = null;

  constructor(private readonly cfg: ConfigService) {
    this.stateDir =
      this.cfg.get<string>('CLUE_STATE_DIR') ||
      path.join(process.cwd(), 'data', 'clue_state');
  }

  onModuleInit(): void {
    if (this.cfg.get<string>('CLUE_STATS_DISABLE_SCHEDULER') === '1') return;
    this.ensureTodayStats(new Date());
    this.scheduleDailyStats();
  }

  onModuleDestroy(): void {
    if (this.firstRunTimer) clearTimeout(this.firstRunTimer);
    if (this.dailyTimer) clearInterval(this.dailyTimer);
  }

  generateDailyStats(now = new Date()): ClueDailyStats {
    const date = this.formatDate(now);
    const records = this.loadRecords();
    const total = records.length;
    const confirmedCount = this.countByStatus(records, 'confirmed');
    const rejectedCount = this.countByStatus(records, 'rejected');
    const pendingCount = this.countByStatus(records, 'pending');
    const scoreSum = records.reduce((sum, r) => sum + this.asScore(r.match_score), 0);
    const stats: ClueDailyStats = {
      date,
      generated_at: now.toISOString(),
      total,
      pending_count: pendingCount,
      confirmed_count: confirmedCount,
      rejected_count: rejectedCount,
      hit_rate: total > 0 ? confirmedCount / total : 0,
      average_match_score: total > 0 ? scoreSum / total : 0,
      top_keywords: this.topKeywords(records),
      rejected_keywords: this.topKeywords(records.filter((r) => r.status === 'rejected')),
    };
    this.writeStats(stats);
    return stats;
  }

  getStatsDir(): string {
    return path.join(this.stateDir, '_stats');
  }

  private ensureTodayStats(now: Date): void {
    const p = this.statsPath(this.formatDate(now));
    if (fs.existsSync(p)) return;
    try {
      this.generateDailyStats(now);
    } catch (e: any) {
      this.logger.warn(`[ClueStatsService] startup stats skipped: ${e?.message || e}`);
    }
  }

  private scheduleDailyStats(): void {
    const delay = this.msUntilNextMidnight(new Date());
    this.firstRunTimer = setTimeout(() => {
      try {
        this.generateDailyStats(new Date());
      } catch (e: any) {
        this.logger.error(`[ClueStatsService] daily stats failed: ${e?.message || e}`);
      }
      this.dailyTimer = setInterval(() => {
        try {
          this.generateDailyStats(new Date());
        } catch (e: any) {
          this.logger.error(`[ClueStatsService] daily stats failed: ${e?.message || e}`);
        }
      }, DAY_MS);
    }, delay);
  }

  private msUntilNextMidnight(now: Date): number {
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    return Math.max(1000, next.getTime() - now.getTime());
  }

  private loadRecords(): MatchRecord[] {
    if (!fs.existsSync(this.stateDir)) return [];
    const names = fs
      .readdirSync(this.stateDir)
      .filter((name) => name.endsWith('.json') && !name.startsWith('_'))
      .sort();
    return names.flatMap((name) => this.readRecordFile(path.join(this.stateDir, name)));
  }

  private readRecordFile(filePath: string): MatchRecord[] {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((r) => r && typeof r === 'object') as MatchRecord[];
    } catch (e: any) {
      this.logger.warn(`[ClueStatsService] skip bad state file ${filePath}: ${e?.message || e}`);
      return [];
    }
  }

  private writeStats(stats: ClueDailyStats): void {
    const dir = this.getStatsDir();
    fs.mkdirSync(dir, { recursive: true });
    const p = this.statsPath(stats.date);
    if (fs.existsSync(p)) {
      try {
        fs.copyFileSync(p, p + '.bak');
      } catch (e: any) {
        this.logger.warn(`[ClueStatsService] stats backup failed ${p}: ${e?.message || e}`);
      }
    }
    const tmp = p + '.tmp';
    const fd = fs.openSync(tmp, 'w');
    try {
      const buf = Buffer.from(JSON.stringify(stats, null, 2), 'utf8');
      fs.writeSync(fd, buf, 0, buf.length, 0);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, p);
  }

  private statsPath(date: string): string {
    return path.join(this.getStatsDir(), `${date}.json`);
  }

  private topKeywords(records: MatchRecord[]): KeywordCount[] {
    const collected = records.reduce<{
      counts: Record<string, number>;
      firstIndex: Record<string, number>;
      nextIndex: number;
    }>(
      (acc, record) => {
        const keywords = Array.isArray(record.keywords) ? record.keywords : [];
        return keywords.reduce<typeof acc>((inner, raw) => {
          const keyword = String(raw || '').trim();
          if (!keyword) return inner;
          const exists = Object.prototype.hasOwnProperty.call(inner.counts, keyword);
          return {
            counts: { ...inner.counts, [keyword]: (inner.counts[keyword] || 0) + 1 },
            firstIndex: exists
              ? inner.firstIndex
              : { ...inner.firstIndex, [keyword]: inner.nextIndex },
            nextIndex: exists ? inner.nextIndex : inner.nextIndex + 1,
          };
        }, acc);
      },
      { counts: {}, firstIndex: {}, nextIndex: 0 },
    );
    return Object.entries(collected.counts)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          collected.firstIndex[a.keyword] - collected.firstIndex[b.keyword],
      )
      .slice(0, TOP_LIMIT);
  }

  private countByStatus(records: MatchRecord[], status: MatchRecord['status']): number {
    return records.filter((r) => r.status === status).length;
  }

  private asScore(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
