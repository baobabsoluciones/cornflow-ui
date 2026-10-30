<template>
  <div>
    <div v-if="error" class="pa-4">
      <v-alert type="warning" variant="tonal">
        {{ $t('notFound.title') }}
      </v-alert>
    </div>
    <Suspense v-else>
      <div class="configuration-subsection-root">
        <component :is="resolvedComponent" :key="subsectionKey" />
      </div>
      <template #fallback>
        <div class="d-flex align-center justify-center pa-8">
          <v-progress-circular indeterminate color="primary" size="48" />
        </div>
      </template>
    </Suspense>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import appConfig from '@/app/config'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { isEntryVisibleFor } from '@cornflow-ui/core/utils/navigationGating'

export default defineComponent({
  name: 'ConfigurationSectionSubsectionView',
  setup() {
    const route = useRoute()
    const store = useGeneralStore()
    const resolvedComponent = ref<unknown>(null)
    const error = ref(false)

    const sectionId = computed(() => route.params.sectionId as string)
    const subsectionKey = computed(() => route.params.subsectionKey as string)

    async function loadComponent() {
      const sid = sectionId.value
      const skey = subsectionKey.value
      if (!sid || !skey) {
        error.value = true
        return
      }
      const def = appConfig.getFrontendAutomationSubsectionDef(sid, skey)
      const viewer = {
        roleNames:
          store.getUser?.roles?.map((role: { name: string }) => role.name) ?? [],
        schema: store.getSchemaName,
      }
      if (!def || !isEntryVisibleFor(def, viewer)) {
        error.value = true
        return
      }
      error.value = false
      try {
        const mod = await def.component()
        resolvedComponent.value = (mod as { default?: unknown })?.default ?? mod
      } catch {
        error.value = true
      }
    }

    watch([sectionId, subsectionKey, () => store.getSchemaName], loadComponent, {
      immediate: true,
    })

    return { resolvedComponent, error, subsectionKey }
  },
})
</script>
