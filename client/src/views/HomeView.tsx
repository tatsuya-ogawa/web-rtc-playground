import {defineComponent, ref} from "vue";
import WebRtc from "@/components/WebRtc";
import {useMainStore} from "@/stores/main";
import {storeToRefs} from "pinia";

export default defineComponent({
    props: undefined,
    setup(props) {
        const main = useMainStore()
        const {hostInitialized} = storeToRefs(main)
        const apiUrl = import.meta.env.VITE_API_URL
        return () => (
            <div style={{width: "100vw", height: "100vh"}}>
                <div style={{display: "flex", flexDirection: "row"}}>
                    <div style={{flex: 1, display: "flex", flexDirection: "column"}}>
                        <div>ホスト</div>
                        <WebRtc signalingServerUrl={`${apiUrl}`} isHost={true}/>
                    </div>
                    <div style={{flex: 1, display: "flex", flexDirection: "column"}}>
                        <div>クライアント</div>
                        {hostInitialized && (<WebRtc signalingServerUrl={`${apiUrl}`} isHost={false}/>)}
                    </div>
                </div>
            </div>
        )
    },
});