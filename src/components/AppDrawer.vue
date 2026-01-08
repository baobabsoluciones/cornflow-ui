<template>
  <div :style="$attrs.style as any">
    <Suspense>
      <MAppDrawer
        :visible="true"
        :width="250"
        :rail="mini"
        :expand-on-hover="hover"
        @update:rail="handleRailUpdate"
        style="position: fixed !important"
      >
        <template #logo>
          <div class="mt-2 logo-container">
            <div class="d-flex align-center justify-space-between">
              <div class="d-flex align-center">
                <v-img
                  position="left"
                  height="30"
                  class="ml-3"
                  v-if="mini"
                  :src="mainLogo"
                />
                <v-img
                  height="30"
                  position="left"
                  class="ml-3"
                  v-else
                  :src="fullLogo"
                />
              </div>

              <!-- Pin/Unpin button -->
              <v-btn
                v-if="!mini"
                icon
                size="small"
                variant="text"
                class="pin-button mr-2"
                @click="togglePin"
                :title="isPinned ? 'Unpin drawer' : 'Pin drawer'"
              >
                <v-icon
                  :icon="isPinned ? 'mdi-pin' : 'mdi-pin-outline'"
                  :color="isPinned ? 'var(--primary)' : 'var(--subtitle)'"
                  size="18"
                />
              </v-btn>
            </div>
            <!-- App name below the logo -->
            <div v-if="!mini" class="app-name ml-3 mt-1">
              {{ appName }}
            </div>
          </div>
        </template>
        <template #user>
          <div
            class="user-container"
            v-if="user && user.name"
            @click="navigateTo('user-settings')"
          >
            <div class="avatar" :style="{ backgroundColor: 'var(--primary)' }">
              {{ user.name[0].toUpperCase() }}
            </div>
            <div v-if="!mini" class="user-info">
              <div class="user-detail">{{ user.name }}</div>
              <div class="user-detail">{{ user.email }}</div>
            </div>
          </div>
        </template>
        <template #menu>
          <template v-for="section in allSections" :key="section.title">
            <v-list-item
              :base-color="'var(--title)'"
              :color="'var(--accent)'"
              :class="{
                'non-clickable': !section.to,
                'page-selected': isSectionActive(section),
                'mini-header': mini && !section.to,
              }"
              :to="section.to || undefined"
              :prepend-icon="mini && section.icon ? section.icon : undefined"
              :disabled="mini && !section.to"
            >
              <template v-if="!mini" #default>
                <div class="d-flex align-center">
                  <v-icon v-if="section.icon" left>{{ section.icon }}</v-icon>
                  <h4 class="ml-4">{{ section.title }}</h4>
                </div>
              </template>
            </v-list-item>
            <template v-if="section.subPages">
              <v-list class="subpages" :class="{ 'mini-subpages': mini }">
                <v-list-item
                  :base-color="'var(--subtitle)'"
                  :color="'var(--accent)'"
                  v-for="subPage in section.subPages"
                  :key="subPage.title"
                  :to="subPage.to"
                  :prepend-icon="mini ? subPage.icon : undefined"
                  :class="{
                    'page-selected': isSubPageItemActive(subPage),
                  }"
                >
                  <template v-if="!mini" #default>
                    <div class="d-flex align-center">
                      <v-icon v-if="subPage.icon">{{ subPage.icon }}</v-icon>
                      <span class="ml-4 subpage-title">{{
                        subPage.title
                      }}</span>
                    </div>
                  </template>
                </v-list-item>
              </v-list>
            </template>
            <v-divider
              class="mb-1 mt-1"
              v-if="section !== allSections[allSections.length - 1]"
            ></v-divider>
          </template>
        </template>
        <template #actions>
          <template v-for="action in actions" :key="action.title">
            <v-list-item
              :base-color="'var(--title)'"
              :color="'var(--accent)'"
              @click="action.action"
            >
              <div class="d-flex align-center">
                <v-icon v-if="action.icon" left>{{ action.icon }}</v-icon>
                <h4 class="ml-4" v-if="!mini">{{ action.title }}</h4>
              </div>
            </v-list-item>
          </template>
        </template>
      </MAppDrawer>
    </Suspense>
  </div>
  <MBaseModal
    v-model="confirmSignOutModal"
    :closeOnOutsideClick="false"
    :title="t('logOut.title')"
    :buttons="[
      {
        text: t('logOut.accept'),
        action: 'save',
        class: 'primary-btn',
      },
      {
        text: t('logOut.cancel'),
        action: 'cancel',
        class: 'secondary-btn',
      },
    ]"
    @save="signOut"
    @cancel="confirmSignOutModal = false"
    @close="confirmSignOutModal = false"
  >
    <template #content>
      <v-row class="d-flex justify-center pr-2 pl-2 pb-5 pt-3">
        <span> {{ t('logOut.message') }}</span>
      </v-row>
    </template>
  </MBaseModal>
</template>

<script lang="ts">
import { defineComponent, Suspense, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@/stores/general'
import getAuthService from '@/services/AuthServiceFactory'
import appConfig from '@/app/config'
import config from '@/config'
import { mainLogo, fullLogo } from '@/utils/assets'
import {
  getNavigationItemsFromConfig,
  filterValidationTablesWithData,
} from '@/services/FrontendAutomationService'
import { useSectionTitles } from '@/composables/useSectionTitles'

export default defineComponent({
  name: 'CoreAppDrawer',
  components: {},
  props: {},
  inheritAttrs: false,
  setup() {
    const { t } = useI18n()
    const { getSectionTitle } = useSectionTitles()
    return { t, getSectionTitle }
  },
  data: () => ({
    model: 1,
    mini: true,
    hover: true,
    isPinned: false, // New state to track if drawer is pinned
    store: useGeneralStore(),
    confirmSignOutModal: false,
    auth: null,
    showSnackbar: null,
    mainLogo,
    fullLogo,
  }),
  async created() {
    this.showSnackbar = inject('showSnackbar')
    this.auth = await getAuthService()
  },
  computed: {
    appName() {
      return config.name || 'Application'
    },
    user() {
      return {
        name: appConfig.getCore().parameters.showUserFullName
          ? this.store.getUser.fullName
          : this.store.getUser.username,
        email: this.store.getUser.email,
      }
    },
    hasSelectedExecution() {
      return this.store.selectedExecution !== null
    },
    // Main executions section (always visible)
    executionsSection() {
      return {
        title: this.getSectionTitle('executions'),
        icon: 'mdi-chart-timeline-variant',
        subPages: [
          {
            title: this.$t('versionHistory.title'),
            icon: 'mdi-history',
            to: '/history-execution',
          },
          {
            title: this.$t('projectExecution.title'),
            icon: 'mdi-play-circle-outline',
            to: '/project-execution',
          },
        ],
      }
    },
    // Master data section (visible when there is at least one table in the master configuration schema)
    masterDataSection() {
      const configurations = this.store.getConfigurations
      const masterDataConfig = configurations?.masterData || {}

      const navigationItems = getNavigationItemsFromConfig(
        masterDataConfig,
        '/configuration',
      )

      const hasData = Object.keys(masterDataConfig).length > 0

      return hasData
        ? {
            title: this.getSectionTitle('masterData'),
            icon: 'mdi-database',
            subPages: navigationItems,
          }
        : null
    },
    // Input data section (only visible when execution is selected)
    inputDataSection() {
      if (!this.hasSelectedExecution) return null

      const configurations = this.store.getConfigurations
      let inputDataConfig = configurations?.inputData || {}

      // Filter validation tables to only show those with data
      if (this.store.selectedExecution) {
        const instanceData =
          this.store.selectedExecution.experiment?.instance ||
          this.store.selectedExecution.instance
        inputDataConfig = filterValidationTablesWithData(
          inputDataConfig,
          instanceData,
        )
      }

      const navigationItems = getNavigationItemsFromConfig(
        inputDataConfig,
        '/input-data',
      )

      const hasData = Object.keys(inputDataConfig).length > 0
      const subPages = []

      // Add input data tables if available
      if (hasData) {
        subPages.push(...navigationItems)
      } else {
        // Fallback to old structure
        subPages.push({
          title: this.$t('inputOutputData.inputTitle'),
          icon: 'mdi-table-arrow-left',
          to: '/input-data',
        })
      }

      // Add instance dashboard pages if available
      if (this.store.appInstanceDashboardPages.length > 0) {
        this.store.appInstanceDashboardPages.forEach((page) => {
          subPages.push(page)
        })
      }


      return {
        title: this.getSectionTitle('inputData'),
        icon: 'mdi-application-cog',
        subPages: subPages,
      }
    },
    // Results section (only visible when execution is selected)
    resultsSection() {
      if (!this.hasSelectedExecution) return null

      const configurations = this.store.getConfigurations
      let resultsDataConfig = configurations?.resultsData || {}

      // Filter validation tables to only show those with data
      if (this.store.selectedExecution) {
        const solutionData =
          this.store.selectedExecution.experiment?.solution ||
          this.store.selectedExecution.solution
        resultsDataConfig = filterValidationTablesWithData(
          resultsDataConfig,
          solutionData,
        )
      }

      const navigationItems = getNavigationItemsFromConfig(
        resultsDataConfig,
        '/results',
      )

      const subPages = []

      // Add solution data tables if available
      if (Object.keys(resultsDataConfig).length > 0) {
        subPages.push(...navigationItems)
      } else {
        // Fallback to old structure
        subPages.push({
          title: this.$t('inputOutputData.outputTitle'),
          icon: 'mdi-table-arrow-right',
          to: '/output-data',
        })
      }

      // Add dashboard if configured
      if (appConfig.getCore().parameters.showDashboardMainView) {
        subPages.push({
          title: 'Dashboard',
          icon: 'mdi-view-dashboard',
          to: '/dashboard',
        })
      }

      // Add dashboard pages if available
      if (this.store.appDashboardPages.length > 0) {
        this.store.appDashboardPages.forEach((page) => {
          subPages.push(page)
        })
      }


      return {
        title: this.getSectionTitle('results'),
        icon: 'mdi-chart-box',
        subPages: subPages,
      }
    },
    // All sections combined
    allSections() {
      const sections = []

      // Always add executions section
      sections.push(this.executionsSection)

      // Add master data section if available
      if (this.masterDataSection) {
        sections.push(this.masterDataSection)
      }

      // Add input data section if execution is selected
      if (this.inputDataSection) {
        sections.push(this.inputDataSection)
      }

      // Add results section if execution is selected
      if (this.resultsSection) {
        sections.push(this.resultsSection)
      }

      return sections
    },
    actions() {
      return [
        {
          title: 'Logout',
          icon: 'mdi-logout',
          action: this.confirmSignOut,
        },
      ]
    },
  },
  methods: {
    confirmSignOut() {
      this.confirmSignOutModal = true
    },
    async signOut() {
      try {
        await this.auth.logout()
        this.$router.push('/sign-in')
        if (this.showSnackbar) {
          this.showSnackbar(
            this.$t('logOut.snackbar_message_success'),
            'success',
          )
        }
      } catch (error) {
        console.error('Logout error:', error)
        if (this.showSnackbar) {
          this.showSnackbar(this.$t('logOut.snackbar_message_error'), 'error')
        }
      }
    },
    isSectionActive(section) {
      const currentPath = this.$route.path

      // Only mark section as active if the route matches exactly its to property
      // Don't mark it active just because a subPage is active
      if (section.to) {
        return currentPath === section.to
      }

      // If section has no to property, don't mark it as active
      return false
    },
    isSubPageActive(subPages) {
      if (!subPages) return false
      const currentPath = this.$route.path

      // Check if current route matches or starts with any subPage route
      return subPages.some((subPage) => {
        return this.isSubPageItemActive(subPage)
      })
    },
    isSubPageItemActive(subPage) {
      if (!subPage) return false
      const currentPath = this.$route.path

      // Check if this subPage itself matches the current route
      if (subPage.to) {
        // Exact match
        if (currentPath === subPage.to) return true

        // Check if current path starts with subPage.to (for nested routes)
        if (currentPath.startsWith(subPage.to)) {
          const nextChar = currentPath[subPage.to.length]
          if (!nextChar || nextChar === '/') {
            return true
          }
        }
      }

      // Recursively check if any nested subPages are active
      if (subPage.subPages && subPage.subPages.length > 0) {
        return this.isSubPageActive(subPage.subPages)
      }

      return false
    },
    navigateTo(path) {
      // Ensure the path is absolute to avoid relative navigation issues
      const absolutePath = path.startsWith('/') ? path : `/${path}`
      this.$router.push(absolutePath)
    },
    togglePin() {
      this.isPinned = !this.isPinned
      // Update the store state
      this.store.setDrawerPinned(this.isPinned)

      if (this.isPinned) {
        // When pinned, expand drawer and disable hover
        this.mini = false
        this.hover = false
      } else {
        // When unpinned, minimize drawer and enable hover
        this.mini = true
        this.hover = true
      }
    },
    handleRailUpdate(newRailState) {
      // Only update mini state if not pinned
      if (!this.isPinned) {
        this.mini = newRailState
      }
    },
  },
})
</script>

<style scoped>
.subpages {
  padding-left: 1em;
}

.mini-subpages {
  padding-left: 0;
}

.v-list-item {
  min-height: 48px !important;
  height: 48px;
}

/* Reduce padding and height for main sections */
.v-list-item:not(.subpages .v-list-item) {
  min-height: 40px !important;
  height: 40px;
  padding-top: 4px !important;
  padding-bottom: 4px !important;
}

.subpages .v-list-item {
  min-height: 36px !important;
  height: 36px;
  padding-top: 4px;
  padding-bottom: 4px;
}

.mini-subpages .v-list-item {
  padding-left: 20px !important;
  padding-right: 12px;
  min-height: 36px !important;
  height: 36px;
  padding-top: 4px;
  padding-bottom: 4px;
  font-size: 0.85rem;
}

.mini-subpages .subpage-title {
  display: none !important;
}

.subpage-title {
  font-size: 0.85rem;
}

/* Smaller icons for subsections */
.subpages .v-icon {
  font-size: 20px !important;
  width: 20px;
  height: 20px;
}

.d-flex.align-center {
  min-height: 40px;
  align-items: center;
}

.subpages .d-flex.align-center {
  min-height: 36px;
  align-items: center;
}

.mini-subpages .d-flex.align-center {
  min-height: 36px;
  align-items: center;
}

.v-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-container {
  display: flex;
  align-items: center;
  cursor: pointer;
  height: 30px !important;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  margin-right: 10px;
  margin-left: 12px;
  flex-shrink: 0;
}

.user-info {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
}

.user-detail {
  font-size: 0.8em;
  color: var(--subtitle);
  margin-right: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.d-flex.align-center {
  width: 100%;
  min-height: 48px;
  transition: all 0.3s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

h4 {
  font-size: 0.9em !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
  line-height: 1.2;
  transition: opacity 0.3s ease;
}

.v-list-item__content {
  transition: all 0.3s ease;
}

.page-selected {
  color: rgb(var(--v-theme-primary)) !important;
}

.page-selected :deep(.v-list-item__prepend > .v-icon),
.page-selected :deep(.v-icon) {
  color: rgb(var(--v-theme-primary)) !important;
}

/* Background for selected items */
:deep(.page-selected.v-list-item) {
  background-color: rgba(var(--v-theme-primary), 0.08) !important;
}

/* Background for selected subpages */
.subpages :deep(.page-selected.v-list-item) {
  background-color: rgba(var(--v-theme-primary), 0.08) !important;
}

.non-clickable {
  color: var(--primary-variant) !important;
}

/* Override Vuetify's default opacity for icons in clickable items */
/* Ensure subpages in mini mode maintain full opacity */
.mini-subpages :deep(.v-list-item .v-list-item__prepend > .v-icon) {
  opacity: 1 !important;
}

.mini-subpages :deep(.v-list-item .v-list-item__append > .v-icon) {
  opacity: 1 !important;
}

/* Mini header styles for parent items (non-clickable) */
.mini-header {
  cursor: default !important;
  opacity: 0.6 !important;
}

.mini-header:hover {
  background-color: transparent !important;
}

.mini-header .v-list-item__prepend > .v-icon {
  opacity: 0.6 !important;
  cursor: default !important;
}

.mini-header .v-list-item__append > .v-icon {
  opacity: 0.6 !important;
  cursor: default !important;
}

/* Pin button styles */
.pin-button {
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.pin-button:hover {
  opacity: 1;
  background-color: rgba(var(--v-theme-on-surface), 0.04) !important;
}

/* Logo container styles */
.logo-container {
  display: flex;
  flex-direction: column;
  min-height: 105px;
}

/* App name styles */
.app-name {
  font-size: 0.85rem;
  color: var(--secondary);
  font-weight: 450;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
