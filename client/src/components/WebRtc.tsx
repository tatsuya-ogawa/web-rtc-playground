import {computed, defineComponent, onMounted, onUnmounted, reactive, ref, watchEffect} from "vue";
import {SignalingService} from "@/services/Signaling.service";
import {WebRTCService} from "@/services/WebRtc.service";
import {useMainStore} from "@/stores/main";

export default defineComponent({
    props: {
        isHost: {
            type: Boolean,
            required: true,
        },
        signalingServerUrl: {
            type: String,
            required: true,
        }
    },
    setup(props) {
        let webRtcService: WebRTCService
        const isInitialized = ref(false)
        const isLoading = ref(true)
        const localVideoRef = ref<HTMLVideoElement | null>(null);
        const remoteVideoRef = ref<HTMLVideoElement | null>(null);
        const isAvailableLocalMedia = ref(false)
        const isAvailableRemoteMedia = ref(false)

        const initialize = async (isHost: boolean) => {
            if(isInitialized.value)return
            isInitialized.value = true
            webRtcService = new WebRTCService(new SignalingService(), props.signalingServerUrl);
            if (isHost) {
                await webRtcService.connectionAsHost({audio: true, video: true});
                localVideoRef.value!.srcObject = webRtcService.localMediaStream!
                isAvailableLocalMedia.value = true
                const main = useMainStore()
                main.setHostInitialized()
            } else {
                await webRtcService.connectionAsClient({audio: true, video: true});
                remoteVideoRef.value!.srcObject = webRtcService.remoteMediaStream!;
                isAvailableRemoteMedia.value = true
            }
            isLoading.value = false;
        }
        onMounted(async () => {
            await initialize(props.isHost)
        })
        watchEffect(async () => {
            await initialize(props.isHost)
        })
        onUnmounted(() => {
            webRtcService?.disconnect()
        })
        return () => (
            <div class="panel">
                <div class="video-panel">
                    <div class="local-video" v-show={isAvailableLocalMedia.value}>
                        <video ref={localVideoRef} autoplay muted playsinline></video>
                    </div>
                    <div class="remote-video" v-show={isAvailableRemoteMedia.value}>
                        <video ref={remoteVideoRef} autoplay muted playsinline></video>
                    </div>
                </div>
            </div>
        )
    }
})