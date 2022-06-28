import { defineStore } from 'pinia'

export const useMainStore = defineStore({
  id: 'WebRtc',
  state: () => ({
    hostInitialized: false
  }),
  getters: {
    hostNotInitialized: (state) => !state.hostInitialized
  },
  actions: {
    setHostInitialized() {
      this.hostInitialized = true
    }
  }
})
