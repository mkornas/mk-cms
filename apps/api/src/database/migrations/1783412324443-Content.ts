import { MigrationInterface, QueryRunner } from "typeorm";

export class Content1783412324443 implements MigrationInterface {
    name = 'Content1783412324443'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "taxonomies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "slug" character varying(64) NOT NULL, "name" character varying(128) NOT NULL, "config" jsonb NOT NULL DEFAULT '{}'::jsonb, "isCore" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_f8c39bce97175559a2223be37f6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ed0dbc9dffca7fe3fbf91a9c08" ON "taxonomies" ("siteId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_15d860bcbc89f26d317fde6f62" ON "taxonomies" ("siteId", "slug") `);
        await queryRunner.query(`CREATE TABLE "terms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "taxonomyId" uuid NOT NULL, "slug" character varying(128) NOT NULL, "name" character varying(200) NOT NULL, "description" character varying(512), "parentId" uuid, CONSTRAINT "PK_33b6fe77d6ace7ff43cc8a65958" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f0bb86b0723d5fa353bc46ac7f" ON "terms" ("siteId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f0e11653b17a33d9ef657f47d5" ON "terms" ("taxonomyId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f0b83a488e0984503d7db59652" ON "terms" ("siteId", "taxonomyId", "slug") `);
        await queryRunner.query(`CREATE TABLE "entry_terms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "entryId" uuid NOT NULL, "termId" uuid NOT NULL, CONSTRAINT "PK_dcaec06e70185b0683e7137cd4c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6765e58856ccf9b3b1cd085dc8" ON "entry_terms" ("siteId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e8ae381a4fcea2feac379844d3" ON "entry_terms" ("entryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3c747748c4141b8447bce31c86" ON "entry_terms" ("termId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_715fdfaa1fa66ba929a6c8b971" ON "entry_terms" ("entryId", "termId") `);
        await queryRunner.query(`CREATE TABLE "content_types" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "slug" character varying(64) NOT NULL, "name" character varying(128) NOT NULL, "description" character varying(512), "config" jsonb NOT NULL DEFAULT '{}'::jsonb, "isCore" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_ce94145fcda04af3b3153f44f2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_07c73f7bebe2732d1774b5d852" ON "content_types" ("siteId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_27f30574d9442e200b789241c5" ON "content_types" ("siteId", "slug") `);
        await queryRunner.query(`CREATE TABLE "field_definitions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "contentTypeId" uuid NOT NULL, "key" character varying(64) NOT NULL, "name" character varying(128) NOT NULL, "type" character varying(64) NOT NULL, "required" boolean NOT NULL DEFAULT false, "config" jsonb NOT NULL DEFAULT '{}'::jsonb, "sortOrder" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_a9da2ecc62baef02aea97f3cb7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_280fcbb4c68af0116e53fb5cf0" ON "field_definitions" ("siteId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b38745ce4126b28ae1e157821a" ON "field_definitions" ("contentTypeId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8eb83f6795e38f716751ca5bf8" ON "field_definitions" ("contentTypeId", "key") `);
        await queryRunner.query(`CREATE TABLE "content_revisions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "entryId" uuid NOT NULL, "authorId" uuid, "data" jsonb NOT NULL, CONSTRAINT "PK_750b063aa2aad282d6a5fd2db2a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_19aed9827e42b1f3ff06682b11" ON "content_revisions" ("siteId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6673521925bb2375f7cfae99bd" ON "content_revisions" ("entryId", "createdAt") `);
        await queryRunner.query(`CREATE TYPE "public"."content_entries_status_enum" AS ENUM('draft', 'published', 'scheduled', 'trashed')`);
        await queryRunner.query(`CREATE TABLE "content_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "contentTypeId" uuid NOT NULL, "slug" character varying(200), "title" character varying(300) NOT NULL, "status" "public"."content_entries_status_enum" NOT NULL DEFAULT 'draft', "authorId" uuid, "parentId" uuid, "locale" character varying(12) NOT NULL DEFAULT 'en', "translationGroupId" uuid, "fields" jsonb NOT NULL DEFAULT '{}'::jsonb, "publishedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_76ad9c3b728294d4dd041613aba" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1878fc789529fe8c1e15be1dbf" ON "content_entries" ("siteId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c53db76397f2a2ed87b7ca9bc1" ON "content_entries" ("contentTypeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7c54c47356dc1985f98c6f0450" ON "content_entries" ("translationGroupId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2296be3321e0a008382d128854" ON "content_entries" ("siteId", "contentTypeId", "locale", "slug") WHERE "slug" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_a49260a95526b312a18d360715" ON "content_entries" ("siteId", "contentTypeId", "status") `);
        await queryRunner.query(`ALTER TABLE "sites" ALTER COLUMN "domains" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "sites" ALTER COLUMN "settings" SET DEFAULT '{}'::jsonb`);
        await queryRunner.query(`ALTER TABLE "roles" ALTER COLUMN "capabilities" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "terms" ADD CONSTRAINT "FK_f0e11653b17a33d9ef657f47d51" FOREIGN KEY ("taxonomyId") REFERENCES "taxonomies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "field_definitions" ADD CONSTRAINT "FK_b38745ce4126b28ae1e157821a7" FOREIGN KEY ("contentTypeId") REFERENCES "content_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "field_definitions" DROP CONSTRAINT "FK_b38745ce4126b28ae1e157821a7"`);
        await queryRunner.query(`ALTER TABLE "terms" DROP CONSTRAINT "FK_f0e11653b17a33d9ef657f47d51"`);
        await queryRunner.query(`ALTER TABLE "roles" ALTER COLUMN "capabilities" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "sites" ALTER COLUMN "settings" SET DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "sites" ALTER COLUMN "domains" SET DEFAULT '[]'`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a49260a95526b312a18d360715"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2296be3321e0a008382d128854"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7c54c47356dc1985f98c6f0450"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c53db76397f2a2ed87b7ca9bc1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1878fc789529fe8c1e15be1dbf"`);
        await queryRunner.query(`DROP TABLE "content_entries"`);
        await queryRunner.query(`DROP TYPE "public"."content_entries_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6673521925bb2375f7cfae99bd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_19aed9827e42b1f3ff06682b11"`);
        await queryRunner.query(`DROP TABLE "content_revisions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8eb83f6795e38f716751ca5bf8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b38745ce4126b28ae1e157821a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_280fcbb4c68af0116e53fb5cf0"`);
        await queryRunner.query(`DROP TABLE "field_definitions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_27f30574d9442e200b789241c5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_07c73f7bebe2732d1774b5d852"`);
        await queryRunner.query(`DROP TABLE "content_types"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_715fdfaa1fa66ba929a6c8b971"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3c747748c4141b8447bce31c86"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e8ae381a4fcea2feac379844d3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6765e58856ccf9b3b1cd085dc8"`);
        await queryRunner.query(`DROP TABLE "entry_terms"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f0b83a488e0984503d7db59652"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f0e11653b17a33d9ef657f47d5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f0bb86b0723d5fa353bc46ac7f"`);
        await queryRunner.query(`DROP TABLE "terms"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_15d860bcbc89f26d317fde6f62"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ed0dbc9dffca7fe3fbf91a9c08"`);
        await queryRunner.query(`DROP TABLE "taxonomies"`);
    }

}
