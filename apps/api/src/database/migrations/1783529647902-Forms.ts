import { MigrationInterface, QueryRunner } from "typeorm";

export class Forms1783529647902 implements MigrationInterface {
    name = 'Forms1783529647902'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "forms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "slug" character varying(64) NOT NULL, "name" character varying(128) NOT NULL, "fields" jsonb NOT NULL DEFAULT '[]'::jsonb, "settings" jsonb NOT NULL DEFAULT '{}'::jsonb, "enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_ba062fd30b06814a60756f233da" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_553b04f29d0d41c71d8027e060" ON "forms" ("siteId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ec50c32a84a542c1fae13045cf" ON "forms" ("siteId", "slug") `);
        await queryRunner.query(`CREATE TABLE "form_submissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "formId" uuid NOT NULL, "data" jsonb NOT NULL DEFAULT '{}'::jsonb, "meta" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_fb6e1e9f26cda31c358a8a1530e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3bb1ca3f6acfb327d6334daf19" ON "form_submissions" ("siteId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6bb44ead8acd515f1333e5309b" ON "form_submissions" ("formId") `);
        await queryRunner.query(`CREATE INDEX "IDX_45b91cb25e8ee05e7e22246b6a" ON "form_submissions" ("siteId", "formId", "createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_45b91cb25e8ee05e7e22246b6a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6bb44ead8acd515f1333e5309b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3bb1ca3f6acfb327d6334daf19"`);
        await queryRunner.query(`DROP TABLE "form_submissions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec50c32a84a542c1fae13045cf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_553b04f29d0d41c71d8027e060"`);
        await queryRunner.query(`DROP TABLE "forms"`);
    }

}
