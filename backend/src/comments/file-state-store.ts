// -*- coding: utf-8 -*-
/**
 * 【2026-07-09 阶段 C】FileStateStore — 线索状态文件的安全读写
 *
 * 替换原 clue-bridge.service.ts 的 _saveState/_loadState/_decide 直接文件 IO,
 * 解决:
 *   1) 并发写丢失: proper-lockfile 跨进程锁, 串行化 append/update
 *   2) 写盘中途崩溃: .bak 备份 + tmp + fsync + rename 原子
 *   3) 旧 match_id 格式: 启动期一次性迁移, 旧值写 match_id_v1, 新值 _matchId 含 eventId
 *
 * 落盘结构: data/clue_state/<safe_animal_id>.json (数组, 每条 MatchRecord)
 *   safe_animal_id = animal_id.replace(/[\\/]/g, '_')
 *
 * 锁文件: <path>.lock (proper-lockfile 自动管理)
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lockfile = require('proper-lockfile') as {
  lock: (p: string, opts?: any) => Promise<() => Promise<void>>;
};
import * as fs from 'fs';
import * as path from 'path';

export interface MatchRecord {
  match_id: string;
  match_id_v1?: string; // 阶段 C 启动迁移时填入, 旧格式保留
  comment_id: string;
  animal_id: string;
  comment_reporter_id: string;
  sentiment: string;
  keywords: string[];
  created_at: string;
  candidate_event_id: string;
  candidate_event_reporter_id: string;
  candidate_event_address: string;
  match_score: number;
  match_reasons: string[];
  status: 'pending' | 'no_match' | 'self_match' | 'cooldown' | 'confirmed' | 'rejected';
  recorded_at: string;
  decided_by?: string;
  decided_at?: string;
  decision_note?: string;
  schema_version?: number;
}

@Injectable()
export class FileStateStore implements OnModuleInit {
  private readonly logger = new Logger(FileStateStore.name);
  private stateDir: string;
  private migrationDone = false;

  constructor(private readonly cfg: ConfigService) {
    this.stateDir =
      this.cfg.get<string>('CLUE_STATE_DIR') ||
      path.join(process.cwd(), 'data', 'clue_state');
  }

  /**
   * 启动期一次性迁移 (阶段 C):
   *   - 旧 match_id (无 eventId) → 写入 match_id_v1, 计算新 _matchId
   *   - 缺 eventId 的 record: 新 _matchId 用 'unknown' 占位 eventId
   *   - 输出 _migration.log
   */
  async onModuleInit(): Promise<void> {
    fs.mkdirSync(this.stateDir, { recursive: true });
    const logLines: string[] = [];
    let migrated = 0;
    let skipped = 0;
    try {
      const files = fs
        .readdirSync(this.stateDir)
        .filter((n) => n.endsWith('.json') && !n.startsWith('_'));
      for (const name of files) {
        const p = path.join(this.stateDir, name);
        const list = this._readUnsafe(p);
        if (!Array.isArray(list) || list.length === 0) continue;
        let changed = false;
        for (const r of list) {
          if (!r || typeof r !== 'object') continue;
          // 已是新格式: 16 位 hex (sha256.slice(0,16)) + 有 eventId + schema_version
          if (
            typeof r.match_id === 'string' &&
            /^[0-9a-f]{16}$/.test(r.match_id) &&
            r.candidate_event_id &&
            r.schema_version === 2
          ) {
            skipped++;
            continue;
          }
          // 旧格式: 计算新 match_id
          const oldMid = r.match_id || '';
          r.match_id_v1 = oldMid;
          r.match_id = newMatchId(
            r.comment_id || '',
            r.animal_id || '',
            r.candidate_event_id || '',
            r.sentiment || '',
          );
          r.schema_version = 2;
          changed = true;
          migrated++;
        }
        if (changed) this._writeUnsafe(p, list);
      }
      this.migrationDone = true;
      logLines.push(
        `[${new Date().toISOString()}] migration done: migrated=${migrated} skipped=${skipped} files=${files.length}`,
      );
      this.logger.log(
        `[FileStateStore.migration] migrated=${migrated} skipped=${skipped} files=${files.length}`,
      );
    } catch (e: any) {
      this.logger.error(`[FileStateStore.migration] failed: ${e?.message || e}`);
      logLines.push(`[${new Date().toISOString()}] migration FAILED: ${e?.message || e}`);
    }
    try {
      fs.writeFileSync(
        path.join(this.stateDir, '_migration.log'),
        logLines.join('\n') + '\n',
        'utf8',
      );
    } catch {
      /* best effort */
    }
  }

  // ---------------- 公开 API ----------------

  /**
   * 读 animal 下的所有 record (锁内一致读)
   */
  async loadList(animalId: string): Promise<MatchRecord[]> {
    return this._withLock(animalId, async () => {
      const p = this._path(animalId);
      const list = this._readUnsafe(p);
      return Array.isArray(list) ? (list as MatchRecord[]) : [];
    });
  }

  /**
   * 追加 1 条 (供 clue matchComment 使用) — 异步 + proper-lockfile
   */
  async append(animalId: string, record: MatchRecord): Promise<void> {
    return this._withLock(animalId, async () => {
      const p = this._path(animalId);
      const list = this._readUnsafe(p);
      if (!Array.isArray(list)) {
        throw new Error(`[FileStateStore.append] corrupted state file: ${p}`);
      }
      list.push({ ...record, schema_version: 2 });
      this._writeAtomic(p, list);
    });
  }

  /**
   * 同步追加 (供 ClueBridgeService._tryMatch 使用)
   *   原因: matchComment 同步返回 + 后续 listPending() 同步读, 异步 fire-and-forget 会丢写
   *   单进程内不需 proper-lockfile, 直接 sync 写 (测试场景单进程)
   *   多进程并发: 由 _withLock 内部 lockfile 提供, sync 版本不参与跨进程互斥
   */
  appendSync(animalId: string, record: MatchRecord): void {
    fs.mkdirSync(this.stateDir, { recursive: true });
    const p = this._path(animalId);
    const list = this._readUnsafe(p);
    if (!Array.isArray(list)) {
      throw new Error(`[FileStateStore.appendSync] corrupted state file: ${p}`);
    }
    list.push({ ...record, schema_version: 2 });
    this._writeAtomic(p, list);
  }

  /**
   * 更新 1 条 (供 decide() 使用: status 流转)
   * 返回是否真改到了
   */
  async update(
    animalId: string,
    matchId: string,
    patch: Partial<MatchRecord>,
  ): Promise<boolean> {
    return this._withLock(animalId, async () => {
      const p = this._path(animalId);
      const list = this._readUnsafe(p);
      if (!Array.isArray(list)) return false;
      let changed = false;
      for (const r of list) {
        if (r && r.match_id === matchId && r.status === 'pending') {
          Object.assign(r, patch, { schema_version: 2 });
          changed = true;
          break;
        }
      }
      if (changed) this._writeAtomic(p, list);
      return changed;
    });
  }

  /**
   * 跨 animal 列所有 pending (admin 列表用)
   */
  async listAllPending(): Promise<Record<string, MatchRecord[]>> {
    const out: Record<string, MatchRecord[]> = {};
    if (!fs.existsSync(this.stateDir)) return out;
    const names = fs.readdirSync(this.stateDir).sort();
    for (const name of names) {
      if (!name.endsWith('.json') || name.startsWith('_')) continue;
      const p = path.join(this.stateDir, name);
      const list = this._readUnsafe(p);
      if (!Array.isArray(list)) continue;
      const pending = (list as MatchRecord[]).filter((r) => r && r.status === 'pending');
      if (pending.length > 0) {
        out[name.slice(0, -5)] = pending; // 去 .json
      }
    }
    return out;
  }

  /** 暴露状态目录 (admin controller / test 用) */
  getStateDir(): string {
    return this.stateDir;
  }

  // ---------------- 内部实现 ----------------

  private _path(animalId: string): string {
    const safe = String(animalId || '').replace(/[\\/]/g, '_');
    return path.join(this.stateDir, safe + '.json');
  }

  private async _withLock<T>(animalId: string, fn: () => Promise<T> | T): Promise<T> {
    fs.mkdirSync(this.stateDir, { recursive: true });
    const lockPath = this._path(animalId) + '.lock';
    // 确保 lock 文件存在 (proper-lockfile 要求)
    if (!fs.existsSync(lockPath)) {
      try {
        fs.writeFileSync(lockPath, '', 'utf8');
      } catch {
        /* 可能在并发场景被先创建, ignore */
      }
    }
    const release = await lockfile.lock(lockPath, {
      retries: { retries: 8, minTimeout: 20, maxTimeout: 200 },
      stale: 5000,
    });
    try {
      return await fn();
    } catch (e: any) {
      this.logger.error(
        `[FileStateStore._withLock] ${lockPath}: ${e?.message || e}`,
      );
      throw e;
    } finally {
      try {
        await release();
      } catch {
        /* lockfile 释放失败不抛 */
      }
    }
  }

  /** 无锁读 (供 listAllPending / 迁移使用, 容忍损坏) */
  private _readUnsafe(p: string): any[] {
    if (!fs.existsSync(p)) return [];
    try {
      const txt = fs.readFileSync(p, 'utf8');
      const arr = JSON.parse(txt);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  /** 无锁写 (供迁移使用) */
  private _writeUnsafe(p: string, list: any[]): void {
    this._writeAtomic(p, list);
  }

  /**
   * 原子写: .bak 备份 → tmp 写 → fsync → rename
   * 失败抛出 (由调用方 in lock 处理)
   */
  private _writeAtomic(p: string, list: any[]): void {
    // 1) 备份
    if (fs.existsSync(p)) {
      try {
        fs.copyFileSync(p, p + '.bak');
      } catch (e: any) {
        this.logger.warn(`[FileStateStore._writeAtomic] backup failed ${p}: ${e?.message || e}`);
      }
    }
    // 2) tmp 写 + fsync
    const tmp = p + '.tmp';
    const fd = fs.openSync(tmp, 'w');
    try {
      const buf = Buffer.from(JSON.stringify(list, null, 2), 'utf8');
      fs.writeSync(fd, buf, 0, buf.length, 0);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    // 3) rename 原子
    fs.renameSync(tmp, p);
  }
}

/**
 * 新版 match_id (含 eventId) — 阶段 C 替代原 _matchId(commentId, animalId)
 * 旧版本无 eventId, 会出现「同 commentId+animalId 不同 sentiment 撞 match_id」问题
 */
export function newMatchId(
  commentId: string,
  animalId: string,
  eventId: string,
  sentiment: string,
): string {
  return createHash('sha256')
    .update(
      [commentId || '', animalId || '', eventId || 'unknown', sentiment || ''].join('|'),
      'utf8',
    )
    .digest('hex')
    .slice(0, 16);
}
