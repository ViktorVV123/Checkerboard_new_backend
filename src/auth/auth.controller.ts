// src/auth/auth.controller.ts
import { Controller, Post, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Авторизация')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Публичный — не требует access-id токена
  // Фронт присылает refresh_id, бэк идёт в IdM и возвращает новую пару { AccessId, RefreshId }
  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Обновить токены через IdM' })
  @ApiQuery({
    name: 'refresh_id',
    required: true,
    example: 'fb6b29cb-f89c-409c-b5c3-0f8ba2dece59',
  })
  refresh(@Query('refresh_id') refreshId: string) {
    return this.authService.refreshTokens(refreshId);
  }

  // Защищённый — требует access-id в хедере
  @Post('verify')
  @ApiOperation({ summary: 'Проверить токен и получить информацию о пользователе' })
  @ApiHeader({ name: 'access-id', required: true })
  verify(@Headers('access-id') accessId: string) {
    return this.authService.verifyToken(accessId);
  }
}
