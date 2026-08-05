# Tests E2E con Playwright

Esta carpeta contiene los tests end-to-end (E2E) de la aplicación utilizando [Playwright](https://playwright.dev/).

## Configuración

### 1. Variables de entorno

Crea un archivo `.env.test` en la carpeta `tests/e2e/` con las siguientes variables:

```env
# Credenciales de autenticación para los tests
PLAYWRIGHT_TEST_USER=tu_usuario
PLAYWRIGHT_TEST_PASSWORD=tu_contraseña

# Tipo de autenticación (opcional, por defecto: 'cornflow')
# Valores posibles: 'cornflow', 'azure', 'cognito'
PLAYWRIGHT_AUTH_TYPE=cornflow

# URL base de la aplicación (opcional, por defecto: 'http://localhost:3000')
PLAYWRIGHT_BASE_URL=http://localhost:3000

# Variables de configuración del backend (VITE_APP_*)
# IMPORTANTE: Usa VITE_APP_BACKEND_URL (no VITE_APP_API_URL)
VITE_APP_BACKEND_URL=https://tu-backend.com
VITE_APP_SCHEMA=tu_schema
VITE_APP_AUTH_TYPE=cornflow
# ... otras variables VITE_APP_* que necesite tu aplicación
```

**Nota:** El archivo `.env.test` está en `.gitignore` y no se subirá al repositorio. Asegúrate de crear tu propio archivo con las credenciales correctas.

### 2. Dependencias

Las dependencias de Playwright ya están incluidas en el `package.json` del proyecto. Si necesitas instalarlas:

```bash
npm install
```

### 3. Servidor de desarrollo

Los tests E2E inician automáticamente el servidor de desarrollo en el puerto 3000 antes de ejecutarse. No es necesario iniciarlo manualmente, pero si ya tienes un servidor corriendo en ese puerto, los tests lo reutilizarán (excepto en CI).

## Scripts disponibles

### `npm run test:e2e`

Ejecuta todos los tests E2E en modo headless (sin interfaz gráfica del navegador).

**Uso:**
```bash
npm run test:e2e
```

**Descripción:**
- Ejecuta todos los tests en la carpeta `tests/e2e/specs/`
- Los navegadores se ejecutan en segundo plano (headless)
- Genera reportes HTML en `playwright-report/`
- Ideal para ejecución rápida y CI/CD

---

### `npm run test:e2e:headed`

Ejecuta los tests E2E con la interfaz gráfica del navegador visible.

**Uso:**
```bash
npm run test:e2e:headed
```

**Descripción:**
- Mismo comportamiento que `test:e2e` pero con navegadores visibles
- Útil para ver qué está haciendo el test en tiempo real
- Permite observar el comportamiento de la aplicación durante la ejecución

---

### `npm run test:e2e:ui`

Abre la interfaz gráfica de Playwright (Playwright UI Mode).

**Uso:**
```bash
npm run test:e2e:ui
```

**Descripción:**
- Abre una interfaz interactiva en el navegador
- Permite ejecutar tests individuales o grupos de tests
- Incluye herramientas de depuración y visualización
- Muestra time travel debugging
- Ideal para desarrollo y depuración de tests

---

### `npm run test:e2e:debug`

Ejecuta los tests en modo debug con Playwright Inspector.

**Uso:**
```bash
npm run test:e2e:debug
```

**Descripción:**
- Pausa la ejecución al inicio de cada test
- Abre Playwright Inspector para depuración paso a paso
- Permite inspeccionar el estado de la página en cada momento
- Útil para depurar tests que fallan o entender el flujo de ejecución
- Puedes usar breakpoints y ejecutar comandos manualmente

---

### `npm run test:e2e:send-report`

Envía el reporte corporativo por email.

**Uso:**
```bash
npm run test:e2e:send-report
```

**Descripción:**
- Requiere haber ejecutado los tests previamente (`npm run test:e2e`)
- Requiere configurar las variables SMTP en `.env.test` (ver sección [Envío de reportes por email](#envío-de-reportes-por-email))
- Lee el reporte HTML corporativo y lo envía por email a los destinatarios configurados

---

### `npm run test:e2e:full`

Ejecuta todos los tests E2E y envía el reporte por email.

**Uso:**
```bash
npm run test:e2e:full
```

**Descripción:**
- Equivale a ejecutar `npm run test:e2e` seguido de `npm run test:e2e:send-report`
- Ideal para CI/CD donde se quiere automatizar tests + envío de reporte

## Autenticación optimizada con storageState

La suite usa la estrategia **authenticate once, reuse everywhere** de Playwright:

1. **`auth.setup.ts`** se ejecuta una sola vez antes de todos los tests. Hace login real por la UI y guarda el estado completo del navegador (cookies, localStorage y **sessionStorage**) en `.auth/user.json`.
2. **`fixtures.ts`** exporta un `test` personalizado que inyecta los valores de sessionStorage (token, userId, isAuthenticated) en cada contexto de navegador antes de que cargue la página.
3. Los tests autenticados importan `test` y `expect` desde `../../fixtures` en vez de `@playwright/test` y navegan directamente sin hacer login.
4. Los tests de autenticación (`specs/auth/`) se ejecutan en un proyecto separado sin estado preautenticado.

> **Resultado:** el login solo se ejecuta **una vez** para toda la suite, en vez de ~50 veces. Esto reduce drásticamente el tiempo de ejecución.

### Cómo escribir un nuevo test autenticado

```typescript
// Importar desde fixtures, NO desde @playwright/test
import { test, expect } from '../../fixtures';

test('mi test', async ({ page }) => {
  // Navegar directamente — la página ya está autenticada
  await page.goto('/');
  const app = page.locator('.v-application');
  await app.first().waitFor({ state: 'visible', timeout: 15000 });

  // ... continuar con el test
});
```

## Estructura de archivos

```
tests/e2e/
├── README.md                    # Este archivo
├── playwright.config.ts         # Configuración de Playwright
├── auth.setup.ts                # Setup global de autenticación (se ejecuta una vez)
├── fixtures.ts                  # Fixture personalizado con inyección de sessionStorage
├── .env.test                    # Variables de entorno (no se sube al repo)
├── .auth/                       # Estado de autenticación guardado (no se sube al repo)
│   └── user.json                # Cookies + localStorage + sessionStorage
├── reporters/                   # Reportes personalizados
│   ├── corporate-reporter.ts    # Reporter corporativo con branding
│   └── send-report.ts           # Script de envío de reportes por email
├── helpers/                     # Helpers y utilidades
│   ├── auth/                    # Helpers de autenticación
│   │   ├── cornflowAuth.ts      # Autenticación con usuario/contraseña
│   │   └── index.ts             # Factory de autenticación
│   ├── constants.ts             # Constantes y selectores
│   ├── errorDetection.ts        # Detección de errores en la UI
│   ├── sessionStorageHelpers.ts # Helpers para sessionStorage
│   └── urlHelpers.ts            # Helpers para URLs y rutas
└── specs/                       # Tests E2E
    ├── auth/
    │   └── login.spec.ts        # Tests de autenticación (login/logout)
    ├── drawer/
    │   └── pinDrawer.spec.ts    # Botón Pin drawer: fijar/desfijar menú lateral
    ├── help/
    │   └── helpButton.spec.ts   # Botón de ayuda y menú de ayuda
    ├── input-data/
    │   └── inputData.spec.ts    # Página de datos de entrada
    ├── layout/
    │   └── baobabLink.spec.ts   # Enlace "Powered by baobab soluciones"
    ├── loaded-executions/
    │   └── loadedExecutionsTabs.spec.ts  # Pestañas de ejecuciones cargadas
    ├── user-settings/
    │   └── userSettingsNavigation.spec.ts # Navegación a ajustes de usuario
    └── version-history/
        └── versionHistoryNavigation.spec.ts # Navegación al historial de versiones
```

## Specs y cobertura

| Carpeta              | Archivo                      | Descripción |
|----------------------|-----------------------------|-------------|
| `auth/`              | `login.spec.ts`             | Login, logout y flujo de autenticación. |
| `drawer/`            | `pinDrawer.spec.ts`         | Botón **Pin drawer** del menú lateral: al pulsar el menú se queda desplegado; al pulsar de nuevo se contrae. |
| `help/`              | `helpButton.spec.ts`        | Botón de ayuda, menú (Centro de ayuda, Licencias) y modal de ayuda. |
| `input-data/`        | `inputData.spec.ts`         | Navegación a datos de entrada, tablas, visualización y carga de datos. |
| `layout/`            | `baobabLink.spec.ts`        | Enlace **"baobab soluciones"** en la barra de la app: comprueba que el `href` es correcto y que al hacer clic se abre la URL en una nueva pestaña. |
| `loaded-executions/` | `loadedExecutionsTabs.spec.ts` | Pestañas de ejecuciones cargadas (crear, cerrar, seleccionar). |
| `user-settings/`     | `userSettingsNavigation.spec.ts` | Navegación a la página de ajustes de usuario. |
| `version-history/`   | `versionHistoryNavigation.spec.ts` | Navegación al historial de versiones. |

## Reportes

Después de ejecutar los tests, se generan los siguientes reportes:

### Reporte estándar de Playwright

- **`playwright-report/index.html`**: Reporte HTML interactivo con resultados, screenshots y videos de los tests fallidos
- **`test-results/`**: Carpeta con resultados detallados de cada ejecución (screenshots, videos, traces)

Para ver el reporte estándar:
```bash
npx playwright show-report
```

### Reporte corporativo

Además del reporte estándar, se genera un **reporte corporativo** con el branding de la empresa:

- **`playwright-report/corporate-report.html`**: Reporte HTML con look & feel corporativo

El reporte corporativo incluye:
- Cabecera con logo y nombre del proyecto
- Tarjetas de resumen (total, passed, failed, skipped, flaky, duración)
- Barra de progreso visual con porcentaje de éxito
- Resultados detallados agrupados por archivo
- Sección de errores con screenshots para tests fallidos
- Pie de página con metadatos de ejecución

#### Personalización

El reporter corporativo acepta opciones en `playwright.config.ts`:

```typescript
['./reporters/corporate-reporter.ts', {
  outputFile: 'playwright-report/corporate-report.html', // Ruta del archivo de salida
  companyName: 'baobab soluciones',                       // Nombre de la empresa
  projectName: 'Cornflow UI',                             // Nombre del proyecto
  logoPath: 'src/app/assets/logo/baobab_full_logo.png',   // Ruta al logo
  embedScreenshots: true,                                  // Incrustar screenshots de fallos
}]
```

### Envío de reportes por email

El reporte corporativo se puede enviar automáticamente por email:

```bash
# Enviar solo el reporte (requiere haber ejecutado los tests antes)
npm run test:e2e:send-report

# Ejecutar tests + enviar reporte
npm run test:e2e:full
```

#### Configuración del email

Añade las siguientes variables en `.env.test`:

```env
REPORT_SMTP_HOST=smtp.gmail.com
REPORT_SMTP_PORT=587
REPORT_SMTP_USER=tu_correo@gmail.com
REPORT_SMTP_PASS=tu_app_password
REPORT_EMAIL_FROM=tu_correo@gmail.com
REPORT_EMAIL_TO=destinatario1@empresa.com,destinatario2@empresa.com
REPORT_EMAIL_CC=cc@empresa.com
REPORT_EMAIL_SUBJECT=E2E Test Report – Cornflow UI
```

> **Nota:** Para Gmail, usa una [contraseña de aplicación](https://support.google.com/accounts/answer/185833) en `REPORT_SMTP_PASS`, no la contraseña habitual.

#### Integración con CI/CD

Para enviar el reporte automáticamente en un pipeline de CI/CD:

```yaml
# Ejemplo para GitHub Actions
- name: Run E2E tests
  run: npm run test:e2e
  env:
    PLAYWRIGHT_TEST_USER: ${{ secrets.E2E_USER }}
    PLAYWRIGHT_TEST_PASSWORD: ${{ secrets.E2E_PASSWORD }}

- name: Send test report
  if: always()
  run: npm run test:e2e:send-report
  env:
    REPORT_SMTP_HOST: ${{ secrets.SMTP_HOST }}
    REPORT_SMTP_PORT: ${{ secrets.SMTP_PORT }}
    REPORT_SMTP_USER: ${{ secrets.SMTP_USER }}
    REPORT_SMTP_PASS: ${{ secrets.SMTP_PASS }}
    REPORT_EMAIL_FROM: ${{ secrets.REPORT_FROM }}
    REPORT_EMAIL_TO: ${{ secrets.REPORT_TO }}
```

Todos los archivos de reportes están en `.gitignore` y no se suben al repositorio.

## Troubleshooting

### Los tests fallan con "Error del servidor"

- Verifica que las credenciales en `.env.test` sean correctas
- Asegúrate de que el backend esté configurado correctamente
- Revisa que las variables `VITE_APP_*` en `.env.test` apunten al backend correcto

### El servidor no inicia

- Verifica que el puerto 3000 esté disponible
- Si ya tienes un servidor corriendo en el puerto 3000, los tests lo reutilizarán automáticamente
- Revisa los logs del servidor en la consola

### Los tests son lentos

- La autenticación se ejecuta **una sola vez** gracias al setup project (`auth.setup.ts`). Si los tests siguen siendo lentos, revisa que estés importando `test` desde `../../fixtures` y no desde `@playwright/test`.
- Los tests se ejecutan de forma secuencial (`fullyParallel: false`) para evitar conflictos con el servidor compartido.
- En local se usa 1 worker; en CI se usan 2 workers.
- Puedes ajustar `workers` y `fullyParallel` en `playwright.config.ts` si es necesario.

### Problemas con selectores

- Usa `npm run test:e2e:debug` para inspeccionar la página en tiempo real
- Usa `npm run test:e2e:ui` para ver la ejecución paso a paso
- Revisa los screenshots en `test-results/` para ver el estado de la página cuando falla un test

## Más información

- [Documentación de Playwright](https://playwright.dev/)
- [Guía de mejores prácticas de Playwright](https://playwright.dev/docs/best-practices)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
