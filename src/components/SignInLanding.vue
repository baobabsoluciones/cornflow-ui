<template>
  <div
    class="signin-landing"
    :style="{ '--login-background': `url(${loginBackground})` }"
  >
    <div class="left-panel">
      <div class="background-image" />
      <div class="overlay" />
      <div class="mask-grid">
        <div class="mask-grid-inner">
          <!-- SVG mask: black background, transparent rounded panels -->
          <svg
            class="panel-svg"
            :viewBox="`0 0 ${SVG_PADDED_SIZE} ${SVG_PADDED_SIZE}`"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
          >
            <defs>
              <mask id="panel-mask">
                <rect
                  :x="0"
                  :y="0"
                  :width="SVG_PADDED_SIZE"
                  :height="SVG_PADDED_SIZE"
                  fill="white"
                />
                <g>
                  <rect
                    v-for="panel in panelPositions"
                    :key="`panel-${panel.row}-${panel.col}`"
                    :x="PANEL_GAP + (panel.col - 1) * (PANEL_SIZE + PANEL_GAP)"
                    :y="PANEL_GAP + (panel.row - 1) * (PANEL_SIZE + PANEL_GAP)"
                    :width="PANEL_SIZE"
                    :height="PANEL_SIZE"
                    :rx="CARD_RADIUS"
                    :ry="CARD_RADIUS"
                    fill="#18181a"
                  />
                </g>
              </mask>
            </defs>
            <rect
              :x="0"
              :y="0"
              :width="SVG_PADDED_SIZE"
              :height="SVG_PADDED_SIZE"
              fill="var(--primary-light-variant)"
              mask="url(#panel-mask)"
            />
          </svg>
          <transition-group name="card-move" tag="div">
            <div
              v-for="card in animatedCards"
              :key="card.id"
              class="animated-card"
              :style="cardStyle(card)"
            >
              <div
                v-if="card.image"
                class="card-image"
                :class="{
                  'card-image-small': card.id === 1,
                  'card-image-half': card.id === 4,
                }"
              >
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
          <span class="app-logo-bold">{{ firstWord }}</span
          ><span v-if="secondWord" class="app-logo-normal">
            {{ secondWord }}</span
          >
        </div>
        <template v-if="loginStep === 'credentials'">
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
            <v-btn
              type="submit"
              color="var(--primary)"
              class="form-btn main-signin-btn"
              rounded="sm"
              block
            >
              {{ t('logIn.button_label') }}
            </v-btn>
          </v-form>

          <button
            type="button"
            class="forgot-link"
            data-test="forgot-link"
            @click="loginStep = 'forgot'"
          >
            {{ t('logIn.forgot_password_link') }}
          </button>

          <div class="divider-container">
            <div class="divider-line"></div>
            <span class="divider-text">{{ t('logIn.or_divider') }}</span>
            <div class="divider-line"></div>
          </div>

          <div class="social-buttons">
            <button
              class="social-btn google-btn"
              @click="initiateGoogleAuth"
              :title="t('logIn.google_button')"
            >
              <img :src="googleLogo" alt="Google" class="logo-image" />
              <span>{{ t('logIn.google_button') }}</span>
            </button>
            <button
              class="social-btn microsoft-btn"
              @click="initiateMicrosoftAuth"
              :title="t('logIn.microsoft_button')"
            >
              <img :src="microsoftLogo" alt="Microsoft" class="logo-image" />
              <span>{{ t('logIn.microsoft_button') }}</span>
            </button>
          </div>
        </template>

        <template v-else-if="loginStep === 'forgot'">
          <v-form @submit.prevent="submitForgot()" class="login-form mfa-form">
            <h3 class="mfa-title">{{ t('logIn.forgot_title') }}</h3>
            <p class="mfa-hint">{{ t('logIn.forgot_hint') }}</p>
            <MInputField
              v-model="forgotEmail"
              :title="t('logIn.forgot_email_label')"
              :placeholder="t('logIn.forgot_email_label')"
              type="text"
              :rules="[rules.required]"
              data-test="forgot-email-input"
            />
            <v-btn
              type="submit"
              color="var(--primary)"
              class="form-btn main-signin-btn"
              rounded="sm"
              block
            >
              {{ t('logIn.forgot_submit') }}
            </v-btn>
            <v-btn variant="text" size="small" block @click="backToCredentials">
              {{ t('logIn.back_button') }}
            </v-btn>
          </v-form>
        </template>

        <template v-else-if="loginStep === 'mfa-code'">
          <v-form @submit.prevent="submitLogIn()" class="login-form mfa-form">
            <h3 class="mfa-title">{{ t('logIn.mfa_code_title') }}</h3>
            <p class="mfa-hint">{{ t('logIn.mfa_code_hint') }}</p>
            <MInputField
              v-model="totpCode"
              :title="t('logIn.mfa_code_label')"
              :placeholder="t('logIn.mfa_code_label')"
              type="text"
              :rules="[rules.required]"
              data-test="mfa-code-input"
            />
            <v-btn
              type="submit"
              color="var(--primary)"
              class="form-btn main-signin-btn"
              rounded="sm"
              block
            >
              {{ t('logIn.mfa_verify_button') }}
            </v-btn>
            <v-btn variant="text" size="small" block @click="backToCredentials">
              {{ t('logIn.back_button') }}
            </v-btn>
          </v-form>
        </template>

        <template v-else-if="loginStep === 'mfa-enroll'">
          <v-form
            @submit.prevent="verifyEnrollment()"
            class="login-form mfa-form"
          >
            <h3 class="mfa-title">{{ t('logIn.mfa_enroll_title') }}</h3>
            <p class="mfa-hint">{{ t('logIn.mfa_enroll_hint') }}</p>
            <div class="mfa-qr-container" v-if="qrDataUrl">
              <img
                :src="qrDataUrl"
                alt="TOTP QR code"
                class="mfa-qr"
                data-test="mfa-qr"
              />
            </div>
            <p class="mfa-secret" v-if="enrollSecret">
              {{ t('logIn.mfa_enroll_secret') }}
              <code>{{ enrollSecret }}</code>
            </p>
            <MInputField
              v-model="enrollCode"
              :title="t('logIn.mfa_code_label')"
              :placeholder="t('logIn.mfa_code_label')"
              type="text"
              :rules="[rules.required]"
              data-test="mfa-enroll-code-input"
            />
            <v-btn
              type="submit"
              color="var(--primary)"
              class="form-btn main-signin-btn"
              rounded="sm"
              block
            >
              {{ t('logIn.mfa_verify_button') }}
            </v-btn>
            <v-btn variant="text" size="small" block @click="backToCredentials">
              {{ t('logIn.back_button') }}
            </v-btn>
          </v-form>
        </template>

        <template v-else-if="loginStep === 'mfa-backup'">
          <div class="login-form mfa-form">
            <h3 class="mfa-title">{{ t('logIn.mfa_backup_title') }}</h3>
            <p class="mfa-hint">{{ t('logIn.mfa_backup_hint') }}</p>
            <div class="mfa-backup-codes" data-test="mfa-backup-codes">
              <code v-for="code in backupCodes" :key="code">{{ code }}</code>
            </div>
            <v-btn
              variant="outlined"
              size="small"
              block
              class="mb-2"
              @click="copyBackupCodes"
            >
              {{ t('logIn.mfa_backup_copy') }}
            </v-btn>
            <v-btn
              color="var(--primary)"
              class="form-btn main-signin-btn"
              rounded="sm"
              block
              @click="finishLogin()"
            >
              {{ t('logIn.mfa_backup_continue') }}
            </v-btn>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import QRCode from 'qrcode'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import getAuthService, {
  getAllAuthServices,
  getSpecificAuthService,
} from '@cornflow-ui/core/services/AuthServiceFactory'
import { useRouter } from 'vue-router'
import config from '@cornflow-ui/core/config'
import type { AuthServices } from '@cornflow-ui/core/services/AuthServiceFactory'
import type { AnimatedCard } from '@cornflow-ui/core/interfaces/AnimatedCard'
import type { LoginResult } from '@cornflow-ui/core/interfaces/AuthProvider'
import type { CSSProperties } from 'vue'
import {
  baobabLogo,
  companyLogo,
  googleLogo,
  microsoftLogo,
  loginBackground,
} from '@cornflow-ui/core/utils/assets'

const { t } = useI18n()
const router = useRouter()
const store = useGeneralStore()
const showSnackbar =
  inject<(message: string, type: string) => void>('showSnackbar')

// Form logic
const username = ref('')
const password = ref('')
const rules = {
  required: (value: string) => !!value || t('rules.required'),
}

// Two-factor authentication / password recovery flow state
type LoginStep =
  | 'credentials'
  | 'forgot'
  | 'mfa-code'
  | 'mfa-enroll'
  | 'mfa-backup'
const loginStep = ref<LoginStep>('credentials')
const forgotEmail = ref('')
const totpCode = ref('')
const enrollCode = ref('')
const enrollSecret = ref('')
const qrDataUrl = ref('')
const backupCodes = ref<string[]>([])
let pendingChangePassword = false

// Auth services
let authServices: AuthServices | null = null
let defaultAuth: any = null

onMounted(async () => {
  try {
    // Initialize all auth services
    authServices = await getAllAuthServices()
    defaultAuth = await getAuthService()
  } catch (error) {
    console.error('Failed to initialize auth services:', error)
    showSnackbar?.(t('logIn.snackbar_message_error_server'), 'error')
  }
})

const backToCredentials = () => {
  loginStep.value = 'credentials'
  forgotEmail.value = ''
  totpCode.value = ''
  enrollCode.value = ''
  enrollSecret.value = ''
  qrDataUrl.value = ''
  backupCodes.value = []
  pendingChangePassword = false
}

const submitForgot = async () => {
  try {
    if (!forgotEmail.value) {
      showSnackbar?.(t('rules.required'), 'error')
      return
    }
    const cornflowAuth = await getSpecificAuthService('cornflow')
    const sent = await cornflowAuth?.requestPasswordReset?.(forgotEmail.value)
    if (sent) {
      // Neutral message: the backend answers the same whether the email
      // exists or not, so accounts can not be enumerated
      showSnackbar?.(t('logIn.forgot_sent'), 'success')
      backToCredentials()
    } else {
      showSnackbar?.(t('logIn.forgot_error'), 'error')
    }
  } catch (error) {
    console.error('Password recovery request error:', error)
    showSnackbar?.(t('logIn.snackbar_message_error_server'), 'error')
  }
}

const finishLogin = () => {
  if (pendingChangePassword) {
    showSnackbar?.(t('logIn.password_change_required'), 'warning')
    router.push({ path: '/user-settings', query: { changePassword: 'true' } })
  } else {
    router.push('/')
    showSnackbar?.(t('logIn.snackbar_message_success'), 'success')
  }
}

const startEnrollment = async () => {
  const cornflowAuth = await getSpecificAuthService('cornflow')
  const setupData = await cornflowAuth?.mfaSetup?.()
  if (!setupData) {
    showSnackbar?.(t('logIn.mfa_setup_error'), 'error')
    return
  }
  enrollSecret.value = setupData.secret
  try {
    qrDataUrl.value = await QRCode.toDataURL(setupData.provisioningUri, {
      width: 220,
      margin: 1,
    })
  } catch (error) {
    // The manual secret below the QR still allows the enrollment
    console.error('Could not render the QR code:', error)
    qrDataUrl.value = ''
  }
  loginStep.value = 'mfa-enroll'
}

const verifyEnrollment = async () => {
  try {
    if (!enrollCode.value) {
      showSnackbar?.(t('rules.required'), 'error')
      return
    }
    const cornflowAuth = await getSpecificAuthService('cornflow')
    const verifyData = await cornflowAuth?.mfaVerify?.(enrollCode.value)
    if (!verifyData) {
      showSnackbar?.(t('logIn.mfa_invalid_code'), 'error')
      return
    }
    backupCodes.value = verifyData.backupCodes
    loginStep.value = 'mfa-backup'
  } catch (error) {
    console.error('MFA verification error:', error)
    showSnackbar?.(t('logIn.snackbar_message_error_server'), 'error')
  }
}

const copyBackupCodes = async () => {
  try {
    await navigator.clipboard.writeText(backupCodes.value.join('\n'))
    showSnackbar?.(t('logIn.mfa_backup_copied'), 'success')
  } catch (error) {
    console.error('Could not copy the backup codes:', error)
  }
}

const submitLogIn = async () => {
  try {
    if (!defaultAuth) {
      showSnackbar?.(t('logIn.snackbar_message_error_server'), 'error')
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
      showSnackbar?.(t('logIn.snackbar_message_error_server'), 'error')
      return
    }

    const rawResult = await cornflowAuth.login(
      username.value,
      password.value,
      totpCode.value || undefined,
    )
    const result: LoginResult =
      typeof rawResult === 'boolean' ? { success: rawResult } : rawResult

    if (result.success) {
      pendingChangePassword = !!result.changePassword
      finishLogin()
      return
    }

    if (result.mfaRequired) {
      if (loginStep.value === 'mfa-code' && totpCode.value) {
        // The user already sent a code and it was not accepted
        showSnackbar?.(t('logIn.mfa_invalid_code'), 'error')
      }
      totpCode.value = ''
      loginStep.value = 'mfa-code'
      return
    }

    if (result.mfaSetupRequired) {
      await startEnrollment()
      return
    }

    if (loginStep.value === 'mfa-code') {
      // Invalid TOTP or backup code
      showSnackbar?.(t('logIn.mfa_invalid_code'), 'error')
      totpCode.value = ''
      return
    }

    showSnackbar?.(
      result.errorMessage || t('logIn.snackbar_message_error_auth'),
      'error',
    )
  } catch (error) {
    console.error('Login error:', error)
    showSnackbar?.(t('logIn.snackbar_message_error_server'), 'error')
  }
}

const initiateGoogleAuth = async () => {
  try {
    // Check if auth type is cornflow
    if (config.auth.type === 'cornflow') {
      showSnackbar?.(t('logIn.google_not_configured'), 'error')
      return
    }

    // Check if Google is actually configured for the current auth type
    if (!config.isGoogleConfigured()) {
      showSnackbar?.(t('logIn.google_not_configured'), 'error')
      return
    }

    // Get the appropriate auth service based on config type
    const authService =
      config.auth.type === 'cognito'
        ? await getSpecificAuthService('cognito')
        : await getSpecificAuthService('azure')

    if (!authService) {
      showSnackbar?.(t('logIn.google_not_available'), 'error')
      return
    }

    await authService.login()
  } catch (error) {
    console.error('Google auth login failed:', error)
    showSnackbar?.(t('logIn.snackbar_message_error_server'), 'error')
  }
}

const initiateMicrosoftAuth = async () => {
  try {
    // Check if auth type is cornflow
    if (config.auth.type === 'cornflow') {
      showSnackbar?.(t('logIn.microsoft_not_configured'), 'error')
      return
    }

    // Check if Microsoft is actually configured for the current auth type
    if (!config.isMicrosoftConfigured()) {
      showSnackbar?.(t('logIn.microsoft_not_configured'), 'error')
      return
    }

    // Get the appropriate auth service based on config type
    const authService =
      config.auth.type === 'cognito'
        ? await getSpecificAuthService('cognito')
        : await getSpecificAuthService('azure')

    if (!authService) {
      showSnackbar?.(t('logIn.microsoft_not_available'), 'error')
      return
    }

    await authService.login()
  } catch (error) {
    console.error('Microsoft auth login failed:', error)
    showSnackbar?.(t('logIn.snackbar_message_error_server'), 'error')
  }
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

// Initial card positions: first 4 panels in the first column
const cardDefs: AnimatedCard[] = [
  {
    id: 1,
    text: '',
    color: 'var(--secondary)',
    icon: '',
    image: baobabLogo,
    gridPosition: { row: 1, col: 1 },
  },
  {
    id: 2,
    text: 'DecisionOps',
    color: 'var(--primary)',
    icon: '',
    gridPosition: { row: 2, col: 1 },
  },
  {
    id: 3,
    text: 'baobab',
    color: 'var(--secondary)',
    icon: '',
    gridPosition: { row: 3, col: 1 },
  },
  {
    id: 4,
    text: '',
    color: 'var(--primary)',
    icon: '',
    image: companyLogo,
    gridPosition: { row: 4, col: 1 },
  },
]
const animatedCards = ref(cardDefs.map((card) => ({ ...card })))

// Define the movement steps for each card
const cardMovementSteps = [
  // Step 1
  [
    { col: 2, row: 2 },
    { col: 2, row: 3 },
    { col: 3, row: 3 },
    { col: 3, row: 4 },
  ],
  // Step 2
  [
    { col: 2, row: 3 },
    { col: 2, row: 4 },
    { col: 3, row: 2 },
    { col: 3, row: 3 },
  ],
  // Step 3
  [
    { col: 2, row: 4 },
    { col: 3, row: 4 },
    { col: 2, row: 2 },
    { col: 3, row: 2 },
  ],
  // Step 4
  [
    { col: 3, row: 4 },
    { col: 3, row: 3 },
    { col: 2, row: 3 },
    { col: 2, row: 2 },
  ],
]

let movementStep = 0
let movementInterval: NodeJS.Timeout | null = null

const moveCards = () => {
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

const cardStyle = (card: AnimatedCard): CSSProperties => {
  // Calculate percent-based sizes to match SVG grid, including padding
  const panelWidthPercent = (PANEL_SIZE / SVG_PADDED_SIZE) * 100
  const gapPercent = (PANEL_GAP / SVG_PADDED_SIZE) * 100
  const col = card.gridPosition.col - 1
  const row = card.gridPosition.row - 1

  // Calculate the border radius as a percentage of the panel width to match SVG exactly
  const borderRadiusPercent = (CARD_RADIUS / PANEL_SIZE) * 100

  // Offset by one gap for the padding
  return {
    background: card.color,
    borderRadius: `${borderRadiusPercent}%`,
    position: 'absolute',
    left: `calc(${gapPercent}% + ${col * (panelWidthPercent + gapPercent)}%)`,
    top: `calc(${gapPercent}% + ${row * (panelWidthPercent + gapPercent)}%)`,
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

<style
  scoped
  lang="scss"
  src="@cornflow-ui/core/assets/styles/components/log-in/SignInLanding.scss"
></style>

<style scoped lang="scss">
.forgot-link {
  background: none;
  border: none;
  padding: 4px 0;
  margin-top: 4px;
  font-size: 0.8rem;
  color: var(--primary);
  cursor: pointer;
  text-decoration: underline;
  align-self: center;
}

.mfa-form {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .mfa-title {
    text-align: center;
    font-size: 1.1rem;
  }

  .mfa-hint {
    font-size: 0.85rem;
    color: rgba(0, 0, 0, 0.6);
    text-align: center;
  }

  .mfa-qr-container {
    display: flex;
    justify-content: center;

    .mfa-qr {
      width: 220px;
      max-width: 100%;
    }
  }

  .mfa-secret {
    font-size: 0.8rem;
    text-align: center;
    word-break: break-all;

    code {
      user-select: all;
    }
  }

  .mfa-backup-codes {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    padding: 12px;
    border: 1px dashed rgba(0, 0, 0, 0.3);
    border-radius: 8px;

    code {
      text-align: center;
      font-size: 0.9rem;
      user-select: all;
    }
  }
}
</style>
