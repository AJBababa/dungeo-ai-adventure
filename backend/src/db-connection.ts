import { Pool } from 'pg';

const pool = new Pool({
  user: 'dddb_vdo4_user',
  password: 'hbcQY9o19ahjR97aXjUrVXUFdMs3Z9gx',
  // EXTERNA host: 'dpg-d5j7f0d6ubrc73ei874g-a.frankfurt-postgres.render.com',
  // INTERNA
  host: 'dpg-d5j7f0d6ubrc73ei874g-a.frankfurt-postgres.render.com',
  port: 5432,
  database: 'dddb_vdo4',
  ssl: { rejectUnauthorized: false }
});

export function query(text: string, params?: any[]): any {
  return pool.query(text, params);
}
