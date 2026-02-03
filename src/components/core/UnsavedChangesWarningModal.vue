<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="450"
    persistent
  >
    <v-card class="unsaved-changes-modal">
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2" color="warning">mdi-alert-circle</v-icon>
        {{ $t('pendingChanges.unsavedChangesWarning.title') }}
      </v-card-title>

      <v-card-text>
        <p class="warning-message">
          {{ $t('pendingChanges.unsavedChangesWarning.message') }}
        </p>
        <div v-if="changesCount > 0" class="changes-summary mt-3">
          <v-chip color="warning" variant="tonal" size="small">
            <v-icon start size="small">mdi-pencil</v-icon>
            {{ changesCount }} {{ $t('pendingChanges.changes') }}
          </v-chip>
        </div>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn
          color="primary"
          variant="flat"
          @click="handleStay"
        >
          {{ $t('pendingChanges.unsavedChangesWarning.stay') }}
        </v-btn>
        <v-btn
          color="error"
          variant="outlined"
          @click="handleLeave"
        >
          {{ $t('pendingChanges.unsavedChangesWarning.leave') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  changesCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  changesCount: 0,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'stay'): void
  (e: 'leave'): void
}>()

const handleStay = () => {
  emit('stay')
  emit('update:modelValue', false)
}

const handleLeave = () => {
  emit('leave')
  emit('update:modelValue', false)
}
</script>

<style scoped>
.unsaved-changes-modal {
  border-radius: 12px;
}

.warning-message {
  font-size: 0.95rem;
  color: var(--subtitle);
  line-height: 1.5;
}

.changes-summary {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>

