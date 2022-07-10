import type {
    ReceiveMessageType,
    SignalingReceiveMessage,
} from "@/services/Signaling.service";
import {SignalingService} from "@/services/Signaling.service";

interface IceServer {
    urls: string
    username?: string
    credential?: string
}

interface OpenMessage {
    peerId?: string;
    host?: string;
    turnCredential: {
        credential: string,
        username: string
    };
}

export class WebRTCService {
    localMediaStream?: MediaStream;
    remoteMediaStream: MediaStream = new MediaStream();
    // private isHost?: boolean;
    iceServers?: IceServer[];
    pcDict: { [key: string]: RTCPeerConnection } = {};
    onOpen?: () => Promise<void>;
    onOffer?: (message: SignalingReceiveMessage) => Promise<void>;
    signaling:SignalingService;
    constructor(public peerId: string, private signalingUrl:string) {
        this.signaling = new SignalingService(this,signalingUrl);
    }

    async open(constraints: MediaStreamConstraints) {
        this.localMediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        await this.signaling.connect();
        // クライアント接続時にホストからofferを送ってもらうためにシグナル送信
        this.signaling.onConnect = () => {
        }
        this.signaling.onMessage = this.handleMessage();
    }

    /**
     * クライアントとして接続
     */
    async call(target: string) {
        this.createPeerConnection(target);
        await this.sendOffer(target);
    }

    async answer(target: string, data: any) {
        this.createPeerConnection(target);
        await this.sendAnswer(target, data);
    }

    /**
     * 切断
     */
    disconnect() {
        // メディアを停止
        [this.localMediaStream, this.remoteMediaStream].forEach(stream => stream?.getTracks().forEach(track => track.stop()));
        // ソケット切断
        this.signaling.disconnect();
    }

    private createPeerConnection(target: string) {
        const pcConfig: RTCConfiguration = {
            iceServers: this.iceServers!
        };

        this.pcDict[target] = new RTCPeerConnection(pcConfig);
        // リモートのトラック受信
        this.pcDict[target].addEventListener('track', (event: RTCTrackEvent) => {
            if (this.remoteMediaStream.getTracks().filter(track => track.id == event.track.id).length > 0) return
            this.remoteMediaStream.addTrack(event.track)
        });
        // 5． ICE候補を追加
        this.pcDict[target].addEventListener('icecandidate', event => {
            if (event.candidate) {
                this.signaling.sendMessage(target,'SEND_CANDIDATE', event.candidate);
            }
        });

        return this.pcDict[target];
    }

    private async sendOffer(target: string) {
        // 3. オファーを作成
        const offer = await this.pcDict[target].createOffer();
        // 4. 作成したオファーをローカル接続の記述として設定
        await this.pcDict[target].setLocalDescription(offer);
        // 6. オファーを送信
        this.signaling.sendMessage(target,'SEND_OFFER', offer);
    }

    public async sendAnswer(target: string, data: RTCSessionDescriptionInit) {
        // 7. クライアント側で受信したofferをリモート側の接続情報としてセット
        const remoteDesc = new RTCSessionDescription(data);
        await this.pcDict[target].setRemoteDescription(remoteDesc);
        // 8. ローカルのメディアトラックをピア接続にアタッチ
        this.localMediaStream?.getTracks().forEach(track => {
            this.pcDict[target].addTrack(track, this.localMediaStream!)
        });
        // 9. アンサー作成
        const answer = await this.pcDict[target].createAnswer();
        // 10. アンサーをローカルの接続情報としてセット
        await this.pcDict[target].setLocalDescription(answer);
        // 11. アンサーを送信
        this.signaling.sendMessage(target,'SEND_ANSWER', answer);
    }

    private async handleOpen(message: any) {
        const openMessage: OpenMessage = message;
        if(!this.peerId)this.peerId = openMessage.peerId!;
        const turnHostName = openMessage.host;
        this.iceServers = [
            {urls: `stun:${turnHostName}:3478`},
            {
                urls: `turn:${turnHostName}:3478?transport=udp`,
                ...openMessage.turnCredential
            },
            {
                urls: `turn:${turnHostName}:3478?transport=tcp`,
                ...openMessage.turnCredential
            },
        ];
        this.onOpen && await this.onOpen();
    }

    private async handleOffer(message: SignalingReceiveMessage) {
        this.onOffer && await this.onOffer(message);
    }

    private async handleAnswer(message: SignalingReceiveMessage) {
        const remoteDesc = new RTCSessionDescription(message.data);
        if (message.src) {
            await this.pcDict[message.src!].setRemoteDescription(remoteDesc);
        }
    }

    private handleMessage() {
        return async (type:ReceiveMessageType,message: SignalingReceiveMessage) => {
            switch (type) {
                case 'OFFER':
                    await this.handleOffer(message);
                    break;
                case 'ANSWER':
                    await this.handleAnswer(message);
                    break;
                case 'OPEN':
                    // if (this.isHost) {
                    //     // クライアントが接続してきたらオファーを投げてやる
                    //     await this.sendOffer(peerConnection);
                    // }
                    await this.handleOpen(message);
                    break;
                case 'CANDIDATE':
                    if (message.dst) {
                        await this.pcDict[message.dst].addIceCandidate(message.data);
                    }
                    break;
            }
        }
    }

}