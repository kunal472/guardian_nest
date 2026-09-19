import { Module, forwardRef } from '@nestjs/common';
import { SosGateway } from './sos.gateway';
import { AuthModule } from '../auth/auth.module';
import { IncidentsModule } from '../incidents/incidents.module';

@Module({
  imports: [AuthModule, forwardRef(() => IncidentsModule)],
  providers: [SosGateway],
  exports: [SosGateway],
})
export class GatewayModule {}
