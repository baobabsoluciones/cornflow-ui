/**
 * The app config of the documentation screenshots: the core's own `src/app/config.ts` with the
 * settings each shot turns on (see `docsOverrides.ts`). The screenshots' Vite config points
 * `@/app/config` here.
 */
import appConfig from '../../../../src/app/config'
import { withDocsOverrides } from './docsOverrides'

export * from '../../../../src/app/config'
export default withDocsOverrides(appConfig)
