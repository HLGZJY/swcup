import { Injectable } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService {
  private readonly uploadDir = join(__dirname, '..', '..', 'static', 'uploads');

  async saveFile(file: Express.Multer.File): Promise<string> {
    // 确保目录存在
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    // 生成唯一文件名
    const ext = this.getExtension(file.originalname) || 'jpg';
    const filename = `${Date.now()}_${randomString(8)}.${ext}`;
    const filePath = join(this.uploadDir, filename);

    // 写入文件
    await fs.promises.writeFile(filePath, file.buffer);

    // 返回相对路径（用于拼接完整 URL）
    return `/static/uploads/${filename}`;
  }

  private getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.slice(lastDot + 1).toLowerCase() : '';
  }
}

function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}