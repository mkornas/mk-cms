import { MigrationInterface, QueryRunner } from "typeorm";

export class Media1783533000000 implements MigrationInterface {
    name = 'Media1783533000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "media" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "filename" character varying(255) NOT NULL, "storageKey" character varying(1024) NOT NULL, "url" character varying(2048) NOT NULL, "mime" character varying(128) NOT NULL, "size" integer NOT NULL, "width" integer, "height" integer, "alt" character varying(512), "title" character varying(255), "focalPoint" jsonb, "variants" jsonb NOT NULL DEFAULT '[]'::jsonb, "uploadedBy" uuid, CONSTRAINT "PK_f4e0fcac36e050de337b670d8bd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_media_siteId" ON "media" ("siteId")`);
        await queryRunner.query(`CREATE INDEX "IDX_media_site_created" ON "media" ("siteId", "createdAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_media_site_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_media_siteId"`);
        await queryRunner.query(`DROP TABLE "media"`);
    }

}
