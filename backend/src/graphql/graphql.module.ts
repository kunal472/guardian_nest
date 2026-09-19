import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AdminResolver } from './resolvers/admin.resolver';
import { IncidentsModule } from '../incidents/incidents.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: true,
      path: '/graphql',
      introspection: true,
    }),
    IncidentsModule,
    GatewayModule,
  ],
  providers: [AdminResolver],
})
export class AppGraphQLModule {}
