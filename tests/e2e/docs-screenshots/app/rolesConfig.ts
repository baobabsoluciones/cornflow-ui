/**
 * The roles config of the documentation screenshots: the core's own `src/app/rolesConfig.ts` with
 * the role permissions a shot sets (see `docsOverrides.ts`). The screenshots' Vite config points
 * `@/app/rolesConfig` here.
 */
import rolesConfig from '../../../../src/app/rolesConfig'
import { readDocsOverrides } from './docsOverrides'

Object.assign(rolesConfig, readDocsOverrides().roles ?? {})

export * from '../../../../src/app/rolesConfig'
export default rolesConfig
