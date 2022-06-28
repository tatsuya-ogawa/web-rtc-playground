import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';

interface IceServer {
  urls: string;
  username?: string;
  credential?: string;
}

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private configService: ConfigService,
  ) {}

  @Get()
  getTurnCredential(@Query('user') user: string): IceServer[] {
    const secret = this.configService.get<string>('TURN_SECRET');
    const turnHostName = this.configService.get<string>('TURN_HOSTNAME');
    if (!secret) {
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (!user) {
      throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
    }
    const { username, credential } = this.appService.getTurnCredential(
      user,
      secret,
    );
    return [
      { urls: `stun:${turnHostName}:3478` },
      {
        urls: `turn:${turnHostName}:3478?transport=udp`,
        username: username,
        credential: credential,
      },
      {
        urls: `turn:${turnHostName}:3478?transport=tcp`,
        username: username,
        credential: credential,
      },
    ];
  }
}
