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
    turnUrl?: string;
    stunUrl?: string;
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
    signaling: SignalingService;

    constructor(public peerId: string, private signalingUrl: string) {
        this.signaling = new SignalingService(this, signalingUrl);
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
        const connectionId = this.createPeerConnection(target);
        await this.sendOffer(connectionId, target);
    }

    async answer(connectionId: string, target: string, data: any) {
        this.createPeerConnection(target, connectionId);
        await this.sendAnswer(connectionId, target, data);
    }

    /**
     * 切断
     */
    disconnect() {
        [this.localMediaStream, this.remoteMediaStream].forEach(stream => stream?.getTracks().forEach(track => track.stop()));
        this.signaling.disconnect();
    }

    private createRandom(): string {
        return Math.random().toString(32).substring(2);
    }

    private createPeerConnection(target: string, connectionId?: string): string {
        connectionId = connectionId || this.createRandom();
        const pcConfig: RTCConfiguration = {
            iceServers: this.iceServers!
        };
        this.pcDict[connectionId] = new RTCPeerConnection(pcConfig);
        this.pcDict[connectionId].addEventListener('track', (event: RTCTrackEvent) => {
            if (this.remoteMediaStream.getTracks().filter(track => track.id == event.track.id).length > 0) return
            this.remoteMediaStream.addTrack(event.track)
        });
        this.pcDict[connectionId].addEventListener('icecandidate', event => {
            if (event.candidate) {
                this.signaling.sendMessage('SEND_CANDIDATE', {connectionId:connectionId!, src: this.peerId, dst: target, candidate:event.candidate});
            }
        });
        return connectionId;
    }

    private async sendOffer(connectionId: string, target: string) {
        this.localMediaStream!.getTracks().forEach(track => this.pcDict[connectionId].addTrack(track, this.localMediaStream!));
        const offer = await this.pcDict[connectionId].createOffer();
        await this.pcDict[connectionId].setLocalDescription(offer);
        this.signaling.sendMessage('SEND_OFFER', {connectionId, src: this.peerId, dst: target, offer});
    }

    public async sendAnswer(connectionId: string, target: string, data: RTCSessionDescriptionInit) {
        const remoteDesc = new RTCSessionDescription(data);
        await this.pcDict[connectionId].setRemoteDescription(remoteDesc);
        this.localMediaStream?.getTracks().forEach(track => {
            this.pcDict[connectionId].addTrack(track, this.localMediaStream!)
        });
        const answer = await this.pcDict[connectionId].createAnswer();
        await this.pcDict[connectionId].setLocalDescription(answer);
        this.signaling.sendMessage('SEND_ANSWER', {connectionId, src: this.peerId, dst: target, answer});
    }

    private async handleOpen(message: any) {
        const openMessage: OpenMessage = message;
        if (!this.peerId) this.peerId = openMessage.peerId!;
        const turnUrl = openMessage.turnUrl;
        const stunUrl = openMessage.stunUrl;
        this.iceServers = [
            {urls: `${stunUrl}`},
            {
                urls: `${turnUrl}?transport=udp`,
                ...openMessage.turnCredential
            },
            {
                urls: `${turnUrl}?transport=tcp`,
                ...openMessage.turnCredential
            },
        ];
        this.onOpen && await this.onOpen();
    }

    private async handleOffer(message: SignalingReceiveMessage) {
        this.onOffer && await this.onOffer(message);
    }

    private async handleAnswer(message: SignalingReceiveMessage) {
        const remoteDesc = new RTCSessionDescription(message.answer);
        if (message.connectionId) {
            await this.pcDict[message.connectionId].setRemoteDescription(remoteDesc);
        }
    }

    private handleMessage() {
        return async (type: ReceiveMessageType, message: SignalingReceiveMessage) => {
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
                        await this.pcDict[message.connectionId].addIceCandidate(message.candidate);
                    }
                    break;
            }
        }
    }

}