<template>
  <div class="catalog-section">
    <h1 class="catalog-section__title">Dialogs, toasts and previews</h1>

    <CatalogBlock
      name="CoreDialog"
      api="v-model · title · icon · tone · width · persistent · closable · #default · #actions"
    >
      <CoreButton
        variant="outlined"
        text="Open a dialog"
        @click="dialogOpen = true"
      />
      <CoreDialog
        v-model="dialogOpen"
        title="Load this execution?"
        icon="mdi-open-in-app"
        closable
      >
        It opens in a new tab at the bottom of the screen.
        <template #actions>
          <CoreButton
            variant="outlined"
            size="small"
            text="Cancel"
            @click="dialogOpen = false"
          />
          <CoreButton size="small" text="Load" @click="dialogOpen = false" />
        </template>
      </CoreDialog>
    </CatalogBlock>

    <CatalogBlock
      name="CoreConfirmDialog"
      api="v-model · title · message · confirmText · cancelText · confirmColor · icon · loading · loadingMessage → confirm, cancel"
    >
      <CoreButton
        variant="outlined"
        color="danger"
        icon="mdi-delete-outline"
        text="Delete…"
        @click="confirmOpen = true"
      />
      <CoreConfirmDialog
        v-model="confirmOpen"
        title="Delete this execution?"
        message="«Plan week 42» will be removed from the history. This cannot be undone."
        confirm-text="Delete"
        cancel-text="Cancel"
        confirm-color="var(--danger)"
        icon="mdi-delete-outline"
        :loading="deleting"
        loading-message="Deleting, please wait…"
        @confirm="fakeDelete"
        @cancel="confirmOpen = false"
      />
    </CatalogBlock>

    <CatalogBlock
      name="CoreSnackbar"
      api="showSnackbar(message, 'success' | 'warning' | 'error' | 'info')"
    >
      <CoreButton
        variant="outlined"
        size="small"
        text="Success"
        @click="showSnackbar('Execution loaded')"
      />
      <CoreButton
        variant="outlined"
        size="small"
        text="Info"
        @click="showSnackbar('Opened in a new tab', 'info')"
      />
      <CoreButton
        variant="outlined"
        size="small"
        text="Warning"
        @click="showSnackbar('Some rows were skipped', 'warning')"
      />
      <CoreButton
        variant="outlined"
        size="small"
        text="Error"
        @click="showSnackbar('The execution could not be deleted', 'error')"
      />
      <CoreButton
        variant="outlined"
        size="small"
        text="Long message"
        @click="showSnackbar(longMessage, 'error')"
      />
      <CoreSnackbar />
    </CatalogBlock>

    <CatalogBlock
      name="CoreHoverCard"
      api="side · align · width · openDelay · disabled · #trigger · #default"
    >
      <CoreHoverCard :width="260">
        <template #trigger>
          <span class="hover-target">Rest the pointer here</span>
        </template>
        <p class="hover-text">A preview, for extra information only.</p>
      </CoreHoverCard>
    </CatalogBlock>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreDialog from '@cornflow-ui/core/components/core/CoreDialog.vue'
import CoreHoverCard from '@cornflow-ui/core/components/core/CoreHoverCard.vue'
import CoreSnackbar from '@cornflow-ui/core/components/core/CoreSnackbar.vue'
import CoreConfirmDialog from '@cornflow-ui/core/components/core/table/CoreConfirmDialog.vue'
import { showSnackbar } from '@cornflow-ui/core/services/SnackbarService'
import CatalogBlock from '../CatalogBlock.vue'

const dialogOpen = ref(false)
const confirmOpen = ref(false)
const deleting = ref(false)

function fakeDelete() {
  deleting.value = true
  setTimeout(() => {
    deleting.value = false
    confirmOpen.value = false
    showSnackbar('Execution deleted')
  }, 1200)
}

const longMessage =
  'The execution could not be saved because the database did not answer in time. ' +
  'Try again in a few minutes; if it keeps failing, download this message and send it to support. '.repeat(
    2,
  )
</script>

<style scoped>
.hover-target {
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  font-size: var(--text-md);
}

.hover-text {
  margin: 0;
  padding: calc(var(--spacing) * 3) calc(var(--spacing) * 4);
  font-size: var(--text-md);
}
</style>
