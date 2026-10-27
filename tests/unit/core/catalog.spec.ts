// @vitest-environment node
/**
 * The component catalog (`dev/catalog/`) shows every component styled with the design tokens: one
 * of its blocks names it (`<CatalogBlock name="ExecutionList · ExecutionListItem">`).
 */
import { describe, expect, test } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return vueFiles(path)
    return entry.name.endsWith('.vue') ? [path] : []
  })
}

const USES_TOKENS = /var\(--(spacing|color-|text-|radius-|font-)/

function usesTokens(file: string): boolean {
  const style = readFileSync(file, 'utf-8').split('<style')[1] ?? ''
  return USES_TOKENS.test(style)
}

const blockNames = new Set(
  vueFiles(join(root, 'dev/catalog')).flatMap((file) =>
    [...readFileSync(file, 'utf-8').matchAll(/<CatalogBlock\b[^>]*?\sname="([^"]+)"/g)].flatMap(
      ([, name]) => name.split('·').map((part) => part.trim()),
    ),
  ),
)

const components = vueFiles(join(root, 'src/components'))
  .filter(usesTokens)
  .map((file) => basename(file, '.vue'))
  .sort()

describe('component catalog', () => {
  test('finds the components styled with the design tokens', () => {
    expect(components).toEqual(expect.arrayContaining(['CoreButton', 'CoreTextField']))
  })

  test.each(components)('%s has a block in the catalog', (component) => {
    expect(blockNames).toContain(component)
  })
})
