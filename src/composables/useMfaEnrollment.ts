/**
 * useMfaEnrollment — adding two-factor authentication to the account, on the sign-in (when the
 * server requires it) and in the user settings.
 *
 * `start()` asks Cornflow for a new secret and draws the QR code an authenticator app reads;
 * `verify(code)` activates it with the app's first code and keeps the one-time backup codes, which
 * are shown this once.
 *
 *   const { secret, qr, backupCodes, start, verify, clear } = useMfaEnrollment()
 */
import { ref } from 'vue'
import { getSpecificAuthService } from '@cornflow-ui/core/services/AuthServiceFactory'

/**
 * How `start()` ended: the enrollment started, the deployment does not offer two-factor
 * authentication, or Cornflow could not start it.
 */
export type MfaEnrollmentStart = 'started' | 'unavailable' | 'failed'

export function useMfaEnrollment() {
  const secret = ref('')
  /** The QR code as a data URL; empty when it could not be drawn (the secret can be typed in). */
  const qr = ref('')
  const backupCodes = ref<string[]>([])

  async function start(): Promise<MfaEnrollmentStart> {
    const auth = await getSpecificAuthService('cornflow')
    const setup = await auth?.mfaSetup?.()
    if (!setup?.success) return setup?.unavailable ? 'unavailable' : 'failed'
    secret.value = setup.secret ?? ''
    try {
      const { toDataURL } = await import('qrcode')
      qr.value = await toDataURL(setup.provisioningUri ?? '', { width: 200, margin: 1 })
    } catch (error) {
      console.error('Could not draw the QR code:', error)
      qr.value = ''
    }
    return 'started'
  }

  /** Resolves to whether the code activated two-factor authentication. */
  async function verify(code: string): Promise<boolean> {
    const auth = await getSpecificAuthService('cornflow')
    const verified = await auth?.mfaVerify?.(code)
    if (!verified) return false
    backupCodes.value = verified.backupCodes
    return true
  }

  function clear() {
    secret.value = ''
    qr.value = ''
    backupCodes.value = []
  }

  return { secret, qr, backupCodes, start, verify, clear }
}
