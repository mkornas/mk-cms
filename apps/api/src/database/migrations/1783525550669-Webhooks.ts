import { MigrationInterface, QueryRunner } from "typeorm";

export class Webhooks1783525550669 implements MigrationInterface {
    name = 'Webhooks1783525550669'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "webhooks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "url" character varying(2048) NOT NULL, "events" jsonb NOT NULL DEFAULT '[]'::jsonb, "secret" character varying(128) NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "description" character varying(200), CONSTRAINT "PK_9e8795cfc899ab7bdaa831e8527" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_838ef31eee966a754827ef4ca1" ON "webhooks" ("siteId") `);
        await queryRunner.query(`CREATE TABLE "webhook_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "webhookId" uuid NOT NULL, "event" character varying(64) NOT NULL, "success" boolean NOT NULL, "statusCode" integer, "attempt" integer NOT NULL DEFAULT '1', "error" character varying(512), CONSTRAINT "PK_535dd409947fb6d8fc6dfc0112a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0be836abeb9d8aa73b32ca4de5" ON "webhook_deliveries" ("siteId") `);
        await queryRunner.query(`CREATE INDEX "IDX_04671c5005d3b532c3fc8811e7" ON "webhook_deliveries" ("siteId", "webhookId", "createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_04671c5005d3b532c3fc8811e7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0be836abeb9d8aa73b32ca4de5"`);
        await queryRunner.query(`DROP TABLE "webhook_deliveries"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_838ef31eee966a754827ef4ca1"`);
        await queryRunner.query(`DROP TABLE "webhooks"`);
    }

}
