import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const avatarDir = join(process.cwd(), 'static', 'uploads', 'avatars');

export const avatarStorage = diskStorage({
  destination: (req, file, cb) => {
    if (!existsSync(avatarDir)) mkdirSync(avatarDir, { recursive: true });
    cb(null, avatarDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).user?.user_id || 'unknown';
    const ext = extname(file.originalname) || '.jpg';
    cb(null, `${userId}${ext}`);
  },
});

export const avatarFilter = (req: any, file: Express.Multer.File, cb: Function) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed'), false);
  }
  cb(null, true);
};