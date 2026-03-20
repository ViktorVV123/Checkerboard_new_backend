import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as https from 'https';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

export interface IdmRefreshResponse {
  SessionId: string;
  RefreshId: string;
  AccessId: string;
  Url: string;
}

export interface IdmUserInfo {
  [key: string]: any;
}

interface TokenCacheEntry {
  data: IdmUserInfo;
  expiresAt: number;
  promise?: Promise<IdmUserInfo>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly idmBaseUrl: string;
  private readonly CACHE_TTL_MS = 60000;
  private tokenCache = new Map<string, TokenCacheEntry>();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.idmBaseUrl = this.configService.get<string>(
      'IDM_BASE_URL',
      'https://csc-idm.pro.lukoil.com/IdmLdapAuth/api/CommonActions',
    );
  }

  async refreshTokens(refreshId: string): Promise<IdmRefreshResponse> {
    this.logger.log('Refreshing tokens...');

    try {
      const { data } = await axios.get<IdmRefreshResponse>(
        `${this.idmBaseUrl}/RefreshSession`,
        {
          params: { refreshId },
          headers: { accept: '*/*' },
          timeout: 10000,
          httpsAgent,
        },
      );

      if (!data.AccessId || !data.RefreshId) {
        this.logger.error('Invalid refresh response from IdM');
        throw new UnauthorizedException('Невалидный ответ от IdM');
      }

      this.logger.log('Tokens refreshed successfully');
      return data;
    } catch (error: any) {
      const status = error?.response?.status;
      this.logger.error(`Refresh failed: status=${status}, message=${error.message}`);

      if (status === 400 || status === 401 || status === 403) {
        throw new UnauthorizedException('Refresh токен истёк или невалиден');
      }

      throw new UnauthorizedException('Ошибка обновления токенов');
    }
  }

  async verifyToken(accessId: string): Promise<IdmUserInfo> {
    const cached = this.tokenCache.get(accessId);

    if (cached) {
      if (cached.promise) {
        return cached.promise;
      }
      if (Date.now() < cached.expiresAt) {
        return cached.data;
      }
      this.tokenCache.delete(accessId);
    }

    const promise = this.doVerifyToken(accessId);

    this.tokenCache.set(accessId, {
      data: null as any,
      expiresAt: 0,
      promise,
    });

    try {
      const data = await promise;
      this.tokenCache.set(accessId, {
        data,
        expiresAt: Date.now() + this.CACHE_TTL_MS,
      });
      return data;
    } catch (error) {
      this.tokenCache.delete(accessId);
      throw error;
    }
  }

  private async doVerifyToken(accessId: string): Promise<IdmUserInfo> {
    try {
      const { data } = await axios.post(
        `${this.idmBaseUrl}/AddTopic`,
        {
          topicName: 'chess-portal',
          tokenId: accessId,
          returnUserInfo: true,
        },
        {
          headers: {
            accept: '*/*',
            'Content-Type': 'application/json',
          },
          timeout: 10000,
          httpsAgent,
        },
      );

      return data;
    } catch (error: any) {
      const status = error?.response?.status;
      this.logger.error(`Token verify failed: status=${status}`);
      throw new UnauthorizedException('Токен невалиден или истёк');
    }
  }

  async logAccess(data: {
    username: string;
    fullName?: string;
    email?: string;
    title?: string;
    department?: string;
    company?: string;
    ip?: string;
  }) {
    try {
      await this.prisma.auth_logs.create({ data });
    } catch (error) {
      this.logger.error(`Failed to save auth log: ${error}`);
    }
  }
}
