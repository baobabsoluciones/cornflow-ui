<template>
  <MInfoCard
    class="mt-5 info-card"
    :title="titleInfoCard"
    :description="descriptionInfoCard"
    :icon="iconInfoCard"
    :iconColor="iconColorInfoCard"
    v-if="
      !selectedExecution ||
      selectedExecution.state === 0 ||
      selectedExecution.state === -7 ||
      (type === 'solution' &&
        selectedExecution &&
        !selectedExecution.hasSolution())
    "
  >
    <template #content>
      <div class="button-container" v-if="!selectedExecution">
        <v-btn
          @click="navigateTo('/project-execution')"
          variant="outlined"
          prepend-icon="mdi-chart-timeline-variant"
        >
          {{ $t('projectExecution.infoCard.createNewExecution') }}
        </v-btn>
        <v-btn
          @click="navigateTo('/history-execution')"
          class="ml-5"
          variant="outlined"
          prepend-icon="mdi-history"
        >
          {{ $t('projectExecution.infoCard.loadFromHistory') }}
        </v-btn>
      </div>
    </template>
  </MInfoCard>
</template>

<script>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@/stores/general'

export default {
  props: {
    selectedExecution: {
      type: Object,
      default: null,
    },
    type: {
      type: String,
      default: 'instance',
    },
  },
  components: {},
  setup(props) {
    const { t } = useI18n()
    const router = useRouter()
    const generalStore = useGeneralStore()

    const navigateTo = (path) => {
      if (path === '/project-execution') {
        // Force reload of the page
        router.push({ path })
        generalStore.incrementUploadComponentKey()
      } else {
        router.push(path)
      }
    }

    const isNoSolution = computed(
      () =>
        props.type === 'solution' &&
        !!props.selectedExecution &&
        !props.selectedExecution.hasSolution(),
    )

    const iconInfoCard = computed(() => {
      const icon = isNoSolution.value ? 'mdi-alert-circle' : 'mdi-check-circle'
      return props.selectedExecution ? icon : 'mdi-alert-circle'
    })

    const iconColorInfoCard = computed(() => {
      const color = isNoSolution.value ? 'var(--warning)' : 'var(--success)'
      return props.selectedExecution ? color : 'var(--warning)'
    })

    const titleInfoCard = computed(() => {
      const title = isNoSolution.value
        ? t('projectExecution.infoCard.noSolutionFoundTitle')
        : t('projectExecution.infoCard.executionCreated')
      return props.selectedExecution
        ? title
        : t('projectExecution.infoCard.noExecutionSelected')
    })

    const descriptionInfoCard = computed(() => {
      const description = isNoSolution.value
        ? t('projectExecution.infoCard.noSolutionMessage')
        : t('projectExecution.infoCard.solutionWillLoadMessage')
      return props.selectedExecution
        ? description
        : t('projectExecution.infoCard.loadExecutionMessage')
    })

    return {
      navigateTo,
      iconInfoCard,
      iconColorInfoCard,
      titleInfoCard,
      descriptionInfoCard,
    }
  },
}
</script>

<style scoped>
.info-card {
  width: 45vw;
  margin: 0 auto;
}

.button-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding-bottom: 30px;
}
</style>
