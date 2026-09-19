import { MigrationInterface, QueryRunner } from "typeorm";

export class Plugins1783509486159 implements MigrationInterface {
    name = 'Plugins1783509486159'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "plugins" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(128) NOT NULL, "installedVersion" character varying(32) NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "settings" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_bb3d17826b76295957a253ba73e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0479844f05c1132f8929cab1c8" ON "plugins" ("name") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_0479844f05c1132f8929cab1c8"`);
        await queryRunner.query(`DROP TABLE "plugins"`);
    }

}
