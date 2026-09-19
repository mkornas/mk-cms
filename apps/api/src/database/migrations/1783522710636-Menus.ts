import { MigrationInterface, QueryRunner } from "typeorm";

export class Menus1783522710636 implements MigrationInterface {
    name = 'Menus1783522710636'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "menus" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "slug" character varying(64) NOT NULL, "name" character varying(128) NOT NULL, CONSTRAINT "PK_3fec3d93327f4538e0cbd4349c4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_db71eb6f62b040fee2a5768a56" ON "menus" ("siteId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ec3535a7ce76edee4f94eee163" ON "menus" ("siteId", "slug") `);
        await queryRunner.query(`CREATE TYPE "public"."menu_items_type_enum" AS ENUM('custom', 'entry')`);
        await queryRunner.query(`CREATE TABLE "menu_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid NOT NULL, "menuId" uuid NOT NULL, "parentId" uuid, "label" character varying(200) NOT NULL, "type" "public"."menu_items_type_enum" NOT NULL DEFAULT 'custom', "url" character varying(2048), "entryId" uuid, "target" character varying(20), "sortOrder" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_57e6188f929e5dc6919168620c8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_80ebc4dbf9c6713525827a979c" ON "menu_items" ("siteId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6b42bf45dbdef19cbf05a4cac" ON "menu_items" ("menuId") `);
        await queryRunner.query(`CREATE INDEX "IDX_65f0971fd1823b7e9ca0a9b2cf" ON "menu_items" ("siteId", "menuId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_65f0971fd1823b7e9ca0a9b2cf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a6b42bf45dbdef19cbf05a4cac"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_80ebc4dbf9c6713525827a979c"`);
        await queryRunner.query(`DROP TABLE "menu_items"`);
        await queryRunner.query(`DROP TYPE "public"."menu_items_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec3535a7ce76edee4f94eee163"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_db71eb6f62b040fee2a5768a56"`);
        await queryRunner.query(`DROP TABLE "menus"`);
    }

}
