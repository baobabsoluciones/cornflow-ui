<template>
  <v-system-bar window
    style="background-color: white !important; border-bottom: 1px solid rgb(237, 234, 234); height: 40px; box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.1)">
  </v-system-bar>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import { inject } from 'vue';

export default defineComponent({
  name: 'CoreAppHeader',
  components: {},
  props: {},
  data: () => ({
    showSnackbar: undefined,
  }),
  created() {
    this.showSnackbar = inject('showSnackbar');
  },
  computed: {
  },
});
</script>

<style scoped>
.v-app-bar {
  background: white !important;
  border-bottom: 1px solid #eee;
}

.toolbar-no-padding {
  padding-left: 0px;
}

:deep .v-toolbar__content {
  padding-left: 0px;
  padding-right: 0px;
  overflow: hidden;
  display: flex;
}

.header-container {
  height: 0px;
}

.v-icon {
  height: 32px;
  width: 32px;
  margin-left: 10px;
}

.name {
  text-align: center;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.8);
  font-size: 20px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stats {
  display: flex;
  flex-direction: column;
  font-weight: 300;
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 1px;
  min-width: 35em;
}

.stat {
  display: flex;
  flex-direction: column;
}

.spacer-right {
  min-width: 24px;
}

.spacer-left {
  width: calc(100% - 290px - 32px - 350px - 32px - 32px - 32px - 32px);
}

:deep .v-badge__badge {
  min-width: 16px;
  width: 16px;

  height: 16px;
  padding: 1px 0px 0px 0px;

  inset: -5px auto auto 20px !important;
}
</style>
