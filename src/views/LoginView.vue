<template>
  <SignInLanding />
</template>

<script>
import { getActivePinia } from 'pinia'
import SignInLanding from '@cornflow-ui/core/components/SignInLanding.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

export default {
  components: {
    SignInLanding,
  },
  data() {
    return {

    }
  },
  created() {
    // Every way out of a session (logout, expired token, 401) lands here: the next login in this
    // tab starts from an empty store instead of the previous user's data.
    if (getActivePinia()) {
      useGeneralStore().resetSessionState()
    }
  },
  computed: {
  },
  methods: {
  },
}
</script>
