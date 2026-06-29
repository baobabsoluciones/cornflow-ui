<template>
  <div>
    <v-btn
      fab
      icon
      rounded
      density="compact"
      style="position: fixed; right: 0; top: 52px"
      @click="open = !open"
    >
      <v-icon size="20" :color="hasWarnings ? 'warning' : undefined">
        {{ hasWarnings ? 'mdi-bell-badge' : 'mdi-bell-outline' }}
      </v-icon>
    </v-btn>

    <v-card
      v-if="open"
      style="
        position: fixed;
        right: 40px;
        top: 50px;
        width: 360px;
        max-height: 480px;
        z-index: 900;
        display: flex;
        flex-direction: column;
      "
      elevation="6"
      rounded="lg"
    >
      <v-card-title
        class="d-flex align-center justify-space-between py-3 px-4"
        style="
          font-size: 0.95rem;
          font-weight: 600;
          background-color: var(--primary);
          color: white;
          border-radius: inherit;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          flex-shrink: 0;
        "
      >
        <span>{{ $t('warnings.title') }}</span>
        <div class="d-flex align-center" style="gap: 4px">
          <v-btn
            v-if="hasWarnings"
            density="compact"
            variant="text"
            size="small"
            color="white"
            :loading="downloading"
            style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; min-width: 0"
            @click="download"
          >
            <v-icon size="14" class="mr-1">mdi-download</v-icon>
            {{ $t('warnings.downloadAll') }}
          </v-btn>
          <v-btn
            icon
            density="compact"
            variant="text"
            color="white"
            size="x-small"
            @click="open = false"
          >
            <v-icon size="16">mdi-close</v-icon>
          </v-btn>
        </div>
      </v-card-title>

      <div style="overflow-y: auto; flex: 1; padding: 10px; display: flex; flex-direction: column; gap: 6px">
        <div v-if="warnings.length === 0" class="text-center py-4" style="font-size: 0.82rem; color: grey">
          {{ $t('warnings.noWarnings') }}
        </div>

        <div
          v-for="(warning, i) in warnings"
          :key="i"
          style="
            font-size: 0.82rem;
            line-height: 1.5;
            padding: 8px 10px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            background: #fafafa;
            word-break: break-word;
            white-space: pre-wrap;
          "
        >
          {{ warning.message }}
        </div>
      </div>
    </v-card>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useGeneralStore } from '@/stores/general'
import WarningsRepository from '@/repositories/WarningsRepository'

const repo = new WarningsRepository()

export default defineComponent({
  name: 'WarningsPanel',
  data: () => ({
    open: false,
    downloading: false,
    store: useGeneralStore(),
  }),
  computed: {
    warnings() {
      return this.store.getWarnings
    },
    hasWarnings() {
      return this.warnings.length > 0
    },
  },
  methods: {
    async download() {
      this.downloading = true
      try {
        await repo.downloadWarnings()
      } catch {
        // silently fail
      } finally {
        this.downloading = false
      }
    },
  },
})
</script>
