<template>
  <div :style="($attrs.style as any)">
    <Suspense>
      <MAppDrawer
        :visible="true"
        :width="250"
        @update:rail="mini = !mini"
        style="position: fixed !important"
      >
        <template #logo>
          <div class="mt-2">
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
          <template
            v-for="generalItem in generalPages"
            :key="generalItem.title"
          >
            <v-list-item
              :base-color="'var(--title)'"
              :color="'var(--accent)'"
              :class="{ 'non-clickable': !generalItem.to }"
              :to="generalItem.to"
            >
              <div class="d-flex align-center">
                <v-icon v-if="generalItem.icon" left>{{
                  generalItem.icon
                }}</v-icon>
                <h4 class="ml-4" v-if="!mini">{{ generalItem.title }}</h4>
              </div>
            </v-list-item>
          </template>
          <v-divider class="mb-2 mt-2"></v-divider>
          <template v-for="item in executionPages" :key="item.title">
            <v-list-item
              :base-color="'var(--title)'"
              :color="'var(--accent)'"
              :class="{
                'non-clickable': !item.to,
                'page-selected': isSubPageActive(item.subPages),
              }"
              :to="item.to"
            >
              <div class="d-flex align-center">
                <v-icon v-if="item.icon" left>{{ item.icon }}</v-icon>
                <h4 class="ml-4" v-if="!mini">{{ item.title }}</h4>
              </div>
            </v-list-item>
            <template v-if="item.subPages && !mini">
              <v-list class="subpages">
                <v-list-item
                  :base-color="'var(--subtitle)'"
                  :color="'var(--accent)'"
                  v-for="subPage in item.subPages"
                  :key="subPage.title"
                  :to="subPage.to"
                  :title="subPage.title"
                  :prepend-icon="subPage.icon"
                >
                  <template #title>
                    <span style="font-size: 0.9rem">{{ subPage.title }}</span>
                  </template>
                </v-list-item>
              </v-list>
            </template>
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
import { mainLogo, fullLogo } from '@/utils/assets'

export default defineComponent({
  name: 'CoreAppDrawer',
  components: {},
  props: {},
  inheritAttrs: false,
  setup() {
    const { t } = useI18n()
    return { t }
  },
  data: () => ({
    model: 1,
    mini: true,
    hover: true,
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
  watch: {},
  computed: {
    user() {
      return {
        name: appConfig.getCore().parameters.showUserFullName
          ? this.store.getUser.fullName
          : this.store.getUser.username,
        email: this.store.getUser.email,
      }
    },
    generalPages() {
      return [
        {
          title: this.t('projectExecution.title'),
          icon: 'mdi-chart-timeline-variant',
          to: '/project-execution',
        },
        {
          title: this.t('versionHistory.title'),
          icon: 'mdi-history',
          to: '/history-execution',
          class: 'no-fill-button',
        },
      ]
    },
    executionPages() {
      return [
        {
          title: this.t('inputOutputData.title'),
          icon: 'mdi-application-cog',
          subPages: [
            {
              title: this.t('inputOutputData.inputTitle'),
              icon: 'mdi-table-arrow-left',
              to: '/input-data',
            },
            {
              title: this.t('inputOutputData.outputTitle'),
              icon: 'mdi-table-arrow-right',
              to: '/output-data',
            },
          ],
        },
        {
          title: 'Dashboard',
          icon: 'mdi-view-dashboard',
          to: appConfig.getCore().parameters.showDashboardMainView
            ? '/dashboard'
            : null,
          subPages:
            this.store.appDashboardPages.length > 0
              ? this.store.appDashboardPages
              : null,
        },
      ]
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
    isSubPageActive(subPages) {
      return subPages?.some((subPage) => this.$route.path === subPage.to)
    },
    navigateTo(path) {
      this.$router.push(path)
    },
  },
})
</script>

<style scoped>
.subpages {
  padding-left: 1em;
}

.user-container {
  display: flex;
  align-items: center;
  cursor: pointer;
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
  min-height: 40px;
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

.v-list-item {
  min-height: 40px;
  transition: all 0.3s ease;
}

.v-list-item__content {
  transition: all 0.3s ease;
}

.v-icon {
  flex-shrink: 0;
  transition: all 0.3s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
  line-height: 1.2;
  transition: opacity 0.3s ease;
}

.v-list-item {
  min-height: 40px;
  transition: all 0.3s ease;
}

.v-list-item__content {
  transition: all 0.3s ease;
}

.v-icon {
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.page-selected {
  color: var(--accent) !important;
  caret-color: var(--accent) !important;
}

.non-clickable {
  color: var(--primary-variant) !important;
}
</style>
