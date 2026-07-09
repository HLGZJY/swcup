// -*- coding: utf-8 -*-
/**
 * 【2026-07-09 阶段 A】clue-bridge.service decide() confirmed 路径 DB 副作用测试
 *
 * 覆盖:
 *   1) confirmed 路径: JSON 状态写入 + 触发 _persistConfirm
 *      - eventRepo.save 调 1 次,入参 source=CLUE / event_type=REPORT / status=CONFIRMED
 *      - animalRepo.update 调 1 次, 入参含 last_seen_at
 *      - commentRepo.update 调 1 次,入参含 is_clue_confirmed=true + clue_confirmed_animal_id
 *   2) rejected 路径: JSON 状态写入, 但 _persistConfirm 不触发 (任何 repo 都不应被调)
 *   3) JSON 没改成功 (match_id 不存在): 任何 DB 副作用都不应触发
 *   4) _persistConfirm 内部异常: decide() 仍返回 { ok: true, persisted: false }, 不抛
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ClueBridgeService } from '../clue-bridge.service';
import { DictionaryLoader } from '../dictionary.loader';
import { FileStateStore } from '../file-state-store';
import { Comment } from '../entities/comment.entity';
import { Animal } from '../../animals/entities/animal.entity';
import { RescueEvent, EventSource, EventStatus, EventType } from '../../events/entities/event.entity';

describe('ClueBridgeService _persistConfirm (阶段 A)', () => {
  let svc: ClueBridgeService;
  let tmpState: string;
  let commentRepo: any;
  let animalRepo: any;
  let eventRepo: any;

  const ANIMAL_ID = 'a-test-001';
  const MATCH_ID = '5295edaa0e429619'; // sha256(c001|a-test-001).slice(0,16) 演示
  const COMMENT_ID = 'c001';
  const REPORTER_ID = 'u_x';
  const CANDIDATE_ADDR = '北京市朝阳区朝阳公园南门';

  function seedStateFile() {
    const safeAid = ANIMAL_ID.replace(/[\\/]/g, '_');
    const p = path.join(tmpState, safeAid + '.json');
    fs.writeFileSync(
      p,
      JSON.stringify(
        [
          {
            match_id: MATCH_ID,
            comment_id: COMMENT_ID,
            animal_id: ANIMAL_ID,
            comment_reporter_id: REPORTER_ID,
            sentiment: 'report',
            keywords: ['朝阳公园', '金毛'],
            created_at: '2026-07-06T10:00:00Z',
            candidate_event_id: 'e1',
            candidate_event_reporter_id: 'u_owner',
            candidate_event_address: CANDIDATE_ADDR,
            match_score: 0.85,
            match_reasons: ['sentiment=report:+0.5'],
            status: 'pending',
            recorded_at: '2026-07-06T10:00:00Z',
          },
        ],
        null,
        2,
      ),
    );
  }

  beforeEach(async () => {
    tmpState = fs.mkdtempSync(path.join(os.tmpdir(), 'clue_persist_'));

    // mock 3 个 repo
    commentRepo = {
      update: jest.fn(async () => ({ affected: 1 })),
      save: jest.fn(async (e: any) => e),
      findOne: jest.fn(),
    };
    animalRepo = {
      update: jest.fn(async () => ({ affected: 1 })),
      findOne: jest.fn(async ({ where: { animal_id } }: any) => ({
        animal_id,
        location_lat: 39.92,
        location_lng: 116.46,
        address: '北京市朝阳区',
      })),
      save: jest.fn(),
    };
    eventRepo = {
      save: jest.fn(async (e: any) => ({ ...e, event_id: e.event_id || 'auto-id' })),
      update: jest.fn(),
      findOne: jest.fn(),
    };

    const cfg: Partial<ConfigService> = {
      get: jest.fn((key: string) => (key === 'CLUE_STATE_DIR' ? tmpState : undefined as any)),
    };
    // 【2026-07-09 阶段 B】DictionaryLoader 实例指向空 tmpdir,
    // 触发 BUILTIN_DEFAULTS 回退, 不影响现有测试
    const tmpDicts = fs.mkdtempSync(path.join(os.tmpdir(), 'clue_dicts_persist_'));
    const cfgWithDicts: Partial<ConfigService> = {
      get: jest.fn((key: string) => {
        if (key === 'CLUE_STATE_DIR') return tmpState;
        if (key === 'CLUE_DICTS_DIR') return tmpDicts;
        return undefined as any;
      }),
    };
    const dict = new DictionaryLoader(cfgWithDicts as ConfigService);
    const store = new FileStateStore(cfgWithDicts as ConfigService);
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ClueBridgeService,
        { provide: ConfigService, useValue: cfgWithDicts },
        { provide: getRepositoryToken(Comment), useValue: commentRepo },
        { provide: getRepositoryToken(Animal), useValue: animalRepo },
        { provide: getRepositoryToken(RescueEvent), useValue: eventRepo },
        { provide: DictionaryLoader, useValue: dict },
        { provide: FileStateStore, useValue: store },
      ],
    }).compile();
    svc = mod.get(ClueBridgeService);
    svc.init();
    seedStateFile();
  });

  afterEach(() => {
    if (fs.existsSync(tmpState)) {
      fs.rmSync(tmpState, { recursive: true, force: true });
    }
  });

  it('confirmed: JSON 改写 + 3 个 DB 副作用 (event INSERT + animal UPDATE + comment UPDATE)', async () => {
    const r = await svc.decide(MATCH_ID, ANIMAL_ID, 'confirmed', 'note-x', 'admin1');
    expect(r.ok).toBe(true);
    expect(r.persisted).toBe(true);

    // 1) eventRepo.save 调 1 次
    expect(eventRepo.save).toHaveBeenCalledTimes(1);
    const evArg = eventRepo.save.mock.calls[0][0];
    expect(evArg.source).toBe(EventSource.CLUE);
    expect(evArg.event_type).toBe(EventType.REPORT);
    expect(evArg.status).toBe(EventStatus.CONFIRMED);
    expect(evArg.animal_id).toBe(ANIMAL_ID);
    expect(evArg.reporter_id).toBe(REPORTER_ID);
    expect(evArg.address).toBe(CANDIDATE_ADDR);
    expect(evArg.description).toContain(COMMENT_ID);
    expect(evArg.event_id).toMatch(/^[0-9a-f-]{36}$/i); // uuid
    expect(evArg.location_lat).toBe(39.92);
    expect(evArg.location_lng).toBe(116.46);

    // 2) animalRepo.update 调 1 次,入参含 last_seen_at + address
    expect(animalRepo.update).toHaveBeenCalledTimes(1);
    const [animalWhere, animalSet] = animalRepo.update.mock.calls[0];
    expect(animalWhere).toEqual({ animal_id: ANIMAL_ID });
    expect(animalSet.last_seen_at).toBeInstanceOf(Date);
    expect(animalSet.address).toBe(CANDIDATE_ADDR);

    // 3) commentRepo.update 调 1 次,is_clue_confirmed=true + clue_confirmed_animal_id
    expect(commentRepo.update).toHaveBeenCalledTimes(1);
    const [cmWhere, cmSet] = commentRepo.update.mock.calls[0];
    expect(cmWhere).toEqual({ comment_id: COMMENT_ID });
    expect(cmSet.is_clue_confirmed).toBe(true);
    expect(cmSet.clue_confirmed_animal_id).toBe(ANIMAL_ID);
  });

  it('rejected: JSON 改写, 任何 DB repo 都不应被调', async () => {
    const r = await svc.decide(MATCH_ID, ANIMAL_ID, 'rejected', '', 'admin1');
    expect(r.ok).toBe(true);
    expect(r.persisted).toBeUndefined();

    expect(eventRepo.save).not.toHaveBeenCalled();
    expect(animalRepo.update).not.toHaveBeenCalled();
    expect(commentRepo.update).not.toHaveBeenCalled();
  });

  it('match_id 不存在: ok=false, 任何 DB repo 都不应被调', async () => {
    const r = await svc.decide('nonexistent-match-id', ANIMAL_ID, 'confirmed', '', 'admin1');
    expect(r.ok).toBe(false);
    expect(r.persisted).toBeUndefined();

    expect(eventRepo.save).not.toHaveBeenCalled();
    expect(animalRepo.update).not.toHaveBeenCalled();
    expect(commentRepo.update).not.toHaveBeenCalled();
  });

  it('_persistConfirm 抛异常时: decide() 返回 { ok:true, persisted:false }, 不向外抛', async () => {
    // 模拟 animalRepo.findOne 抛错
    animalRepo.findOne = jest.fn(async () => { throw new Error('mock DB failure'); });

    const r = await svc.decide(MATCH_ID, ANIMAL_ID, 'confirmed', '', 'admin1');
    expect(r.ok).toBe(true);
    expect(r.persisted).toBe(false);
  });

  it('animal 不存在时: lat/lng 兜底为 0, address 用 candidate_event_address', async () => {
    animalRepo.findOne = jest.fn(async () => null);
    const r = await svc.decide(MATCH_ID, ANIMAL_ID, 'confirmed', '', 'admin1');
    expect(r.persisted).toBe(true);

    const evArg = eventRepo.save.mock.calls[0][0];
    expect(evArg.location_lat).toBe(0);
    expect(evArg.location_lng).toBe(0);
    expect(evArg.address).toBe(CANDIDATE_ADDR);
  });
});
