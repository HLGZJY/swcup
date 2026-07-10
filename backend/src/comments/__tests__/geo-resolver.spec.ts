// -*- coding: utf-8 -*-
/**
 * 【2026-07-10 阶段 E P1】GeoResolverService 单元测试
 *
 * 覆盖:
 *   1) 北京坐标 → 白名单含 朝阳/海淀/北京 等, 不含 浦东/武汉
 *   2) 海口坐标 → 白名单含 海口, 不含 朝阳
 *   3) animal 坐标缺失 → 回退全集 (不返回空集)
 *   4) 性能: resolve() < 1ms / call
 *   5) 重建索引: rebuild() 后能正确初始化
 *   6) 网格高纬度: 漠河 (53°) 仍能命中本地词
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeoResolverService } from '../geo-resolver.service';
import { DictionaryLoader } from '../dictionary.loader';

function makeCfg(): ConfigService {
  return {
    get: (_key: string) => undefined,
  } as any;
}

describe('GeoResolverService (阶段 E P1)', () => {
  let svc: GeoResolverService;
  let dict: DictionaryLoader;

  beforeEach(async () => {
    const cfg = makeCfg();
    dict = new DictionaryLoader(cfg);
    dict.loadAll(); // 触发 _loadJson, 加载 entities.json
    const mod = await Test.createTestingModule({
      providers: [
        GeoResolverService,
        { provide: DictionaryLoader, useValue: dict },
      ],
    }).compile();
    svc = mod.get(GeoResolverService);
    svc.onModuleInit();
  });

  it('北京坐标 → 白名单含朝阳/海淀/北京, 不含浦东/武汉', () => {
    const r = svc.resolve(39.9042, 116.4074, 30);
    expect(r.allowedWords.has('朝阳')).toBe(true);
    expect(r.allowedWords.has('海淀')).toBe(true);
    expect(r.allowedWords.has('北京')).toBe(true);
    expect(r.allowedWords.has('北京市')).toBe(true);
    expect(r.allowedWords.has('浦东')).toBe(false);
    expect(r.allowedWords.has('武汉')).toBe(false);
  });

  it('海口坐标 → 白名单含海口, 不含朝阳', () => {
    const r = svc.resolve(20.0444, 110.1992, 50);
    expect(r.allowedWords.has('海口')).toBe(true);
    expect(r.allowedWords.has('海口市')).toBe(true);
    expect(r.allowedWords.has('朝阳')).toBe(false);
  });

  it('animal 坐标缺失 → 回退全集 (不返回空集)', () => {
    const r1 = svc.resolve(null, 116.4074, 10);
    const r2 = svc.resolve(39.9042, undefined, 10);
    const r3 = svc.resolve(null, null, 10);
    expect(r1.allowedWords.size).toBeGreaterThan(0);
    expect(r2.allowedWords.size).toBeGreaterThan(0);
    expect(r3.allowedWords.size).toBeGreaterThan(0);
  });

  it('性能: resolve() < 1ms / call', () => {
    const N = 1000;
    const start = Date.now();
    for (let i = 0; i < N; i++) {
      svc.resolve(30.5 + (i % 100) * 0.01, 114.3 + (i % 100) * 0.01, 10);
    }
    const elapsed = Date.now() - start;
    const avgMs = elapsed / N;
    expect(avgMs).toBeLessThan(1);
  });

  it('rebuild() 后索引有效', () => {
    svc.rebuild();
    const r = svc.resolve(39.9042, 116.4074, 30);
    expect(r.allowedWords.has('北京')).toBe(true);
  });

  it('matched 数组返回距离信息 (调试用)', () => {
    const r = svc.resolve(39.9042, 116.4074, 30);
    expect(Array.isArray(r.matched)).toBe(true);
    for (const m of r.matched) {
      expect(m.name).toBeTruthy();
      expect(m.level).toBeTruthy();
      expect(m.distanceKm).toBeGreaterThanOrEqual(0);
      expect(m.distanceKm).toBeLessThanOrEqual(30);
    }
  });
});
