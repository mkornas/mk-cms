import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config as loadDotenv } from 'dotenv';
import { validateEnv } from '../config/env.schema';

/**
 * Standalone DataSource used by the TypeORM CLI (migration:generate / run /
 * revert). The running app configures TypeORM through {@link DatabaseModule};
 * this mirrors the same validated env so the two never drift.
 */
loadDotenv({ path: ['.env', '../../.env'] });
const env = validateEnv(process.env);

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});
