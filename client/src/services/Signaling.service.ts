import io, {Socket} from 'socket.io-client';
import type {IceServer} from "@/services/WebRtc.service";

export type MessageType = 'offer' | 'answer' | 'connect_client' | 'new-ice-candidate';

interface SignalingMessage {
    type: MessageType;
    data: any;
}

export class SignalingService {
    private socket?: Socket;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onMessage?: (type: MessageType, data: any) => void;
    public iceServers?:IceServer[]
    /**
     * シグナリングサーバーと接続
     */
    async init(signalingServerUrl: string) {
        this.socket = io(`${signalingServerUrl}/signaling`, {});
        this.socket.on('connect', () => {
            if (this.onConnect) this.onConnect()
        });
        this.socket.on('disconnect', () => {
            if (this.onDisconnect) this.onDisconnect()
        });
        this.socket.on('message', (event: SignalingMessage) => {
            if (this.onMessage) this.onMessage(event.type, event.data)
        })
        const credential = await fetch(`${signalingServerUrl}/?user=user`)
        this.iceServers = await credential.json()
    }

    /**
     * シグナリングサーバーから切断
     */
    disconnect() {
        this.socket?.disconnect();
    }

    sendMessage(type: MessageType, data: any) {
        const message: SignalingMessage = {type, data};
        this.socket?.emit('message', message);
    }

}