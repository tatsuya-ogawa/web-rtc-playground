import io, {Socket} from 'socket.io-client';
import type {WebRTCService} from "@/services/WebRtc.service";

export type SendMessageType = 'SEND_OFFER' | 'SEND_ANSWER' | 'SEND_CANDIDATE';
export type ReceiveMessageType = 'OFFER' | 'ANSWER' | 'OPEN' | 'CANDIDATE';

export interface SignalingSendMessage {
    src?: string,
    dst?: string,
    data: any;
}

export interface SignalingReceiveMessage {
    src?: string,
    dst?: string,
    data: any;
}

export class SignalingService {
    private socket?: Socket;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onMessage?: (type: ReceiveMessageType, message: SignalingReceiveMessage) => void;

    // public iceServers?:IceServer[]
    constructor(private service: WebRTCService, private signalingServerUrl: string) {
    }

    /**
     * シグナリングサーバーと接続
     */
    async connect() {
        const {domain,secure} = await (await fetch(`${this.signalingServerUrl}/signaling`)).json()
        this.socket = io(`${secure?"https":"http"}://${domain}`, {
            query: {
                peerId: this.service.peerId
            },
            transports: ["websocket", "polling"]
        });
        this.socket.on('connect', () => {
            if (this.onConnect) this.onConnect()
        });
        this.socket.on('disconnect', () => {
            if (this.onDisconnect) this.onDisconnect()
        });
        ['OFFER', 'ANSWER', 'OPEN', 'CANDIDATE'].forEach(type => {
            this.socket!.on(type, async (event: SignalingReceiveMessage) => {
                if (this.onMessage) await this.onMessage(type as ReceiveMessageType, event)
            })
        })
    }

    /**
     * シグナリングサーバーから切断
     */
    disconnect() {
        this.socket?.disconnect();
    }

    sendMessage(target: string, type: SendMessageType, data: any) {
        const message: SignalingSendMessage = {dst: target, src: this.service.peerId, data: data};
        this.socket?.emit(type, message);
    }

}