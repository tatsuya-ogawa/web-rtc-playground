import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';
interface IceServer {
    urls: string;
    username?: string;
    credential?: string;
}
export declare class AppController {
    private readonly appService;
    private configService;
    constructor(appService: AppService, configService: ConfigService);
    getTurnCredential(user: string): IceServer[];
}
export {};
