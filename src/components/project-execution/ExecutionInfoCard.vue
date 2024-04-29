<template>
  <InfoCard
    class="mt-5 info-card"
    :title="titleInfoCard"
    :description="descriptionInfoCard"
    :icon="iconInfoCard"
    :iconColor="iconColorInfoCard"
    v-if="
      !selectedExecution ||
      selectedExecution.state === 0 ||
      selectedExecution.state === -7
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
  </InfoCard>
</template>

<script>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import InfoCard from '@/components/core/InfoCard.vue'

export default {
  props: {
    selectedExecution: {
      type: Object,
      default: () => ({}),
    },
  },
  components: {
    InfoCard,
  },
  setup(props) {
    const router = useRouter()

    const navigateTo = (path) => {
      router.push(path)
    }

    const iconInfoCard = computed(() => {
      return props.selectedExecution ? 'mdi-check-circle' : 'mdi-alert-circle'
    })

    const iconColorInfoCard = computed(() => {
      return props.selectedExecution ? 'var(--success)' : 'var(--warning)'
    })

    const titleInfoCard = computed(() => {
      return props.selectedExecution
        ? $t('projectExecution.infoCard.executionCreated')
        : $t('projectExecution.infoCard.noExecutionSelected')
    })

    const descriptionInfoCard = computed(() => {
      return props.selectedExecution
        ? $t('projectExecution.infoCard.solutionWillLoadMessage')
        : $t('projectExecution.infoCard.loadExecutionMessage')
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
