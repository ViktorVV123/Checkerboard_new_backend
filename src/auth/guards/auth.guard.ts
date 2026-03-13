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
  private readonly logger = new Logger(AuthGuard.name);
  private readonly devToken: string;

  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private reflector: Reflector,
  ) {
    this.devToken = this.configService.get<string>('DEV_ACCESS_TOKEN', '');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Проверяем декоратор @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const accessId = request.headers['access-id'];

    if (!accessId) {
      throw new UnauthorizedException('Отсутствует токен авторизации');
    }

    // DEV токен — пропускаем без проверки в IdM
    if (this.devToken && accessId === this.devToken) {
      request.user = { name: 'Developer', role: 'dev' };
      return true;
    }

    // Реальный токен — проверяем через IdM
    try {
      const userInfo = await this.authService.verifyToken(accessId);
      request.user = userInfo;
      return true;
    } catch {
      throw new UnauthorizedException('Токен невалиден или истёк');
    }
  }
}
