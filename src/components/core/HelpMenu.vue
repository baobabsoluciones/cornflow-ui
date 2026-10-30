<!--
  HelpMenu: the "?" button at the top right of every view. Its menu opens the help centre (the
  files of `helpMenuFiles` in the app config, to download in the current language) and the
  licences of the libraries, and shows the versions of the app and of Cornflow.
-->
<template>
  <CorePopover v-model:open="menuOpen" align="end" :width="260">
    <template #trigger>
      <button
        type="button"
        class="help-menu__trigger"
        :aria-label="t('helpMenu.help')"
        :title="t('helpMenu.help')"
        data-testid="help-menu-trigger"
      >
        <CoreIcon name="mdi-help" :size="20" />
      </button>
    </template>
    <CoreMenu :items="menuItems" @select="pick" />
    <div class="help-menu__versions">
      <span>{{ appVersion }}</span>
      <span>{{ backendVersion }}</span>
    </div>
  </CorePopover>

  <CoreDialog
    v-model="helpOpen"
    :title="t('helpMenu.help')"
    icon="mdi-help-circle-outline"
    :width="460"
    data-testid="help-dialog"
  >
    <ul class="help-menu__files">
      <li v-for="file in downloadableFiles" :key="file.publicPath">
        <a
          class="help-menu__file"
          :href="resolveFilePath(file)"
          :download="file.downloadName || fileBaseName(file.publicPath)"
        >
          <CoreIcon name="mdi-download" :size="18" />
          {{ t(file.labelKey) }}
        </a>
      </li>
    </ul>
    <template #actions>
      <CoreButton :text="t('helpMenu.close')" @click="helpOpen = false" />
    </template>
  </CoreDialog>

  <CoreDialog
    v-model="licencesOpen"
    :title="t('helpMenu.licences')"
    icon="mdi-license"
    :width="560"
    data-testid="licences-dialog"
  >
    <ul class="help-menu__licences">
      <li v-for="licence in licences" :key="licence.library">
        <strong>{{ licence.library }} v.{{ licence.version }} ({{ licence.license }})</strong>:
        {{ licence.author }} · {{ licence.description }}
      </li>
    </ul>
    <template #actions>
      <CoreButton :text="t('helpMenu.close')" @click="licencesOpen = false" />
    </template>
  </CoreDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { version } from '@cornflow-ui/core/../package.json'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreDialog from '@cornflow-ui/core/components/core/CoreDialog.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreMenu, { type CoreMenuItem } from '@cornflow-ui/core/components/core/CoreMenu.vue'
import CorePopover from '@cornflow-ui/core/components/core/CorePopover.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import appConfig, { type HelpMenuDownloadableFile } from '@/app/config'

defineOptions({ name: 'HelpMenu' })

const { t, locale } = useI18n()
const store = useGeneralStore()

const menuOpen = ref(false)
const helpOpen = ref(false)
const licencesOpen = ref(false)

const menuItems = computed<CoreMenuItem[]>(() => [
  { key: 'help', label: t('helpMenu.help'), icon: 'mdi-help-circle-outline', testId: 'help-menu-help' },
  { key: 'licences', label: t('helpMenu.licences'), icon: 'mdi-license', testId: 'help-menu-licences' },
])

const downloadableFiles = computed(() => appConfig.getHelpMenuFiles())
const licences = computed(() => store.getLicences)
const appVersion = computed(() => `Cornflow app version: ${version}`)
const backendVersion = computed(() => `Cornflow version: ${store.cornflowVersion}`)

function pick(item: CoreMenuItem) {
  menuOpen.value = false
  if (item.key === 'help') helpOpen.value = true
  else licencesOpen.value = true
}

/** The file in the current language (`{lang}` in its path), under the app's base URL. */
function resolveFilePath(file: HelpMenuDownloadableFile) {
  return `${import.meta.env.BASE_URL}${file.publicPath.replace('{lang}', locale.value)}`
}

function fileBaseName(publicPath: string) {
  return publicPath.split('/').pop() || publicPath
}

defineExpose({ helpOpen, licencesOpen, resolveFilePath })
</script>

<style scoped>
.help-menu__trigger {
  position: fixed;
  top: calc(var(--app-top-offset, 0px) + var(--spacing) * 4);
  right: calc(var(--spacing) * 3);
  z-index: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}

.help-menu__trigger:hover,
.help-menu__trigger[data-state='open'] {
  background: var(--color-surface-hover);
  color: var(--color-primary);
}

.help-menu__trigger:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.help-menu__versions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: calc(var(--spacing) * 1);
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3) calc(var(--spacing) * 1);
  border-top: 1px solid var(--color-divider);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.help-menu__files,
.help-menu__licences {
  margin: 0;
  padding: 0;
  list-style: none;
}

.help-menu__files {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1);
}

.help-menu__file {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  text-decoration: none;
  transition: background-color var(--duration-fast) var(--ease-standard);
}

/* The app's stylesheet colours every link with `!important`: the colour goes on the children. */
.help-menu__file,
.help-menu__file > * {
  color: var(--color-text);
}

.help-menu__file > :first-child {
  color: var(--color-primary);
}

.help-menu__file:hover {
  background: var(--color-surface-hover);
}

.help-menu__licences {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2);
  max-height: 360px;
  overflow-y: auto;
  font-size: var(--text-md);
  line-height: var(--leading-normal);
  color: var(--color-text-muted);
}

.help-menu__licences strong {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}
</style>
