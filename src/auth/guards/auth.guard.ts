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

export const IS_PUBLIC_KEY = 'isPublic';

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

    if (!accessId) {
      this.logger.warn(`Blocked: no token — ${request.method} ${request.url}`);
      throw new UnauthorizedException('Отсутствует токен авторизации');
    }

    // DEV токен
    if (this.devToken && accessId === this.devToken) {
      request.user = { username: 'developer', cn: 'Developer', mail: 'dev@local' };

      // Логируем dev доступ (не ждём завершения)
      this.authService.logAccess({
        username: 'developer',
        fullName: 'Developer',
        email: 'dev@local',
        method: request.method,
        url: request.url,
        ip,
      });

      return true;
    }

    // Реальный токен
    try {
      const userInfo = await this.authService.verifyToken(accessId);
      request.user = userInfo;

      const user = userInfo?.User || userInfo;
      const username = user?.username || 'unknown';
      const fullName = user?.cn || '';
      const email = user?.mail || '';

      this.logger.log(`${fullName} (${email}) — ${request.method} ${request.url}`);

      // Логируем в базу (не ждём завершения)
      this.authService.logAccess({
        username,
        fullName,
        email,
        method: request.method,
        url: request.url,
        ip,
      });

      return true;
    } catch {
      this.logger.warn(`Blocked: invalid token — ${request.method} ${request.url}`);
      throw new UnauthorizedException('Токен невалиден или истёк');
    }
  }
}
