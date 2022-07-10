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
        [this.localMediaStream, this.remoteMediaStream].forEach(stream => stream?.getTracks().forEach(track => track.stop()));
        this.signaling.disconnect();
    }

    private createPeerConnection(target: string) {
        const pcConfig: RTCConfiguration = {
            iceServers: this.iceServers!
        };

        this.pcDict[target] = new RTCPeerConnection(pcConfig);
        this.pcDict[target].addEventListener('track', (event: RTCTrackEvent) => {
            if (this.remoteMediaStream.getTracks().filter(track => track.id == event.track.id).length > 0) return
            this.remoteMediaStream.addTrack(event.track)
        });
        this.pcDict[target].addEventListener('icecandidate', event => {
            if (event.candidate) {
                this.signaling.sendMessage(target,'SEND_CANDIDATE', event.candidate);
            }
        });
        return this.pcDict[target];
    }

    private async sendOffer(target: string) {
        this.localMediaStream!.getTracks().forEach(track => this.pcDict[target].addTrack(track, this.localMediaStream!));
        const offer = await this.pcDict[target].createOffer();
        await this.pcDict[target].setLocalDescription(offer);
        this.signaling.sendMessage(target,'SEND_OFFER', offer);
    }

    public async sendAnswer(target: string, data: RTCSessionDescriptionInit) {
        const remoteDesc = new RTCSessionDescription(data);
        await this.pcDict[target].setRemoteDescription(remoteDesc);
        this.localMediaStream?.getTracks().forEach(track => {
            this.pcDict[target].addTrack(track, this.localMediaStream!)
        });
        const answer = await this.pcDict[target].createAnswer();
        await this.pcDict[target].setLocalDescription(answer);
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
                    await this.handleOpen(message);
                    break;
                case 'CANDIDATE':
                    if (message.src) {
                        await this.pcDict[message.src].addIceCandidate(message.data);
                    }
                    break;
            }
        }
    }

}