/**
 * Codes of two-factor authentication (TOTP, RFC 6238: HMAC-SHA1, 6 digits, 30-second steps), made
 * from a user's secret with what Node has, as an authenticator app makes them.
 *
 * Cornflow takes each code once (a code used again in its 30 seconds is turned down, and counts
 * towards locking the account), so a sign-in takes its code with `claimTotpCode`: one per step
 * and user, across every process of the run.
 */
import { createHmac } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const STEP_MS = 30_000
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Bytes(secret: string): Buffer {
  const clean = secret.replace(/[\s=-]/g, '').toUpperCase()
  let bits = ''
  for (const char of clean) {
    const value = BASE32.indexOf(char)
    if (value < 0)
      throw new Error(`[cornflow-e2e] Not a base32 secret: "${secret}"`)
    bits += value.toString(2).padStart(5, '0')
  }
  const bytes = bits.match(/.{8}/g) ?? []
  return Buffer.from(bytes.map((byte) => parseInt(byte, 2)))
}

/** The code of `secret` for the 30-second `step` (now's by default). */
export function totpCode(
  secret: string,
  step = Math.floor(Date.now() / STEP_MS),
): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hmac = createHmac('sha1', base32Bytes(secret)).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const value = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(value).padStart(6, '0')
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * A code of `secret` that no other sign-in of `account` in this run has taken: the one of the
 * current step, or else of the next one, waiting for it. Never one about to expire. Each step is
 * claimed by creating a file in the run's state folder, which only one process can do.
 */
export async function claimTotpCode(
  secret: string,
  account: string,
): Promise<string> {
  const folder = path.join(process.env.E2E_STATE_DIR ?? '.', 'totp')
  fs.mkdirSync(folder, { recursive: true })
  for (;;) {
    const now = Date.now()
    const step = Math.floor(now / STEP_MS)
    const left = (step + 1) * STEP_MS - now
    if (left < 3_000) {
      await sleep(left + 200)
      continue
    }
    try {
      fs.writeFileSync(path.join(folder, `${account}.${step}`), '', {
        flag: 'wx',
      })
      return totpCode(secret, step)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      await sleep(left + 200)
    }
  }
}
