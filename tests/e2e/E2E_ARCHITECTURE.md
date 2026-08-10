# Arquitectura E2E de Cornflow — core, enterprise y apps de cliente

> Cómo se reparten, se heredan, se configuran y se lanzan los tests E2E en los tres niveles del
> producto. Este documento vive en **core** porque la maquinaria (la *factory* de configuración)
> vive aquí y viaja dentro del paquete a todos los consumidores.
>
> Documentos hermanos: [`E2E_TEST_PLAN.md`](./E2E_TEST_PLAN.md) (estrategia y cobertura),
> `README.md` de cada repo (instrucciones locales).

---

## 1. El problema que resuelve

El producto tiene tres niveles y cada uno añade código:

```
cornflow-ui (CORE)  ──►  cornflow_ui_enterprise (ENTERPRISE)  ──►  tendam-frontend (APP)
   flujos base              módulos premium                          vistas y lógica propias
```

Un cliente como Tendam necesita probar **las tres cosas a la vez**. La salida fácil —copiar los
tests de core a enterprise y de enterprise a cada cliente— produce N copias que divergen: se
arregla un selector en core y nadie se entera en los otros seis repos.

La regla de este montaje es: **cada test se escribe una sola vez, en la capa que lo posee, y se
hereda hacia abajo.**

---

## 2. Las tres capas

| Capa | Qué cubre | Dónde viven los specs | Proyecto Playwright |
|---|---|---|---|
| **Core** | Login/logout, input data, solution data, validaciones, historial de versiones, ejecuciones cargadas, ayuda, drawer, ajustes de usuario, layout | `@cornflow-ui/core` → `tests/e2e/specs/` | `chromium`, `chromium-auth-tests` |
| **Enterprise** | Módulos premium: plan actual (*latest-plan*) y, según se vayan escribiendo, agent, recalculation, ETL, master-table-match | `@cornflow-ui/enterprise` → `tests/e2e/premium/<módulo>/` | `chromium-enterprise` |
| **App** | Lo que solo existe en ese cliente: vistas propias, dashboards, su schema, sus parámetros | el repo del cliente → `tests/e2e/app/` | `chromium-app` |

Una sola orden (`npm run test:e2e`) ejecuta las capas que apliquen, en la misma sesión
autenticada.

### En qué capa va un test nuevo

```
¿El comportamiento existe en cualquier app cornflow?          → core
¿Solo cuando está activado un módulo premium?                 → enterprise
¿Depende de una vista, schema o regla de ESTE cliente?        → app
```

Si dudas: un test que le serviría a otro cliente **no** debe vivir en el repo del cliente. Súbelo
a core o enterprise y todos lo heredan.

---

## 3. Cómo funciona por dentro

### 3.1 La *factory* de configuración

Cada repo tiene un `playwright.config.mjs` mínimo que llama a una función de fábrica. La de core
([`configFactory.mjs`](./configFactory.mjs)) es la que construye la configuración real:
proyectos, reporters, dev server, timeouts y estado de autenticación.

Enterprise no reimplementa nada: su
`tests/e2e/configFactory.mjs` **delega en la de core** y le añade su capa premium. Un cliente
importa la del paquete más alto que consume y recibe la cadena entera.

### 3.2 Los *mirrors* (y por qué existen)

Playwright **no puede cargar ficheros `.ts` que estén dentro de `node_modules`** (falla con
*"Stripping types is currently unsupported for files under node_modules"* y detecta 0 tests). Esa
es la restricción que condiciona todo el diseño.

La solución: cuando la factory detecta que una suite viene de un paquete instalado, la **copia**
a una carpeta local del proyecto que se está probando, fuera de `node_modules`, y apunta
Playwright ahí:

```
tendam-frontend/
└── tests/e2e/
    ├── .cornflow-core/         ← copia de @cornflow-ui/core/tests/e2e        (gitignored)
    ├── .cornflow-enterprise/   ← copia de @cornflow-ui/enterprise/…/premium  (gitignored)
    ├── .auth/user.json         ← sesión guardada por el setup                (gitignored)
    ├── .env.test               ← credenciales y entorno                      (gitignored)
    └── app/                    ← lo único versionado en el cliente
```

Los mirrors se **borran y regeneran en cada ejecución**, así que nunca se quedan desfasados y no
hay que mantenerlos. No se editan jamás: cualquier cambio ahí se pierde en el siguiente arranque.

### 3.3 La pieza que hace que encaje: mirrors hermanos

Los specs premium de enterprise importan el harness de core con una ruta relativa. Para que esa
ruta funcione **igual en su repo y dentro de un cliente**, los mirrors se colocan como
**hermanos** bajo `tests/e2e/`:

```
En cornflow_ui_enterprise:            En tendam-frontend:
tests/e2e/premium/core-harness.ts     tests/e2e/.cornflow-enterprise/core-harness.ts
      └─► ../.cornflow-core/fixtures        └─► ../.cornflow-core/fixtures
          (mirror de core)                       (mirror de core)
```

Misma ruta relativa, distinto sitio. Por eso los specs se copian tal cual, sin reescribir ni un
import.

### 3.4 Un solo punto de acoplamiento por repo

Ningún spec menciona nunca la carpeta del mirror. Cada repo tiene un fichero que reexporta el
harness, y los specs importan de ahí:

| Repo | Fichero | Los specs escriben |
|---|---|---|
| enterprise | `tests/e2e/premium/core-harness.ts` | `import { test, expect, TIMEOUTS } from '../core-harness'` |
| cliente | `tests/e2e/app/harness.ts` | `import { test, expect, TIMEOUTS } from '../harness'` |

Si un test necesita un helper de core que no está reexportado, se añade **al harness**, no al
spec. Y si hace falta un helper que core no tiene, se añade a core y se sube el tag.

### 3.5 Autenticación

El proyecto `setup` hace un login real por UI **una sola vez** y guarda cookies + localStorage +
sessionStorage en `tests/e2e/.auth/user.json` del proyecto que se prueba. El resto de proyectos
arrancan ya autenticados (`storageState`), salvo `chromium-auth-tests`, que prueba el login en sí
y corre sin sesión.

Ese fichero se resuelve desde la **raíz del proyecto**, no desde la ubicación de los specs — si
se resolviera relativo al spec, en un cliente caería dentro del mirror, que se borra en cada
ejecución. Se puede forzar otra ruta con `CORNFLOW_E2E_AUTH_FILE`.

La autenticación de test es siempre **usuario/contraseña de cornflow**, nunca SSO: Azure/Cognito
no son fiables en CI.

### 3.6 Qué aporta cada lado

| Lo pone el **paquete** | Lo pone el **proyecto que se prueba** |
|---|---|
| Specs, helpers, fixtures, reporters, auth setup | Dev server, `.env.test`, `.env`, sesión guardada, specs propios |

Los specs de core y enterprise son **agnósticos del schema**: no dan por hecho tablas ni
ejecuciones concretas, se adaptan a lo que haya (`if (count > 0) …`) y solo asertan i18n y
estructura propias de su capa.

---

## 4. Configuración

### 4.1 `playwright.config.mjs` — un fichero por repo

**Core** (`tests/e2e/playwright.config.ts`) usa su propia factory: la suite corre en el sitio.

**Enterprise** (raíz del repo):

```js
import { createCornflowE2EConfig } from './tests/e2e/configFactory.mjs';

export default createCornflowE2EConfig();
```

**Cliente** (raíz del repo):

```js
import { createCornflowE2EConfig } from '@cornflow-ui/enterprise/tests/e2e/configFactory.mjs';

export default createCornflowE2EConfig({
  consumerSpecDir: 'tests/e2e/app',
  premiumModules: [],
});
```

> Un cliente que consuma **solo core** importa
> `@cornflow-ui/core/e2e/configFactory.mjs` y omite `premiumModules`.
>
> La diferencia en la forma del import no es un descuido: core declara `exports` en su
> `package.json` (de ahí el alias corto `/e2e/…`) y enterprise no, así que en enterprise se usa la
> ruta real `/tests/e2e/…`. Enterprise se instala completo, así que la carpeta llega igual.

### 4.2 Opciones de la factory

| Opción | Qué hace | Por defecto |
|---|---|---|
| `consumerSpecDir` | Carpeta con los specs propios del proyecto → proyecto `chromium-app` | ninguna |
| `premiumModules` *(solo la de enterprise)* | Qué módulos premium aplican a esta app | todos |
| `devCommand` | Comando para arrancar la app bajo test | `npm run dev -- --port 3000` |
| `baseURL` | URL de la app | `PLAYWRIGHT_BASE_URL` o `http://localhost:3000` |
| `consumerDir` | Raíz del proyecto | `process.cwd()` |
| `layers` | Capas adicionales (uso avanzado; enterprise ya inyecta la suya) | — |
| `overrides` | Cualquier ajuste extra de Playwright | — |

**`premiumModules` en detalle** — no todos los clientes activan todos los módulos premium:

| Valor | Efecto |
|---|---|
| omitido | Corre **todos** los módulos que enterprise publique |
| `['latest-plan', 'etl']` | Corre **solo** esos |
| `[]` | La capa premium **se salta entera** |

Debe reflejar lo que la app tiene activado en `src/app/config.ts`. Ejemplo real: Tendam tiene
`latestPlanConfig.enableLatestPlan = false`, así que hoy lleva `[]`; usa ETL, y cuando enterprise
publique specs de ETL pasará a `['etl']`.

### 4.3 `.env.test`

Va en `tests/e2e/.env.test` del proyecto que se prueba (**gitignored**; hay un `.env.test.example`
en cada repo para copiar):

```env
PLAYWRIGHT_TEST_USER=usuario
PLAYWRIGHT_TEST_PASSWORD=contraseña
PLAYWRIGHT_AUTH_TYPE=cornflow
PLAYWRIGHT_BASE_URL=http://localhost:3000

VITE_APP_BACKEND_URL=https://entorno.pre.cornflow.com
VITE_APP_SCHEMA=mi_schema
```

⚠️ **No definas `PLAYWRIGHT_TEST_TEMP_PASSWORD`** contra una cuenta compartida: activa los tests
de cambio de contraseña, que mutan la cuenta y dejan a todo el mundo fuera.

### 4.4 `.gitignore`

```gitignore
tests/e2e/.auth/
tests/e2e/.env.test
tests/e2e/.cornflow-core/
tests/e2e/.cornflow-enterprise/
playwright-report/
test-results/
```

### 4.5 Scripts de npm

```json
"test:e2e":        "playwright test",
"test:e2e:app":    "playwright test --project=chromium-app",
"test:e2e:headed": "playwright test --headed",
"test:e2e:ui":     "playwright test --ui",
"test:e2e:debug":  "playwright test --debug",
"test:e2e:sync":   "playwright test --list"
```

### 4.6 Alta de un cliente nuevo, de cero

```bash
npm install -D @playwright/test
npx playwright install chromium
```

1. `playwright.config.mjs` en la raíz (§4.1).
2. `tests/e2e/app/harness.ts` reexportando el harness (§3.4).
3. `cp tests/e2e/.env.test.example tests/e2e/.env.test` y rellenar.
4. Añadir las entradas de `.gitignore` y los scripts.
5. `npm run test:e2e:sync` → genera los mirrors y lista los tests. Si aparecen, está montado.

---

## 5. Cómo se lanzan

```bash
npm run test:e2e                      # todas las capas que apliquen
npm run test:e2e -- --list            # qué se ejecutaría, sin ejecutarlo
npm run test:e2e:headed               # con navegador visible
npm run test:e2e:ui                   # modo UI de Playwright (el mejor para depurar)
npm run test:e2e:debug                # paso a paso con el inspector
```

**Por capa:**

```bash
npx playwright test --project=chromium              # solo core (sin los de login)
npx playwright test --project=chromium-auth-tests   # solo login/logout
npx playwright test --project=chromium-enterprise   # solo módulos premium
npx playwright test --project=chromium-app          # solo los specs de esta app
```

**Por fichero o por nombre:**

```bash
npx playwright test tests/e2e/app/dashboard          # una carpeta
npx playwright test -g "download Excel"              # por nombre de test
npx playwright test --grep-invert "current plan"     # excluyendo
```

**Excluir lo que muta estado compartido** (útil contra un entorno vivo):

```bash
npx playwright test --grep-invert "current plan|change password|restore original password|delete execution"
```

### Resultados

Cada ejecución genera `playwright-report/corporate-report.html` (informe con marca) además del
report HTML estándar de Playwright. Core tiene también envío por email
(`npm run test:e2e:send-report`, SMTP vía Nodemailer); en los demás repos requiere añadir
`nodemailer` y `tsx`.

---

## 6. Actualizar los tests heredados

**Es un cambio de tag, nada más.** No se copia ni se re-adapta nada:

```jsonc
// package.json del cliente
"@cornflow-ui/core":       "git+https://github.com/baobabsoluciones/cornflow-ui.git#v3.2.4",
"@cornflow-ui/enterprise": "git+https://github.com/baobabsoluciones/cornflow_ui_enterprise.git#v2.4.1"
```

```bash
npm install
npm run test:e2e:sync   # regenera los mirrors con la versión nueva
```

Si un test de core empieza a fallar en un cliente, hay dos lecturas posibles y conviene
distinguirlas antes de tocar nada: o el cliente ha roto un comportamiento genérico (arréglalo en
el cliente), o el spec de core daba por hecho algo que no es universal (arréglalo **en core**, y
todos se benefician).

---

## 7. Reglas de convivencia

- **No edites nunca** `.cornflow-core/` ni `.cornflow-enterprise/`: se borran en cada ejecución.
- **No copies** specs de una capa a otra. Si lo necesitas en dos sitios, va en la capa de abajo.
- **No importes** desde `@cornflow-ui/*` en un spec: los `.ts` de `node_modules` no se pueden
  cargar. Siempre a través del harness del repo.
- **Cuidado con los tests que mutan**: marcar plan actual, cambiar contraseña y borrar ejecución
  alteran estado compartido y no se deshacen. Contra entornos vivos, exclúyelos.
- Los specs de core y enterprise **no pueden asumir un schema**. Si un test necesita una tabla
  concreta, pertenece a la capa de la app.

---

## 8. Problemas típicos

| Síntoma | Causa | Solución |
|---|---|---|
| `Stripping types is currently unsupported for files under node_modules` / **0 tests** | Se está apuntando a los `.ts` dentro de `node_modules` | Usar la factory; es justo lo que evita |
| El editor marca en rojo los imports del harness | El mirror aún no existe | `npm run test:e2e:sync` una vez |
| Los tests corren contra el backend equivocado | Vite **no lee** `.env.test`: la app coge su config del `.env` de la raíz | Alinear ambos ficheros |
| Cambio la config y no surte efecto | `reuseExistingServer` reutilizó un dev server viejo en :3000 | Matar el dev server anterior |
| El proyecto autenticado falla al arrancar | No hay `.auth/user.json`: el `setup` no llegó a pasar | Mirar el fallo del proyecto `setup` (credenciales/backend) |
| Un módulo premium falla entero | La app no lo tiene activado en `src/app/config.ts` | Quitarlo de `premiumModules` |
| Descargas de Excel intermitentes | Carga en frío lenta y filas en estado *Error* que no generan `.xlsx` | Ya mitigado (elige fila exitosa + retries); si reaparece, subir timeout |

---

## 9. Estado a 10-08-2026

| Pieza | Estado |
|---|---|
| Suite de core (60 tests) | ✅ Verde contra south_handling pre |
| Harness reutilizable + capas | ✅ En `cornflow-ui`, rama `feature/e2e-tests` (pusheada) |
| PR de core | ⏳ Pendiente de abrir |
| Módulo premium *latest-plan* (8 tests) | ✅ Portado a enterprise, rama `feature/e2e-tests` (sin pushear) |
| Andamiaje de Tendam (2 tests propios) | ✅ Rama `feature/e2e-tests` (sin pushear) |
| Ejecución real de enterprise / Tendam | ❌ Falta entorno con premium **y** un tag de core que incluya el harness |
| Módulos premium restantes | ❌ agent, recalculation, ETL, master-table-match |
| E2E legado de enterprise | ⚠️ Sigue en `tests/e2e/{playwright.config.ts,helpers,specs/auth}`, accesible por `test:e2e:legacy`; borrar cuando el montaje nuevo corra verde |
| CI | ❌ Sin pipeline; hoy se lanza en local |

**Camino crítico para poder ejecutar en cliente:** mergear el PR de core → tag `v3.2.4` → bump en
enterprise → tag de enterprise → bump en el cliente. Hasta entonces, los repos de arriba solo se
pueden verificar montando el harness a mano en `node_modules`.
