import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordService } from './password.service';
import { InviteService } from './invite.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Auth is global so the {@link JwtAuthGuard} (registered as an APP_GUARD in
 * AppModule) and {@link PasswordService} (used by the seeder) are available
 * everywhere. Secrets are passed per-sign/verify call, so JwtModule needs no
 * static config here.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, InviteService, JwtAuthGuard],
  // Re-export JwtModule so JwtService resolves in the root injector, where the
  // APP_GUARD-registered JwtAuthGuard is instantiated. InviteService is exported
  // (module is @Global) so the UserResolver can drive invite onboarding without
  // an admin-api.module edit.
  exports: [AuthService, PasswordService, InviteService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
