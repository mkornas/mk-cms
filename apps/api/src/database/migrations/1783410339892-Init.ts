import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1783410339892 implements MigrationInterface {
    name = 'Init1783410339892'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'invited', 'suspended')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying(320) NOT NULL, "passwordHash" character varying(255) NOT NULL, "name" character varying(200) NOT NULL, "avatarUrl" character varying(1024), "status" "public"."users_status_enum" NOT NULL DEFAULT 'active', "isSuperAdmin" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TYPE "public"."sites_status_enum" AS ENUM('active', 'suspended', 'archived')`);
        await queryRunner.query(`CREATE TABLE "sites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "slug" character varying(128) NOT NULL, "name" character varying(200) NOT NULL, "domains" jsonb NOT NULL DEFAULT '[]'::jsonb, "status" "public"."sites_status_enum" NOT NULL DEFAULT 'active', "settings" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_4f5eccb1dfde10c9170502595a7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_26503a75e987672fb5af9258cc" ON "sites" ("slug") `);
        await queryRunner.query(`CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid, "slug" character varying(64) NOT NULL, "name" character varying(128) NOT NULL, "capabilities" jsonb NOT NULL DEFAULT '[]'::jsonb, "isSystem" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_dbb66412a84ba000d3e240ecb4" ON "roles" ("siteId", "slug") `);
        await queryRunner.query(`CREATE TABLE "site_memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "siteId" uuid NOT NULL, "roleId" uuid NOT NULL, CONSTRAINT "PK_36156bd7670336d7011e016a6f0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c479afd654e0005e46281400e0" ON "site_memberships" ("siteId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a5af705ccf1fa17e8d397b39c1" ON "site_memberships" ("userId", "siteId") `);
        await queryRunner.query(`CREATE TABLE "options" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "siteId" uuid, "key" character varying(191) NOT NULL, "value" jsonb NOT NULL, "autoload" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_d232045bdb5c14d932fba18d957" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2ef127cf0860b6879abb62cb96" ON "options" ("siteId", "key") `);
        await queryRunner.query(`ALTER TABLE "site_memberships" ADD CONSTRAINT "FK_6611c105279f04337e6de334617" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "site_memberships" ADD CONSTRAINT "FK_c479afd654e0005e46281400e07" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "site_memberships" ADD CONSTRAINT "FK_3360adbfebe3b3263f106e49546" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "site_memberships" DROP CONSTRAINT "FK_3360adbfebe3b3263f106e49546"`);
        await queryRunner.query(`ALTER TABLE "site_memberships" DROP CONSTRAINT "FK_c479afd654e0005e46281400e07"`);
        await queryRunner.query(`ALTER TABLE "site_memberships" DROP CONSTRAINT "FK_6611c105279f04337e6de334617"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2ef127cf0860b6879abb62cb96"`);
        await queryRunner.query(`DROP TABLE "options"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a5af705ccf1fa17e8d397b39c1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c479afd654e0005e46281400e0"`);
        await queryRunner.query(`DROP TABLE "site_memberships"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dbb66412a84ba000d3e240ecb4"`);
        await queryRunner.query(`DROP TABLE "roles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_26503a75e987672fb5af9258cc"`);
        await queryRunner.query(`DROP TABLE "sites"`);
        await queryRunner.query(`DROP TYPE "public"."sites_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    }

}
