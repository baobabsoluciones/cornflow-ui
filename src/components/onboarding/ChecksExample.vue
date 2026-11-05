<!--
  ChecksExample: the checks of a new execution as they look when they find something, one check
  with errors and one with warnings, for the guided tour. The data is made up.
-->
<template>
  <ChecksStatus status="errors" :results="results" :checked-at="checkedAt" blocking />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ChecksStatus from '@cornflow-ui/core/components/create-execution/ChecksStatus.vue'
import type { CheckResult } from '@cornflow-ui/core/composables/create-execution/checkResults'

defineOptions({ name: 'ChecksExample' })

const { t } = useI18n()

const checkedAt = new Date()

const rows = (count: number) => Array.from({ length: count }, () => ({}))

const results = computed<CheckResult[]>(() => [
  {
    key: 'error',
    title: t('onboarding.createExecution.checksExample.example.error'),
    description: '',
    kind: 'error',
    columns: [],
    records: rows(3),
  },
  {
    key: 'warning',
    title: t('onboarding.createExecution.checksExample.example.warning'),
    description: '',
    kind: 'warning',
    columns: [],
    records: rows(12),
  },
])
</script>
