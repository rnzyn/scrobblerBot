import fs from 'fs';
import dotenv from 'dotenv';


if (process.env.NODE_ENV === 'production') {
  dotenv.config();
} else {
  process.env = Object.assign(process.env, dotenv.parse(fs.readFileSync('.env.dev')));
}

export const NODE_ENV = process.env.NODE_ENV;
export const PORT = process.env.PORT;
export const MONGODB_URL = process.env.MONGODB_URL;
export const SCROBBLERBOT_TOKEN = process.env.SCROBBLERBOT_TOKEN;
export const LASTFM_URL = process.env.LASTFM_URL;
export const LASTFM_KEY = process.env.LASTFM_KEY;
export const LASTFM_SECRET = process.env.LASTFM_SECRET;
export const ADMIN_ID = process.env.ADMIN_ID;
export const REDIS_URL = process.env.REDIS_URL;
