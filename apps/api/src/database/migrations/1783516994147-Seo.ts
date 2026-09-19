import { MigrationInterface, QueryRunner } from "typeorm";

export class Seo1783516994147 implements MigrationInterface {
    name = 'Seo1783516994147'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "seo_meta" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "entryId" uuid NOT NULL, "title" character varying(300), "description" character varying(500), "canonical" character varying(2048), "ogTitle" character varying(300), "ogDescription" character varying(500), "ogImage" character varying(2048), "noindex" boolean NOT NULL DEFAULT false, "jsonLd" jsonb, CONSTRAINT "PK_2a849d7e3165b26dec3e1471b9b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fbc854b5960fa04fd59661b0dd" ON "seo_meta" ("siteId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_51d687e8058a631e4ed375a059" ON "seo_meta" ("siteId", "entryId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_51d687e8058a631e4ed375a059"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fbc854b5960fa04fd59661b0dd"`);
        await queryRunner.query(`DROP TABLE "seo_meta"`);
    }

}
