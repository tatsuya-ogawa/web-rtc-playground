import type {MessageType, SignalingService} from "@/services/Signaling.service";

export interface IceServer {
    urls: string
    username: string
    credential: string
}

export class WebRTCService {
    localMediaStream?: MediaStream;
    remoteMediaStream: MediaStream = new MediaStream();
    private isHost?: boolean;

    constructor(private signaling: SignalingService, private signalingServerUrl: string) {
    }

    /**
     * ホストとして接続
     */
    async connectionAsHost(constraints: MediaStreamConstraints) {
        this.isHost = true;
        try {
            // 1. ホスト側のメディアストリームを取得
            this.localMediaStream = await navigator.mediaDevices.getUserMedia(constraints);

            await this.signaling.init(this.signalingServerUrl);
            // 2. ホスト側でPeerConnectionを作成し、トラックを追加
            const pc = this.createPeerConnection(this.signaling.iceServers!);
            this.localMediaStream.getTracks().forEach(track => pc.addTrack(track, this.localMediaStream!));

            // ソケット接続時にオファーを送信
            this.signaling.onConnect = () => this.sendOffer(pc);
            this.signaling.onMessage = this.handleMessage(pc);
        } catch (err) {
            console.error(err);
        }
    }

    /**
     * クライアントとして接続
     */
    async connectionAsClient(constraints: MediaStreamConstraints) {
        this.isHost = false;
        try {
            this.localMediaStream = await navigator.mediaDevices.getUserMedia(constraints);

            await this.signaling.init(this.signalingServerUrl);
            const pc = this.createPeerConnection(this.signaling.iceServers!);

            // クライアント接続時にホストからofferを送ってもらうためにシグナル送信
            this.signaling.onConnect = () => this.signaling.sendMessage('connect_client', null);
            this.signaling.onMessage = this.handleMessage(pc);
        } catch (err) {
            console.error(err);
        }
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

    private createPeerConnection(iceServers: IceServer[]) {
        const pcConfig: RTCConfiguration = {
            iceServers: iceServers
        };

        const pc = new RTCPeerConnection(pcConfig);
        // リモートのトラック受信
        pc.addEventListener('track', (event: RTCTrackEvent) => {
            if (this.remoteMediaStream.getTracks().filter(track => track.id == event.track.id).length > 0) return
            this.remoteMediaStream.addTrack(event.track)
        });
        // 5． ICE候補を追加
        pc.addEventListener('icecandidate', event => {
            if (event.candidate) {
                this.signaling.sendMessage('new-ice-candidate', event.candidate);
            }
        });

        return pc;
    }

    private async sendOffer(peerConnection: RTCPeerConnection) {
        // 3. オファーを作成
        const offer = await peerConnection.createOffer();
        // 4. 作成したオファーをローカル接続の記述として設定
        await peerConnection.setLocalDescription(offer);
        // 6. オファーを送信
        this.signaling.sendMessage('offer', offer);
    }

    private handleMessage(peerConnection: RTCPeerConnection) {
        return async (type: MessageType, data: any) => {
            switch (type) {
                case 'offer':
                    if (!this.isHost) {
                        // 7. クライアント側で受信したofferをリモート側の接続情報としてセット
                        const remoteDesc = new RTCSessionDescription(data);
                        await peerConnection.setRemoteDescription(remoteDesc);
                        // 8. ローカルのメディアトラックをピア接続にアタッチ
                        this.localMediaStream?.getTracks().forEach(track => {
                            try{
                                peerConnection.addTrack(track, this.localMediaStream!)
                            }catch (ex){
                                console.log(ex)
                            }
                        });
                        // 9. アンサー作成
                        const answer = await peerConnection.createAnswer();
                        // 10. アンサーをローカルの接続情報としてセット
                        await peerConnection.setLocalDescription(answer);
                        // 11. アンサーを送信
                        this.signaling.sendMessage('answer', answer);
                    }
                    break;
                case 'answer':
                    // 12. ホスト側でアンサーを受信
                    if (this.isHost) {
                        // 13. アンサーをリモート側の接続情報としてセット
                        const remoteDesc = new RTCSessionDescription(data);
                        await peerConnection.setRemoteDescription(remoteDesc);
                    }
                    break;
                case 'connect_client':
                    if (this.isHost) {
                        // クライアントが接続してきたらオファーを投げてやる
                        await this.sendOffer(peerConnection);
                    }
                    break;
                case 'new-ice-candidate':
                    await peerConnection.addIceCandidate(data);
                    break;
            }
        }
    }

}