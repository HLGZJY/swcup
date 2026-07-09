import { Injectable } from '@nestjs/common';

/**
 * 鼻纹采集幂等缓存 (2026-07-08 恢复)
 *
 * Bug 5 修复 (2026-07-08): 用户在 collect 页 1.66s 内连点两次 → 6ebf15ac + 5bdf0e0d 孤儿
 * 用 SHA256(nose_photo) 截断 16 字符做 key, 5 分钟内的重复提交返回首次结果
 *
 * 实现: 内存级 Map (Node 进程),进程重启后失效,可接受 (5 分钟窗口很短)
 */
@Injectable()
export class IdempotencyCache {
  private cache = new Map<string, { value: any; expiresAt: number }>();
  private readonly TTL_MS = 5 * 60 * 1000;

  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set(key: string, value: any, ttlMs: number = this.TTL_MS): void {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  clear(): void {
    this.cache.clear();
  }
}
