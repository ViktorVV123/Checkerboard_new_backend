import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly idmBaseUrl: string;

  constructor(private configService: ConfigService) {
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
}
