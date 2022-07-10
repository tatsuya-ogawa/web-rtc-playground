import { Server, Socket } from 'socket.io';
export declare class ConnectionGateway {
    server: Server;
    handleMessage(client: Socket, payload: any): void;
}
