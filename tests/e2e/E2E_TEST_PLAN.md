# Plan de Tests E2E — Cornflow UI (core)

> Estado: **EN EJECUCIÓN**. La suite de core ya está implementada en esta rama (60 tests, verde
> contra south_handling pre); este documento sigue siendo la referencia de estrategia, cobertura
> pendiente y decisiones. Las secciones que hablan en futuro describen el plan original.
> Rama: `feature/e2e-tests` (creada desde `develop`).
> Objetivo: definir cómo montar una suite E2E que cubra **todos los flujos posibles**, cómo
> configurarla, mejores prácticas, y reporting por email.
>
> 👉 Para **cómo se reparten y heredan los tests entre core, enterprise y las apps de cliente**
> (capas, configuración y ejecución), ver [`E2E_ARCHITECTURE.md`](./E2E_ARCHITECTURE.md).

---

## 0. Resumen ejecutivo (TL;DR)

- **No partimos de cero.** El repo `cornflow-ui` ya tiene una rama, **`feature/e2e_testing`**
  (hace ~4 meses, 104 commits), con una suite E2E **muy avanzada**: ~67 casos sobre flujos
  reales de negocio + autenticación por `storageState` + **reporter corporativo HTML + envío
  por email (SMTP/Nodemailer)**. `develop` **no** tiene nada de E2E.
- **Recomendación central:** adoptar esa base (portarla/rebasarla sobre `develop` v3.2.2),
  **completar los huecos de cobertura**, y **productizarla** (CI + email programado). Reescribir
  desde cero sería tirar ~4 meses de trabajo válido.
- **Dónde vive:** la suite debe vivir en **core (`cornflow-ui`)** porque cubre los flujos
  genéricos que TODOS los productos heredan. Cada consumidor/enterprise añade encima solo sus
  specs específicos (dashboards propios, módulos premium).
- **Lo que hay que decidir con la responsable:** entorno de test dedicado, usuario cornflow de
  test (auth user/pass, no Azure), y política de email de reportes. Ver §14–15.

---

## 1. Objetivo y alcance

Montar una suite de tests **end-to-end** (navegador real → app → backend real) que:

1. **Detecte regresiones** de los flujos de usuario críticos antes de desplegar (especialmente
   ahora que migramos de rsync a paquete npm y cada bump de core puede romper consumidores).
2. **Se ejecute en CI** en cada PR a `develop`/`master` y de forma programada (nightly).
3. **Genere un reporte legible** y lo **envíe por email** a los responsables.
4. Sea **reutilizable** por todos los productos (core + enterprise + consumidores) con el mínimo
   de duplicación.

**Fuera de alcance** (lo cubren otros niveles):
- Lógica pura de composables/utils/mappers → **tests unitarios** (Vitest), ya existen.
- Contratos de API del backend → responsabilidad del backend (cornflow).

---

## 2. Estado actual — inventario de lo que YA existe en `feature/e2e_testing`

Framework: **Playwright** (`@playwright/test`). `testDir: tests/e2e/specs`, arranca el dev server
solo (`webServer`), 3 *projects* (setup / autenticado / auth-tests).

### 2.1 Casos ya cubiertos (~67)

| Área | Spec | Casos (resumen) |
|---|---|---|
| **Auth** | `specs/auth/login.spec.ts` | carga home, login OK/KO/vacío, redirección a ruta protegida, logout (programático + botón UI), redirección sin sesión, persistencia tras reload (9) |
| **Restore password** | `restore-password.spec.ts` | restaura la contraseña original (1) |
| **Drawer** | `specs/drawer/pinDrawer.spec.ts` | fijar/desfijar el drawer (1) |
| **Help** | `specs/help/helpButton.spec.ts` | menú de ayuda, modal help center, descarga de manual, modal de licencias, cerrar (6) |
| **Input data** | `specs/input-data/inputData.spec.ts` | ver datos de instancia, tabs, descarga Excel, ir a editar instancia, FAB "plan actual", set como plan actual (6) |
| **Layout** | `specs/layout/baobabLink.spec.ts` | link a baobab soluciones (1) |
| **Loaded executions** | `specs/loaded-executions/loadedExecutionsTabs.spec.ts` | barra de tabs de ejecuciones cargadas, navegar, cerrar tabs (6) |
| **Solution data** | `specs/solution-data/solutionData.spec.ts` | ver solución por ejecución, datos del endpoint, tabs, descarga Excel, plan actual (7) |
| **User settings** | `specs/user-settings/userSettingsNavigation.spec.ts` | navegación, tabs, tema, **cambio de idioma**, **cambio de contraseña** (7) |
| **Validations** | `specs/validations/validations.spec.ts` | ver validaciones por instancia, endpoint, descarga Excel, editar instancia, tabs, plan actual (8) |
| **Version history** | `specs/version-history/versionHistoryNavigation.spec.ts` | listado, navegación, **estructura de datos del endpoint**, filtros Hoy/Ayer/7d/30d, datepickers, descarga Excel, cargar ejecución, set plan actual, modales cancelar/eliminar (15) |

### 2.2 Infraestructura ya construida

- **`auth.setup.ts`** — *project* de setup: hace login una vez y persiste el estado
  (`.auth/user.json`: cookies + localStorage). El resto de specs lo reutilizan → no repiten login.
- **`fixtures.ts`** — fixture custom que además restaura **sessionStorage** (donde vive el token cornflow).
- **`helpers/authInjectSkip.ts`** — permite **saltarse la inyección de sesión** en flujos que
  cambian credenciales (p. ej. cambio de contraseña), para que no se re-inyecte el token viejo.
- **`helpers/executionHelpers.ts`** — helpers de flujo de ejecución: `ensureHistoryHasRows`,
  `loadNonCurrentExecutionFromHistory`, `ensureExecutionLoaded`, `findLoadExecutionButtonInRow`,
  `waitForStableLoadedExecutionTab`, `loadExecutionFromHistoryUntil`.
- **`helpers/`** — `cornflowAuth`, `urlHelpers` (hash routing), `sessionStorageHelpers`,
  `errorDetection`, `constants`, `restorePassword`.
- **`reporters/corporate-reporter.ts`** — genera `playwright-report/corporate-report.html` con marca propia.
- **`reporters/send-report.ts`** — **envía ese HTML por email** (Nodemailer/SMTP), con imágenes
  embebidas como CID y fallback de SVG→texto para clientes tipo Gmail.
- **Scripts** en `package.json`: `test:e2e`, `:headed`, `:ui`, `:debug`, `:send-report`,
  `:full` (corre + envía email).

### 2.3 Limitación

Está sobre **core viejo** (4 meses; sin v3.2.2, sin el contrato de config v3.2.1 actual, sin el
fix i18n). **No se puede mergear tal cual** — hay que portarla/rebasarla sobre `develop`.

---

## 3. Estrategia y arquitectura

### 3.1 Modelo por capas (dónde vive cada test)

```
core (cornflow-ui)         → flujos GENÉRICOS (auth, ejecución, input/solution/validation,
                              history, settings, help, roles, licencias…). ← la mayor parte
   └── enterprise           → hereda core + specs de módulos PREMIUM (agent, latest-plan,
                              recalculation, ETL).
        └── consumidor (ie_cronos, south, nippon…) → hereda + specs de sus DASHBOARDS/vistas propias.
```

- La suite base (core) se ejecuta contra un **schema de test genérico** con datos controlados.
- Los helpers/fixtures/reporters se definen **una vez en core** y se reexportan/copian al resto
  (idealmente, cuando core sea consumible como paquete, los consumidores importan los helpers
  desde `@cornflow-ui/core/tests-e2e` — ver §13, fase 4).

### 3.2 Enfoque de test

- **Playwright** (ya adoptado; no cambiar de framework).
- **Page Objects / helpers por dominio** en vez de selectores sueltos en cada spec.
- **Auth una sola vez** vía `storageState` (setup project) + fixture de sessionStorage.
- **Tests independientes e idempotentes**: cada uno prepara/limpia su propio estado; nada de
  dependencias de orden.

---

## 4. Estructura de carpetas objetivo

```
tests/e2e/
├── playwright.config.ts          # 3 projects: setup, chromium (auth), chromium-auth-tests
├── auth.setup.ts                 # login 1 vez → .auth/user.json
├── fixtures.ts                   # fixtures custom (sessionStorage, datos)
├── .env.test.example             # plantilla (SIN secretos) — el real .env.test va gitignored
├── .env.test                     # LOCAL, gitignored: credenciales + SMTP
├── README.md                     # cómo configurar y ejecutar
├── E2E_TEST_PLAN.md              # este documento
├── helpers/
│   ├── auth/ (cornflowAuth, index, authInjectSkip)
│   ├── executionHelpers.ts       # crear/cargar/preparar ejecuciones
│   ├── dataHelpers.ts            # (NUEVO) seed/reset de instancias de test vía API
│   ├── urlHelpers, sessionStorageHelpers, errorDetection, constants
├── fixtures-data/                # (NUEVO) ficheros de instancia (.xlsx/.json) para subir
├── reporters/
│   ├── corporate-reporter.ts     # HTML con marca
│   └── send-report.ts            # email SMTP
└── specs/
    ├── auth/            solution-data/     validations/
    ├── input-data/      version-history/   user-settings/
    ├── loaded-executions/  help/  drawer/  layout/
    ├── create-execution/   (NUEVO — ver §6)
    ├── roles-management/   (NUEVO)
    └── dashboards/         (genérico core; los específicos, en cada consumidor)
```

---

## 5. Estrategia de autenticación (clave)

**Problema:** la mayoría de productos usan **Azure/Cognito SSO**, que Playwright no puede
automatizar de forma fiable (redirect a Microsoft, MFA, cookies httpOnly, tokens que MSAL
refresca en vivo). Verificado en la investigación previa: una sesión Azure estática no es
replayable de forma robusta.

**Decisión recomendada:** los E2E corren contra un **entorno de test con `auth_type=cornflow`
(usuario/contraseña)**. Es lo que ya asume `feature/e2e_testing`
(`PLAYWRIGHT_TEST_USER` / `PLAYWRIGHT_TEST_PASSWORD`). Ventajas: repetible, sin MFA, CI-friendly.

**Mecánica (ya implementada en la rama):**
1. *Project* `setup` (`auth.setup.ts`) hace login real una vez y guarda `.auth/user.json`
   (cookies + localStorage) + el token en sessionStorage (vía fixture).
2. *Project* `chromium` reutiliza ese estado → los specs entran ya autenticados (rápido, estable).
3. *Project* `chromium-auth-tests` corre los specs de `auth/` **sin** sesión previa (para probar
   el propio login/logout).
4. Para flujos que cambian credenciales (cambio de contraseña), `authInjectSkip` evita re-inyectar
   el token viejo.

**Alternativa documentada (solo verificación puntual, NO CI):** inyección de un token de backend
ya obtenido en `sessionStorage` (probado y funcional para una comprobación manual, pero caduca en
~1 h y no sirve para CI).

---

## 6. Mapa COMPLETO de flujos a cubrir (matriz cobertura/prioridad)

Leyenda: ✅ ya cubierto en `feature/e2e_testing` · 🟡 parcial · ❌ hueco (a escribir) ·
Prioridad **P0** (crítico) / **P1** / **P2**.

### 6.1 Autenticación y sesión
| Flujo | Estado | Prio |
|---|---|---|
| Login OK / KO / campos vacíos | ✅ | P0 |
| Redirección a ruta protegida / a sign-in sin sesión | ✅ | P0 |
| Logout (programático + botón UI) | ✅ | P0 |
| Persistencia de sesión tras reload | ✅ | P0 |
| **Refresh/expiración de token** (sesión larga, re-login) | ❌ | P1 |
| **Signup** (cuando `enableSignup=true`) | ❌ | P2 |
| Restore password | ✅ | P1 |

### 6.2 Ciclo de vida de la EJECUCIÓN (lo más importante — hoy es el mayor hueco)
| Flujo | Estado | Prio |
|---|---|---|
| **Crear ejecución (wizard completo)**: cargar instancia (fichero) → revisar instancia → verificar datos → **configurar configParams** → nombre/descripción → confirmar → **resolver** → ver solución | ❌ | **P0** |
| — validación de `configParams` (tipos, requeridos, placeholders) *(es la pantalla del screenshot)* | ❌ | P0 |
| — subir fichero de instancia (.xlsx/.json) y procesarlo (incl. ETL/matriz si aplica) | ❌ | P0 |
| — estados de la ejecución (loading/solving/solved/error) y polling | ❌ | P0 |
| Cargar ejecución existente desde history | ✅ | P0 |
| Editar instancia y guardar cambios | 🟡 (navega a editar; no guarda) | P1 |
| Marcar/desmarcar "plan actual" | ✅ | P1 |
| Eliminar ejecución (modal confirm/cancel) | ✅ | P1 |
| Barra de tabs de ejecuciones cargadas | ✅ | P1 |

### 6.3 Visualización de datos
| Flujo | Estado | Prio |
|---|---|---|
| Input data (tablas, tabs, descarga Excel) | ✅ | P0 |
| Solution data (por ejecución, tabs, Excel) | ✅ | P0 |
| Validations (por instancia, tabs, Excel) | ✅ | P0 |
| Version history (listado, filtros de fecha, datepickers, Excel, cargar) | ✅ | P0 |
| **Dashboards genéricos de core** (render + interacción básica) | ❌ | P1 |
| **Dashboards específicos de app** (Grado/Máster, KPIs, calendarios…) | ❌ (va en el consumidor) | P1 |

### 6.4 Navegación / UI / configuración
| Flujo | Estado | Prio |
|---|---|---|
| Drawer (fijar/desfijar) | ✅ | P2 |
| Help center + manual + licencias | ✅ | P1 |
| Link baobab | ✅ | P2 |
| User settings: tema | ✅ | P1 |
| User settings: **cambio de idioma** (i18n en runtime) | ✅ | P1 |
| User settings: cambio de contraseña | ✅ | P1 |
| **Roles management / admin** (drawer de roles, v3.2.1) | ❌ | P1 |
| **Traducciones de app** correctas (no claves crudas) — regresión del bug i18n v3.2.2 | ❌ | **P0** |

### 6.5 Módulos PREMIUM (enterprise — van en el repo enterprise, heredando esta base)

> **Aclaración arquitectónica (2026-08-05):** core expone puntos de enganche
> (`plugins/extensions.ts`, `types/extension.ts`, `useLatestPlanController.ts`,
> `types/latestPlan.ts`) pero la **UI premium ya NO vive en core** — `SetCurrentPlanFab.vue`,
> `LatestPlanBanner.vue`, `SetLatestPlanModal.vue`, `LatestPlanRepository.ts` están en
> **`cornflow_ui_enterprise`**. Por tanto los e2e de estos módulos van en enterprise, como
> **módulos e2e extra** que reutilizan el harness de core.

| Módulo | Estado | Prio |
|---|---|---|
| **Latest plan / "plan actual"** (FAB estrella, set current plan, banner, up-to-date) | ❌ (van a enterprise) | P1 |
| Agent (chat/mentions) | ❌ | P1 |
| Recalculation | ❌ | P1 |
| ETL (carga de instancia vía backend ETL, metadata/review) | ❌ | P1 |
| Master-table-match | ❌ | P1 |

> **Tests a REUBICAR de core→enterprise** (7 tests de "current plan" que recuperamos en core
> pero prueban UI premium): `input-data` (2), `solution-data` (2), `validations` (2),
> `version-history` (1). Fuente para portarlos: rama `feature/e2e_testing` de core o el
> commit de recuperación. En core se **eliminan** (no aplican a un consumidor CORE puro).

### 6.6 Transversales (cross-cutting)
| Aspecto | Estado | Prio |
|---|---|---|
| Detección de **errores de consola / red** en cada test (fallar si hay errores no esperados) | 🟡 (`errorDetection` existe) | P1 |
| Manejo de errores de backend (4xx/5xx → UI muestra error, no crashea) | ❌ | P1 |
| i18n: cada texto clave traducido en es/en/fr | ❌ | P1 |
| Responsive / breakpoints básicos | ❌ | P2 |
| Accesibilidad básica (roles ARIA en botones críticos) | ❌ | P2 |

**Prioridad de escritura recomendada:** primero cerrar los **P0 nuevos** (wizard de crear
ejecución completo + regresión i18n de configParams/app), luego P1 (roles, dashboards genéricos,
premium en enterprise, errores de red), luego P2.

---

## 7. Datos de prueba y entorno

Los E2E de negocio necesitan **datos deterministas**. Opciones (a decidir con backend, §15):

1. **Schema/entorno de test dedicado** con `auth_type=cornflow` y un **usuario de test** fijo.
   - Aísla los E2E de datos reales; permite crear/borrar ejecuciones sin ensuciar producción.
2. **Seed vía API** (`helpers/dataHelpers.ts`, nuevo): antes de la suite, crear una instancia/
   ejecución conocida por API (`POST /instance/`, `/execution/`) y borrarla al final.
   - Alternativa: **ficheros de instancia** en `fixtures-data/` que los tests suben por la UI
     (más realista para el flujo de "crear ejecución").
3. **Aislamiento**: cada test que muta datos debe crear lo suyo con un nombre único
   (p. ej. `e2e-<timestamp>-<worker>`) y limpiarlo. `Date.now()` en nombres para unicidad.
4. **Determinismo**: no depender de "la última ejecución" salvo que el test la haya creado.

> Nota: los flujos que solo LEEN (history, input/solution/validation) pueden correr contra un
> conjunto de datos seed de solo-lectura; los que CREAN/BORRAN necesitan aislamiento estricto.

---

## 8. Testability y selectores (mejores prácticas)

- **Preferir `data-testid`** en los elementos clave de la UI (botones del wizard, celdas de tabla,
  tabs, FAB de plan actual, filtros). Hoy los specs dependen de texto visible (`getByText(/Logout|
  Cerrar sesión/)`) y clases CSS (`.main-signin-btn`, `.primary-btn`) → **frágil** ante cambios de
  copy o de estilos. **Acción:** añadir `data-testid` en core progresivamente y migrar selectores.
- **Page Object Model** por página/dominio (`pages/SignInPage.ts`, `pages/ExecutionWizard.ts`,
  `pages/HistoryPage.ts`…) encapsulando selectores y acciones.
- No usar `nth`/índices salvo imprescindible; preferir roles ARIA + `data-testid`.
- Selección por **rol accesible** (`getByRole('button', { name })`) cuando el copy sea estable.

---

## 9. Anti-flakiness y mejores prácticas

- **Auto-waiting de Playwright**: usar `expect(locator).toBeVisible()` en vez de `waitForTimeout`
  fijos (la rama actual abusa de `waitForTimeout` en algún helper → revisar).
- **`waitForLoadState('networkidle')`** tras navegaciones que disparan llamadas al backend.
- **Retries**: 2 en CI, 1 local (ya configurado). `trace: on-first-retry`, `screenshot`/`video`
  `on-failure` (ya configurado) → adjuntos al reporte para depurar.
- **Aislamiento de estado**: cada test parte de un estado conocido (storageState + seed propio).
- **`fullyParallel: false`** hoy (evita choques de auth/servidor compartido). A medio plazo,
  paralelizar por *worker* con datos aislados por worker.
- **Sin secretos en el repo**: credenciales y SMTP solo en `.env.test` (gitignored) o *secrets* de CI.
- **`forbidOnly` en CI** (ya) para que no se cuele un `.only`.
- Nombrar tests describiendo el comportamiento del usuario, no la implementación.

---

## 10. Reporting

Tres formatos, ya soportados/planificados:

1. **HTML corporativo** (`reporters/corporate-reporter.ts`) → `playwright-report/corporate-report.html`.
   Reporte con marca, resumen de resultados, capturas de fallos.
2. **HTML nativo de Playwright** + **`github`** (anotaciones en el PR) + **`list`** (consola).
   Añadir **`junit`** (XML) para integrarlo con el panel de tests del CI. *(Acción: añadir reporter junit.)*
3. **Email** (`reporters/send-report.ts` vía Nodemailer):
   - Procesa el HTML para clientes de correo (imágenes `data:` → adjuntos **CID**, SVG → texto).
   - Adjunta el HTML completo como fichero descargable.
   - Se dispara con `npm run test:e2e:send-report` o `npm run test:e2e:full` (corre + envía,
     envía incluso si los tests fallan → así llega el reporte de fallos).

### Variables de email (en `.env.test` o secrets de CI)
```
REPORT_SMTP_HOST      # p.ej. smtp.gmail.com  (o el SMTP corporativo)
REPORT_SMTP_PORT      # 587 (STARTTLS) / 465 (SSL)
REPORT_SMTP_USER
REPORT_SMTP_PASS      # app-password / token; NUNCA en el repo
REPORT_EMAIL_FROM
REPORT_EMAIL_TO       # lista separada por comas
REPORT_EMAIL_CC       # (opcional)
REPORT_EMAIL_SUBJECT  # (opcional)
REPORT_FILE           # (opcional) ruta al HTML
```
> Recomendación: usar el **SMTP corporativo de baobab** con una cuenta de servicio, no un Gmail
> personal. Alternativa a SMTP: subir el HTML como *artifact* del CI y mandar por email solo un
> **resumen + enlace** (menos peso, sin adjuntos pesados).

---

## 11. CI/CD (GitHub Actions)

Diseño propuesto (nuevo workflow `.github/workflows/e2e.yml`):

- **Disparadores:**
  - En **PR** a `develop`/`master`: corre la suite (o un subconjunto P0 "smoke" para no ralentizar).
  - **Nightly** (cron): suite completa + **email** del reporte.
  - Manual (`workflow_dispatch`).
- **Pasos:** checkout → setup Node → `npm ci` → `npx playwright install --with-deps chromium` →
  `npm run test:e2e` → subir `playwright-report/` como *artifact* → (nightly) `npm run test:e2e:send-report`.
- **Secrets:** `PLAYWRIGHT_TEST_USER/PASSWORD`, `VITE_APP_BACKEND_URL/SCHEMA`, `REPORT_SMTP_*`,
  `REPORT_EMAIL_*`. (El token de repos privados ya se reutiliza: `FRONTEND_SYNC_TOKEN`.)
- **Backend:** apuntar a un entorno de test estable y accesible desde el runner (CORS permitido).

---

## 12. Configuración paso a paso (para poder ejecutar en local)

1. `cp tests/e2e/.env.test.example tests/e2e/.env.test` y rellenar:
   - `PLAYWRIGHT_TEST_USER` / `PLAYWRIGHT_TEST_PASSWORD` (usuario cornflow de test).
   - `VITE_APP_BACKEND_URL`, `VITE_APP_SCHEMA`, `VITE_APP_AUTH_TYPE=cornflow`
     (+ `VITE_APP_EXTERNAL_APP=true` si el backend sirve la API bajo `/cornflow`).
   - (opcional) bloque `REPORT_*` para el email.
2. `npm ci`
3. `npx playwright install --with-deps chromium`
4. `npm run test:e2e` (arranca el dev server solo). Depurar: `:headed` / `:ui` / `:debug`.
5. Email del reporte: `npm run test:e2e:send-report` (o `test:e2e:full`).

> `.env.test` y `.auth/` (storageState) deben estar en `.gitignore`.

---

## 13. Roadmap por fases

- **Fase 0 — Reconciliación (base):** portar `feature/e2e_testing` sobre `develop` (v3.2.2).
  Actualizar selectores/contratos rotos por los cambios de core (config v3.2.1, i18n). Dejar la
  suite existente **verde** contra el entorno de test. *(Sin esto, nada corre.)*
- **Fase 1 — P0 nuevos:** wizard **crear ejecución completo** (carga instancia → configParams →
  resolver → solución) + **regresión i18n** (configParams/app traducidos). Smoke suite para CI de PR.
- **Fase 2 — P1:** roles management, dashboards genéricos de core, errores de red, refresh de token,
  editar+guardar instancia. Wire del **CI** (PR smoke + nightly full + email).
- **Fase 3 — Enterprise:** en el repo enterprise, heredar la base y añadir specs de módulos premium
  (agent, latest-plan, recalculation, ETL).
- **Fase 4 — Reutilización:** exponer helpers/fixtures/reporters de core como consumible
  (`@cornflow-ui/core`), para que consumidores importen la base y solo escriban sus specs de app.
- **Fase 5 — Testability:** añadir `data-testid` en core y migrar selectores frágiles.

---

## 14. Riesgos y decisiones abiertas

- **Auth de test:** confirmar que existe (o se puede crear) un entorno con `auth_type=cornflow`
  y usuario de test. Si SOLO hay Azure, los E2E no son fiables en CI (ver §5).
- **Entorno/datos:** ¿schema de test dedicado? ¿podemos crear/borrar ejecuciones por API? ¿CORS
  del backend permite el origen del runner de CI?
- **Propiedad:** la suite base vive en core, pero cada consumidor debe mantener sus specs de app.
  Definir quién mantiene qué.
- **Email:** SMTP corporativo vs Gmail de servicio; destinatarios; frecuencia (¿solo nightly? ¿solo
  en fallo?).
- **Coste/tiempo de CI:** suite completa en cada PR puede ser lenta → separar "smoke" (P0) en PR y
  "full" en nightly.
- **La rama base es de hace 4 meses:** el esfuerzo de Fase 0 depende de cuánto ha cambiado core
  (config contract, rutas, selectores). Hay que estimarlo abriendo la rama con detalle.

---

## 15. Preguntas para la responsable (para arrancar Fase 0)

1. ¿Hay un **entorno de test** (backend + schema) con **auth cornflow** y un **usuario de test**
   que podamos usar en CI? Si no, ¿lo montamos?
2. ¿Se pueden **crear y borrar ejecuciones/instancias por API** en ese entorno (para seed/cleanup)?
3. ¿Qué **SMTP** usamos para el email y a **quién** se manda el reporte (y con qué frecuencia)?
4. ¿La suite base la queremos en **core** (recomendado) y que enterprise/consumidores hereden, o
   preferís mantenerla en enterprise?
5. ¿Basamos el trabajo en **portar `feature/e2e_testing`** (recomendado) o preferís partir limpio?

---

*Documento de planificación. Próximo paso sugerido: validar §15 y arrancar Fase 0 (reconciliación
de `feature/e2e_testing` sobre `develop`).*
