import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root or server dir
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: process.env.DATABASE_PATH || path.resolve(__dirname, '../../data/resolveai.db'),
  jwtSecret: process.env.JWT_SECRET || 'resolveai_dev_jwt_secret_must_be_changed_in_prod_123456789',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  slaHours: parseInt(process.env.SLA_HOURS || '4', 10),
  cookieSecure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
};

// Validate critical configurations
if (process.env.NODE_ENV === 'production' && config.jwtSecret.includes('dev_jwt_secret')) {
  console.warn('[WARNING] Running in production with default development JWT_SECRET!');
}
