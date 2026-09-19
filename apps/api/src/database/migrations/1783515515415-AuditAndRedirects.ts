import { MigrationInterface, QueryRunner } from "typeorm";

export class AuditAndRedirects1783515515415 implements MigrationInterface {
    name = 'AuditAndRedirects1783515515415'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "redirects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "fromPath" character varying(2048) NOT NULL, "toPath" character varying(2048) NOT NULL, "statusCode" integer NOT NULL DEFAULT '301', "enabled" boolean NOT NULL DEFAULT true, "hits" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_d81f0797728eb0eb92ae3c6eedd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_227399ece9bd6a1a1d373da4f7" ON "redirects" ("siteId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c31250847523ee20747996f0d0" ON "redirects" ("siteId", "fromPath") `);
        await queryRunner.query(`CREATE TABLE "audit_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "action" character varying(64) NOT NULL, "actorId" uuid, "actorEmail" character varying(320), "targetType" character varying(64), "targetId" uuid, "summary" character varying(512) NOT NULL, "meta" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0023be7ae7a9916c992b8e408a" ON "audit_log" ("siteId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1e1c9e37533df2bef300873bdf" ON "audit_log" ("siteId", "createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_1e1c9e37533df2bef300873bdf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0023be7ae7a9916c992b8e408a"`);
        await queryRunner.query(`DROP TABLE "audit_log"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c31250847523ee20747996f0d0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_227399ece9bd6a1a1d373da4f7"`);
        await queryRunner.query(`DROP TABLE "redirects"`);
    }

}
