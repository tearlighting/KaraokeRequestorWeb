import { readFileSync } from 'node:fs';
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { BoundaryError } from './errors.js';

export interface MysqlConfig { host: string; port: number; database: string; user: string; password: string }
const readSecret = (path?: string) => path ? readFileSync(path, 'utf8').trim() : '';
export function mysqlConfigFromEnv(env: NodeJS.ProcessEnv = process.env): MysqlConfig {
  return {
    host: env.MYSQL_HOST || 'mysql', port: Number(env.MYSQL_PORT || 3306), database: env.MYSQL_DATABASE || 'yukari',
    user: env.MYSQL_USER || 'yukari_app', password: readSecret(env.MYSQL_PASSWORD_FILE) || env.MYSQL_PASSWORD || '',
  };
}
export class MysqlStore {
  readonly pool: Pool;
  constructor(config: MysqlConfig) {
    if (!config.password) throw new Error('MYSQL_PASSWORD_FILE is required');
    this.pool = mysql.createPool({ ...config, waitForConnections: true, connectionLimit: 10, queueLimit: 100, charset: 'utf8mb4', timezone: 'Z', decimalNumbers: true, enableKeepAlive: true });
  }
  async ping() { await this.pool.query('SELECT 1'); }
  async close() { await this.pool.end(); }
  async transaction<T>(fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try { await connection.beginTransaction(); const result = await fn(connection); await connection.commit(); return result; }
    catch (error) { try { await connection.rollback(); } catch { throw new BoundaryError(503, 'MYSQL_WRITE_UNCERTAIN', 'The database write outcome is uncertain; check the operation result before retrying'); } throw error; }
    finally { connection.release(); }
  }
  async rows<T extends RowDataPacket = RowDataPacket>(sql: string, values: unknown[] = []) { const [rows] = await this.pool.execute<T[]>(sql, values); return rows; }
  async execute(sql: string, values: unknown[] = []) { const [result] = await this.pool.execute<ResultSetHeader>(sql, values); return result; }
}

