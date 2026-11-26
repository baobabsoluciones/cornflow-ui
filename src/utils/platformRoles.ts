/**
 * Cornflow's platform roles (`platform_viewer`, `platform_planner`, `platform_admin`): the staff
 * that runs the deployment, apart from the client's own users. Only a platform administrator grants
 * them, and an administrator with two-factor authentication confirms it with a fresh code.
 */

export const isPlatformRole = (name: string) => name.startsWith('platform_')

/** A platform role was granted without a valid two-factor code of the administrator. */
export const TOTP_REQUIRED = 'totp_required'

/** The roles of the deployment can only be managed by a platform administrator. */
export const PLATFORM_ADMIN_REQUIRED = 'platform_admin_required'
