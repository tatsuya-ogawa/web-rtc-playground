export interface TurnCredential {
    username: string;
    credential: string;
}
export declare class AppService {
    getTurnCredential(name: string, secret: string): TurnCredential;
}
