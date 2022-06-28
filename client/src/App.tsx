import {defineComponent, ref} from "vue";
import HomeView from "@/views/HomeView";

export default defineComponent({
    props: {
    },
    setup(props) {
        return () => (
           <HomeView></HomeView>
        )
    },
})