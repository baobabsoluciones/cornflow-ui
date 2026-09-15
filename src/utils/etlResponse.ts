/**
 * Helpers for handling the response envelope returned by the ETL backend
 * (both `POST /etl/` and `POST /etl/update/`).
 *
 * The backend may wrap the instance payload in a `{ data, warning }` envelope:
 * - `data`: the instance data object (tables + parameters).
 * - `warning`: an optional non-blocking message (string or per-locale dictionary).
 *
 * Older backends return the instance data directly (no envelope). The helpers
 * here normalise both shapes into `{ data, warning }`.
 */

export interface EtlUnwrapResult {
    data: Record<string, any>
    warning: string | null
  }
  
  /**
   * Unwrap the `{ data, warning }` envelope returned by the ETL backend.
   *
   * Falls back to treating the whole response as instance data when no `data`
   * key is present (back-compat with the previous contract).
   *
   * `warning` may be a string or a per-locale dictionary like `{ en: '...', es: '...' }`.
   */
  export function unwrapEtlResponse(
    response: any,
    locale: string,
  ): EtlUnwrapResult {
    if (
      response &&
      typeof response === 'object' &&
      !Array.isArray(response) &&
      'data' in response &&
      response.data &&
      typeof response.data === 'object'
    ) {
      return {
        data: response.data,
        warning: resolveWarning(response.warning, locale),
      }
    }
    return { data: response, warning: null }
  }
  
  /**
   * Resolves an ETL warning value to a single string in the current locale.
   * Accepts plain strings or per-locale dictionaries (`{ en, es, fr, ... }`).
   * Returns `null` when the value is empty, whitespace-only, or missing.
   */
  export function resolveWarning(
    warning: unknown,
    locale: string,
  ): string | null {
    if (warning == null) return null
    if (typeof warning === 'string') return warning.trim() ? warning : null
    if (typeof warning === 'object') {
      const dict = warning as Record<string, unknown>
      const lang = locale.toLowerCase().split('-')[0]
      const candidate =
        dict[lang] ?? dict[locale] ?? Object.values(dict).find((v) => v != null)
      return typeof candidate === 'string' && candidate.trim() ? candidate : null
    }
    return null
  }
  