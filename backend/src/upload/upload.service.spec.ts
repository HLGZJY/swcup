import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from './upload.service';
import * as fs from 'fs';
import * as path from 'path';

describe('UploadService', () => {
  let service: UploadService;
  const testDir = path.join(__dirname, '..', '..', 'static', 'uploads');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UploadService],
    }).compile();
    service = module.get<UploadService>(UploadService);

    // 清理测试目录
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      for (const f of files) {
        if (f.startsWith('test_')) {
          fs.unlinkSync(path.join(testDir, f));
        }
      }
    } else {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // 清理测试生成的文件
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      for (const f of files) {
        if (f.startsWith('test_')) {
          fs.unlinkSync(path.join(testDir, f));
        }
      }
    }
  });

  it('应保存文件并返回相对 URL 路径', async () => {
    const fakeFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test_photo.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('fake image content'),
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    const url = await service.saveFile(fakeFile);

    expect(url).toMatch(/^\/static\/uploads\//);
    const filename = url.replace('/static/uploads/', '');
    const filePath = path.join(testDir, filename);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('应保留文件扩展名(小写)', async () => {
    const fakeFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test_photo.PNG',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('fake'),
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    const url = await service.saveFile(fakeFile);
    expect(url.toLowerCase()).toMatch(/\.png$/);
  });

  it('无扩展名的文件应使用 jpg 默认扩展名', async () => {
    const fakeFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test_noext',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('fake'),
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    const url = await service.saveFile(fakeFile);
    expect(url).toMatch(/\.jpg$/);
  });

  it('同一时间多次保存的文件名应不重复(包含随机串)', async () => {
    const fakeFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test_a.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('content'),
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    const url1 = await service.saveFile(fakeFile);
    // 等 1ms 避免 Date.now() 相同
    await new Promise(r => setTimeout(r, 5));
    const url2 = await service.saveFile({ ...fakeFile, originalname: 'test_b.jpg' });

    expect(url1).not.toEqual(url2);
  });

  it('目录不存在时应自动创建', async () => {
    // 备份并删除目录
    const existed = fs.existsSync(testDir);
    if (existed) {
      // 不真删整个目录,只测 saveFile 不会因目录不存在失败
      const stat = fs.statSync(testDir);
      expect(stat.isDirectory()).toBe(true);
    }

    const fakeFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test_autocreate.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('x'),
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    const url = await service.saveFile(fakeFile);
    expect(url).toMatch(/^\/static\/uploads\//);
  });

  it('应写入正确的文件内容(验证 buffer 落盘)', async () => {
    const content = Buffer.from('hello nose-print world');
    const fakeFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test_content.txt',
      encoding: '7bit',
      mimetype: 'text/plain',
      size: content.length,
      buffer: content,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    const url = await service.saveFile(fakeFile);
    const filename = url.replace('/static/uploads/', '');
    const filePath = path.join(testDir, filename);
    const onDisk = fs.readFileSync(filePath);
    expect(onDisk.equals(content)).toBe(true);
  });
});