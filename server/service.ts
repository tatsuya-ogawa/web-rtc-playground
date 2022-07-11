import {createHmac} from 'node:crypto';

export interface OpenMessage {
    peerId?: string;
    turnUrl?: string;
    stunUrl?: string;
    turnCredential: {
        credential: string,
        username: string
    };
}

interface IceServer {
    urls: string;
    username?: string;
    credential?: string;
}

export class Service {
    private getTurnCredential(name: string, secret: string): {
        credential: string,
        username: string
    } {
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

    getOpenMessage(peerId: string): OpenMessage {
        if (!peerId) peerId = Math.random().toString(32).substring(2);
        const secret = process.env['TURN_SECRET'];
        const turnHostName = process.env['TURN_HOSTNAME'];
        if (!secret) {
            throw new Error();
        }
        if (!peerId) {
            throw new Error();
        }
        const {username, credential} = this.getTurnCredential(
            peerId,
            secret,
        );
        return {
            peerId: peerId,
            turnUrl: `turn:${turnHostName}:3748`,
            stunUrl: `stun:${turnHostName}:3748`,
            turnCredential: {
                username: username,
                credential: credential,
            }
        };
    }
}
