// src/auth/guards/auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger('Auth');
  private readonly devToken: string;

  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private reflector: Reflector,
  ) {
    this.devToken = this.configService.get<string>('DEV_ACCESS_TOKEN', '');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const accessId = request.headers['access-id'];
    const ip = request.ip || request.headers['x-forwarded-for'] || '';
    const isVerifyEndpoint =
      request.method === 'POST' && request.url.includes('/auth/verify');

    if (!accessId) {
      this.logger.warn(`Blocked: no token — ${request.method} ${request.url}`);
      throw new UnauthorizedException('Отсутствует токен авторизации');
    }

    if (this.devToken && accessId === this.devToken) {
      request.user = { username: 'developer', cn: 'Developer', mail: 'dev@local' };
      if (isVerifyEndpoint) {
        this.authService.logAccess({
          username: 'developer',
          fullName: 'Developer',
          email: 'dev@local',
          ip,
        });
      }
      return true;
    }

    try {
      const userInfo = await this.authService.verifyToken(accessId);
      request.user = userInfo;

      const user       = userInfo?.User || userInfo;
      const username   = user?.username   || 'unknown';
      const cn         = user?.cn         || '';
      const mail       = user?.mail       || '';
      const title      = user?.title      || '';
      const department = user?.department || '';
      const company    = user?.company    || '';

      this.logger.log(`${cn} (${mail}) — ${request.method} ${request.url}`);

      if (isVerifyEndpoint) {
        this.authService.logAccess({
          username,
          fullName: cn,
          email: mail,
          title,
          department,
          company,
          ip,
        });
      }

      return true;
    } catch {
      this.logger.warn(`Blocked: invalid token — ${request.method} ${request.url}`);
      throw new UnauthorizedException('Токен невалиден или истёк');
    }
  }
}
