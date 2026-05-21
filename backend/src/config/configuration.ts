import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'nose_rescue',
}));

export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'swcup2026_secret',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
};