 Idiomas definidos en el core y seleccionables por proyecto

## Objetivo

Los idiomas de la aplicación se definen y se traducen en el core, y en enterprise para sus módulos. Cada proyecto solo decide qué idiomas se muestran en el selector de Ajustes.

## Diseño

### 1. Registro de idiomas en el core

`src/plugins/languages.ts` contiene la lista `CORE_LANGUAGES` con todos los idiomas disponibles:

~~~ts
export interface LanguageDefinition {
  code: string        // 'en', 'es', 'fr'...
  labelKey: string    // clave i18n del nombre del idioma, p. ej. 'settings.english'
  dateLocale: string  // código BCP-47 para fechas, p. ej. 'es-ES'
  messages: Record<string, any>
}

export const FALLBACK_LANGUAGE = 'en'

export const CORE_LANGUAGES: LanguageDefinition[] = [
  { code: 'en', labelKey: 'settings.english', dateLocale: 'es-ES', messages: en },
  { code: 'es', labelKey: 'settings.spanish', dateLocale: 'es-ES', messages: es },
  { code: 'fr', labelKey: 'settings.french',  dateLocale: 'fr-FR', messages: fr },
]
~~~

Todo el core toma los idiomas de este registro:
- `i18n.ts`: textos de cada idioma y `fallbackLocale: 'en'`.
- `vuetify.ts`: correspondencia idioma → `dateLocale` para las fechas.
- `i18nUtils.ts`: `LOCALE_KEYS`.
- Validación del idioma en `setDefaultLanguage` y `changeLanguage`.

Las traducciones del core están en `src/plugins/locales/<code>.ts`. Las de enterprise, en los `locales` de cada módulo, y se añaden al arrancar mediante `applyPremiumLocales`.

### 2. Textos propios del proyecto

Cada proyecto guarda las traducciones de sus propias claves en `src/app/plugins/locales/<code>.ts`. Aquí nunca van traducciones del core.

El core carga todos los ficheros de esa carpeta con `import.meta.glob('@/app/plugins/locales/*.ts', { eager: true })`, toma el código de idioma del nombre del fichero y combina sus textos con los del core con `deepMerge`. Todos los ficheros son opcionales.

### 3. Idiomas visibles por proyecto

En `src/app/config.ts`:

~~~ts
/**
 * Idiomas que se muestran en el selector de Ajustes (deben existir en el core).
 * Vacío o sin definir: se muestran todos los idiomas del core.
 */
languages: [] as string[],   // p. ej. ['en', 'es']
~~~

Y en la clase `Config`, un método `getLanguages()` que devuelve la lista.

- **Selector de Ajustes** (`UserSettingsView.vue`): muestra los idiomas del core incluidos en `languages`, en ese orden, con el nombre tomado de `labelKey`. Los códigos que no existen en el core se ignoran y se avisa en consola.
- **Idioma por defecto** (`bootstrap.ts`): se usa `defaultLanguage` (variable de entorno o `values.json`) si está entre los idiomas visibles. Si no, se usa el primero de `languages` (o `en` si la lista está vacía) y se avisa en consola.

### 4. Orden de carga

`appConfig.getLanguages()` solo se consulta cuando la app ya está en marcha (arranque y selector), nunca al cargar los módulos. `languages.ts` e `i18n.ts` no deben importar `@/app/config`, porque se formaría un ciclo de imports (`i18n.ts` → `@/app/config` → `app/models` → `data_io.ts` → `i18n.ts`).

## Cómo se añade un idioma nuevo (ejemplo: portugués)

1. **Core:** crear `src/plugins/locales/pt.ts` con todas las claves, incluido `$vuetify`. Añadir `{ code: 'pt', labelKey: 'settings.portuguese', dateLocale: 'pt-PT', messages: pt }` a `CORE_LANGUAGES` y la clave `settings.portuguese` en todos los idiomas.
2. **Enterprise:** añadir las traducciones `pt` en los `locales` de cada módulo con textos.
3. **Proyecto:** añadir `'pt'` a `languages` en `config.ts` y crear `src/app/plugins/locales/pt.ts` con sus claves propias.

Un idioma nuevo requiere sacar una versión nueva del core (y de enterprise si aplica).

## Criterios de aceptación

- [ ] Sin `languages` en `config.ts`, el selector muestra todos los idiomas del core.
- [ ] Con `languages: ['en', 'es']`, el selector muestra solo esos dos, en ese orden.
- [ ] Un código en `languages` que no existe en el core se ignora y aparece un aviso en consola.
- [ ] Si `defaultLanguage` no está entre los idiomas visibles, se usa el primero de la lista y aparece un aviso.
- [ ] Los textos de `src/app/plugins/locales/<code>.ts` se cargan para cualquier idioma del core.
- [ ] Un proyecto no puede añadir idiomas ni traducciones del core.
- [ ] Ni `languages.ts` ni `i18n.ts` importan `@/app/config`.
- [ ] Tests del selector, del idioma por defecto y de la carga de los textos del proyecto.
- [ ] README actualizado: opción `languages`, textos del proyecto y cómo añadir un idioma al core.

## Fuera de alcance

- Traducir el portugués (tarea aparte para core y enterprise).
- Completar el francés: le faltan 285 de las 833 claves de `en`.