/**
 * The administration of the app, for admins: roles management, in the admin group of the side
 * menu where `enableRolesManagement` is on.
 */
import type { Page } from '@playwright/test'
import { leaveMenu, openMenuGroup } from './navigation'
import { readSessionStorage, type RunInfo } from './run'

export const ROLES_MANAGEMENT = '/roles-management'

/** Opens roles management from the admin group of the side menu. */
export async function openRolesManagement(page: Page): Promise<void> {
  const links = await openMenuGroup(page, 'admin', 'the administration group')
  await links.and(page.locator(`a[href$="${ROLES_MANAGEMENT}"]`)).click()
  await page.waitForURL((url) => url.href.endsWith(ROLES_MANAGEMENT))
  await leaveMenu(page)
}

/** A session of the run whose user is an admin, if there is one. */
export function adminSession(run: RunInfo): string | undefined {
  return run.sessions.find(
    (session) => readSessionStorage(session.name).isAdmin === 'true',
  )?.name
}
