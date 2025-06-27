<template>
  <div class="signin-landing">
    <div class="left-panel">
      <div class="background-image" />
      <div class="overlay" />
      <div class="mask-grid">
        <div class="mask-grid-inner">
          <!-- SVG mask: black background, transparent rounded panels -->
          <svg class="panel-svg" :viewBox="`0 0 ${SVG_PADDED_SIZE} ${SVG_PADDED_SIZE}`" width="100%" height="100%" preserveAspectRatio="none">
            <defs>
              <mask id="panel-mask">
                <rect :x="0" :y="0" :width="SVG_PADDED_SIZE" :height="SVG_PADDED_SIZE" fill="white" />
                <g>
                  <rect v-for="panel in panelPositions"
                    :key="`panel-${panel.row}-${panel.col}`"
                    :x="PANEL_GAP + (panel.col-1)*(PANEL_SIZE+PANEL_GAP)"
                    :y="PANEL_GAP + (panel.row-1)*(PANEL_SIZE+PANEL_GAP)"
                    :width="PANEL_SIZE"
                    :height="PANEL_SIZE"
                    :rx="CARD_RADIUS" :ry="CARD_RADIUS"
                    fill="#18181a"
                  />
                </g>
              </mask>
            </defs>
            <rect :x="0" :y="0" :width="SVG_PADDED_SIZE" :height="SVG_PADDED_SIZE" fill="var(--primary-light-variant)" mask="url(#panel-mask)" />
            <!-- Removed panel borders that might be causing the line -->
            <!--
            <g>
              <rect v-for="panel in panelPositions"
                :key="`panel-border-${panel.row}-${panel.col}`"
                :x="PANEL_GAP + (panel.col-1)*(PANEL_SIZE+PANEL_GAP)"
                :y="PANEL_GAP + (panel.row-1)*(PANEL_SIZE+PANEL_GAP)"
                :width="PANEL_SIZE"
                :height="PANEL_SIZE"
                :rx="CARD_RADIUS" :ry="CARD_RADIUS"
                fill="none"
                stroke="var(--primary-light-variant)"
                stroke-width="3"
              />
            </g>
            -->
          </svg>
          <transition-group name="card-move" tag="div">
            <div
              v-for="card in animatedCards"
              :key="card.id"
              class="animated-card"
              :style="cardStyle(card)"
            >
              <div v-if="card.image" class="card-image" :class="{ 'card-image-small': card.id === 1, 'card-image-half': card.id === 4 }">
                <img :src="card.image" :alt="card.text" />
              </div>
              <div v-if="card.icon" class="card-icon">
                <v-icon :icon="card.icon" size="20" />
              </div>
              <div v-if="card.text" class="card-text">{{ t(card.text) }}</div>
            </div>
          </transition-group>
        </div>
      </div>
    </div>
    <div class="right-panel">
      <div class="form-container minimal-form">
        <div class="app-logo">
          <span class="app-logo-bold">{{ firstWord }}</span><span v-if="secondWord" class="app-logo-normal"> {{ secondWord }}</span>
        </div>
        <v-form @submit.prevent="submitLogIn()" class="login-form">
          <MInputField
            v-model="username"
            :title="t('logIn.username_textfield_label')"
            :placeholder="t('logIn.username_textfield_label')"
            type="text"
            :rules="[rules.required]"
          />
          <MInputField
            v-model="password"
            :title="t('logIn.password_textfield_label')"
            :placeholder="t('logIn.password_textfield_label')"
            type="password"
            :rules="[rules.required]"
          />
          <v-btn type="submit" color="var(--primary)" class="form-btn main-signin-btn" rounded="sm" block>
            {{ t('logIn.button_label') }}
          </v-btn>
        </v-form>
        
        <div class="divider-container">
          <div class="divider-line"></div>
          <span class="divider-text">{{ t('logIn.or_divider') }}</span>
          <div class="divider-line"></div>
        </div>
        
        <div class="social-buttons">
          <button
            v-if="isGoogleAvailable"
            class="social-btn google-btn"
            @click="initiateGoogleAuth"
            :title="t('logIn.google_button')"
          >
            <img src="@/app/assets/logo/google_logo.png" alt="Google" class="logo-image" />
            <span>{{ t('logIn.google_button') }}</span>
          </button>
          <button
            v-if="isMicrosoftAvailable"
            class="social-btn microsoft-btn"
            @click="initiateMicrosoftAuth"
            :title="t('logIn.microsoft_button')"
          >
            <img src="@/app/assets/logo/microsoft_logo.png" alt="Microsoft" class="logo-image" />
            <span>{{ t('logIn.microsoft_button') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@/stores/general'
import getAuthService, { getAllAuthServices, getSpecificAuthService, isAuthServiceAvailable } from '@/services/AuthServiceFactory'
import type { AuthServices } from '@/services/AuthServiceFactory'
import { useRouter } from 'vue-router'
import type { CSSProperties } from 'vue'
import config from '@/config'

const { t } = useI18n()
const router = useRouter()
const store = useGeneralStore()
const showSnackbar = inject<(message: string, type: string) => void>('showSnackbar')

// Form logic
const username = ref('')
const password = ref('')
const rules = {
  required: (value: string) => !!value || t('rules.required'),
}

// Auth services
let authServices: AuthServices | null = null
let defaultAuth: any = null

// Button availability
const isGoogleAvailable = ref(false)
const isMicrosoftAvailable = ref(false)

onMounted(async () => {
  try {
    // Initialize all auth services
    authServices = await getAllAuthServices()
    defaultAuth = await getAuthService()
    
    // Check which services are available based on config parameters
    isGoogleAvailable.value = store.appConfig.parameters.hasGoogleAuth
    isMicrosoftAvailable.value = store.appConfig.parameters.hasMicrosoftAuth
  } catch (error) {
    console.error('Failed to initialize auth services:', error)
    showSnackbar?.(t('logIn.snackbar_message_error'), 'error')
  }
})

const submitLogIn = async () => {
  try {
    if (!defaultAuth) {
      showSnackbar?.(t('logIn.snackbar_message_error'), 'error')
      return
    }
    
    // Check if username and password are filled for cornflow auth
    if (!username.value || !password.value) {
      showSnackbar?.(t('rules.required'), 'error')
      return
    }
    
    // Always use cornflow auth for username/password login
    const cornflowAuth = await getSpecificAuthService('cornflow')
    if (!cornflowAuth) {
      showSnackbar?.(t('logIn.snackbar_message_error'), 'error')
      return
    }
    
    const isAuthenticated = await cornflowAuth.login(username.value, password.value)
    if (isAuthenticated) {
      router.push('/')
      showSnackbar?.(t('logIn.snackbar_message_success'), 'success')
    } else {
      showSnackbar?.(t('logIn.snackbar_message_error'), 'error')
    }
  } catch (error) {
    console.error('Login error:', error)
    showSnackbar?.(t('logIn.snackbar_message_error'), 'error')
  }
}

const initiateGoogleAuth = async () => {
  try {
    if (!isGoogleAvailable.value) {
      showSnackbar?.(t('logIn.google_not_configured'), 'error')
      return
    }
    
    // Get the appropriate auth service based on config type
    const authService = config.auth.type === 'cognito' 
      ? await getSpecificAuthService('cognito')
      : await getSpecificAuthService('azure')
      
    if (!authService) {
      showSnackbar?.(t('logIn.google_not_available'), 'error')
      return
    }
    
    await authService.login()
  } catch (error) {
    console.error('Google auth login failed:', error)
    showSnackbar?.(t('logIn.snackbar_message_error'), 'error')
  }
}

const initiateMicrosoftAuth = async () => {
  try {
    if (!isMicrosoftAvailable.value) {
      showSnackbar?.(t('logIn.microsoft_not_configured'), 'error')
      return
    }
    
    // Get the appropriate auth service based on config type
    const authService = config.auth.type === 'cognito' 
      ? await getSpecificAuthService('cognito')
      : await getSpecificAuthService('azure')
      
    if (!authService) {
      showSnackbar?.(t('logIn.microsoft_not_available'), 'error')
      return
    }
    
    await authService.login()
  } catch (error) {
    console.error('Microsoft auth login failed:', error)
    showSnackbar?.(t('logIn.snackbar_message_error'), 'error')
  }
}

// Animated cards logic
interface AnimatedCard {
  id: number
  text: string
  color: string
  icon?: string
  image?: string
  gridPosition: { row: number; col: number }
}

// Panel positions for SVG grid (4x4, small gap)
const GRID_COLS = 4
const GRID_ROWS = 4
const PANEL_GAP = 4 // SVG units (small gap)
const SVG_SIZE = 480
const TOTAL_GAP = PANEL_GAP * (GRID_COLS - 1)
const PANEL_SIZE = (SVG_SIZE - TOTAL_GAP) / GRID_COLS // 119px
const CARD_SIZE = PANEL_SIZE // cards fit panel exactly
const CARD_RADIUS = 16 // SVG units
const SVG_PADDED_SIZE = SVG_SIZE + 2 * PANEL_GAP

const panelPositions = Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => {
  const row = Math.floor(i / GRID_COLS) + 1
  const col = (i % GRID_COLS) + 1
  return { row, col }
})

const baobabLogo = new URL('@/app/assets/logo/baobab_full_logo.png', import.meta.url).href
const companyLogo = new URL('@/app/assets/logo/company_logo.png', import.meta.url).href

// Initial card positions: first 4 panels in the first column
const cardDefs: AnimatedCard[] = [
  { id: 1, text: '', color: 'var(--secondary)', icon: '', image: baobabLogo, gridPosition: { row: 1, col: 1 } },
  { id: 2, text: 'DecisionOps', color: 'var(--primary)', icon: '', gridPosition: { row: 2, col: 1 } },
  { id: 3, text: 'baobab', color: 'var(--secondary)', icon: '', gridPosition: { row: 3, col: 1 } },
  { id: 4, text: '', color: 'var(--primary)', icon: '', image: companyLogo, gridPosition: { row: 4, col: 1 } },
]
const animatedCards = ref(cardDefs.map(card => ({ ...card })))

// Define the movement steps for each card
const cardMovementSteps = [
  // Step 1
  [ { col: 2, row: 2 }, { col: 2, row: 3 }, { col: 3, row: 3 }, { col: 3, row: 4 } ],
  // Step 2
  [ { col: 2, row: 3 }, { col: 2, row: 4 }, { col: 3, row: 2 }, { col: 3, row: 3 } ],
  // Step 3
  [ { col: 2, row: 4 }, { col: 3, row: 4 }, { col: 2, row: 2 }, { col: 3, row: 2 } ],
  // Step 4
  [ { col: 3, row: 4 }, { col: 3, row: 3 }, { col: 2, row: 3 }, { col: 2, row: 2 } ],
]

let movementStep = 0
let movementInterval: NodeJS.Timeout | null = null

function moveCards() {
  movementStep = (movementStep + 1) % cardMovementSteps.length
  animatedCards.value = animatedCards.value.map((card, idx) => {
    const pos = cardMovementSteps[movementStep][idx]
    return { ...card, gridPosition: { ...pos } }
  })
  
  // Stop at the last step
  if (movementStep === cardMovementSteps.length - 1 && movementInterval) {
    clearInterval(movementInterval)
    movementInterval = null
  }
}

// Set initial positions
animatedCards.value = animatedCards.value.map((card, idx) => {
  const pos = cardMovementSteps[0][idx]
  return { ...card, gridPosition: { ...pos } }
})

movementInterval = setInterval(moveCards, 2000)

function cardStyle(card: AnimatedCard): CSSProperties {
  // Calculate percent-based sizes to match SVG grid, including padding
  const panelWidthPercent = (PANEL_SIZE / SVG_PADDED_SIZE) * 100;
  const gapPercent = (PANEL_GAP / SVG_PADDED_SIZE) * 100;
  const col = card.gridPosition.col - 1;
  const row = card.gridPosition.row - 1;
  // Offset by one gap for the padding
  return {
    background: card.color,
    borderRadius: CARD_RADIUS + 'px',
    position: 'absolute',
    left: `calc(${gapPercent}% + ${(col * (panelWidthPercent + gapPercent))}%)`,
    top: `calc(${gapPercent}% + ${(row * (panelWidthPercent + gapPercent))}%)`,
    width: `${panelWidthPercent}%`,
    height: `${panelWidthPercent}%`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
  }
}

const appName = config.name || ''
let firstWord = appName
let secondWord = ''

if (appName.includes(' ')) {
  // Split by the first space
  const idx = appName.indexOf(' ')
  firstWord = appName.slice(0, idx)
  secondWord = appName.slice(idx + 1)
} else {
  // Split PascalCase or camelCase
  const match = appName.match(/^([A-Z][a-z0-9]+)([A-Z].*)$/)
  if (match) {
    firstWord = match[1]
    secondWord = match[2]
  }
}
</script>

<style scoped lang="scss" src="@/assets/styles/components/log-in/SignInLanding.scss"></style>