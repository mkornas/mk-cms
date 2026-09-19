import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/app-config.service';

/**
 * TypeORM connection wired from validated config. Entities are auto-discovered
 * as feature modules register them via `TypeOrmModule.forFeature(...)`.
 *
 * `synchronize` is honoured only from config and defaults to false — schema
 * changes go through migrations, never auto-sync, in anything but throwaway dev.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const db = config.database;
        return {
          type: 'postgres',
          host: db.host,
          port: db.port,
          username: db.user,
          password: db.password,
          database: db.name,
          autoLoadEntities: true,
          synchronize: db.synchronize,
          logging: db.logging,
          migrations: [__dirname + '/migrations/*.{ts,js}'],
          migrationsRun: db.runMigrations,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
