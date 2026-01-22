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
# Estas se pasan automáticamente al servidor de desarrollo durante los tests
VITE_APP_API_URL=http://localhost:5000
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

## Estructura de archivos

```
tests/e2e/
├── README.md                    # Este archivo
├── playwright.config.ts         # Configuración de Playwright
├── .env.test                    # Variables de entorno (no se sube al repo)
├── helpers/                     # Helpers y utilidades
│   ├── auth/                    # Helpers de autenticación
│   │   ├── cornflowAuth.ts     # Autenticación con usuario/contraseña
│   │   └── index.ts            # Factory de autenticación
│   ├── constants.ts             # Constantes y selectores
│   ├── errorDetection.ts        # Detección de errores en la UI
│   ├── sessionStorageHelpers.ts # Helpers para sessionStorage
│   └── urlHelpers.ts            # Helpers para URLs y rutas
└── specs/                       # Tests E2E
    ├── auth/
    │   └── login.spec.ts        # Tests de autenticación
    └── example.spec.ts          # Test de ejemplo
```

## Reportes

Después de ejecutar los tests, se generan los siguientes archivos:

- **`playwright-report/index.html`**: Reporte HTML interactivo con resultados, screenshots y videos de los tests fallidos
- **`test-results/`**: Carpeta con resultados detallados de cada ejecución (screenshots, videos, traces)

Estos archivos están en `.gitignore` y no se suben al repositorio.

Para ver el reporte HTML:
```bash
npx playwright show-report
```

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

- Los tests se ejecutan en paralelo por defecto
- En CI, el número de workers se limita a 2 para evitar sobrecarga
- Puedes ajustar `workers` en `playwright.config.ts` si es necesario

### Problemas con selectores

- Usa `npm run test:e2e:debug` para inspeccionar la página en tiempo real
- Usa `npm run test:e2e:ui` para ver la ejecución paso a paso
- Revisa los screenshots en `test-results/` para ver el estado de la página cuando falla un test

## Más información

- [Documentación de Playwright](https://playwright.dev/)
- [Guía de mejores prácticas de Playwright](https://playwright.dev/docs/best-practices)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
