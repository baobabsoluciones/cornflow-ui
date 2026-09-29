/**
 * Recursively merges `override` into `base` (plain objects only; arrays and primitives are
 * replaced). Returns a new object; neither input is mutated.
 */
export function deepMerge(
  base: Record<string, any>,
  override: Record<string, any>,
): Record<string, any> {
  const result = { ...base }
  for (const key of Object.keys(override)) {
    if (
      override[key] !== null &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      typeof base[key] === 'object' &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key], override[key])
    } else {
      result[key] = override[key]
    }
  }
  return result
}
