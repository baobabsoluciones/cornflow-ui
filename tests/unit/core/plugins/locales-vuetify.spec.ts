import { describe, test, expect } from 'vitest'
import { es as vuetifyEs, en as vuetifyEn, fr as vuetifyFr } from 'vuetify/locale'

import es from '@cornflow-ui/core/plugins/locales/es'
import en from '@cornflow-ui/core/plugins/locales/en'
import fr from '@cornflow-ui/core/plugins/locales/fr'

/** Every leaf key path of an object, e.g. "dataTable.ariaLabel.sortBy". */
const leafPaths = (obj: any, prefix = ''): string[] =>
  Object.entries(obj ?? {}).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? leafPaths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )

const LOCALES = [
  ['es', es, vuetifyEs],
  ['en', en, vuetifyEn],
  ['fr', fr, vuetifyFr],
] as const

describe('$vuetify messages', () => {
  // The vue-i18n adapter has no fallback into Vuetify's own bundled strings: a key the
  // messages do not define is rendered verbatim, so the user reads
  // "$vuetify.fileInput.counterSize" where a file size belongs. Using Vuetify's locale as
  // the base is what keeps that from happening — including for groups added by a future
  // Vuetify release.
  test.each(LOCALES)('%s covers every key Vuetify asks for', (_name, messages, bundled) => {
    const ours = new Set(leafPaths((messages as any).$vuetify))
    const missing = leafPaths(bundled).filter((path) => !ours.has(path))

    expect(missing).toEqual([])
  })

  test.each(LOCALES)('%s renders the file input counter, not its key', (_name, messages) => {
    expect((messages as any).$vuetify.fileInput.counterSize).not.toMatch(/^\$vuetify\./)
    expect((messages as any).$vuetify.fileInput.counterSize).toContain('{0}')
    expect((messages as any).$vuetify.fileInput.counterSize).toContain('{1}')
  })

  test('the hand-written overrides still win over the Vuetify defaults', () => {
    // The base is spread in, not merged over: a translation we chose deliberately must not
    // be reverted to Vuetify's wording.
    expect(es.$vuetify.dataFooter.itemsPerPageText).toBe('Elementos por página:')
    expect(es.$vuetify.dataTable.sortBy).toBe('Ordenar por')
    expect(es.$vuetify.noDataText).toBe('No hay datos disponibles')
    expect(en.$vuetify.dataFooter.itemsPerPageText).toBe('Items per page:')
    expect(fr.$vuetify.noDataText).toBe('Aucune donnée disponible')
  })
})
