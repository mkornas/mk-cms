import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault,
} from '@apollo/server/plugin/landingPage/default';
import type { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { ApiSharedModule } from './api-shared.module';
import { LoaderFactory } from './loaders/loader.factory';
import { AdminApiModule } from './admin/admin-api.module';
import { DeliveryApiModule } from './delivery/delivery-api.module';

/**
 * The GraphQL surface (per ARCHITECTURE §1, §5). One Apollo instance / one
 * code-first schema at `/graphql` serves both audiences:
 *
 *   • Admin/Management — authenticated root queries + mutations, each guarded
 *     by capabilities (the global JwtAuth + Capability guards).
 *   • Content Delivery — a single public root field, `delivery`, whose subtree
 *     is read-only and published-only (drafts only via a preview token).
 *
 * The two are one schema rather than two endpoints because NestJS code-first
 * shares its schema-builder singletons across multiple `GraphQLModule.forRoot`
 * instances, so a second endpoint cannot get an independently-scoped schema.
 * Separation is instead enforced per resolver: `delivery` is `@Public` and
 * only ever reads published content, while every admin field requires a token
 * and a capability. `Entry.author` is the public-safe projection on both paths
 * so identity fields never leak to the delivery consumer.
 *
 * In development the endpoint serves the embedded **Apollo Sandbox** — a
 * GraphiQL-style explorer with schema docs, autocomplete and a query runner
 * (GraphQL's answer to Swagger UI). It's disabled and introspection is turned
 * off in production so the schema isn't publicly browsable.
 */
@Module({
  imports: [
    AdminApiModule,
    DeliveryApiModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ApiSharedModule],
      inject: [LoaderFactory, AppConfigService],
      useFactory: (loaders: LoaderFactory, config: AppConfigService) => {
        const dev = !config.isProduction;
        return {
          path: '/graphql',
          autoSchemaFile: true,
          sortSchema: true,
          // Introspection powers the Sandbox explorer; keep it dev-only.
          introspection: dev,
          playground: false,
          plugins: [
            dev
              ? ApolloServerPluginLandingPageLocalDefault({ embed: true })
              : ApolloServerPluginLandingPageProductionDefault(),
          ],
          context: ({ req }: { req: Request }) => ({
            req,
            loaders: loaders.create(),
          }),
        };
      },
    }),
  ],
})
export class GraphqlModule {}
