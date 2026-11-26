/**
 * Roles and permissions: with a user of each role (disposable mode; in shared mode, the one user
 * there is), what each one sees and can do, and the roles management of the admins.
 *
 * - What a role may open comes from the app's `rolesConfig` (`describe().rolesConfig`): each view
 *   it forbids is not in the menu and its address does not open it. Roles management is only for
 *   admins, and only where `enableRolesManagement` is on.
 * - What the backend does not let a role do (create an execution, for a viewer), the app does not
 *   offer, or says so when it is tried.
 * - Roles management: the roles of the backend with their users; giving a user a role and taking
 *   it away (only in disposable mode, to a user the test creates); and, where `allowEditRoles` is
 *   on, that adding, renaming and deleting a role are offered. No role is saved: Cornflow 1.3
 *   cannot delete one, so it would stay.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../../harness/fixtures'
import { CornflowApi, CornflowApiError } from '../../harness/cornflowApi'
import { asUser } from '../../harness/contextChecks'
import { freshSessionStorage } from '../../harness/session'
import {
  CREATE_EXECUTION,
  loadDataset,
  nameExecution,
  resolveButton,
} from '../../harness/createExecution'
import {
  adminSession,
  openRolesManagement,
  ROLES_MANAGEMENT,
} from '../../harness/admin'
import {
  currentView,
  goToRoute,
  leaveMenu,
  openFromMenu,
  unfoldMenu,
} from '../../harness/navigation'
import {
  cornflowApiFor,
  credentials,
  readSessionStorage,
  roleSessions,
  type Deployment,
  type RolePermissions,
  type RunInfo,
} from '../../harness/run'
import { readDataset } from '../../harness/uat'

/** Roles a run of the suite made and could not delete: not the deployment's (see the set-up). */
const SUITE_ROLE = /^e2e_/

/** Views a user can open by their address, to check that a role that forbids them cannot. */
const ROUTE_VIEWS = ['history-execution', 'project-execution', 'user-settings']

/** Whether `roles` may open `view`: no role of the user forbids it (the app's rule). */
function mayOpen(
  config: Record<string, RolePermissions>,
  roles: string[],
  view: string,
): boolean {
  return roles.every(
    (role) => !(config[role]?.forbidden_views ?? []).includes(view),
  )
}

/** The roles of the user signed in on `page`, as the app has them. */
async function rolesOf(page: Page): Promise<string[]> {
  await page.waitForFunction(() => !!sessionStorage.getItem('userRoles'))
  return page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('userRoles') ?? '[]'),
  )
}

/** The Cornflow API as one of the run's users, signed in again. */
async function apiAs(
  deployment: Deployment,
  baseURL: string | undefined,
  session: string,
) {
  const api = cornflowApiFor(deployment, baseURL)
  api.useToken((await freshSessionStorage(session, baseURL)).token)
  return api
}

/** An admin's API: the test's own when its user is one, or E2E_USER's. */
async function adminApi(api: CornflowApi): Promise<CornflowApi> {
  if (readSessionStorage('default').isAdmin === 'true') return api
  const { username, password } = credentials()
  return api.signedInAs(username, password)
}

test.describe('roles and permissions', () => {
  test('each role sees in the menu what its permissions let it open, and is kept out of the rest', async ({
    browser,
    deployment,
    run,
  }) => {
    const config = deployment.rolesConfig ?? {}
    const configuredDefault =
      deployment.core.parameters?.defaultView || 'history-execution'
    const rolesManagement = !!deployment.core.parameters?.enableRolesManagement

    for (const session of roleSessions(run)) {
      await test.step(`the user of ${session.name}`, async () => {
        await asUser(browser, deployment, session.name, async (page) => {
          const roles = await rolesOf(page)
          const admin = readSessionStorage(session.name).isAdmin === 'true'
          const forbidden = [
            ...new Set(
              roles.flatMap((role) => config[role]?.forbidden_views ?? []),
            ),
          ]

          // It lands where the app opens, or where its role lands when that is forbidden.
          const roleDefault = roles
            .map((role) => config[role]?.defaultView)
            .find(Boolean)
          const landing = mayOpen(config, roles, configuredDefault)
            ? configuredDefault
            : roleDefault && mayOpen(config, roles, roleDefault)
              ? roleDefault
              : null
          await expect
            .poll(() => currentView(page), {
              message: `${session.name} lands where it may`,
            })
            .not.toBe('')
          if (landing) expect(currentView(page)).toBe(landing)
          expect(
            forbidden,
            `${session.name} lands on a view it may open`,
          ).not.toContain(currentView(page))

          // The menu has no link to what the role forbids, nor "New execution" when that is it.
          await unfoldMenu(page)
          const drawer = page.getByTestId('app-drawer')
          for (const view of forbidden) {
            await expect(
              drawer.locator(`a[href*="/${view}"]`),
              `${session.name} has no link to ${view}`,
            ).toHaveCount(0)
          }
          await expect(
            page.getByTestId('app-drawer-new-execution'),
            `${session.name} ${mayOpen(config, roles, 'project-execution') ? 'can' : 'cannot'} start a new execution`,
          ).toHaveCount(mayOpen(config, roles, 'project-execution') ? 1 : 0)
          await expect(
            page.getByTestId('drawer-group-admin'),
            `${session.name} ${admin ? 'has' : 'has no'} administration`,
          ).toHaveCount(admin && rolesManagement ? 1 : 0)
          await leaveMenu(page)

          // Nor does the address of a forbidden view open it.
          for (const view of forbidden.filter((v) => ROUTE_VIEWS.includes(v))) {
            await goToRoute(page, `/${view}`)
            await expect
              .poll(() => currentView(page), {
                message: `${session.name} is kept out of ${view}`,
              })
              .toBe('not-found')
            await expect(
              page.getByTestId('not-found'),
              'it says the view is forbidden',
            ).toHaveAttribute('data-reason', 'forbidden')
          }
          if (!admin || !rolesManagement) {
            await goToRoute(page, ROLES_MANAGEMENT)
            await expect
              .poll(() => currentView(page), {
                message: `${session.name} is kept out of roles management`,
              })
              .not.toBe(ROLES_MANAGEMENT.slice(1))
          }
        })
      })
    }
  })

  test('what the backend does not let a role do, the app does not offer, or says so when tried', async ({
    browser,
    deployment,
    run,
    uat,
    baseURL,
  }) => {
    const schema = deployment.schemas[0]
    const data = readDataset(uat, schema, 'valid')
    test.skip(!data, `the UAT file has no valid dataset for ${schema}`)
    const config = deployment.rolesConfig ?? {}
    let refused = 0

    for (const session of roleSessions(run)) {
      // Whether the backend lets this role create data: its input data first.
      const roleApi = await apiAs(deployment, baseURL, session.name)
      const allowed = await roleApi
        .createInstance({ schema, data: data!, label: `probe ${session.name}` })
        .then(
          () => true,
          (error) => {
            if (error instanceof CornflowApiError && error.status === 403)
              return false
            throw error
          },
        )
      await roleApi.cleanup()
      if (allowed) continue
      refused++

      await test.step(`the user of ${session.name}, whom the backend does not let create`, async () => {
        await asUser(browser, deployment, session.name, async (page) => {
          const roles = await rolesOf(page)
          if (!mayOpen(config, roles, 'project-execution')) {
            // Not offered: the first test checks the menu and the address.
            test.info().annotations.push({
              type: 'note',
              description: `${session.name} is not offered the create-execution page`,
            })
            return
          }
          await openFromMenu(page, CREATE_EXECUTION)
          await loadDataset(page, uat, schema, 'valid')
          const name = roleApi.name(`refused ${session.name}`)
          await nameExecution(page, name)
          await resolveButton(page).click()
          await expect(
            page.getByTestId('launch-panel-error'),
            'the page says the execution could not be created',
          ).toBeVisible({ timeout: 60_000 })
          await expect(page.getByTestId('launch-result')).toHaveCount(0)
          expect(
            await roleApi.findExecution(name),
            'nothing is created',
          ).toBeNull()
        })
      })
    }
    if (!refused) {
      test.info().annotations.push({
        type: 'note',
        description: 'every role here may create executions',
      })
    }
  })

  test.describe('roles management', () => {
    test.beforeEach(({ deployment, run }) => {
      test.skip(
        !deployment.core.parameters?.enableRolesManagement,
        'enableRolesManagement is off: there is no roles management',
      )
      test.skip(!adminSession(run), 'no user of the run is an admin')
    })

    test('lists the roles of the backend with their users, and picking one lists them', async ({
      browser,
      deployment,
      run,
      api,
    }) => {
      const admin = await adminApi(api)
      const [roles, users, assignments] = await Promise.all([
        admin.roles(),
        admin.listUsers(),
        admin.userRoles(),
      ])
      const userIds = new Set(users.map((user) => user.id))
      await asUser(browser, deployment, adminSession(run)!, async (page) => {
        await openRolesManagement(page)

        for (const role of roles) {
          const row = page.getByTestId(`roles-role-${role.name}`)
          await expect(row, `it lists the role ${role.name}`).toBeVisible()
          const count = row.getByTestId('roles-role-count')
          if (await count.count()) {
            const users = assignments.filter(
              (a) => a.role_id === role.id && userIds.has(a.user_id),
            ).length
            await expect(count, `the users of ${role.name}`).toHaveText(
              String(users),
            )
          }
        }

        // Picking a role lists its users: each of the run's, under the roles it has and no other.
        const search = page.getByTestId('users-search').locator('input')
        for (const session of roleSessions(run)) {
          const user = users.find((u) => u.username === session.username)
          if (!user) continue
          const theirs = assignments
            .filter((a) => a.user_id === user.id)
            .map((a) => roles.find((r) => r.id === a.role_id)?.name)
          await search.fill(session.username)
          for (const role of roles) {
            await page
              .getByTestId(`roles-role-${role.name}`)
              .getByTestId('roles-role-select')
              .click()
            const listed = theirs.includes(role.name)
            await expect(
              page.getByTestId(`users-row-${session.username}`),
              `${session.username} is ${listed ? '' : 'not '}listed under ${role.name}`,
            ).toHaveCount(listed ? 1 : 0)
          }
        }
      })
    })

    test('gives a user another role and takes it away', async ({
      browser,
      deployment,
      run,
      api,
    }) => {
      test.skip(
        run.mode !== 'disposable',
        "users' roles are changed only in disposable mode",
      )
      const admin = await adminApi(api)
      const roles = (await admin.roles()).filter(
        (role) =>
          !['dummy', 'service'].includes(role.name) &&
          !SUITE_ROLE.test(role.name),
      )
      test.skip(roles.length < 2, 'there is no other role to give')
      const [first, second] = roles
      const user = await admin.createUser({ roleId: first.id, label: 'roles' })
      const rolesOfUser = async () =>
        (await admin.userRoles())
          .filter((a) => a.user_id === user.id)
          .map((a) => a.role_id)

      await asUser(browser, deployment, adminSession(run)!, async (page) => {
        await openRolesManagement(page)
        await page
          .getByTestId('users-search')
          .locator('input')
          .fill(user.username)
        const row = page.getByTestId(`users-row-${user.username}`)
        await expect(row).toBeVisible()

        const setRole = async (on: boolean) => {
          await row.getByTestId('users-row-edit').click()
          const box = page.getByTestId(`user-roles-role-${second.name}`)
          if ((await box.getAttribute('aria-checked')) !== String(on))
            await box.click()
          await expect(box).toHaveAttribute('aria-checked', String(on))
          const save = page.getByTestId('user-roles-save')
          await save.click()
          await expect(save).toBeHidden()
        }

        await setRole(true)
        await expect(row, 'the row shows the new role').toContainText(
          second.name,
        )
        await expect
          .poll(rolesOfUser, { message: `the backend gives it ${second.name}` })
          .toContain(second.id)

        await setRole(false)
        await expect
          .poll(rolesOfUser, {
            message: `the backend takes ${second.name} away`,
          })
          .not.toContain(second.id)
        expect(await rolesOfUser(), 'it keeps its other role').toContain(
          first.id,
        )
      })
    })

    test('offers adding, renaming and deleting a role where allowEditRoles is on', async ({
      browser,
      deployment,
      run,
      api,
    }) => {
      // Nothing is saved: Cornflow 1.3 cannot delete a role (501), so a role made here would
      // stay in the backend for good.
      const admin = await adminApi(api)
      const before = (await admin.roles()).map((role) => role.name).sort()
      await asUser(browser, deployment, adminSession(run)!, async (page) => {
        await openRolesManagement(page)
        const add = page.getByTestId('roles-add')

        if (!deployment.core.parameters?.allowEditRoles) {
          test.info().annotations.push({
            type: 'note',
            description: 'allowEditRoles is off: roles are only listed',
          })
          await expect(add).toHaveCount(0)
          await page
            .getByTestId(`roles-role-${before[0]}`)
            .getByTestId('roles-role-select')
            .click()
          await expect(page.getByTestId('roles-role-edit')).toHaveCount(0)
          await expect(page.getByTestId('roles-role-delete')).toHaveCount(0)
          return
        }

        // Adding asks for a name, and does not save without one.
        await add.click()
        const name = page.getByTestId('role-form-name')
        await expect(name).toHaveValue('')
        await expect(page.getByTestId('role-form-save')).toBeDisabled()
        await page.getByTestId('role-form-cancel').click()
        await expect(name).toBeHidden()

        // The selected role can be renamed, starting from its name, and deleted, after asking.
        const role = page.getByTestId(`roles-role-${before[0]}`)
        await role.getByTestId('roles-role-select').click()
        await role.getByTestId('roles-role-edit').click()
        await expect(name).toHaveValue(before[0])
        await page.getByTestId('role-form-cancel').click()
        await expect(name).toBeHidden()
        await role.getByTestId('roles-role-delete').click()
        await page.getByTestId('confirm-dialog-cancel').click()
        await expect(page.getByTestId('confirm-dialog-cancel')).toBeHidden()

        expect(
          (await admin.roles()).map((r) => r.name).sort(),
          'the roles are as they were',
        ).toEqual(before)
      })
    })
  })
})
