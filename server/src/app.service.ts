import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';

export interface TurnCredential {
  username: string;
  credential: string;
}
@Injectable()
export class AppService {
  getTurnCredential(name: string, secret: string): TurnCredential {
    const unixTimeStamp: number = Date.now() / 1000 + 24 * 3600; // this credential would be valid for the next 24 hours
    const username: string = [unixTimeStamp, name].join(':');
    const hmac = createHmac('sha1', secret);
    hmac.setEncoding('base64');
    hmac.write(username);
    hmac.end();
    const password = hmac.read();
    return {
      username: username,
      credential: password,
    };
  }
}
