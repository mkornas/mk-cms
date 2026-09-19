import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Full-text search over content entries. A STORED generated `tsvector` column
 * aggregates the title (weight A) and every string value in the `fields` JSONB
 * (weight B), maintained automatically by Postgres on write — so there's no
 * reindex step for the FTS backend. Indexed with GIN for fast `@@` matches. The
 * `simple` config is language-agnostic (no stemming), a safe default for a
 * multilingual multi-tenant instance.
 */
export class Search1783531500000 implements MigrationInterface {
    name = 'Search1783531500000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "content_entries" ADD COLUMN "search_vector" tsvector
            GENERATED ALWAYS AS (
              setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
              setweight(jsonb_to_tsvector('simple', coalesce("fields", '{}'::jsonb), '["string"]'), 'B')
            ) STORED
        `);
        await queryRunner.query(`CREATE INDEX "IDX_content_entries_search" ON "content_entries" USING GIN ("search_vector")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_content_entries_search"`);
        await queryRunner.query(`ALTER TABLE "content_entries" DROP COLUMN "search_vector"`);
    }

}
