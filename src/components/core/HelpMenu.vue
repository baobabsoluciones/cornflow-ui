<template>
  <v-btn
    fab
    icon
    rounded
    density="compact"
    class="mt-4"
    style="position: fixed; right: 0"
  >
    <v-icon>mdi-help</v-icon>
    <v-menu activator="parent" location="end" transition="fade-transition">
      <v-list density="compact" min-width="250" rounded="lg" slim>
        <v-list-item link @click="helpModal = true">
          <v-list-item-title class="small-font">
            {{ $t('helpMenu.help') }}
          </v-list-item-title>
        </v-list-item>
        <v-list-item link @click="licensesModal = true">
          <v-list-item-title class="small-font">
            {{ $t('helpMenu.licences') }}
          </v-list-item-title>
        </v-list-item>
        <v-divider class="my-2"></v-divider>

        <v-list-item min-height="24">
          <template v-slot:subtitle>
            <div class="text-caption">{{ appVersion }}</div>
          </template>
        </v-list-item>
        <v-list-item min-height="24">
          <template v-slot:subtitle>
            <div class="text-caption">{{ backendVersion }}</div>
          </template>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-btn>
  <MBaseModal
    :title="$t('helpMenu.licences')"
    :buttons="[
      {
        text: $t('helpMenu.close'),
        action: 'cancel',
        class: 'primary-btn',
      },
    ]"
    @cancel="licensesModal = false"
    @close="licensesModal = false"
    v-model="licensesModal"
  >
    <template #content>
      <div style="max-height: 350px; overflow-y: auto">
        <v-card-text class="text-left">
          <ul class="list">
            <li v-for="(licence, index) in licences" :key="index">
              <strong
                >{{ licence.library }} v.{{ licence.version }} ({{
                  licence.license
                }})</strong
              >: {{ licence.author }} - {{ licence.description }}
            </li>
          </ul>
        </v-card-text>
      </div>
    </template>
  </MBaseModal>
  <MBaseModal
    v-model="helpModal"
    :title="$t('helpMenu.help')"
    :buttons="[
      {
        text: $t('helpMenu.close'),
        action: 'cancel',
        class: 'primary-btn',
      },
    ]"
    @cancel="helpModal = false"
    @close="helpModal = false"
  >
    <template #content>
      <v-card-text class="mt-6 transition-icon">
        <a
          :href="manualFile"
          download="manual_user.pdf"
          class="transition-icon"
        >
          <v-icon small class="mr-2" style="color: var(--primary)"
            >mdi-download</v-icon
          >
          <span> {{ $t('helpMenu.download') }} </span>
        </a>
      </v-card-text>
    </template>
  </MBaseModal>
</template>

<script>
import { version } from '@/../package.json'
import { useGeneralStore } from '@/stores/general'

export default {
  data: () => ({
    licensesModal: false,
    helpModal: false,
    store: useGeneralStore(),
  }),
  computed: {
    manualFile() {
      const lang = this.$i18n.locale
      return `${import.meta.env.BASE_URL}manual/user_manual_${lang}.pdf`
    },
    licences() {
      return this.store.getLicences
    },
    appVersion() {
      return `Cornflow app version: ${version}`
    },
    backendVersion() {
      return `Cornflow version: ${this.store.cornflowVersion}`
    },
  },
  methods: {},
}
</script>

<style scoped>
.small-font {
  font-size: 0.85rem !important;
}

.transition-icon {
  text-decoration: none !important;
  color: black !important;
  text-transform: uppercase !important;
  letter-spacing: 1px !important;
  font-size: 14px;
}

.transition-icon:hover {
  i {
    transform: translateX(0) translateY(4px) !important;
    transition: all 0.3s ease-in-out !important;
  }
}
</style>
