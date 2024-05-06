<template>
  <MAppDrawer :visible="true" :width="250" @update:rail="mini = !mini">
    <template #logo>
      <div class="mt-2">
        <v-img
          position="left"
          height="30"
          class="ml-3"
          v-if="mini"
          src="@/app/assets/logo/logo.png"
        />
        <v-img
          height="30"
          position="left"
          class="ml-3"
          v-else
          src="@/app/assets/logo/full_logo.png"
        />
      </div>
    </template>
    <template #user>
      <div class="user-container" v-if="user && user.name">
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
      <template v-for="generalItem in generalPages" :key="generalItem.title">
        <v-list-item
          :base-color="'var(--title)'"
          :color="'var(--accent)'"
          :class="{ 'non-clickable': !generalItem.to }"
          :to="generalItem.to"
        >
          <div class="d-flex align-center">
            <v-icon v-if="generalItem.icon" left>{{ generalItem.icon }}</v-icon>
            <h4 class="ml-4" v-if="!mini">{{ generalItem.title }}</h4>
          </div>
        </v-list-item>
      </template>
      <v-divider class="mb-2 mt-2"></v-divider>
      <template v-for="item in executionPages" :key="item.title">
        <v-list-item
          :base-color="'var(--title)'"
          :color="'var(--accent)'"
          :class="{ 'non-clickable': !item.to }"
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
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useGeneralStore } from '@/stores/general'
import AuthService from '@/services/AuthService'

export default defineComponent({
  name: 'CoreAppDrawer',
  components: {},
  props: {},
  data: () => ({
    model: 1,
    mini: true,
    hover: true,
    store: useGeneralStore(),
  }),
  watch: {},
  computed: {
    user() {
      return {
        name: this.store.getUser.username,
        email: this.store.getUser.email,
      }
    },
    generalPages() {
      return [
        {
          title: 'Project execution',
          icon: 'mdi-chart-timeline-variant',
          to: '/project-execution',
        },
        {
          title: 'Executions history',
          icon: 'mdi-history',
          to: '/history-execution',
          class: 'no-fill-button',
        },
      ]
    },
    executionPages() {
      return [
        {
          title: 'Dashboard',
          icon: 'mdi-view-dashboard',
          to: '/dashboard',
        },
        {
          title: 'Project Management',
          icon: 'mdi-application-cog',
          subPages: [
            {
              title: 'Input Data',
              icon: 'mdi-table-arrow-left',
              to: '/input-data',
            },
            {
              title: 'Output Data',
              icon: 'mdi-table-arrow-right',
              to: '/output-data',
            },
          ],
        },
      ]
    },
    actions() {
      return [
        {
          title: 'Logout',
          icon: 'mdi-logout',
          action: this.signOut,
        },
      ]
    },
  },
  methods: {
    signOut() {
      AuthService.logout()
      this.$router.push('/sign-in')
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
  flex-shrink: 0; /* Prevents the avatar from shrinking */
}

.user-info {
  display: flex;
  flex-direction: column;
  flex-grow: 1; /* Allows the user info to take up the remaining space */
  overflow: hidden; /* Hides the overflow */
}

.user-detail {
  font-size: 0.8em;
  color: var(--subtitle);
  margin-right: 5px;
  white-space: nowrap; /* Prevents the text from wrapping to the next line */
  overflow: hidden; /* Hides the overflow */
  text-overflow: ellipsis; /* Adds '...' when the text overflows */
}

h4 {
  font-size: 0.9em !important;
}
</style>
