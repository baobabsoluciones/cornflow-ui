/**
 * Users a test creates for itself (disposable mode), to change what no user others sign in with
 * may have changed: its two-factor authentication, its password, its personal API key. They have
 * the role `roleForTestUsers` gives, and are deleted when the test ends.
 */
import { test } from '@playwright/test'
import {
  type CornflowApi,
  CornflowApiError,
  type TestUser,
} from './cornflowApi'

/** A user for the test, as the server makes them: with two-factor authentication where it requires it. */
export async function newTestUser(
  api: CornflowApi,
  label: string,
): Promise<TestUser> {
  const role = await api.roleForTestUsers()
  return api.createUser({ roleId: role.id, label })
}

/**
 * A user for the test with two-factor authentication on; skips the test when the backend has
 * none (before Cornflow 1.4) or has it turned off.
 */
export async function userWithTwoFactor(
  api: CornflowApi,
  label: string,
): Promise<TestUser> {
  const role = await api.roleForTestUsers()
  return api
    .createUser({ roleId: role.id, label, mfa: true })
    .catch((error) => {
      if (
        error instanceof CornflowApiError &&
        [404, 501].includes(error.status)
      )
        test.skip(true, 'this backend has no two-factor authentication')
      throw error
    })
}
